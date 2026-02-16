# LOD Checker - Architecture

This document describes the system architecture, module boundaries, data flow, and known issues for the LOD Checker Visual RAG system.

---

## System Overview

**LOD Checker** is a local-first Visual RAG (Retrieval-Augmented Generation) workflow for BIM image analysis:

```
User Upload (Images)
  ↓
Computer Vision Pipeline (13 steps)
  ↓
Embeddings + Graph Generation (UMAP + kNN)
  ↓
Interactive 24K-Node WebGL Graph + Semantic Search
```

**Key Features:**
- **Local-first:** No cloud dependency for pipeline (OpenAI only for categorization/analysis)
- **Multi-modal embeddings:** SigLIP (image) + SentenceTransformers (text)
- **Graph visualization:** 24K nodes with UMAP dimensionality reduction + kNN precomputation
- **Semantic search:** Dual encoding (original + OpenAI-expanded query) with keyword grounding

---

## High-Level Architecture (5 Layers)

```
┌─────────────────────────────────────────────────────────────┐
│                      1. LAUNCHER                             │
│  run_viz.py: Auto-switches to venv Python, starts Flask +   │
│  Vite, loads resources (master_registry + embeddings)       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   2. BACKEND API (Flask)                     │
│  Routes: /health, /api/search, /api/run/local_pipeline,     │
│  /api/delete/image, /vectors/<path>, /img/<path>            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              3. PIPELINE (01_backend/img_pipeline/)          │
│  Step01 (Upscale) → Step03 (Background) → Step02 (Caption)  │
│  → Step04/05/06 (Refinement) → Step07 (Embeddings)          │
│  → Step08/09/13 (Finalization)                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                4. DATA STORAGE (00_data/)                    │
│  img/ (processed images), vectors/ (master_registry.json,   │
│  graph_data.json), Categories.json (BIM taxonomy)           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                  5. FRONTEND (02_frontend/)                  │
│  React + TypeScript: SemanticGraph (Canvas), SearchResults, │
│  ResultsDashboard, FileUploadModal                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow Diagrams

### 1. Upload Flow (User → Pipeline → Backend → Frontend)

```
User (Browser)
  ↓ [Upload images via FileUploadModal]
Frontend (02_frontend)
  ↓ [POST /api/run/local_pipeline with FormData]
Backend (run_viz.py)
  ↓ [Save to 00_data/uploads/batch_<timestamp>/]
  ↓ [Subprocess: Run_Pipeline_Optimized.py]
Pipeline (01_backend/img_pipeline/)
  ↓ [Step01 → Step02 → ... → Step08]
  ↓ [Write batch_OPTIMIZED_<timestamp>.json to 00_data/vectors/]
Backend (run_viz.py)
  ↓ [Subprocess: Step09_DataTools.py --consolidate]
  ↓ [Merge batch into master_registry.json]
  ↓ [Subprocess: Step13_GraphPrep.py]
  ↓ [Regenerate graph_data.json (UMAP + kNN)]
  ↓ [Hot-reload: load_resources()]
  ↓ [Return latest records from master_registry.json]
Frontend (ResultsDashboard)
  ↓ [Display LOD gauge, category distribution, AI analysis]
```

### 2. Search Flow (User → Backend → Frontend)

```
User (Browser)
  ↓ [Enter search query "door"]
Frontend (LandingSearch)
  ↓ [GET /api/search?q=door]
Backend (run_viz.py)
  ↓ [OpenAI query expansion: "door" → "wooden door with frame and handle"]
  ↓ [SigLIP text encoding: original + expanded]
  ↓ [Blend: 0.3 * original + 0.7 * expanded]
  ↓ [Cosine similarity vs. L2-normalized image embeddings]
  ↓ [Keyword grounding boost: +0.15 per matching term]
  ↓ [Return top 200 results by score]
Frontend (SearchResults)
  ↓ [Display top 100 results with thumbnails]
