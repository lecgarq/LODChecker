# LOD Checker Architecture

This document reflects the current architecture after Stages 1-5.

## System Layers

1. Launcher/runtime host (`run_viz.py`)
2. Flask backend API (`run_viz.py`)
3. Pipeline orchestration (`01_backend/img_pipeline/Run_Pipeline_Optimized.py`)
4. Data artifacts (`00_data/vectors/*.json`, `00_data/img/*`)
5. React frontend (`02_frontend/src/*`)

## Backend Architecture

`run_viz.py` now uses a class-based resource holder (`BackendResources`) instead of scattered globals.

Responsibilities:
- load/validate registry data
- normalize embeddings for search
- load SigLIP for text query embedding
- cache query expansions
- serve route handlers without changing route contracts

Key routes (stable):
- `GET /health`
- `GET /api/search`
- `POST /api/analyze_batch`
- `POST /api/run/local_pipeline`
- `DELETE /api/delete/image`
- `GET /vectors/<path>`
- `GET /img/<path>`
- `GET /img/thumb/<path>`

## Pipeline Architecture

Canonical orchestrator: `01_backend/img_pipeline/Run_Pipeline_Optimized.py`

Stage order currently implemented:
1. Upscale
2. Background removal
3. Captioning
4. Conditional refinement (GDINO/SAM path when needed)
5. Embeddings
6. Finalization (record build, categorization call, manifest write)

Modularity introduced:
- embedding provider interface: `providers/embedding_provider.py`
- SigLIP implementation: `providers/siglip_provider.py`
- model adapters: `adapters/blip2_adapter.py`, `adapters/rmbg_adapter.py`
- schema validators: `01_backend/schemas.py`

Config source of truth:
- `04_config/config/default.yaml`
- loaded via `04_config/config/loader.py`
- overridable with `LOD_*` env vars

## Data Contracts

Contracts remain stable:
- `00_data/vectors/master_registry.json`
- `00_data/vectors/graph_data.json`

Validation behavior:
- invalid records/nodes are logged and skipped, not fatal to server startup

## Frontend Architecture

Decomposition status:
- graph renderer logic split with `graphConstants.ts` and `graphUtils.ts`
- detail panel split into smaller components under `components/layout/detail/`
- upload flow split with `hooks/usePipelineUpload.ts` and upload subcomponents
- API calls centralized in `services/api.ts`

Stability fixes in place:
- dashboard safe parsing and error boundary wrapping
- layout switching guarded/debounced to avoid race crashes
- node deletion rebuilds neighbor references with bounds-safe filtering

## Test and CI Architecture

Local tests:
- `tests/pipeline_tester.py`
- `tests/backend_smoke.py`
- `tests/frontend_smoke.py`

CI:
- `.github/workflows/ci.yml` with frontend, backend, audit, docs jobs
- `.github/workflows/stage1-audit.yml` retained as Stage 1 workflow

## Constraints

- Python 3.12 only
- CUDA-required pipeline
- Do not modify/delete `00_data/img/`
- Do not modify `00_data/Categories.json`
- Treat `00_data/vectors/` as append-only for finalized outputs
- Preserve existing route and JSON contracts unless explicitly staged
