# Source Code

Place all your project's source code in this folder.

## Structure Guidelines

Organize your code logically. Here are common patterns — use whatever fits
your project:

### Web Application
```
src/
  backend/        ← API server code
  frontend/       ← UI code
  shared/         ← Shared utilities/types
```

### Data / AI Project
```
src/
  data/           ← Data ingestion / preprocessing
  models/         ← ML model code
  api/            ← Serving layer
  notebooks/      ← Jupyter notebooks (exploration)
```

### CLI / Script-based Tool

The ChainRescue CLI detects cold-chain temperature breaches and simulates
automated re-routing of disrupted shipments — no running server required.

#### Directory structure

```
src/
  cli/
    index.js      ← CLI entry point — parses commands and renders output
  lib/
    simulator.js  ← Core logic: breach detection, re-routing, fleet matching
  utils/
    logger.js     ← Color-coded ANSI terminal alerts (no external deps)
  package.json    ← CLI package manifest
```

#### Core features

| Feature | Description |
|---|---|
| **Breach detection** | Flags cold-chain / perishable shipments whose cargo temperature exceeds the safe threshold (`thresholdMax + 2 °C` triggers `critical`; any exceedance triggers `high`) |
| **Weather disruption** | Simulates a severe weather event along a shipment's route and produces a full re-routing plan |
| **Re-routing simulation** | Computes an alternate waypoint corridor, calculates the extra distance (km) and estimated delay (hours) at 40 km/h average speed |
| **Fleet matching** | Identifies the nearest available vehicle; enforces refrigerated-truck assignment for cold-chain cargo |
| **Full simulation** | `simulate` command combines all of the above into a single enriched output |
| **Color-coded alerts** | ANSI severity badges — 🚨 red for critical, ⚠ yellow for high, blue for medium, green for low / success |

#### Supported breach types

| Value | Triggers |
|---|---|
| `temperature` | Cold-chain / perishable threshold breach detection |
| `weather` | Typhoon / storm corridor advisory |
| `port_congestion` | Destination-port congestion advisory |

#### Execution commands

```bash
# Show help
node src/cli/index.js --help

# Simulate a breach and display re-routing options
node src/cli/index.js simulate <shipmentId> <breachType>

# Examples
node src/cli/index.js simulate SHP-001 temperature
node src/cli/index.js simulate SHP-002 weather
node src/cli/index.js simulate SHP-003 temperature

# Scan all shipments for active temperature breaches
node src/cli/index.js scan-breaches

# Compute and display a re-route plan without a full simulation
node src/cli/index.js reroute <shipmentId> <breachType>
node src/cli/index.js reroute SHP-003 temperature

# List all tracked shipments with status and temperature readings
node src/cli/index.js list-shipments
```

> **No `npm install` needed.** `src/utils/logger.js` uses only ANSI escape
> codes, and `src/lib/simulator.js` is self-contained. The CLI runs with
> any Node.js ≥ 18.

#### npm convenience scripts (from `src/`)

```bash
cd src
npm run scan                        # scan-breaches
npm run list                        # list-shipments
npm run simulate -- SHP-001 temperature
```

---

### Data / AI — ML Models (`src/models/`)

The models directory contains a fully self-contained training pipeline that
produces two `scikit-learn`-compatible pickle files.

#### Directory structure

```
src/models/
  train.py                          ← Training + inference helpers
  requirements.txt                  ← Python dependencies
  disruption_model.pkl              ← (generated) XGBoost binary classifier
  disruption_model_metadata.json    ← (generated) metrics & feature importances
  coldchain_model.pkl               ← (generated) Random Forest multi-class
  coldchain_model_metadata.json     ← (generated) metrics & feature importances
```

#### Models at a glance

| Model file | Algorithm | Task | Target labels |
|---|---|---|---|
| `disruption_model.pkl` | XGBoost | Binary classification | `Low` / `High` disruption risk |
| `coldchain_model.pkl` | Random Forest | Multi-class classification | `Normal` / `Warning` / `Critical Violation` |

#### Input features

**Disruption model**

| Feature | Type | Description |
|---|---|---|
| `route_delay_hours` | float | Actual delay vs scheduled ETA (h) |
| `weather_severity` | int 1–5 | External weather severity score |
| `temp_excursion_hours` | float | Hours cargo spent outside safe band |
| `peak_sensor_temp_c` | float | Highest recorded sensor temperature (°C) |
| `shipment_value_usd` | float | Declared cargo value (USD) |
| `idle_fleet_hours` | float | Cumulative vehicle idle time (h) |

**Cold-chain model**

| Feature | Type | Description |
|---|---|---|
| `temp_excursion_hours` | float | Total hours outside safe temperature band |
| `peak_sensor_temp_c` | float | Maximum sensor reading (°C) |
| `temp_variance` | float | Std-dev of all sensor readings |
| `excursion_rate` | float | Fraction of readings outside safe band (0–1) |
| `recovery_time_hours` | float | Time to return inside safe band after breach |

#### Setup and execution