Frontend (SemanticGraph)
  ↓ [Highlight matching nodes, dim non-matches to 15% opacity]
```

### 3. Graph Load Flow (Frontend → Backend → Frontend)

```
User (Browser)
  ↓ [Navigate to GraphPage]
Frontend (useGraphData hook)
  ↓ [GET /vectors/graph_data.json]
Backend (Flask static file handler)
  ↓ [Serve 00_data/vectors/graph_data.json]
Frontend (SemanticGraph)
  ↓ [Parse JSON: nodes with x/y coords + neighbors]
  ↓ [Initialize Canvas 2D renderer]
  ↓ [Build spatial grid for hit testing]
  ↓ [Cache layout positions (similarity/category/lod/provider)]
  ↓ [Animate to initial layout (UMAP x/y)]
  ↓ [Render 24K nodes with frustum culling]
```

### 4. Deletion Flow (User → Backend → Frontend)

```
User (Browser)
  ↓ [Select node, click "Delete" in DetailPanel]
Frontend (DetailPanel)
  ↓ [DELETE /api/delete/image with filename]
Backend (run_viz.py)
  ↓ [Delete file from 00_data/img/<filename>]
  ↓ [Remove record from master_registry.json]
  ↓ [Hot-reload: load_resources()]
  ↓ [Return success]
Frontend (useGraphData.removeNode)
  ↓ [Filter deleted node from local state]
  ↓ [Known issue: Neighbor arrays NOT rebuilt (causes crashes)]
Frontend (SemanticGraph)
  ↓ [Re-render without deleted node]
