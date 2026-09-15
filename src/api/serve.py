"""
ChainRescue — ML Inference API
================================
Serves the two trained models over HTTP using FastAPI + Uvicorn.

Endpoints
---------
  POST /api/predict-disruption    → XGBoost disruption-risk classifier
  POST /api/evaluate-coldchain    → Random Forest cold-chain severity classifier
  GET  /api/health                → liveness probe

Run (from project root)
-----------------------
  uvicorn src.api.serve:app --reload --host 0.0.0.0 --port 8000

The Vite/React frontend on http://localhost:5173 is covered by the
allow_origins=["*"] CORS middleware so no proxy config is needed during dev.
"""

from __future__ import annotations

import pickle
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Paths ──────────────────────────────────────────────────────────────────────
# Resolve relative to this file so the server works regardless of cwd.
_API_DIR = Path(__file__).parent
_MODELS_DIR = _API_DIR.parent / "models"
DISRUPTION_MODEL_PATH = _MODELS_DIR / "disruption_model.pkl"
COLDCHAIN_MODEL_PATH = _MODELS_DIR / "coldchain_model.pkl"


# ── In-process model store ─────────────────────────────────────────────────────
# Populated once at startup; avoids re-loading pickle on every request.
_models: dict[str, Any] = {}


def _load_model(key: str, path: Path) -> None:
    """Load a pickle file into _models[key]. Raises on missing file."""
    if not path.exists():
        print(
            f"[serve.py] WARNING: {path} not found. "
            "Run `python src/models/train.py` first to generate model files.",
            file=sys.stderr,
        )
        _models[key] = None
        return
    with open(path, "rb") as fh:
        _models[key] = pickle.load(fh)
    print(f"[serve.py] ✔  Loaded {key} from {path}")


# ── Lifespan: load models once on startup ────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan context — runs before first request, cleans up on shutdown."""
    _load_model("disruption", DISRUPTION_MODEL_PATH)
    _load_model("coldchain", COLDCHAIN_MODEL_PATH)
    yield
    _models.clear()


