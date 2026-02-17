# LOD Checker Runbook

This runbook reflects the current implementation after Stages 1-5.

## Environment

- OS: Windows + PowerShell
- Python: 3.12 only
- GPU: NVIDIA CUDA required
- Node.js: 20+

Required `.env` at repo root:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
# Optional for gated/private Hugging Face access:
# HF_TOKEN=...
# HUGGINGFACE_HUB_TOKEN=...
```

## Setup

```powershell
cd 03_env\python
python -m venv imgpipe_env
.\imgpipe_env\Scripts\Activate.ps1
pip install -r ..\..\requirements.txt
cd ..
cd ..

cd 02_frontend
npm install
cd ..
```

## Run Full Stack

```powershell
python run_viz.py
```

- Backend: `http://localhost:5000`
- Frontend: `http://localhost:5173`

This is the primary supported runtime mode.

## Run Pipeline Only

```powershell
03_env\python\imgpipe_env\Scripts\python.exe 01_backend\img_pipeline\Run_Pipeline_Optimized.py --input <input_dir> --output 00_data --provider <provider_name>
```

Then consolidate + rebuild graph:

```powershell
03_env\python\imgpipe_env\Scripts\python.exe 01_backend\img_pipeline\Step09_DataTools.py --root 00_data --consolidate
03_env\python\imgpipe_env\Scripts\python.exe 01_backend\img_pipeline\Step13_GraphPrep.py
```

## Validation Commands

```powershell
# Audit
python scripts/audit.py

# Pipeline contracts on fixtures
python tests/pipeline_tester.py

# Backend smoke contracts (/health, /api/search, /vectors/graph_data.json)
python tests/backend_smoke.py

# Frontend typecheck
cd 02_frontend; npx.cmd tsc --noEmit; cd ..

# Frontend build smoke (if your shell policy allows npm build subprocesses)
cd 02_frontend; npm.cmd run build; cd ..
python tests/frontend_smoke.py
```

## CI Workflows

- `.github/workflows/ci.yml`
  - `frontend-checks`: typecheck, lint, build, frontend smoke
  - `backend-checks`: compileall, pipeline fixture tester, backend smoke
  - `audit-checks`: `scripts/audit.py`
  - `docs-checks`: required markdown files present
- `.github/workflows/stage1-audit.yml` deprecated — superseded by ci.yml audit-checks and docs-checks jobs.
- `.github/workflows/pages.yml` deploys frontend static build to GitHub Pages from `main`.
  - Set repository variable `LOD_BACKEND_BASE_URL` for hosted API calls.
  - If `LOD_BACKEND_BASE_URL` is empty, Pages UI loads but backend-dependent features fail with 404.
  - `http://localhost:5000` is valid only for local runtime, not for public GitHub Pages clients.

## Performance Benchmark

```powershell
python scripts/benchmark_pipeline.py --input 00_data/img --runs 3 --limit 5
```

Outputs per-run and median per-image time, with a `~30s` target check.

## Troubleshooting

- `scripts/audit.py` fails on Python version:
  - Use Python 3.12 exactly.
- Hugging Face model load fails in restricted networks:
  - Set `LOD_HF_LOCAL_ONLY=1` to force local cache usage.
  - Ensure models are already cached if offline.
- Frontend command blocked by PowerShell execution policy:
  - Use `.cmd` executables (`npx.cmd`, `npm.cmd`) in PowerShell.
- Search endpoint returns unavailable:
  - Verify `.env` has valid `OPENAI_API_KEY`.

## Data Safety Constraints

- Do not modify/delete `00_data/img/`
- Do not modify `00_data/Categories.json`
- Treat `00_data/vectors/` as append-only for finalized outputs