```

---

## Module Boundaries & Contracts

### Pipeline → Data Storage
**Contract:** Pipeline writes JSON artifacts to `00_data/vectors/`

**Schemas:**
- **batch_OPTIMIZED_<timestamp>.json:**
  - Array of records with fields: `id`, `name_of_file`, `image_embedding`, `final_category`, `lod`, etc.
  - Schema: See master_registry.json (same structure)

- **master_registry.json:**
  - Consolidated array of all processed images
  - Fields: `id`, `name_of_file`, `image_embedding` (768-dim), `text_embedding` (384-dim, optional), `final_category`, `subcategory`, `lod`, `lod_label`, `provider`, `family_name`, `full_description`, `confidence_level`, `processed_at`, `file_size_kb`, `lod_metrics`
  - **Must remain stable** (backend + frontend depend on this schema)

- **graph_data.json:**
  - `meta`: UMAP/kNN parameters (n_neighbors=15, min_dist=0.1, k=30, seed=42)
  - `nodes`: Array with `id`, `x`, `y`, `neighbors` (array of indices), metadata (name, family_name, final_category, lod_label, provider, img, full_description, etc.)
  - **Must remain stable** (frontend depends on this schema)

**Implicit assumptions:**
- `image_embedding` is L2-normalized (cosine-compatible)
- `x`, `y` coordinates are normalized to [-1, 1] range (aspect-preserving)
- `neighbors` array contains indices (not IDs), top 30 neighbors by cosine distance

### Backend → Frontend
**Contract:** Flask serves JSON artifacts and search results via REST API

**Endpoints:**

| Endpoint | Method | Request | Response Schema |
|----------|--------|---------|-----------------|
| `/health` | GET | - | `{"status": "ok", "items": int}` |
| `/api/search` | GET | `?q=<query>` | `{"query": str, "expandedQuery": str, "results": [{"id": str, "score": float}]}` |
| `/vectors/graph_data.json` | GET | - | JSON (see graph_data.json schema above) |
| `/api/run/local_pipeline` | POST | FormData (files) | `{"success": bool, "count": int, "results": [<ImageRecord>]}` |
| `/api/delete/image` | DELETE | `{"filename": str}` | `{"success": bool, "files": [...], "memory_updated": bool}` |

**Implicit assumptions:**
- Search results are sorted by score (descending)
- Image embeddings are L2-normalized (backend applies normalization on load)
- Frontend expects exact field names (brittle to schema changes)

### Frontend Internal Contracts
**SemanticGraph ↔ useGraphData:**
- `useGraphData` provides: `nodes` array, `removeNode(id)` function
- `SemanticGraph` expects: Each node has `id`, `x`, `y`, `neighbors` (array of indices)
- **Known issue:** `removeNode()` doesn't rebuild neighbor arrays (causes crashes)

**Toolbar ↔ SemanticGraph:**
- `Toolbar` emits: `layoutMode` change (similarity/category/lod/provider)
- `SemanticGraph` listens: Recalculates target positions, triggers animation
- **Known issue:** Race condition if layout changes during animation (grid indexing mismatch)

---

## Pipeline Architecture (6 Stages)

### Stage 1: Prep & Upscale
- **Step01_Upscale.py:** 4× upscaling via RealESRGAN binary
- **Input:** Original images (PNG, JPG, WebP, BMP, TIFF)
- **Output:** Upscaled PNGs in temp directory
- **Model:** RealESRGAN-ncnn-vulkan (binary at `01_backend/img_pipeline/bin/realesrgan/`)
- **Resource:** CPU-bound (ThreadPoolExecutor, max_workers=2)

### Stage 2: Background Removal
- **Step03_Background.py:** Remove background via RMBG-1.4
- **Input:** Upscaled images
- **Output:** Alpha masks (transparent background)
- **Model:** RMBG-1.4 (briaai/RMBG-1.4, Hugging Face)
- **Resource:** GPU-bound (batch processing, VRAM ~2-3 GB)

### Stage 3: Captioning
- **Step02_Caption.py:** Generate image captions via BLIP-2
- **Input:** Upscaled images
- **Output:** Caption strings (descriptive text)
- **Model:** BLIP-2 (Salesforce/blip2-opt-2.7b, Hugging Face)
- **Resource:** GPU-bound (batch processing, VRAM ~4-6 GB)

### Stage 4: Refinement
- **Step04_Detection.py:** Object detection via GroundingDINO
- **Step05_Segmentation.py:** Mask refinement via SAM + RMBG fusion
- **Step06_Categorization.py:** BIM taxonomy classification via GPT + SentenceTransformers
- **Input:** Images, captions, background masks
- **Output:** Bounding boxes, refined masks, category/subcategory labels
- **Models:** GroundingDINO (IDEA-Research/grounding-dino-tiny), SAM (facebook/sam-vit-huge), OpenAI GPT, SentenceTransformers (all-MiniLM-L6-v2)
- **Resource:** GPU-bound (conditional: only runs if background mask quality < 0.6)

### Stage 5: Embeddings
- **Step07_Embeddings.py:** Generate dual embeddings (image + text) via SigLIP + SentenceTransformers
- **Input:** Images, captions
- **Output:** `image_embedding` (768-dim), `text_embedding` (384-dim, optional)
- **Model:** SigLIP (google/siglip-base-patch16-224), SentenceTransformers (all-MiniLM-L6-v2)
- **Resource:** GPU-bound (batch processing, VRAM ~3-4 GB)
- **Normalization:** L2-normalized (cosine-compatible)

### Stage 6: Finalization
- **Step08_OutputUtils.py:** Assemble records (LOD estimation, metadata)
- **Step09_DataTools.py:** Consolidate batch manifests into master_registry.json
- **Step13_GraphPrep.py:** Generate graph (UMAP dimensionality reduction + kNN precomputation)
- **Input:** Batch JSONs, master_registry.json
- **Output:** master_registry.json (updated), graph_data.json (regenerated)
- **Resource:** CPU-bound (UMAP/kNN on embeddings)

---

## Known Issues & Fragile Areas

### 1. Frontend Crashes

#### Issue 1.1: Dashboard Generation Crash
**Location:** `02_frontend/src/components/dashboard/ResultsDashboard.tsx`

**Symptom:** Dashboard crashes when pipeline returns malformed records (missing required fields).

**Root cause:** No schema validation on pipeline results. Metrics calculations (LOD average, category distribution) assume exact field names.

**Fragile code:**
```typescript
const avgLOD = results.reduce((sum, r) => sum + r.lod, 0) / results.length;
// Crashes if r.lod is undefined
```

**Fix needed:** Add schema validation, filter invalid records, wrap calculations in try/catch, add ErrorBoundary component.

---

#### Issue 1.2: Graph Grouping/Switching Race Condition
**Location:** `02_frontend/src/components/graph/SemanticGraph.tsx`

**Symptom:** Switching layout modes during animation causes flicker or crash (grid indexing mismatch).

**Root cause:** Layout switch recalculates `targetPositions` while animation is in progress. Spatial grid rebuilt mid-animation, causing indices to mismatch.

**Fragile code:**
```typescript
useEffect(() => {
  // Layout change triggers immediate recalculation
  recalculateLayout(layoutMode);
}, [layoutMode]);
```

**Fix needed:** Add layout lock state, debounce layout changes (300ms), disable layout buttons during animation, rebuild spatial grid only when stable.

---

#### Issue 1.3: Node Deletion/Recalc Sync
**Location:** `02_frontend/src/hooks/useGraphData.ts` + `02_frontend/src/components/layout/DetailPanel.tsx`

**Symptom:** After deleting a node, clicking neighbors in DetailPanel crashes (orphaned neighbor indices).

**Root cause:** `removeNode()` filters deleted node from array but doesn't rebuild neighbor arrays. Neighbor indices become stale (point to wrong nodes or out-of-bounds).

**Fragile code:**
```typescript
const removeNode = (id: string) => {
  setNodes(prev => prev.filter(n => n.id !== id));
  // Neighbor arrays NOT updated!
};
```

**Fix needed:** Rebuild neighbor arrays after deletion (filter out deleted node index, adjust remaining indices), add bounds checking in DetailPanel neighbor map.

---

### 2. Backend Issues

#### Issue 2.1: Scattered Configuration
**Location:** Multiple files (Step02, Step03, Step07, Step11, Step12, run_viz.py)

**Symptom:** Model URLs hardcoded in 6+ files. Swapping embedding model (e.g., SigLIP → CLIP) requires cascade changes.

**Root cause:** No centralized config layer. Each step loads models independently.

**Hardcoded locations:**
- `Step07_Embeddings.py`: `"google/siglip-base-patch16-224"`
- `Step02_Caption.py`: `"Salesforce/blip2-opt-2.7b"`
- `Step03_Background.py`: `"briaai/RMBG-1.4"`
- `Step11_Detection.py`: `"IDEA-Research/grounding-dino-tiny"`, `"facebook/sam-vit-huge"`
- `run_viz.py`: `"google/siglip-base-patch16-224"`

**Fix needed:** Create `config/default.yaml` with all model URLs, create config loader, update all steps to use config.

---

#### Issue 2.2: Windows-Specific Paths
**Location:** `01_backend/img_pipeline/Step13_GraphPrep.py`

**Symptom:** Hardcoded `C:\LECG\LOD Checker` breaks cross-platform compatibility.

**Fragile code:**
```python
ROOT_DIR = Path(r"C:\LECG\LOD Checker")
```

**Fix needed:** Use relative paths from project root, resolve dynamically via `pathlib.Path(__file__).parent`.

---

#### Issue 2.3: Global Singletons
**Location:** `Step07_Embeddings.py`, `Step11_Detection.py`, `run_viz.py`

**Symptom:** Models loaded as global variables (not thread-safe, hard to test).

**Fragile code:**
```python
_SIGLIP_MODEL = None
_SIGLIP_PROCESSOR = None