# ── App ────────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="ChainRescue ML API",
    description=(
        "Real-time supply-chain disruption risk scoring and cold-chain "
        "regulatory severity classification."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
# allow_origins=["*"] lets the Vite dev server (port 5173) and any other
# origin reach this API without a proxy.  Tighten in production.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,   # must be False when allow_origins=["*"]
    allow_methods=["*"],
    allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════════════════
# REQUEST / RESPONSE SCHEMAS
# ══════════════════════════════════════════════════════════════════════════════

class DisruptionRequest(BaseModel):
    """
    Input for POST /api/predict-disruption.

    Required fields map directly to the XGBoost feature vector.
    Optional fields default to safe/neutral values so callers only need to
    provide the three most observable signals (delay, weather, value).
    """
    route_delay_hours: float = Field(
        ..., ge=0, le=720,
        description="Actual delay vs scheduled ETA, in hours (0–720).",
        examples=[22.0],
    )
    weather_severity: int = Field(
        ..., ge=1, le=5,
        description="Weather severity score on a 1 (calm) – 5 (extreme) scale.",
        examples=[4],
    )
    shipment_value_usd: float = Field(
        ..., ge=0,
        description="Declared cargo value in USD.",
        examples=[85000.0],
    )
    # Optional — default to neutral values when not available at call time
    temp_excursion_hours: float = Field(
        default=0.0, ge=0, le=24,
        description="Hours cargo spent outside the safe temperature band.",
    )
    peak_sensor_temp_c: float = Field(
        default=4.0, ge=-30, le=60,
        description="Highest sensor temperature recorded during transit (°C).",
    )
    idle_fleet_hours: float = Field(
        default=0.0, ge=0, le=168,
        description="Cumulative vehicle idle time in hours.",
    )


class DisruptionResponse(BaseModel):
    risk: str                        # "High" | "Low"
    probability_high: float          # 0.0 – 1.0
    reroute_suggested: bool
    message: str


class ColdChainRequest(BaseModel):
    """
    Input for POST /api/evaluate-coldchain.

    Required: the two primary sensor signals.
    Optional: derived statistics that improve accuracy when available.
    """
    peak_sensor_temp_c: float = Field(
        ..., ge=-30, le=60,
        description="Maximum temperature recorded by sensors during transit (°C).",
        examples=[11.2],
    )
    temp_excursion_hours: float = Field(
        ..., ge=0, le=24,
        description="Total hours cargo was outside the safe temperature band.",
        examples=[6.0],
    )
    # Optional derived features — model handles defaults gracefully
    temp_variance: float = Field(
        default=1.0, ge=0,
        description="Standard deviation of all sensor readings.",
    )
    excursion_rate: float = Field(
        default=None,   # type: ignore[assignment]
        ge=0.0, le=1.0,
        description=(
            "Fraction of sensor readings outside safe band (0–1). "
            "Computed from temp_excursion_hours/24 when omitted."
        ),
    )
    recovery_time_hours: float = Field(
        default=0.0, ge=0, le=72,
        description="Hours taken to return inside safe band after a breach.",
    )

    def model_post_init(self, __context: Any) -> None:  # noqa: ANN401
        """Derive excursion_rate if caller did not supply it."""
        if self.excursion_rate is None:
            object.__setattr__(
                self, "excursion_rate",
                round(min(self.temp_excursion_hours / 24.0, 1.0), 4),
            )


class ColdChainResponse(BaseModel):
    severity: str                          # "Normal" | "Warning" | "Critical Violation"
    probabilities: dict[str, float]        # {"Normal": p, "Warning": p, "Critical Violation": p}
    regulatory_action: str
    message: str


# ── Severity → regulatory action lookup ───────────────────────────────────────
_REGULATORY_ACTIONS: dict[str, str] = {
    "Normal": "No action required. Cargo within regulatory limits.",
    "Warning": (
        "Issue carrier alert. Inspect refrigeration unit at next waypoint. "
        "Document breach for regulatory audit trail."
    ),
    "Critical Violation": (
        "STOP shipment. Mandatory quality inspection required. "
        "Notify regulatory authority. Initiate emergency cargo transfer or disposal."
    ),
}


# ══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/health", tags=["Health"])
def health_check():
    """Liveness probe — returns model load status."""
    return {
        "status": "ok",
        "models": {
            "disruption": _models.get("disruption") is not None,
            "coldchain": _models.get("coldchain") is not None,
        },
    }


@app.post("/api/predict-disruption", response_model=DisruptionResponse, tags=["Disruption"])
def predict_disruption(body: DisruptionRequest):
    """
    Classify route disruption risk using the XGBoost model.

    Returns **High** or **Low** risk with a re-routing recommendation when
    the predicted probability of disruption is ≥ 0.50.
    """
    artifact = _models.get("disruption")
    if artifact is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "disruption_model.pkl is not loaded. "
                "Run `python src/models/train.py` and restart the server."
            ),
        )

    clf = artifact["model"]
    feature_cols = artifact["feature_cols"]

    row = pd.DataFrame([[
        body.route_delay_hours,
        body.weather_severity,
        body.temp_excursion_hours,
        body.peak_sensor_temp_c,
        body.shipment_value_usd,
        body.idle_fleet_hours,
    ]], columns=feature_cols)

    prob_high = float(clf.predict_proba(row)[0][1])
    risk = "High" if prob_high >= 0.5 else "Low"
    reroute = risk == "High"

    message = (
        f"High disruption probability ({prob_high:.0%}). Automated re-routing recommended."
        if reroute
        else f"Low disruption probability ({prob_high:.0%}). No intervention required."
    )

    return DisruptionResponse(
        risk=risk,
        probability_high=round(prob_high, 4),
        reroute_suggested=reroute,
        message=message,
    )


@app.post("/api/evaluate-coldchain", response_model=ColdChainResponse, tags=["Cold Chain"])
def evaluate_coldchain(body: ColdChainRequest):
    """
    Classify cold-chain regulatory severity using the Random Forest model.

    Returns one of **Normal**, **Warning**, or **Critical Violation** with
    the corresponding regulatory action and per-class probabilities.
    """
    artifact = _models.get("coldchain")
    if artifact is None:
        raise HTTPException(
            status_code=503,
            detail=(
                "coldchain_model.pkl is not loaded. "
                "Run `python src/models/train.py` and restart the server."
            ),
        )

    clf = artifact["model"]
    le = artifact["label_encoder"]
    feature_cols = artifact["feature_cols"]

    row = pd.DataFrame([[
        body.temp_excursion_hours,
        body.peak_sensor_temp_c,
        body.temp_variance,
        body.excursion_rate,
        body.recovery_time_hours,
    ]], columns=feature_cols)

    proba = clf.predict_proba(row)[0]
    predicted_idx = int(proba.argmax())
    severity: str = le.inverse_transform([predicted_idx])[0]
    prob_map = {cls: round(float(p), 4) for cls, p in zip(le.classes_, proba)}

    regulatory_action = _REGULATORY_ACTIONS.get(severity, "Consult compliance officer.")
    message = f"Cold-chain evaluation complete. Regulatory status: {severity}."

    return ColdChainResponse(
        severity=severity,
        probabilities=prob_map,
        regulatory_action=regulatory_action,
        message=message,
    )
