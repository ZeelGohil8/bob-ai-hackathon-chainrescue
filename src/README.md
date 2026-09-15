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
- **Live Demo:** [https://your-app-domain.com](https://your-app-domain.com)
- **Tech Stack:** React.js, Node.js, Express, MongoDB, Socket.io (Real-time tracking)

```bash
# Run Frontend & Backend
cd src/backend && npm start
cd src/frontend && npm start```

### Data / AI Project
```
src/
  data/           ← Data ingestion / preprocessing
  models/         ← ML model code
  api/            ← Serving layer
  notebooks/      ← Jupyter notebooks (exploration)
`An AI-driven resilience engine designed to proactively mitigate cold-chain supply chain risks. It continuously monitors live telemetry data to predict cargo spoilage and recalculate optimal delivery routes in real time.

**Key AI Components:**
* **Real-time Anomaly Detection:** Identifies temperature spikes and breach events using automated threshold triggers.
* **Risk Prediction Models:** Evaluates route safety based on live weather data, delay patterns, and cargo sensitivity.
* **Automated Re-routing:** Dynamically calculates alternative distribution hubs to prevent spoiled cargo and financial loss.

`src/data/` - Ingests live telemetry streams, weather API feeds, and shipment logs.
`src/models/` - Houses ML models for breach prediction and route optimization logic.
`src/api/` - Exposes REST endpoints to serve predictions to the frontend dashboard.
`src/notebooks/` - Contains exploratory data analysis (EDA) and model prototyping files.``

### CLI / Script-based Tool
```
src/
  cli/            ← CLI entry points
  lib/            ← Core logic
  utils/          ← Helpers
``This CLI utility simulates real-time logistics events, cold-chain temperature breaches, and automated re-routing logic for the Supply Chain Resilience application.

#### Core Functionality:
- **Disruption Simulation:** Triggers simulated temperature breaches (e.g., cold chain failure above 2°C) or severe weather alerts on active shipment routes.
- **Automated Re-Routing:** Calculates optimal backup delivery hubs (e.g., Hub-B) and alternative routes upon detection of breaches.
- **Backend Sync:** Sends real-time POST requests to the backend API to reflect status changes directly on the frontend dashboard.

#### CLI Execution Commands:
- **Run Breach Simulation:**
  `node src/cli/index.js simulate <SHIPMENT_ID> temperature`
- **Run Weather Re-routing:**
  `node src/cli/index.js simulate <SHIPMENT_ID> weather``

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
