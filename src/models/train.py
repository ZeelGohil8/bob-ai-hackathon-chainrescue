"""
ChainRescue — ML Model Training Script
========================================
Problem L2: Supply Chain Disruption Risk & Cold-Chain Compliance

Models trained
--------------
1. disruption_model.pkl  — XGBoost binary classifier
   Input features : route_delay_hours, weather_severity, temp_excursion_hours,
                    peak_sensor_temp_c, shipment_value_usd, idle_fleet_hours
   Target         : risk_label  (0 = Low, 1 = High)
   Output         : saved to src/models/disruption_model.pkl
   Also saves     : src/models/disruption_model_metadata.json

2. coldchain_model.pkl  — Random Forest multi-class classifier
   Input features : temp_excursion_hours, peak_sensor_temp_c,
                    temp_variance, excursion_rate, recovery_time_hours
   Target         : severity_label  ('Normal', 'Warning', 'Critical Violation')
   Output         : saved to src/models/coldchain_model.pkl
   Also saves     : src/models/coldchain_model_metadata.json

Usage
-----
  pip install numpy pandas scikit-learn xgboost
  python src/models/train.py

Both model files are written to the directory containing this script.
"""

import json
import os
import pickle
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import classification_report, confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from xgboost import XGBClassifier

# ── Paths ─────────────────────────────────────────────────────────────────────
MODELS_DIR = Path(__file__).parent
DISRUPTION_MODEL_PATH = MODELS_DIR / "disruption_model.pkl"
COLDCHAIN_MODEL_PATH = MODELS_DIR / "coldchain_model.pkl"
DISRUPTION_META_PATH = MODELS_DIR / "disruption_model_metadata.json"
COLDCHAIN_META_PATH = MODELS_DIR / "coldchain_model_metadata.json"

# ── Reproducibility ───────────────────────────────────────────────────────────
RANDOM_SEED = 42
N_SAMPLES = 2_000  # mock dataset size


# ══════════════════════════════════════════════════════════════════════════════
# 1. MOCK DATA GENERATION
# ══════════════════════════════════════════════════════════════════════════════

def generate_disruption_data(n: int, seed: int) -> pd.DataFrame:
    """
    Generate synthetic supply chain records for disruption risk modelling.

    Feature distributions are designed to mimic realistic supply chain
    conditions:
      - route_delay_hours      : 0–72 h  (log-normal; most shipments arrive
                                           within 12 h of schedule)
      - weather_severity       : 1–5 ordinal scale (skewed toward 1–2)
      - temp_excursion_hours   : 0–24 h  (zero-inflated; ~60 % have no breach)
      - peak_sensor_temp_c     : 0–15 °C (safe cold-chain max is 8 °C for
                                           many pharmaceuticals/perishables)
      - shipment_value_usd     : $1 000–$500 000 (log-normal)
      - idle_fleet_hours       : 0–48 h

    Label rule (deterministic w/ noise):
      High risk (1) when ≥ 2 of the following thresholds are exceeded:
        - route_delay_hours > 18
        - weather_severity  >= 4
        - temp_excursion_hours > 6
        - peak_sensor_temp_c > 8
        - idle_fleet_hours > 24
    """
    rng = np.random.default_rng(seed)

    route_delay_hours = np.clip(
        rng.lognormal(mean=1.8, sigma=1.1, size=n), 0, 72
    ).round(1)

    weather_severity = rng.choice(
        [1, 2, 3, 4, 5], size=n, p=[0.35, 0.30, 0.20, 0.10, 0.05]
    )

    # Zero-inflated: 60 % of shipments have no temperature excursion
    excursion_mask = rng.random(n) > 0.60
    temp_excursion_hours = np.where(
        excursion_mask,
        np.clip(rng.exponential(scale=4.0, size=n), 0.1, 24),
        0.0,
    ).round(2)

    # Peak sensor temp: safe range 2–8 °C; breaches can spike to ~15 °C
    peak_sensor_temp_c = np.clip(
        rng.normal(loc=5.5, scale=2.8, size=n), 0.0, 15.0
    ).round(2)

    shipment_value_usd = np.clip(
        rng.lognormal(mean=10.5, sigma=1.2, size=n), 1_000, 500_000
    ).round(2)

    idle_fleet_hours = np.clip(
        rng.exponential(scale=8.0, size=n), 0, 48
    ).round(1)

    # ── Label generation ──────────────────────────────────────────────────────
    risk_flags = (
        (route_delay_hours > 18).astype(int)
        + (weather_severity >= 4).astype(int)
        + (temp_excursion_hours > 6).astype(int)
        + (peak_sensor_temp_c > 8).astype(int)
        + (idle_fleet_hours > 24).astype(int)
    )
    # Add label noise (~5 %) to prevent overfitting to the deterministic rule
    noise_mask = rng.random(n) < 0.05
    base_label = (risk_flags >= 2).astype(int)
    risk_label = np.where(noise_mask, 1 - base_label, base_label)

    return pd.DataFrame({
        "route_delay_hours": route_delay_hours,
        "weather_severity": weather_severity,
        "temp_excursion_hours": temp_excursion_hours,
        "peak_sensor_temp_c": peak_sensor_temp_c,
        "shipment_value_usd": shipment_value_usd,
        "idle_fleet_hours": idle_fleet_hours,
        "risk_label": risk_label,
    })


