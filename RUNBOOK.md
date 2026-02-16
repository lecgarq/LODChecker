# LOD Checker - Runbook

This runbook provides step-by-step instructions for running, validating, and troubleshooting the LOD Checker Visual RAG system.

---

## System Overview

**LOD Checker** is a local-first Visual RAG workflow:
- **Input:** User uploads BIM images (PNG, JPG, WebP, BMP, TIFF)
- **Pipeline:** 13-step computer vision pipeline (upscale, background removal, captioning, detection, segmentation, categorization, embeddings, graph generation)
- **Output:** Interactive 24K-node WebGL graph + semantic search
- **Stack:** Python 3.12 pipeline + Flask backend + React/TypeScript/Vite frontend

---

## Prerequisites

### Environment
- **OS:** Windows (PowerShell)
- **Python:** 3.12 ONLY (do NOT use 3.11 or 3.13)
- **GPU:** NVIDIA GeForce RTX 5070 Ti Laptop (or similar CUDA-capable GPU)
- **NVIDIA Driver:** 576.65 or compatible
- **CUDA:** 12.4 (bundled via torch 2.6.0+cu124)
- **Node.js:** 20.x or later (for frontend)

### Environment Variables
Create a `.env` file in the project root (`C:\LECG\LOD Checker\.env`):

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4
```

- **OPENAI_API_KEY:** Required for GPT categorization (Step06) and AI batch analysis
- **OPENAI_MODEL:** Optional, defaults to `gpt-4`

### Python Virtual Environment
The pipeline uses a virtual environment at `01_backend/imgpipe_env/`. This is auto-detected by `run_viz.py`.

If missing, create it:
```powershell
cd C:\LECG\LOD Checker\01_backend
python -m venv imgpipe_env
.\imgpipe_env\Scripts\Activate.ps1
pip install -r ..\requirements.txt
```

### Frontend Dependencies
```powershell
cd C:\LECG\LOD Checker\02_frontend
npm install
```

---

## Local Development Startup

### Quick Start (Recommended)
```powershell
cd C:\LECG\LOD Checker
python run_viz.py
```

This launches:
- **Backend:** Flask server on http://localhost:5000
- **Frontend:** Vite dev server on http://localhost:5173

**Access:** Open http://localhost:5173 in your browser.

---

## Pipeline CLI (Standalone)

To run the pipeline independently (without backend/frontend):

### Using Optimized Pipeline (Recommended)
```powershell
cd C:\LECG\LOD Checker\01_backend\img_pipeline
..\..\imgpipe_env\Scripts\python.exe Run_Pipeline_Optimized.py --input "C:\path\to\images" --output "C:\LECG\LOD Checker\00_data\vectors" --provider "YourProviderName"
```

- **--input:** Directory containing images to process
- **--output:** Directory to write batch manifest JSON
- **--provider:** Image source/provider name (e.g., "BIMOBJECT", "LECG Arquitectura")

### Using Legacy Pipeline (Not Recommended)
```powershell
..\..\imgpipe_env\Scripts\python.exe Run_Pipeline.py --input "C:\path\to\images"
```

**Note:** `Run_Pipeline_Optimized.py` is the canonical version (VRAM-optimized, ~20s/image target). `Run_Pipeline.py` is deprecated.

---

## Data Consolidation & Graph Regeneration

After running the pipeline, consolidate batch results and regenerate the graph:

### Consolidate Batch Manifests into master_registry.json
```powershell
cd C:\LECG\LOD Checker\01_backend\img_pipeline
..\..\imgpipe_env\Scripts\python.exe Step09_DataTools.py --consolidate
```

This merges all `batch_*.json` files into `00_data/vectors/master_registry.json`.

### Regenerate Graph (UMAP + kNN)
```powershell
..\..\imgpipe_env\Scripts\python.exe Step13_GraphPrep.py
```

This reads `master_registry.json`, applies UMAP dimensionality reduction, precomputes kNN (K=30), and writes `00_data/vectors/graph_data.json`.

---

## Model Dependencies (Auto-Downloaded)

The pipeline uses Hugging Face models that auto-download on first run:

| Model | Purpose | Cache Location |
|-------|---------|----------------|
| `google/siglip-base-patch16-224` | Image embeddings (Step07) | `~/.cache/huggingface/` |
| `Salesforce/blip2-opt-2.7b` | Image captioning (Step02) | `~/.cache/huggingface/` |
| `briaai/RMBG-1.4` | Background removal (Step03) | `~/.cache/huggingface/` |
| `IDEA-Research/grounding-dino-tiny` | Object detection (Step04, Step11) | `~/.cache/huggingface/` |
| `facebook/sam-vit-huge` | Segmentation (Step05, Step11) | `~/.cache/huggingface/` |
| `sentence-transformers/all-MiniLM-L6-v2` | Text embeddings (Step06, Step07) | `~/.cache/huggingface/` |

### First Run Download Sizes
- Total: ~15-20 GB (models are large)
- Requires: Stable internet connection
- Time: 10-30 minutes (depending on network speed)

---

## Binary Dependencies

### RealESRGAN (Step01, Step12)
- **Location:** `01_backend/img_pipeline/bin/realesrgan/realesrgan-ncnn-vulkan.exe`
- **Purpose:** 4× image upscaling
- **Fallback:** If binary missing, Step01 skips upscaling and returns original image

**If missing, download:**
1. Visit: https://github.com/xinntao/Real-ESRGAN/releases
2. Download: `realesrgan-ncnn-vulkan-<version>-windows.zip`
3. Extract `realesrgan-ncnn-vulkan.exe` to `01_backend/img_pipeline/bin/realesrgan/`

---

## Data Artifacts

### master_registry.json
- **Location:** `00_data/vectors/master_registry.json`
- **Schema:** Array of image records with metadata:
  - `id` (UUID), `name_of_file`, `name_of_image`
  - `image_embedding` (768-dim SigLIP vector)
  - `final_category`, `subcategory`, `lod`, `lod_label`
  - `provider`, `family_name`, `processed_at`, `file_size_kb`
  - See ARCHITECTURE.md for full schema

### graph_data.json
- **Location:** `00_data/vectors/graph_data.json`
- **Schema:**
  - `meta` (UMAP/kNN parameters)
  - `nodes` (array with `id`, `x`, `y`, `neighbors`, metadata)
  - See ARCHITECTURE.md for full schema

### Categories.json
- **Location:** `00_data/Categories.json`
- **Purpose:** BIM category taxonomy (560+ categories)
- **Maintenance:** Manually curated (do NOT auto-generate)

---

## Validation Steps

### 1. Pipeline Smoke Test
Run pipeline on 1 test image:
```powershell
cd C:\LECG\LOD Checker\01_backend\img_pipeline
..\..\imgpipe_env\Scripts\python.exe Run_Pipeline_Optimized.py --input "C:\path\to\test_image.png" --output "C:\LECG\LOD Checker\00_data\vectors" --provider "Test"
```

**Expected:**
- Batch manifest created: `00_data/vectors/batch_OPTIMIZED_<timestamp>.json`
- No errors in console
- Processed image in `00_data/img/<filename>`

### 2. Backend Smoke Test
Start backend and hit endpoints:
```powershell
cd C:\LECG\LOD Checker
python run_viz.py
```

In another terminal (or browser):
```powershell
# Health check
curl http://localhost:5000/health

