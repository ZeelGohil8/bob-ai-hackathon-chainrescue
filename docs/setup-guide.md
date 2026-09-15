# ChainRescue — Setup Guide

> **For hackathon judges:** This guide assumes a completely fresh machine.
> Follow every section in order and all three servers will be running in under.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Environment Configuration](#2-environment-configuration)
3. [Installation Steps](#3-installation-steps)
4. [Running the Application](#4-running-the-application)
5. [Verification](#5-verification)
6. [Troubleshooting](#6-troubleshooting)

---

## 1. Prerequisites

### Required tools

| Tool | Minimum version | Install link | Verify |
|---|---|---|---|
| **Node.js** | 18.x LTS | https://nodejs.org | `node --version` |
| **npm** | 9.x (bundled with Node) | (bundled) | `npm --version` |
| **Python** | 3.10+ | https://python.org/downloads | `python --version` |
| **pip** | 23+ (bundled with Python) | (bundled) | `pip --version` |
| **Git** | 2.x | https://git-scm.com | `git --version` |

> **Windows users:** Use **PowerShell** or **Git Bash** for all commands below.
> Python must be added to `PATH` during installation — tick the checkbox on the
> Python installer's first screen.

### Required accounts & API keys

| Account | Purpose | Where to get it |
|---|---|---|
| **IBM Cloud account** | Needed to generate a watsonx.ai API key | https://cloud.ibm.com/registration |
| **IBM watsonx.ai project** | Provides the Project ID for model calls | https://dataplatform.cloud.ibm.com |

> **Running without IBM credentials?**
> The Express backend degrades gracefully — disruption events and fleet data
> still work. Only the AI impact analysis and fleet insights endpoints
> (`POST /api/disruptions/:id/analyse`, `GET /api/fleet/insights`) return an
> error. The ML inference server (FastAPI) and the React dashboard work
> fully offline.

---

## 2. Environment Configuration

The project uses a single `.env` file inside `src/backend/`. A template is
provided at [`src/.env.example`](../src/.env.example).

### Step — copy the template

```bash
# From the project root
cp src/.env.example src/backend/.env
```

Then open `src/backend/.env` in any text editor and fill in the values
described below.

### Variable reference

| Variable | Required | Sample value | Description |
|---|---|---|---|
| `WATSONX_API_KEY` | **Yes*** | `abc123xyz-ibm-api-key` | IBM Cloud API key with watsonx.ai access. Generate at **Manage → Access (IAM) → API Keys** in the IBM Cloud console. |
| `WATSONX_PROJECT_ID` | **Yes*** | `a1b2c3d4-1234-5678-abcd-ef0123456789` | The GUID of your watsonx.ai project. Found in **Project → Manage → General** in IBM watsonx. |
| `WATSONX_URL` | **Yes*** | `https://us-south.ml.cloud.ibm.com` | Regional watsonx.ai endpoint. Change to `eu-de` or `au-syd` if your project is in a different region. |
| `WATSONX_MODEL_ID` | No | `ibm/granite-13b-instruct-v2` | Granite model used for impact analysis and fleet insights. Leave as default unless you have access to a different model. |
| `APP_PORT` | No | `3000` | Port the Express backend listens on. Change only if port 3000 is occupied. |
| `APP_ENV` | No | `development` | Runtime environment. Use `development` locally; `production` activates JSON logging. |
| `CHAINRESCUE_API_KEY` | No | *(leave empty)* | API key required in the `x-api-key` request header. **Leave empty** during local development to disable auth entirely. |
| `CORS_ORIGIN` | No | `*` | Allowed CORS origin. `*` allows all origins (including the Vite dev server on port 5173). Restrict in production. |
| `DATABASE_URL` | No | `postgresql://user:pass@localhost:5432/chainrescue` | PostgreSQL connection string. **Not needed for the demo** — the backend uses an in-memory mock store by default. |
| `SLACK_WEBHOOK_URL` | No | `https://hooks.slack.com/services/T.../B.../xxx` | Slack incoming webhook URL for disruption notifications. Leave blank to disable. |
| `LOG_LEVEL` | No | `info` | Winston log level. Options: `error`, `warn`, `info`, `debug`. |

> \* Required only for watsonx.ai-powered features (AI impact analysis, fleet
> insights). All other features work without them.

### Minimal `.env` for a judge running the demo

```dotenv
# src/backend/.env  — minimum viable config for judging
WATSONX_API_KEY=<your-ibm-api-key>
WATSONX_PROJECT_ID=<your-project-guid>
WATSONX_URL=https://us-south.ml.cloud.ibm.com
WATSONX_MODEL_ID=ibm/granite-13b-instruct-v2
APP_PORT=3000
APP_ENV=development
CHAINRESCUE_API_KEY=
CORS_ORIGIN=*
LOG_LEVEL=info
```

---

## 3. Installation Steps

Open **three separate terminal windows** (or tabs). You will need them all
running simultaneously in [Section 4](#4-running-the-application).

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-org/bob-ai-hackathon-chainrescue.git
cd bob-ai-hackathon-chainrescue
```

### Step 2 — Configure the environment

```bash
cp src/.env.example src/backend/.env
# Edit src/backend/.env with your IBM credentials (see Section 2)
```

### Step 3 — Install Express backend dependencies

```bash
cd src/backend
npm install
cd ../..
```

Expected output: `added NNN packages` with no `npm ERR!` lines.

### Step 4 — Install React frontend dependencies

```bash
cd src/frontend
npm install
cd ../..
```

Expected output: `added NNN packages` with no `npm ERR!` lines.

### Step 5 — Set up the Python virtual environment

```bash
# From the project root — create an isolated Python environment
python -m venv .venv
```

**Activate the virtual environment:**

```bash
# macOS / Linux
source .venv/bin/activate

# Windows PowerShell
.\.venv\Scripts\Activate.ps1

# Windows Command Prompt
.venv\Scripts\activate.bat
```

Your prompt should now show `(.venv)` as a prefix.

### Step 6 — Install Python dependencies

```bash
# With .venv active
pip install -r src/models/requirements.txt
```

This installs: `numpy`, `pandas`, `scikit-learn`, `xgboost`, `fastapi`,
`uvicorn[standard]`, and `pydantic`.

### Step 7 — Train the ML models (one-time)

```bash
# With .venv active, from the project root
python src/models/train.py
```

Expected output:

```
════════════════════════════════════════════════════════════
 ChainRescue — ML Training Pipeline
════════════════════════════════════════════════════════════

[1/4] Generating 2,000 disruption samples…
[2/4] Training XGBoost disruption model…
[3/4] Generating 2,000 cold-chain sensor samples…
[4/4] Training Random Forest cold-chain model…

── Self-test: sample inference ────────────────────────────
   Disruption risk  → High (p_high=0.xxxx, reroute=True)
   Cold-chain sev.  → Critical Violation  probs={...}

════════════════════════════════════════════════════════════
 Training complete. Artifacts written to src/models/
════════════════════════════════════════════════════════════
```

Two files are created: `src/models/disruption_model.pkl` and
`src/models/coldchain_model.pkl`.

---

## 4. Running the Application

The full stack requires **three servers** running simultaneously. Open a
separate terminal for each.

### Terminal 1 — Express backend (Node.js)

```bash
# From the project root
cd src/backend
npm run dev
```

Expected output:

```
HH:MM:SS [info] ChainRescue backend running on port 3000 [development]
```

The Express API is now available at **`http://localhost:3000`**.

### Terminal 2 — FastAPI ML inference server (Python)

```bash
# From the project root, with .venv active
source .venv/bin/activate          # macOS/Linux
# OR: .\.venv\Scripts\Activate.ps1  (Windows PowerShell)

uvicorn src.api.serve:app --reload --host 0.0.0.0 --port 8000
```

Expected output:

```
INFO:     [serve.py] ✔  Loaded disruption from src/models/disruption_model.pkl
INFO:     [serve.py] ✔  Loaded coldchain from src/models/coldchain_model.pkl
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
```

The ML API is now available at **`http://localhost:8000`**.

### Terminal 3 — React frontend (Vite)

```bash
# From the project root
cd src/frontend
npm run dev
```

Expected output:

```
  VITE v5.x.x  ready in NNN ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://xxx.xxx.xxx.xxx:5173/
```

The dashboard is now available at **`http://localhost:5173`**.

### Summary — ports at a glance

| Server | Command | URL |
|---|---|---|
| Express backend | `npm run dev` (in `src/backend/`) | `http://localhost:3000` |
| FastAPI ML server | `uvicorn src.api.serve:app --reload --port 8000` | `http://localhost:8000` |
| React frontend | `npm run dev` (in `src/frontend/`) | `http://localhost:5173` |

---

## 5. Verification

Run through each check in order. A passing result is shown for each step.

### ✅ Check 1 — Express backend health

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{ "status": "ok", "timestamp": "...", "uptime": ... }
```

### ✅ Check 2 — FastAPI ML server health

Open in your browser or run:

```bash
curl http://localhost:8000/api/health
```

Expected response:

```json
{ "status": "ok", "models": { "disruption": true, "coldchain": true } }
```

> If either model shows `false`, the `.pkl` files are missing. Run
> `python src/models/train.py` again (Step 7).

### ✅ Check 3 — FastAPI interactive docs (Swagger UI)

Open **`http://localhost:8000/docs`** in your browser.

You should see the ChainRescue ML API Swagger UI with two documented
endpoints:
- `POST /api/predict-disruption`
- `POST /api/evaluate-coldchain`

Try the **"Try it out"** button on either endpoint to confirm live inference.

### ✅ Check 4 — Disruption API (Express)

```bash
curl http://localhost:3000/api/disruptions
```

Expected response:

```json
{
  "count": 3,
  "events": [
    { "id": "EVT-001", "type": "weather", "severity": "critical", ... },
    ...
  ]
}
```

> If you set `CHAINRESCUE_API_KEY` to a non-empty value, add
> `-H "x-api-key: <your-key>"` to all curl requests.

### ✅ Check 5 — Fleet utilisation API (Express)

```bash
curl http://localhost:3000/api/fleet/utilization
```

Expected response:

```json
{
  "totalVehicles": 4,
  "byStatus": { "available": 2, "on_route": 1, "maintenance": 1 },
  "avgLoadPercent": ...,
  "utilizationRate": ...
}
```

### ✅ Check 6 — ML prediction (disruption risk)

```bash
curl -X POST http://localhost:8000/api/predict-disruption \
  -H "Content-Type: application/json" \
  -d '{"route_delay_hours": 22, "weather_severity": 4, "shipment_value_usd": 85000}'
```

Expected response:

```json
{
  "risk": "High",
  "probability_high": 0.87,
  "reroute_suggested": true,
  "message": "High disruption probability (87%). Automated re-routing recommended."
}
```

### ✅ Check 7 — ML prediction (cold-chain severity)

```bash
curl -X POST http://localhost:8000/api/evaluate-coldchain \
  -H "Content-Type: application/json" \
  -d '{"peak_sensor_temp_c": 11.2, "temp_excursion_hours": 6}'
```

Expected response:

```json
{
  "severity": "Critical Violation",
  "probabilities": { "Normal": ..., "Warning": ..., "Critical Violation": ... },
  "regulatory_action": "STOP shipment. Mandatory quality inspection required...",
  "message": "Cold-chain evaluation complete. Regulatory status: Critical Violation."
}
```

### ✅ Check 8 — React dashboard

Open **`http://localhost:5173`** in your browser.

You should see:
1. **⚠ Disruption Alerts** tab — table of 3 mock disruption events
2. **🚛 Fleet & Routes** tab — 4 vehicles with utilisation stats
3. **🤖 ML Risk Dashboard** tab — two interactive prediction forms

Submit either form to confirm the frontend can reach the ML server.

### ✅ Check 9 — CLI tool (optional)

```bash
node src/cli/index.js simulate SHP-001 temperature
node src/cli/index.js scan-breaches
node src/cli/index.js list-shipments
```

---

## 6. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Cannot find module` on `npm run dev` | `npm install` not completed | `cd src/backend && npm install` |
| `EADDRINUSE: address already in use :::3000` | Port 3000 occupied by another process | Change `APP_PORT=3001` in `src/backend/.env`, then restart |
| `EADDRINUSE: address already in use :::8000` | Another process on port 8000 | Run uvicorn on a different port: `--port 8001`; update the fetch URLs in the React forms accordingly |
| `EADDRINUSE: address already in use :::5173` | Another Vite dev server running | Stop the other process or run `npm run dev -- --port 5174` |
| Express API returns `401 Unauthorized` | `CHAINRESCUE_API_KEY` is set | Either clear it (`CHAINRESCUE_API_KEY=`) or add `-H "x-api-key: <key>"` to all requests |
| FastAPI returns `503 Service Unavailable` for ML endpoints | `.pkl` model files missing | Run `python src/models/train.py` with `.venv` activated |
| `ModuleNotFoundError: No module named 'xgboost'` | Python venv not activated, or deps not installed | Activate `.venv` and re-run `pip install -r src/models/requirements.txt` |
| `FileNotFoundError: disruption_model.pkl` | Training step was skipped | Run `python src/models/train.py` from the project root |
| watsonx.ai returns `401` / `403` | Invalid or expired IBM API key | Regenerate the key at **IBM Cloud → Manage → Access (IAM) → API Keys** and update `WATSONX_API_KEY` in `.env` |
| watsonx.ai returns `404` | Wrong `WATSONX_PROJECT_ID` or `WATSONX_URL` | Verify both values in the IBM watsonx console; ensure the region in `WATSONX_URL` matches your project's region |
| React dashboard shows CORS error in browser console | FastAPI ML server not running, or wrong port | Start uvicorn (`Terminal 2`) and confirm it shows `Loaded disruption` and `Loaded coldchain` on startup |
| Vite proxy `502 Bad Gateway` | Express backend not running | Start `npm run dev` in `src/backend/` (`Terminal 1`) |
| `python` command not found on Windows | Python not on PATH | Re-install Python and tick **"Add Python to PATH"**; or use `py` instead of `python` |
| `Activate.ps1 cannot be loaded` (Windows PowerShell) | Execution policy blocks scripts | Run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` then re-activate |
| `.env` file not being read | File placed in wrong directory | The `.env` must be at `src/backend/.env` (same directory as `server.js`) |
| `nodemon: command not found` | `devDependencies` not installed | Run `npm install` inside `src/backend/`; or use `node server.js` directly |
| Temperature scan returns `0 new events` | No shipments currently in breach | Expected — the mock data has one known breach on `SHP-003`. Trigger it: `POST /api/disruptions/scan/temperature` |

---

## Quick-start cheat-sheet

```bash
# ── One-time setup ────────────────────────────────────────────────
git clone https://github.com/your-org/bob-ai-hackathon-chainrescue.git
cd bob-ai-hackathon-chainrescue
cp src/.env.example src/backend/.env
# → edit src/backend/.env with IBM credentials

cd src/backend && npm install && cd ../..
cd src/frontend && npm install && cd ../..

python -m venv .venv
source .venv/bin/activate          # Windows: .\.venv\Scripts\Activate.ps1
pip install -r src/models/requirements.txt
python src/models/train.py

# ── Start (3 terminals) ───────────────────────────────────────────
# Terminal 1
cd src/backend && npm run dev

# Terminal 2
source .venv/bin/activate && uvicorn src.api.serve:app --reload --port 8000

# Terminal 3
cd src/frontend && npm run dev

# ── Open ──────────────────────────────────────────────────────────
# Dashboard  → http://localhost:5173
# Swagger UI → http://localhost:8000/docs
# Express    → http://localhost:3000/api/health
```