def generate_coldchain_data(n: int, seed: int) -> pd.DataFrame:
    """
    Generate synthetic temperature sensor logs for cold-chain compliance
    classification.

    Features:
      - temp_excursion_hours  : total hours outside safe band
      - peak_sensor_temp_c    : maximum recorded temperature
      - temp_variance         : std-dev of sensor readings (°C)
      - excursion_rate        : fraction of readings outside safe band (0–1)
      - recovery_time_hours   : time to return inside safe band after breach

    Label rule:
      'Normal'             : excursion_hours == 0  AND  peak ≤ 8 °C
      'Warning'            : 0 < excursion_hours ≤ 4  OR  8 < peak ≤ 10 °C
      'Critical Violation' : excursion_hours > 4   OR  peak > 10 °C
    """
    rng = np.random.default_rng(seed + 1)

    temp_excursion_hours = np.where(
        rng.random(n) > 0.55,
        np.clip(rng.exponential(scale=3.5, size=n), 0.1, 24),
        0.0,
    ).round(2)

    peak_sensor_temp_c = np.clip(
        rng.normal(loc=6.0, scale=2.5, size=n), 0.0, 15.0
    ).round(2)

    # Variance correlates with excursion: longer breaches → higher spread
    temp_variance = np.clip(
        0.5 + 0.3 * temp_excursion_hours + rng.normal(0, 0.4, n), 0.05, 5.0
    ).round(3)

    excursion_rate = np.clip(
        temp_excursion_hours / 24.0 + rng.normal(0, 0.02, n), 0.0, 1.0
    ).round(4)

    recovery_time_hours = np.where(
        temp_excursion_hours > 0,
        np.clip(temp_excursion_hours * rng.uniform(0.5, 2.0, n), 0.1, 48),
        0.0,
    ).round(2)

    # ── Label generation ──────────────────────────────────────────────────────
    def classify(exc_h, peak):
        if exc_h == 0 and peak <= 8.0:
            return "Normal"
        elif exc_h <= 4.0 or peak <= 10.0:
            return "Warning"
        else:
            return "Critical Violation"

    severity_label = np.array([
        classify(e, p) for e, p in zip(temp_excursion_hours, peak_sensor_temp_c)
    ])

    return pd.DataFrame({
        "temp_excursion_hours": temp_excursion_hours,
        "peak_sensor_temp_c": peak_sensor_temp_c,
        "temp_variance": temp_variance,
        "excursion_rate": excursion_rate,
        "recovery_time_hours": recovery_time_hours,
        "severity_label": severity_label,
    })


# ══════════════════════════════════════════════════════════════════════════════
# 2. MODEL TRAINING
# ══════════════════════════════════════════════════════════════════════════════