# Search test
curl "http://localhost:5000/api/search?q=door"

# Graph data
curl http://localhost:5000/vectors/graph_data.json
```

**Expected:**
- `/health` returns `{"status": "ok", "items": <count>}`
- `/api/search` returns `{"results": [...]}`
- `/vectors/graph_data.json` returns valid JSON

### 3. Frontend Smoke Test
```powershell
cd C:\LECG\LOD Checker\02_frontend
npm run build
```

**Expected:**
- `dist/` directory created
- `dist/index.html` exists
- `dist/assets/` contains bundled JS/CSS

### 4. Manual UI Validation
1. Open http://localhost:5173
2. **Upload flow:** Upload 3 images → verify dashboard shows metrics
3. **Graph load:** Click "Explore Graph" → verify 24K nodes render
4. **Search:** Search "door" → verify results highlighted
5. **Grouping:** Switch layout (Similarity → Category → LOD) → verify smooth transitions
6. **Deletion:** Select node → delete → verify no crash

---

## Troubleshooting

### Issue: `torch.cuda.is_available() == False`
**Cause:** CUDA not detected or PyTorch CPU-only version installed.

**Fix:**
1. Verify NVIDIA driver: `nvidia-smi`
2. Reinstall PyTorch with CUDA:
   ```powershell
   pip install torch==2.6.0+cu124 --index-url https://download.pytorch.org/whl/cu124
   ```

### Issue: `sm_120 compatibility warning` on RTX 50-series
**Message:** `CUDA Toolkit not compiled with sm_120 support`

**Status:** **Known issue, non-blocking.** PyTorch 2.6.0+cu124 binaries don't include sm_120 kernels for RTX 50-series (Blackwell). The warning is harmless; pipeline still runs on CUDA.

**Do NOT fix by:** Downgrading Python, switching to CPU, or upgrading PyTorch (breaks other dependencies).

### Issue: `ModuleNotFoundError: No module named 'transformers'`
**Cause:** Virtual environment not activated or dependencies not installed.

**Fix:**
```powershell
cd C:\LECG\LOD Checker\01_backend
.\imgpipe_env\Scripts\Activate.ps1
pip install -r ..\requirements.txt
```

### Issue: Backend returns 404 for `/api/search`
**Cause:** `master_registry.json` missing or backend failed to load resources.

**Fix:**
1. Verify `00_data/vectors/master_registry.json` exists
2. Restart backend: `python run_viz.py`
3. Check console for errors during `load_resources()`

### Issue: Frontend graph doesn't load
**Cause:** `graph_data.json` missing or malformed.

**Fix:**
1. Regenerate graph: `python 01_backend/img_pipeline/Step13_GraphPrep.py`
2. Verify `00_data/vectors/graph_data.json` exists
3. Check JSON is valid: `python -m json.tool 00_data/vectors/graph_data.json`

### Issue: Dashboard crashes on upload
**Cause:** Malformed pipeline results (missing required fields).

**Fix:**
1. Check browser console for errors
2. Verify pipeline output has required fields: `id`, `name_of_file`, `final_category`, `lod`
3. If persistent, see ARCHITECTURE.md → Known Issues

---

## Performance Tuning

### Pipeline Speed (~20s/image target)
- **Current:** Run_Pipeline_Optimized.py uses batch GPU processing + VRAM cleanup
- **Bottlenecks:** Step01 (RealESRGAN), Step02 (BLIP-2), Step04/05 (GroundingDINO + SAM)
- **Future:** Profile with PyTorch profiler, optimize VRAM allocation

### Graph Rendering (24K nodes)
- **Current:** Canvas 2D with frustum culling + sprite batching
- **Optimizations:** Low-quality mode during drag, stride rendering, spatial grid hit testing

---

## GitHub Repo Bootstrap (If Empty)

The repo at https://github.com/lecgarq/LODChecker currently appears empty. To push local code:

1. **Verify `.gitignore`:**
   ```gitignore
   01_backend/imgpipe_env/
   00_data/img/
   00_data/vectors/*.json
   .env
   node_modules/
   02_frontend/dist/
   __pycache__/
   *.pyc
   ```

2. **Initialize and push:**
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: LOD Checker Visual RAG"
   git remote add origin https://github.com/lecgarq/LODChecker
   git branch -M main
   git push -u origin main
   ```

3. **Verify:** Check GitHub web UI

---

## Summary

- **Local dev:** `python run_viz.py` (backend on 5000, frontend on 5173)
- **Pipeline CLI:** `Run_Pipeline_Optimized.py --input ... --output ... --provider ...`
- **Consolidate:** `Step09_DataTools.py --consolidate`
- **Graph regen:** `Step13_GraphPrep.py`
- **Validation:** Pipeline smoke → backend smoke → frontend smoke → manual UI
- **Troubleshooting:** See sections above for common issues

For architecture details, see ARCHITECTURE.md. For repo conventions, see skills.md.
