# LOD Checker - Visual RAG for BIM Images

**LOD Checker** is a local-first Visual RAG (Retrieval-Augmented Generation) workflow for analyzing BIM (Building Information Modeling) images. Upload images, run the computer vision pipeline, and explore a 24K-node interactive graph with semantic search.

---

## Quick Start

### Prerequisites
- **Windows** (PowerShell)
- **Python 3.12** (do NOT use 3.11 or 3.13)
- **NVIDIA GPU** (CUDA-capable, e.g., RTX 5070 Ti)
- **Node.js 20.x** or later

### Installation

1. **Clone the repository:**
   ```powershell
   git clone https://github.com/lecgarq/LODChecker
   cd LODChecker
   ```

2. **Create Python virtual environment:**
   ```powershell
   cd 01_backend
   python -m venv imgpipe_env
   .\imgpipe_env\Scripts\Activate.ps1
   pip install -r ..\requirements.txt
   cd ..
   ```

3. **Install frontend dependencies:**
   ```powershell
   cd 02_frontend
   npm install
   cd ..
   ```

4. **Create `.env` file:**
   ```env
   OPENAI_API_KEY=sk-your-key-here
   OPENAI_MODEL=gpt-4
   ```

### Run the System

```powershell
python run_viz.py
```

- **Backend:** http://localhost:5000
- **Frontend:** http://localhost:5173

Open http://localhost:5173 in your browser.

---

## Features

- **Local-first pipeline:** Process images on your GPU (no cloud dependency except OpenAI categorization)
- **13-step computer vision pipeline:**
  1. 4× Upscaling (RealESRGAN)
  2. Background Removal (RMBG-1.4)
  3. Image Captioning (BLIP-2)
  4. Object Detection (GroundingDINO)
  5. Mask Refinement (SAM)
  6. BIM Categorization (GPT + SentenceTransformers)
  7. Dual Embeddings (SigLIP image + text)
  8. Graph Generation (UMAP + kNN)
- **Interactive 24K-node graph:** WebGL canvas rendering with pan/zoom/selection
- **Semantic search:** Dual encoding (original + OpenAI-expanded query) with keyword grounding
- **Dashboard:** LOD (Level of Detail) metrics + category distribution

---

## Architecture Overview

```
User Upload (Images)
  ↓
Computer Vision Pipeline (13 steps)
  ↓
Embeddings + Graph Generation (UMAP + kNN)
  ↓
Interactive WebGL Graph + Semantic Search
```

**Stack:**
- **Backend:** Python 3.12 + Flask + PyTorch + CUDA
- **Pipeline:** SigLIP, BLIP-2, RMBG, GroundingDINO, SAM, OpenAI GPT
- **Frontend:** React + TypeScript + Vite + Tailwind + Canvas 2D
- **Data:** JSON artifacts (master_registry.json, graph_data.json)

For detailed architecture, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Documentation

- **[RUNBOOK.md](RUNBOOK.md)** - How to run the system, env vars, validation steps
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Modules, boundaries, data flow, known issues
- **[CODEBASE_MAP.md](CODEBASE_MAP.md)** - File-by-file system map
- **[skills.md](skills.md)** - Codex working agreements + repo conventions
- **[DECISIONS.md](DECISIONS.md)** - Architecture decisions log

---

## Known Issues

### Frontend Crashes (Being Fixed)
1. **Dashboard generation:** Crashes on malformed records (missing validation)
2. **Graph grouping/switching:** Race condition during layout changes (grid indexing mismatch)
3. **Node deletion/recalc sync:** Neighbor arrays not rebuilt after deletion (orphaned references)

### Backend Issues (Being Refactored)
1. **Scattered configuration:** Model URLs hardcoded in 6+ files
2. **Windows-specific paths:** `C:\LECG\LOD Checker` hardcoded (breaks cross-platform)
3. **Global singletons:** Models loaded as global variables (not thread-safe)

See [ARCHITECTURE.md](ARCHITECTURE.md) → Known Issues for details.

---

## Contributing

See [skills.md](skills.md) for:
- Repo conventions (PEP 8, TypeScript strict mode)
- Hard invariants (Python 3.12 ONLY, CUDA-required, do-not-touch areas)
- Branching strategy (small PRs, behavior-preserving changes)

---

## Environment Details

### Hardware
- **GPU:** NVIDIA GeForce RTX 5070 Ti Laptop
- **Driver:** 576.65
- **CUDA:** 12.4 (bundled via PyTorch 2.6.0+cu124)

### Software
- **OS:** Windows (PowerShell)
- **Python:** 3.12 ONLY
- **Node.js:** 20.x or later
- **PyTorch:** 2.6.0+cu124
- **torch.cuda.is_available():** `True`

### Known Warning (Non-Blocking)
```
CUDA Toolkit not compiled with sm_120 support
```
**Status:** Expected on RTX 50-series (Blackwell). The warning is harmless; pipeline still runs on CUDA.

---

## Future Expansion (Planned, Not In Scope)

### APS/ACC Integration
- Extract thumbnails from Autodesk Construction Cloud (ACC) via Model Derivative API
- Add `01_backend/acc/` module for APS/ACC API handlers
- Add frontend UI for project/tree selection + 3-legged OAuth

---

## License

TODO: Add license (MIT, Apache 2.0, etc.)

---

## Contact

- **GitHub:** https://github.com/lecgarq/LODChecker
- **Issues:** https://github.com/lecgarq/LODChecker/issues

---

## Acknowledgments

This project uses the following models and libraries:
- **SigLIP** (Google) - Image embeddings
- **BLIP-2** (Salesforce) - Image captioning
- **RMBG-1.4** (BRIA AI) - Background removal
- **GroundingDINO** (IDEA Research) - Object detection
- **SAM** (Meta) - Segmentation
- **RealESRGAN** (Tencent) - Image upscaling
- **UMAP** (McInnes et al.) - Dimensionality reduction
- **OpenAI GPT** - BIM categorization

---

## Quick Links

- **Run system:** `python run_viz.py`
- **Run pipeline:** `python 01_backend/img_pipeline/Run_Pipeline_Optimized.py --input ... --output ... --provider ...`
- **Consolidate data:** `python 01_backend/img_pipeline/Step09_DataTools.py --consolidate`
- **Regenerate graph:** `python 01_backend/img_pipeline/Step13_GraphPrep.py`

For more details, see [RUNBOOK.md](RUNBOOK.md).
