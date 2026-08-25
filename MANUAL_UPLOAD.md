# RazorShield AI Risk Manager — Manual Setup

This package contains the complete preview dashboard, its PaySim-trained Random Forest artifact, verified training metadata, and server-side scoring bridge. The original PaySim CSV is intentionally excluded because it is large and not needed for running the provided trained model.

## Local prerequisites

Install Node.js 22 or later and Python 3.11 or later. From the project root, create a Python environment for the trained model:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r server/model_assets/requirements.txt
```

Then install and run the dashboard:

```bash
pnpm install
PYTHON_BIN="$(pwd)/.venv/bin/python" pnpm dev
```

Open the local URL printed by the development server. The dashboard performs all assessments on the server by invoking `server/model_assets/model_runner.py`, which loads `risk_model.joblib`.

## Verification

Run the following commands before uploading or sharing the project:

```bash
PYTHON_BIN="$(pwd)/.venv/bin/python" pnpm check
PYTHON_BIN="$(pwd)/.venv/bin/python" pnpm test
PYTHON_BIN="$(pwd)/.venv/bin/python" pnpm build
```

## Upload to GitHub

Create an empty repository, unzip this package, and run the following commands in the project folder:

```bash
git init -b main
git add .
git commit -m "Add RazorShield preview risk dashboard"
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
git switch -c razorshield-preview
git push -u origin razorshield-preview
```

Do not add the raw PaySim dataset, `.env` files, `node_modules`, or local virtual-environment folders to the repository.

## Prototype limits

PaySim is synthetic data. This project is not connected to Razorpay and must not be used to make automatic production payment-blocking decisions. The current Python bridge is suitable for local preview and development; replace it with a production-compatible model-serving service before public deployment.
