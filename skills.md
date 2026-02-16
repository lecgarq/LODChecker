# LOD Checker - Codex Working Agreements & Repo Conventions

This file defines the working agreements, hard constraints, and conventions for the LOD Checker Visual RAG codebase. **Codex (or any agent) must follow these rules when making changes to prevent regressions and maintain system integrity.**

---

## Hard Invariants (NON-NEGOTIABLE)

### Environment
- **Operating System:** Windows (PowerShell execution target)
- **Python Version:** **3.12 ONLY** - Do NOT suggest upgrading or downgrading Python
- **CUDA Requirement:** Pipeline **MUST remain CUDA/NVIDIA-enabled** - Do NOT propose CPU-only changes
- **GPU:** NVIDIA GeForce RTX 5070 Ti Laptop
- **Driver:** 576.65
- **Torch:** 2.6.0+cu124, CUDA 12.4, `torch.cuda.is_available() == True`
- **Known Issue:** sm_120 compatibility warning with current PyTorch build on RTX 50-series (Blackwell) - This is expected and non-blocking. Do NOT "fix" by changing Python version or switching to CPU.

### Do-Not-Touch Areas
- **`00_data/img/`** - Training/processed images. Do NOT modify or delete.
- **`00_data/Categories.json`** - BIM category taxonomy. Do NOT modify (manually maintained).
- **`00_data/vectors/`** - Data artifacts (master_registry.json, graph_data.json). **Append-only** when writing finalized pipeline outputs. Do NOT manually edit existing records.

### Data Contracts (Must Remain Stable)
- **`00_data/vectors/master_registry.json`** - Schema must remain unchanged (pipeline → backend → frontend dependency)
- **`00_data/vectors/graph_data.json`** - Schema must remain unchanged (backend → frontend dependency)
- Any changes to these schemas require coordinated updates across pipeline, backend, and frontend

---

## Repo Conventions

### Python Code Style
- **PEP 8 compliance** - Use 4 spaces for indentation, max line length 120
- **Type hints encouraged** - Use where helpful (not mandatory yet)
- **Docstrings for public functions** - Explain purpose, params, returns
- **Lazy model loading** - Models should load on-demand, not at module import (to avoid VRAM pressure)
- **VRAM cleanup** - Explicitly call `gc.collect()` + `torch.cuda.empty_cache()` after heavy model stages

### Frontend Code Style
- **TypeScript strict mode** - All new code must pass `tsc --noEmit`
- **React functional components** - Use hooks, avoid class components
- **Component organization:**
  - `components/ui/` - Reusable primitives (buttons, spinners, etc.)
  - `components/layout/` - Page structure (toolbar, panels)
  - `components/graph/` - Graph visualization
  - `components/dashboard/` - Metrics and analysis
  - `components/search/` - Search UI and results
- **Hooks in `hooks/`** - Custom hooks for data fetching, state management
- **Tailwind for styling** - Avoid inline styles, use Tailwind classes

### Git & Branching
- **Main branch:** `main` (protected)
- **Feature branches:** `feature/<short-description>` (e.g., `feature/config-consolidation`)
- **PR strategy:** Small, incremental PRs with clear acceptance criteria
- **Commit messages:** Descriptive, imperative mood (e.g., "Add config loader for centralized settings")

---

## Model Loading Patterns

### Current Pattern (To Be Preserved)
1. **Global singleton with lazy loading:**
   ```python
   _MODEL = None
   def load_model():
       global _MODEL
       if _MODEL is None:
           _MODEL = transformers.from_pretrained("model-name")
       return _MODEL
   ```
2. **Subprocess isolation:** Pipeline steps communicate via JSON files (not in-memory), allowing isolated Python processes
3. **VRAM management:** Models explicitly deleted after use in optimized pipeline

### Future Pattern (After Refactor)
- **Provider/Adapter pattern:** Abstract model loading behind interfaces
- **Dependency injection:** Pass model instances to functions (not global singletons)
- **Config-driven:** Model URLs loaded from YAML config (not hardcoded)

---

## Data Flow & Pipeline Stages

### Pipeline Stages (Canonical)
1. **Prep & Upscale** - Step01_Upscale.py (4× RealESRGAN)
2. **Background Removal** - Step03_Background.py (RMBG-1.4)
3. **Captioning** - Step02_Caption.py (BLIP-2)
4. **Refinement** - Step04_Detection.py (GroundingDINO) + Step05_Segmentation.py (SAM) + Step06_Categorization.py (GPT + SentenceTransformers)
5. **Embeddings** - Step07_Embeddings.py (SigLIP image + text embeddings)
6. **Finalize** - Step08_OutputUtils.py + Step09_DataTools.py (consolidate) + Step13_GraphPrep.py (UMAP + kNN graph)