```bash
# 1. (one-time) install Python dependencies
pip install -r src/models/requirements.txt

# 2. Run the training script from the project root
python src/models/train.py
```

The script will:
1. Generate **2 000 synthetic shipment records** per model.
2. Split 80 / 20 train / test, train both classifiers, and print
   classification reports.
3. Write `disruption_model.pkl`, `coldchain_model.pkl`, and their
   companion `_metadata.json` files into `src/models/`.
4. Run a quick self-test inference to confirm both models load correctly.

#### Programmatic inference (Python)

```python
from src.models.train import predict_disruption_risk, predict_coldchain_severity

# Disruption risk
result = predict_disruption_risk(
    route_delay_hours=22, weather_severity=4,
    temp_excursion_hours=8, peak_sensor_temp_c=9.5,
    shipment_value_usd=85_000, idle_fleet_hours=30,
)
# → {"risk": "High", "probability_high": 0.87, "reroute_suggested": True}

# Cold-chain severity
sev = predict_coldchain_severity(
    temp_excursion_hours=6, peak_sensor_temp_c=11.2,
    temp_variance=1.8, excursion_rate=0.25, recovery_time_hours=3,
)
# → {"severity": "Critical Violation", "probabilities": {...}}
```

---

### ML Inference API (`src/api/serve.py`)

A FastAPI server that loads both trained models once at startup and exposes
them as JSON endpoints.  No ML code needs to run on the frontend.

#### Directory structure

```
src/api/
  serve.py     ← FastAPI app: CORS, model loading, endpoints
```

#### Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Liveness probe — returns model load status |
| `POST` | `/api/predict-disruption` | XGBoost disruption risk classifier |
| `POST` | `/api/evaluate-coldchain` | Random Forest cold-chain severity classifier |

Interactive docs are auto-generated by FastAPI at **`http://localhost:8000/docs`**
(Swagger UI) and **`http://localhost:8000/redoc`**.

#### Setup and run

```bash
# 1. Install dependencies (includes fastapi, uvicorn, pydantic)
pip install -r src/models/requirements.txt

# 2. Train models if not already done
python src/models/train.py

# 3. Start the API server (from project root)
uvicorn src.api.serve:app --reload --host 0.0.0.0 --port 8000
```

> The `--reload` flag enables hot-reload during development.
> Drop it in production and use a process manager (e.g. `gunicorn`).

#### POST `/api/predict-disruption`

**Request body**

```json
{
  "route_delay_hours": 22.0,
  "weather_severity": 4,
  "shipment_value_usd": 85000.0,
  "temp_excursion_hours": 8.0,
  "peak_sensor_temp_c": 9.5,
  "idle_fleet_hours": 30.0
}
```

`temp_excursion_hours`, `peak_sensor_temp_c`, and `idle_fleet_hours` are
**optional** — they default to safe neutral values so you only need to send
the three primary signals.

**Response**

```json
{
  "risk": "High",
  "probability_high": 0.8731,
  "reroute_suggested": true,
  "message": "High disruption probability (87%). Automated re-routing recommended."
}
```

#### POST `/api/evaluate-coldchain`

**Request body**

```json
{
  "peak_sensor_temp_c": 11.2,
  "temp_excursion_hours": 6.0,
  "temp_variance": 1.8,
  "excursion_rate": 0.25,
  "recovery_time_hours": 3.0
}
```

`temp_variance`, `excursion_rate`, and `recovery_time_hours` are **optional**.
`excursion_rate` is auto-derived from `temp_excursion_hours / 24` when omitted.

**Response**

```json
{
  "severity": "Critical Violation",
  "probabilities": {
    "Normal": 0.02,
    "Warning": 0.11,
    "Critical Violation": 0.87
  },
  "regulatory_action": "STOP shipment. Mandatory quality inspection required. Notify regulatory authority. Initiate emergency cargo transfer or disposal.",
  "message": "Cold-chain evaluation complete. Regulatory status: Critical Violation."
}
```

#### Calling from the React frontend

```js
// Disruption risk
const res = await fetch('http://localhost:8000/api/predict-disruption', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ route_delay_hours: 22, weather_severity: 4, shipment_value_usd: 85000 }),
});
const { risk, reroute_suggested } = await res.json();

// Cold-chain severity
const cc = await fetch('http://localhost:8000/api/evaluate-coldchain', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ peak_sensor_temp_c: 11.2, temp_excursion_hours: 6 }),
});
const { severity, regulatory_action } = await cc.json();
```

CORS is configured with `allow_origins=["*"]`, so the Vite dev server on
`http://localhost:5173` can call these endpoints directly — no proxy needed.

---

## Important Files to Include

- `requirements.txt` or `package.json` — dependency manifest
- `.env.example` — template for environment variables (NEVER commit `.env`)
- Any database migration files
- Configuration files

## What NOT to Include in src/

- `.env` files with real secrets
- Large binary files (use Git LFS or link externally)
- `node_modules/` or `venv/` (these are in `.gitignore`)
- Build artifacts (`dist/`, `build/`, `__pycache__/`)