def load_siglip():
    global _SIGLIP_MODEL, _SIGLIP_PROCESSOR
    if _SIGLIP_MODEL is None:
        _SIGLIP_MODEL = AutoModel.from_pretrained("google/siglip-base-patch16-224")
```

**Fix needed:** Provider pattern (abstract model loading), dependency injection (pass model instances to functions).

---

### 3. Pipeline Issues

#### Issue 3.1: Two Orchestrators
**Location:** `Run_Pipeline.py` vs `Run_Pipeline_Optimized.py`

**Symptom:** Confusion about which orchestrator is canonical. Documentation references both.

**Root cause:** `Run_Pipeline.py` is baseline (deprecated), `Run_Pipeline_Optimized.py` is actively used (VRAM-optimized).

**Fix needed:** Rename `Run_Pipeline.py` → `Run_Pipeline_Legacy.py`, update docs to reference only Optimized version.

---

#### Issue 3.2: No Schema Validation
**Location:** `Step09_DataTools.py`, `Step13_GraphPrep.py`

**Symptom:** JSON records assumed to have specific fields. Silent failures if schema changes.

**Root cause:** No Pydantic models or JSON schema validation.

**Fix needed:** Define `ImageRecord` and `GraphNode` Pydantic models, validate on consolidation (Step09) and graph generation (Step13).

---

## Future Expansion Path (Do NOT Implement Yet)

### APS/ACC Integration (Planned)
**Goal:** Extract thumbnails from Autodesk Construction Cloud (ACC) via Model Derivative API.

**Architecture:**
- **Backend:** Add `01_backend/acc/` module:
  - `auth.py` - 3-legged OAuth (PKCE flow)
  - `model_derivative.py` - Extract thumbnails via urn:adsk.objects:* → SVF2 → PNG
  - `data_management.py` - List projects, folders, items
- **Frontend:** Add UI in `02_frontend/src/components/acc/`:
  - `ProjectSelector.tsx` - Select ACC project
  - `FolderTree.tsx` - Navigate folder hierarchy
  - `ThumbnailExtractor.tsx` - Trigger thumbnail extraction → pipeline
- **Data flow:** ACC thumbnails → local `00_data/uploads/` → pipeline → graph (same as local uploads)
- **Auth:** Store tokens in environment variables or encrypted config (not git-committed)

**Note:** Current refactor should NOT block this path. Avoid hardcoding assumptions that prevent APS integration later (e.g., local-only file paths).

---

## Environment Details (Critical for Debugging)

### Hardware
- **GPU:** NVIDIA GeForce RTX 5070 Ti Laptop
- **Driver:** 576.65
- **Compute Capability:** sm_120 (Blackwell architecture)

### Software
- **OS:** Windows (PowerShell execution target)
- **Python:** 3.12 ONLY (do NOT upgrade/downgrade)
- **Torch:** 2.6.0+cu124
- **CUDA:** 12.4 (bundled via torch)
- **torch.cuda.is_available():** `True`

### Known Warning (Non-Blocking)
```
CUDA Toolkit not compiled with sm_120 support
```
**Status:** Expected on RTX 50-series (Blackwell). PyTorch 2.6.0+cu124 binaries don't include sm_120 kernels. The warning is harmless; pipeline still runs on CUDA.

**Do NOT fix by:** Downgrading Python, switching to CPU, or upgrading PyTorch (breaks other dependencies).

---

## Summary

- **5 layers:** Launcher (run_viz.py), Backend API (Flask), Pipeline (13 steps), Data Storage (00_data/), Frontend (React)
- **Data flow:** Upload → Pipeline → master_registry.json + graph_data.json → Backend → Frontend
- **Known issues:** 3 frontend crashes (dashboard, layout switch, deletion sync), scattered config, Windows paths, global singletons
- **Hard invariants:** Python 3.12, CUDA-enabled, do-not-touch data, stable contracts
- **Future:** APS/ACC integration (01_backend/acc/ + frontend UI)

For file-by-file map, see CODEBASE_MAP.md. For how to run, see RUNBOOK.md. For repo conventions, see skills.md.