def train_disruption_model(df: pd.DataFrame) -> dict:
    """Train XGBoost binary classifier for route disruption risk."""
    feature_cols = [
        "route_delay_hours", "weather_severity", "temp_excursion_hours",
        "peak_sensor_temp_c", "shipment_value_usd", "idle_fleet_hours",
    ]
    X = df[feature_cols]
    y = df["risk_label"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED, stratify=y
    )

    model = XGBClassifier(
        n_estimators=200,
        max_depth=5,
        learning_rate=0.08,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=RANDOM_SEED,
        verbosity=0,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    report = classification_report(y_test, y_pred, target_names=["Low Risk", "High Risk"])
    cm = confusion_matrix(y_test, y_pred).tolist()

    # Feature importances
    importances = dict(zip(feature_cols, model.feature_importances_.round(4).tolist()))

    print("\n── Disruption Model (XGBoost) ────────────────────────────")
    print(report)
    print(f"   Confusion matrix: {cm}")
    print(f"   Feature importances: {importances}")

    return {
        "model": model,
        "feature_cols": feature_cols,
        "importances": importances,
        "classification_report": report,
        "confusion_matrix": cm,
    }


def train_coldchain_model(df: pd.DataFrame) -> dict:
    """Train Random Forest multi-class classifier for cold-chain severity."""
    feature_cols = [
        "temp_excursion_hours", "peak_sensor_temp_c",
        "temp_variance", "excursion_rate", "recovery_time_hours",
    ]
    CLASS_ORDER = ["Normal", "Warning", "Critical Violation"]

    le = LabelEncoder()
    le.fit(CLASS_ORDER)

    X = df[feature_cols]
    y = le.transform(df["severity_label"])

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.20, random_state=RANDOM_SEED, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=8,
        min_samples_leaf=5,
        class_weight="balanced",
        random_state=RANDOM_SEED,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)
    report = classification_report(
        y_test, y_pred, target_names=le.classes_, zero_division=0
    )
    cm = confusion_matrix(y_test, y_pred).tolist()
    importances = dict(zip(feature_cols, model.feature_importances_.round(4).tolist()))

    print("\n── Cold-Chain Model (Random Forest) ──────────────────────")
    print(report)
    print(f"   Confusion matrix: {cm}")
    print(f"   Feature importances: {importances}")

    return {
        "model": model,
        "label_encoder": le,
        "feature_cols": feature_cols,
        "classes": le.classes_.tolist(),
        "importances": importances,
        "classification_report": report,
        "confusion_matrix": cm,
    }


# ══════════════════════════════════════════════════════════════════════════════
# 3. SAVE ARTIFACTS
# ══════════════════════════════════════════════════════════════════════════════

def save_model(obj: object, path: Path, label: str) -> None:
    """Pickle a model object and print confirmation."""
    with open(path, "wb") as fh:
        pickle.dump(obj, fh, protocol=pickle.HIGHEST_PROTOCOL)
    size_kb = path.stat().st_size / 1024
    print(f"   ✔  Saved {label:30s} → {path}  ({size_kb:.1f} KB)")


def save_metadata(meta: dict, path: Path) -> None:
    """Write human-readable JSON metadata alongside the pickle."""
    # Remove non-serialisable model objects before dumping
    safe = {k: v for k, v in meta.items() if k not in ("model", "label_encoder")}
    safe["trained_at"] = datetime.utcnow().isoformat() + "Z"
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(safe, fh, indent=2)


# ══════════════════════════════════════════════════════════════════════════════
# 4. INFERENCE HELPERS  (importable by the backend / CLI)
# ══════════════════════════════════════════════════════════════════════════════

def predict_disruption_risk(
    route_delay_hours: float,
    weather_severity: int,
    temp_excursion_hours: float,
    peak_sensor_temp_c: float,
    shipment_value_usd: float,
    idle_fleet_hours: float,
    model_path: Path = DISRUPTION_MODEL_PATH,
) -> dict:
    """
    Load disruption_model.pkl and return a risk prediction.

    Returns
    -------
    {
        "risk": "High" | "Low",
        "probability_high": float,   # 0–1
        "reroute_suggested": bool,
    }
    """
    with open(model_path, "rb") as fh:
        result = pickle.load(fh)
    clf = result["model"]
    feature_cols = result["feature_cols"]

    row = pd.DataFrame([[
        route_delay_hours, weather_severity, temp_excursion_hours,
        peak_sensor_temp_c, shipment_value_usd, idle_fleet_hours,
    ]], columns=feature_cols)

    prob_high = float(clf.predict_proba(row)[0][1])
    risk = "High" if prob_high >= 0.5 else "Low"
    return {
        "risk": risk,
        "probability_high": round(prob_high, 4),
        "reroute_suggested": risk == "High",
    }


