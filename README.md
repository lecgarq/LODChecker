# LOD Checker

LOD Checker is a local-first Visual RAG workflow for BIM image processing, semantic search, and graph exploration.

## Current Status

The 5-stage refactor is implemented in the current codebase:
- Stage 1: docs + audit scaffolding
- Stage 2: centralized config + path/model de-hardcoding
- Stage 3: frontend stability fixes (dashboard validation, layout switching safety, neighbor rebuild on deletion)
- Stage 4: pipeline modularity (schemas, embedding provider, adapters, backend resource holder)
- Stage 5: tester harness + CI gates + rollback runbook

## Requirements

- Windows + PowerShell
- Python 3.12 only
- CUDA-capable NVIDIA GPU (CPU-only mode is out of scope)
- Node.js 20+

## Quick Start

```powershell
git clone https://github.com/lecgarq/LODChecker
cd LODChecker

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

Create `.env` in repo root:

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

Run full stack:

```powershell
python run_viz.py
```

- Backend: `http://localhost:5000`
- Frontend (dev): `http://localhost:5173`

## Current Deployment Mode

The active/expected mode is local full-stack via `run_viz.py`:
- frontend on `localhost:5173`
- backend on `localhost:5000`

## Core Commands

```powershell
# Stage 1 audit
python scripts/audit.py

# Pipeline fixture harness
python tests/pipeline_tester.py

# Backend smoke
python tests/backend_smoke.py

# Frontend typecheck
cd 02_frontend; npx.cmd tsc --noEmit; cd ..
```

Performance benchmark:

```powershell
python scripts/benchmark_pipeline.py --input 00_data/img --runs 3 --limit 5
```

## Project Docs

- [RUNBOOK.md](RUNBOOK.md)
- [CODEBASE_MAP.md](CODEBASE_MAP.md)
- [ARCHITECTURE.md](ARCHITECTURE.md)
- [ARCHITECTURE_MAP.md](ARCHITECTURE_MAP.md)
- [DECISIONS.md](DECISIONS.md)
- [skills.md](skills.md)
- [ROLLBACK.md](ROLLBACK.md)

## GitHub Pages

Static frontend hosting is supported via `.github/workflows/pages.yml`.

- Pages build uses `VITE_PUBLIC_BASE=/LODChecker/`.
- API calls use `VITE_API_BASE_URL` (repository variable: `LOD_BACKEND_BASE_URL`).
- If `LOD_BACKEND_BASE_URL` is not set, hosted UI loads but backend features fail (`/api/*`, `/vectors/*` 404).
- `localhost` cannot be used as backend for public GitHub Pages visitors.

## Hard Constraints

- Do not modify/delete `00_data/img/`
- Do not modify `00_data/Categories.json`
- Treat `00_data/vectors/` as append-only for finalized outputs
- Keep route and JSON contracts stable unless explicitly staged
