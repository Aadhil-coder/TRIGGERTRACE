# TriggerTrace

A health-support Progressive Web Application (PWA) designed to record asthma flare-ups alongside local atmospheric and environmental readings (PM2.5, humidity, temperature, and rainfall). Over time, the system performs multivariable logistic regression and bootstrap uncertainty analysis to uncover possible environmental patterns without providing medical diagnosis or treatment advice.

---

## Safety and Clinical Boundary Notice

> **Important**: TriggerTrace is an educational and analytical research prototype.
> - It does not provide medical diagnoses or prescribe treatment plans.
> - Statistical associations represent possible patterns, not proven causal relationships.
> - In an acute or severe emergency, always utilize emergency medication and contact local healthcare or emergency services immediately.

---

## Architecture Overview

- **Backend**: Python 3.10+ with Flask, SQLite, NumPy, Pandas, Scikit-learn, and ReportLab.
- **Frontend**: React 18, Vite 5, PWA Service Worker via `vite-plugin-pwa`, and custom responsive design tokens.
- **Offline Reliability**: Client-side Indexed/Local storage queue with automatic background synchronization upon reconnection.

---

## Quick Start Guide

### Prerequisites
- Python 3.10 or newer
- Node.js 18 or newer (with npm)
- Git

### 1. Environment Configuration
Copy the template configuration file:
```bash
# Windows PowerShell / macOS / Linux
cp .env.example .env
```

### 2. Backend Setup
```bash
# Windows PowerShell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# macOS / Linux
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
```

### 3. Generate & Load Demo Data
```bash
# Generate synthetic hourly and daily datasets (seed 42)
python data/demo.py generate

# Populate database tables
python data/demo.py load --reset
```

### 4. Build Frontend Assets
```bash
cd frontend
npm install
npm run build
cd ..
```

### 5. Run the Application
Start the Flask application server:
```bash
python backend/app.py
```
The server will bind to `0.0.0.0:8000`.
- Open your desktop browser at `http://localhost:8000`.
- To view the component design system catalog, navigate to `http://localhost:8000/design`.

---

## Accessing from Mobile Device (Same Wi-Fi)

1. Ensure your laptop and mobile device are connected to the same local wireless network.
2. Note your laptop's local IP address (e.g. `192.168.1.X` or `10.X.X.X`).
3. Open mobile Safari or Chrome and navigate to:
   ```
   http://<YOUR-LAPTOP-IP>:8000
   ```
4. On iOS Safari, tap **Share** -> **Add to Home Screen**.
5. On Android Chrome, tap the menu -> **Install app** or **Add to Home screen**.

---

## Running Automated Tests

To execute the backend verification test suite:
```bash
cd backend
python -m pytest tests -v
```

---

## Resetting Demo Data

To wipe and reseed the synthetic baseline at any time:
```bash
python data/demo.py load --reset
```

---

## License

Distributed under the terms of the MIT License. See [LICENSE](LICENSE) for details.