def predict_coldchain_severity(
    temp_excursion_hours: float,
    peak_sensor_temp_c: float,
    temp_variance: float,
    excursion_rate: float,
    recovery_time_hours: float,
    model_path: Path = COLDCHAIN_MODEL_PATH,
) -> dict:
    """
    Load coldchain_model.pkl and return a regulatory severity prediction.

    Returns
    -------
    {
        "severity": "Normal" | "Warning" | "Critical Violation",
        "probabilities": {"Normal": float, "Warning": float, "Critical Violation": float},
    }
    """
    with open(model_path, "rb") as fh:
        result = pickle.load(fh)
    clf = result["model"]
    le: LabelEncoder = result["label_encoder"]
    feature_cols = result["feature_cols"]

    row = pd.DataFrame([[
        temp_excursion_hours, peak_sensor_temp_c,
        temp_variance, excursion_rate, recovery_time_hours,
    ]], columns=feature_cols)

    proba = clf.predict_proba(row)[0]
    predicted_idx = int(proba.argmax())
    severity = le.inverse_transform([predicted_idx])[0]
    prob_map = {cls: round(float(p), 4) for cls, p in zip(le.classes_, proba)}

    return {"severity": severity, "probabilities": prob_map}


# ══════════════════════════════════════════════════════════════════════════════
# 5. MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main() -> None:
    print("═" * 60)
    print(" ChainRescue — ML Training Pipeline")
    print(f" {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
    print("═" * 60)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    # ── Disruption model ──────────────────────────────────────────────────────
    print(f"\n[1/4] Generating {N_SAMPLES:,} disruption samples…")
    disruption_df = generate_disruption_data(N_SAMPLES, RANDOM_SEED)
    label_counts = disruption_df["risk_label"].value_counts().to_dict()
    print(f"      Label distribution — Low: {label_counts.get(0,0)}, High: {label_counts.get(1,0)}")

    print("[2/4] Training XGBoost disruption model…")
    disruption_result = train_disruption_model(disruption_df)
    save_model(
        {"model": disruption_result["model"], "feature_cols": disruption_result["feature_cols"]},
        DISRUPTION_MODEL_PATH,
        "disruption_model.pkl",
    )
    save_metadata(disruption_result, DISRUPTION_META_PATH)

    # ── Cold-chain model ──────────────────────────────────────────────────────
    print(f"\n[3/4] Generating {N_SAMPLES:,} cold-chain sensor samples…")
    coldchain_df = generate_coldchain_data(N_SAMPLES, RANDOM_SEED)
    sev_counts = coldchain_df["severity_label"].value_counts().to_dict()
    print(f"      Label distribution — Normal: {sev_counts.get('Normal',0)}, "
          f"Warning: {sev_counts.get('Warning',0)}, "
          f"Critical Violation: {sev_counts.get('Critical Violation',0)}")

    print("[4/4] Training Random Forest cold-chain model…")
    coldchain_result = train_coldchain_model(coldchain_df)
    save_model(
        {
            "model": coldchain_result["model"],
            "label_encoder": coldchain_result["label_encoder"],
            "feature_cols": coldchain_result["feature_cols"],
        },
        COLDCHAIN_MODEL_PATH,
        "coldchain_model.pkl",
    )
    save_metadata(coldchain_result, COLDCHAIN_META_PATH)

    # ── Quick self-test ───────────────────────────────────────────────────────
    print("\n── Self-test: sample inference ───────────────────────────")
    d = predict_disruption_risk(
        route_delay_hours=22, weather_severity=4,
        temp_excursion_hours=8, peak_sensor_temp_c=9.5,
        shipment_value_usd=85_000, idle_fleet_hours=30,
    )
    print(f"   Disruption risk  → {d['risk']} (p_high={d['probability_high']}, "
          f"reroute={d['reroute_suggested']})")

    c = predict_coldchain_severity(
        temp_excursion_hours=6, peak_sensor_temp_c=11.2,
        temp_variance=1.8, excursion_rate=0.25, recovery_time_hours=3,
    )
    print(f"   Cold-chain sev.  → {c['severity']}  probs={c['probabilities']}")

    print("\n" + "═" * 60)
    print(" Training complete. Artifacts written to src/models/")
    print("═" * 60 + "\n")


if __name__ == "__main__":
    main()
