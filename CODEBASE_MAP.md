# LOD Checker Codebase Map

This map is intentionally focused on maintained source paths (not virtualenv/node_modules artifacts).

## Root

- `run_viz.py`: launcher + Flask API + backend resource holder
- `requirements.txt`: Python deps
- `04_config/config/default.yaml`: centralized paths/models config (JSON content in `.yaml` file)
- `04_config/config/loader.py`: config loader + env overrides + repo-root resolution
- `03_env/`: local environment area (venvs, local runtime artifacts; git-ignored except placeholders)
- `scripts/audit.py`: Stage 1 audit checks
- `scripts/benchmark_pipeline.py`: runtime benchmark helper
- `tests/`: Stage 5 harness/smoke tests
- `.github/workflows/`: CI workflows

## Data

- `00_data/img/`: processed images (do not modify/delete)
- `00_data/vectors/`: append-only finalized artifacts (`master_registry.json`, `graph_data.json`, `batch_*.json`)
- `00_data/Categories.json`: BIM taxonomy (do not modify)

## Backend + Pipeline

- `01_backend/schemas.py`: pydantic schemas + validators for registry/graph contracts
- `01_backend/img_pipeline/Run_Pipeline_Optimized.py`: canonical orchestrator
- `01_backend/img_pipeline/Run_Pipeline.py`: legacy orchestrator (deprecated shim)
- `01_backend/img_pipeline/Step01_*.py` ... `Step13_*.py`: pipeline stages and helpers
- `01_backend/img_pipeline/hf_utils.py`: HF connectivity/local-only fail-fast behavior
- `01_backend/img_pipeline/providers/embedding_provider.py`: embedding interface
- `01_backend/img_pipeline/providers/siglip_provider.py`: SigLIP provider implementation
- `01_backend/img_pipeline/adapters/blip2_adapter.py`: BLIP2 adapter
- `01_backend/img_pipeline/adapters/rmbg_adapter.py`: RMBG adapter

## Frontend

- `02_frontend/src/App.tsx`: app-level state and page routing
- `02_frontend/src/pages/`: page components
- `02_frontend/src/components/graph/SemanticGraph.tsx`: main canvas renderer
- `02_frontend/src/components/layout/`: toolbar, detail panel, detail subcomponents
- `02_frontend/src/components/search/`: upload/search/dashboard UI blocks
- `02_frontend/src/components/ui/ErrorBoundary.tsx`: UI safety wrapper
- `02_frontend/src/hooks/useGraphData.ts`: graph load + deletion sync rebuild
- `02_frontend/src/hooks/usePipelineUpload.ts`: upload flow state
- `02_frontend/src/lib/graphNodeOps.ts`: node deletion neighbor rebuild utilities
- `02_frontend/src/services/api.ts`: frontend API client helpers
- `02_frontend/src/types/`: API/graph contracts
- `02_frontend/vite.config.ts`: dev proxy + `@` alias to `src`

## Testing and CI

- `tests/pipeline_tester.py`: fixture-based pipeline contract harness
- `tests/backend_smoke.py`: backend JSON contract smoke tests
- `tests/frontend_smoke.py`: build artifact smoke check
- `.github/workflows/ci.yml`: multi-job PR/main CI gates
- `.github/workflows/stage1-audit.yml`: deprecated — superseded by ci.yml
- `agents/`: agent spec files (CLAUDE_CODE_PLAN, CODEX_5_3_EXECUTION, GEMINI_3_FLASH_UX)
