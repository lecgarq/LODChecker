# LOD Checker Architecture Map

High-level runtime topology and flow map for the current project state.

## Components

- Launcher + API host: `run_viz.py`
- Pipeline: `01_backend/img_pipeline/Run_Pipeline_Optimized.py`
- Data contracts: `00_data/vectors/master_registry.json`, `00_data/vectors/graph_data.json`
- Frontend: `02_frontend/src/*` (React + TypeScript + Vite + Canvas)
- Config: `config/default.yaml` + `config/loader.py`

## Runtime Topology

```text
Browser (http://localhost:5173)
  |
  |  Vite proxy (/api, /img, /vectors)
  v
Flask API (http://localhost:5000)
  |
  +-- BackendResources (model, processor, embeddings, registry, query cache)
  |
  +-- File artifacts under 00_data/
```

## Main Flows

### Startup

1. `python run_viz.py`
2. Relaunches under `01_backend/imgpipe_env/Scripts/python.exe` when needed.
3. Loads registry + embeddings + SigLIP into `BackendResources`.
4. Starts Flask on `5000` and Vite on `5173`.

### Search

1. Frontend calls `GET /api/search?q=<query>`.
2. Backend expands query (OpenAI when configured), embeds query text with SigLIP.
3. Cosine similarity vs normalized `image_embedding` vectors.
4. Keyword boost on metadata fields.
5. Returns stable JSON contract: `query`, `expandedQuery`, `results`.

### Upload -> Pipeline -> Refresh

1. Frontend `POST /api/run/local_pipeline` with image files.
2. Backend writes temp upload batch.
3. Backend runs:
   - `Run_Pipeline_Optimized.py`
   - `Step09_DataTools.py --consolidate`
   - `Step13_GraphPrep.py`
4. Backend reloads resources and returns latest records.

### Delete

1. Frontend `DELETE /api/delete/image`.
2. Backend removes image artifacts + matching registry/graph entries.
3. Frontend updates local node state using neighbor-rebuild-safe deletion logic.

## Current Stability Posture

- Dashboard handles malformed records safely.
- Layout switching avoids race crashes.
- Node deletion rebuilds neighbor references and applies bounds-safe rendering.
- Registry/graph schema validation skips invalid records without crashing.

## Guardrails

- Python 3.12 only
- CUDA required
- Preserve route and JSON contracts
- Respect data immutability constraints in `00_data/`