### Data Flow
```
User Upload (Frontend)
  ↓
POST /api/run/local_pipeline (Backend)
  ↓
Run_Pipeline_Optimized.py (Orchestrator)
  ↓
Step01 → Step02 → ... → Step13
  ↓
00_data/vectors/ (master_registry.json, graph_data.json)
  ↓
Backend /vectors/<path> (Serve artifacts)
  ↓
Frontend (Load graph, render Canvas)
```

---

## Testing Approach

### Current State
- **No automated tests** - Manual validation only
- **Validation steps:**
  1. Run pipeline on 1-3 test images
  2. Verify artifacts exist (master_registry.json, graph_data.json)
  3. Start backend (`python run_viz.py`)
  4. Start frontend (Vite dev server on 5173)
  5. Load graph in browser, verify dashboard/search/grouping/deletion work

### Future State (After Refactor)
- **Remote tester pipeline** - Standalone harness for pipeline-only validation
- **GitHub Actions CI** - Automated checks on PRs (lint, typecheck, build)
- **Smoke tests** - Backend endpoints, frontend build
- **Acceptance tests** - End-to-end upload → pipeline → graph → search

---

## Known Issues & Fragile Areas

### Frontend Crashes (To Be Fixed)
1. **Dashboard generation** - Crashes on malformed records (missing validation)
2. **Graph grouping/switching** - Race condition during layout changes (indexing mismatch)
3. **Node deletion/recalc sync** - Neighbor arrays not rebuilt after deletion (orphaned references)

### Backend Issues
- **Scattered configuration** - Model URLs hardcoded in 6+ files
- **Windows-specific paths** - `C:\LECG\LOD Checker` hardcoded in Step13_GraphPrep.py
- **Global singletons** - Models loaded as global variables (not thread-safe)

### Pipeline Issues
- **Two orchestrators** - Run_Pipeline.py vs Run_Pipeline_Optimized.py (confusion about which is canonical)
- **No schema validation** - JSON records assumed to have specific fields (implicit contracts)

---

## Future Expansion Path (Do NOT Implement Yet)

### APS/ACC Integration (Planned, Not In Scope)
- **Backend:** Add `01_backend/acc/` module for APS/ACC API handlers (Model Derivative + Data Management)
- **Frontend:** Add UI for project/tree selection + 3-legged OAuth
- **Data flow:** APS thumbnails → pipeline → graph (same as local uploads)
- **Auth:** Store tokens securely (environment variables or encrypted config)

**Note:** Current refactor should NOT block this path. Avoid hardcoding assumptions that prevent APS integration later.

---

## Code Review Checklist

Before submitting a PR:
- [ ] Python 3.12 compatibility verified
- [ ] CUDA/GPU functionality preserved (no CPU-only changes)
- [ ] Do-not-touch areas unmodified (00_data/img, Categories.json, vectors except append-only)
- [ ] Data contracts stable (master_registry.json, graph_data.json schemas unchanged)
- [ ] Tests pass (manual smoke tests for now, CI checks after refactor)
- [ ] Documentation updated (RUNBOOK.md, ARCHITECTURE.md if applicable)
- [ ] No new global singletons introduced
- [ ] VRAM cleanup included for heavy model stages

---

## Bootstrap Instructions (GitHub Repo)

### Initial Setup (If Repo Is Empty)
The GitHub repo at https://github.com/lecgarq/LODChecker currently appears empty. To bootstrap:

1. **Verify `.gitignore`** - Ensure it excludes:
   ```
   01_backend/imgpipe_env/
   00_data/img/
   00_data/vectors/*.json
   .env
   node_modules/
   02_frontend/dist/
   __pycache__/
   *.pyc
   ```

2. **Initial commit:**
   ```powershell
   git init
   git add .
   git commit -m "Initial commit: LOD Checker Visual RAG codebase"
   ```

3. **Add remote and push:**
   ```powershell
   git remote add origin https://github.com/lecgarq/LODChecker
   git branch -M main
   git push -u origin main
   ```

4. **Verify:** Check GitHub web UI to confirm files are pushed

---

## Summary

This file defines the **non-negotiable constraints** (Python 3.12, CUDA-only, do-not-touch areas), **repo conventions** (PEP 8, TypeScript strict, small PRs), and **known issues** (frontend crashes, scattered config) for the LOD Checker codebase.

**Any changes must preserve CUDA functionality, Python 3.12 compatibility, and data contract stability.**
