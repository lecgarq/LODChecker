# LOD Checker - Codebase Map

This document provides a file-by-file map of the LOD Checker codebase.

---

## Root Directory

```
C:\LECG\LOD Checker\
├── run_viz.py                  # Main launcher: Flask backend + Vite frontend + resource loader
├── requirements.txt            # Python dependencies (torch, transformers, flask, openai, etc.)
├── .env                        # Environment variables (OPENAI_API_KEY, OPENAI_MODEL) [git-ignored]
├── .env.example                # Template for .env file
├── .gitignore                  # Git ignore rules
├── aps.env                     # APS/ACC environment variables (future use)
├── README.md                   # Project overview
├── ARCHITECTURE_MAP.md         # High-level system design (existing doc)
├── 00_data/                    # Data storage (images, vectors, categories)
├── 01_backend/                 # Backend: Flask app + pipeline
├── 02_frontend/                # Frontend: React + TypeScript + Vite
└── .claude/                    # Claude Code config [git-ignored]
```

---

## 00_data/ (Data Storage)

```
00_data/
├── img/                        # Processed images (do NOT modify manually)
│   ├── <filename>.png          # Processed image output from pipeline
│   └── thumb/                  # Thumbnails (auto-generated)
├── vectors/                    # Data artifacts (append-only for finalized outputs)
│   ├── master_registry.json    # Master record of all processed images (embeddings + metadata)
│   ├── graph_data.json         # UMAP graph data (nodes with x/y coords + kNN neighbors)
│   └── batch_*.json            # Batch manifests from pipeline runs (consolidated into master_registry)
└── Categories.json             # BIM category taxonomy (manually maintained, do NOT auto-generate)
```

### Key Data Contracts

**master_registry.json** - Array of image records:
- Schema: `id`, `name_of_file`, `image_embedding` (768-dim), `final_category`, `lod`, `lod_label`, `provider`, etc.
- Purpose: Central registry of all processed images with embeddings for search

**graph_data.json** - Graph visualization data:
- Schema: `meta` (UMAP/kNN params), `nodes` (array with `id`, `x`, `y`, `neighbors`, metadata)
- Purpose: Frontend graph rendering (24K nodes)

**Categories.json** - BIM categories:
- Schema: Hierarchical dict of categories with subcategories and descriptions
- Purpose: Reference for pipeline categorization (Step06) and frontend coloring

---

## 01_backend/ (Backend: Flask + Pipeline)

```
01_backend/
├── imgpipe_env/                # Python 3.12 virtual environment [git-ignored]
│   └── Scripts/
│       └── python.exe          # Python 3.12 interpreter
└── img_pipeline/               # Computer vision pipeline (13 steps)
    ├── Run_Pipeline.py         # Baseline pipeline orchestrator (DEPRECATED, use Optimized)
    ├── Run_Pipeline_Optimized.py  # Canonical pipeline orchestrator (VRAM-optimized, ~20s/image)
    ├── Step01_Upscale.py       # Stage 1: 4× upscaling (RealESRGAN)
    ├── Step02_Caption.py       # Stage 3: Image captioning (BLIP-2)
    ├── Step03_Background.py    # Stage 2: Background removal (RMBG-1.4)
    ├── Step04_Detection.py     # Stage 4: Object detection (GroundingDINO)
    ├── Step05_Segmentation.py  # Stage 4: Mask refinement (SAM + RMBG fusion)
    ├── Step06_Categorization.py # Stage 4: BIM taxonomy classification (GPT + SentenceTransformers)
    ├── Step07_Embeddings.py    # Stage 5: Dual embeddings (SigLIP image + text)
    ├── Step08_OutputUtils.py   # Stage 6: Record assembly utilities
    ├── Step09_DataTools.py     # Stage 6: Data consolidation (merge batch → master_registry)
    ├── Step10_Vision.py        # Helper: Vision utilities (cv2 operations)
    ├── Step11_Detection.py     # Helper: Detection utilities (GroundingDINO + SAM singletons)
    ├── Step12_Upscale.py       # Helper: Upscale utilities (RealESRGAN binary wrapper)
    ├── Step13_GraphPrep.py     # Stage 6: Graph generation (UMAP + kNN)
    ├── bin/
    │   └── realesrgan/
    │       └── realesrgan-ncnn-vulkan.exe  # RealESRGAN binary (4× upscaling)
    └── models/                 # Placeholder for model weights (auto-downloaded to ~/.cache/huggingface/)
```

### Pipeline Step Details

| Step | File | Purpose | Input | Output | Models |
|------|------|---------|-------|--------|--------|
| **Step01** | `Step01_Upscale.py` | 4× upscaling | Image | Upscaled PNG | RealESRGAN binary |
| **Step02** | `Step02_Caption.py` | Image captioning | Image | Caption string | BLIP-2 (Salesforce/blip2-opt-2.7b) |
| **Step03** | `Step03_Background.py` | Background removal | Image | Alpha mask | RMBG-1.4 (briaai/RMBG-1.4) |
| **Step04** | `Step04_Detection.py` | Object detection | Image, Categories | Bounding boxes | GroundingDINO (IDEA-Research/grounding-dino-tiny) |
| **Step05** | `Step05_Segmentation.py` | Mask refinement | Image, Boxes | Refined mask | SAM (facebook/sam-vit-huge) |
| **Step06** | `Step06_Categorization.py` | BIM taxonomy | Caption | Category/Subcategory | OpenAI GPT + SentenceTransformers (all-MiniLM-L6-v2) |
| **Step07** | `Step07_Embeddings.py` | Dual embeddings | Image + Caption | Image/Text vectors (768-dim) | SigLIP (google/siglip-base-patch16-224) |
| **Step08** | `Step08_OutputUtils.py` | Record assembly | All data | JSON record | Utilities (cv2, PIL) |
| **Step09** | `Step09_DataTools.py` | Data consolidation | Batch JSONs | master_registry.json | JSON merge utilities |
| **Step10** | `Step10_Vision.py` | Vision utilities | Masks, Images | Processed masks | cv2 |
| **Step11** | `Step11_Detection.py` | Detection utilities | Images | Detections | GroundingDINO, SAM (singleton globals) |
| **Step12** | `Step12_Upscale.py` | Upscale utilities | Images | Upscaled images | RealESRGAN binary |
| **Step13** | `Step13_GraphPrep.py` | Graph generation | master_registry.json | graph_data.json | UMAP (metric="cosine"), pynndescent (kNN) |

### Orchestrator Details

**Run_Pipeline_Optimized.py** (Canonical, ~440 lines):
- **Architecture:** 6-stage batch processing with explicit VRAM management
- **Stages:**
  1. Upscale (CPU parallel, ThreadPoolExecutor, max_workers=2)
  2. Background Removal (GPU batch, RMBG loaded once)
  3. Captioning (GPU batch, BLIP-2 loaded once)
  4. Refinement (Conditional GPU - GDINO+SAM only if quality gate fails)
  5. Embeddings (GPU batch, SigLIP loaded once)
  6. Finalization (Record assembly + manifest write)
- **Output:** `batch_OPTIMIZED_<timestamp>.json` in `/vectors/`
- **Target:** ~20s/image on RTX 5070 Ti

**Run_Pipeline.py** (Deprecated, baseline):
- **Architecture:** Sequential per-image processing with subprocess isolation
- **Status:** Less maintained, reference implementation

---

## 02_frontend/ (Frontend: React + TypeScript + Vite)

```
02_frontend/
├── src/
│   ├── assets/                 # Images (Autodesk logo)
│   ├── components/             # React components (organized by domain)
│   │   ├── dashboard/
│   │   │   └── ResultsDashboard.tsx  # Batch analysis results visualization (LOD gauge, category bars)
│   │   ├── effects/
│   │   │   └── ParticleBackground.tsx  # Landing page animation
│   │   ├── graph/
│   │   │   └── SemanticGraph.tsx  # Main WebGL canvas renderer (~700 lines, 24K nodes)
│   │   ├── layout/
│   │   │   ├── Toolbar.tsx     # Top toolbar (layout switcher, controls)
│   │   │   └── DetailPanel.tsx # Right panel (node details, neighbors, delete button)
│   │   ├── search/
│   │   │   ├── LandingSearch.tsx  # Search entry point
│   │   │   ├── SearchResults.tsx  # Search results sidebar
│   │   │   └── FileUploadModal.tsx  # Image upload modal
│   │   └── ui/
│   │       ├── DetailImage.tsx # Image viewer in detail panel
│   │       ├── Spinner.tsx     # Loading spinner
│   │       └── MinimalLoading.tsx  # Minimal loading overlay
│   ├── hooks/                  # Custom React hooks
│   │   ├── useGraphData.ts     # Fetch & manage 24K-node graph from backend
│   │   ├── useAISearch.ts      # AI search API integration
│   │   └── useKeyboard.ts      # Keyboard event utilities
│   ├── lib/                    # Utilities & constants
│   │   ├── colors.ts           # Deterministic category color mapping
│   │   ├── helpers.ts          # Node image URLs, LOD label parsing
│   │   └── constants.ts        # API endpoints (/vectors/graph_data.json, /api/search)
│   ├── pages/                  # Page-level components
│   │   ├── LandingPage.tsx     # Search entry point
│   │   └── GraphPage.tsx       # Main visualization page
│   ├── types/                  # TypeScript definitions
│   │   └── graph.ts            # GraphNode, SearchResult, LayoutMode
│   ├── App.tsx                 # Root component with page routing
│   ├── main.tsx                # React-DOM entry point
│   └── index.css               # Tailwind + custom animations
├── vite.config.ts              # Vite config (proxy to Flask backend on 5000)
├── tsconfig.json               # TypeScript config (strict mode)
├── tailwind.config.js          # Tailwind theme (colors, fonts, animations)
├── package.json                # Frontend dependencies (react, vite, tailwind, lucide-react)
└── tests/                      # TODO: Frontend smoke tests (not yet implemented)
```

### Frontend Component Details

**SemanticGraph.tsx** (~700 lines, critical):
- **Renderer:** HTML5 Canvas 2D API (NOT Three.js or D3.js)
- **Performance:** Batch rendering by color groups, frustum culling, sprite caching, spatial grid hit testing
- **Layout Modes:** similarity (UMAP), category (grid), lod (grid), provider (grid)
- **Animation:** Smooth position interpolation (0.2 factor), detects stable state
- **Interaction:** Hit testing, hover tooltip, selection, neighbor highlighting, middle-mouse pan, wheel zoom

**useGraphData.ts** (critical):
- **Fetches:** `/vectors/graph_data.json` on mount (one-time load)
- **Deduplicates:** Nodes by ID via Map (safeguard against corrupted data)
- **Node deletion:** Local state mutation via `removeNode(id)` (filters from array)
- **Known issue:** Deletion doesn't rebuild neighbor arrays (causes crashes in DetailPanel)

**FileUploadModal.tsx** (critical):
- **Uploads:** Images via POST `/api/run/local_pipeline` with FormData
- **State sequence:** idle → uploading → processing → finishing → complete
- **Known issue:** No schema validation on pipeline results (crashes on malformed data)

---

## run_viz.py (Main Launcher)

**Location:** `C:\LECG\LOD Checker\run_viz.py`

**Purpose:** Unified launcher for local development (Flask backend + Vite frontend + resource loader)

**Architecture:**
- **Auto-switches to venv Python:** Detects `01_backend/imgpipe_env` and re-executes with venv Python
- **Flask app:** Defined inline (no separate app factory)
- **Resource loading:** `load_resources()` called on startup (loads master_registry.json + embeddings into memory)
- **Execution:** Main thread runs Vite (blocking), Flask in daemon thread

**Flask Routes:**

| Route | Method | Purpose | Dependencies |
|-------|--------|---------|--------------|
| `/health` | GET | Health check | In-memory embeddings count |
| `/api/search` | GET | Semantic search | SigLIP, OpenAI (optional), in-memory registry/embeddings |
| `/api/analyze_batch` | POST | AI batch analysis | OpenAI |
| `/api/run/local_pipeline` | POST | Process uploaded images | Subprocess calls to Run_Pipeline_Optimized.py, Step09, Step13 |
| `/api/delete/image` | DELETE | Remove image + metadata | File system, in-memory registry, master_registry.json |
| `/vectors/<path>` | GET | Serve graph data + vectors | File system (00_data/vectors/) |
| `/img/<path>` | GET | Serve processed images | File system (00_data/img/) |
| `/img/thumb/<path>` | GET | Serve thumbnails | File system (00_data/img/thumb/) |
| `/<path>` | GET | Serve React frontend | File system (02_frontend/dist/) |

**Search Endpoint Deep Dive (`/api/search`):**
1. Query expansion via OpenAI (cached by lowercased query)
2. Dual text encoding (original + expanded) with SigLIP text tower
3. Blend vectors: `0.3 * original + 0.7 * expanded`
4. Cosine similarity against normalized image embeddings (L2-normalized)
5. **Keyword grounding boost:** +0.15 per matching term in (name_of_file, final_category, family_name, provider)
6. Return top 200 results by score

---

## Configuration Files

**requirements.txt** - Python dependencies:
- Core: `flask`, `flask-cors`, `numpy`, `torch`, `transformers`, `pillow`, `openai`, `python-dotenv`
- TODO: Confirm full dependency list via audit

**.env** - Environment variables (git-ignored):
- `OPENAI_API_KEY` (required for Step06 categorization)
- `OPENAI_MODEL` (defaults to `gpt-4`)

**.env.example** - Template:
```env
OPENAI_API_KEY=your-key-here
OPENAI_MODEL=gpt-4
```

**aps.env** - APS/ACC environment variables (future use, not currently used)

---

## Known Issues & TODOs

### Frontend Crashes
1. **ResultsDashboard.tsx** - Crashes on malformed records (missing validation)
2. **SemanticGraph.tsx** - Race condition during layout switching (grid indexing mismatch)
3. **useGraphData.ts** - Node deletion doesn't rebuild neighbor arrays (orphaned references)

### Backend Issues
1. **Scattered configuration** - Model URLs hardcoded in Step02, Step03, Step07, Step11, Step12, run_viz.py
2. **Windows-specific paths** - `C:\LECG\LOD Checker` hardcoded in Step13_GraphPrep.py
3. **Global singletons** - Models loaded as global variables in Step07, Step11, run_viz.py (not thread-safe)

### Pipeline Issues
1. **Two orchestrators** - Run_Pipeline.py vs Run_Pipeline_Optimized.py (confusion)
2. **No schema validation** - JSON records assumed to have specific fields (implicit contracts)

---

## Future Expansion (Do NOT Implement Yet)

### APS/ACC Integration (Planned)
- **Backend:** Add `01_backend/acc/` module (Model Derivative + Data Management APIs)
- **Frontend:** Add UI for project/tree selection + 3-legged OAuth
- **Data flow:** APS thumbnails → pipeline → graph (same as local uploads)

---

## Summary

- **Root:** `run_viz.py` (launcher), `requirements.txt` (deps), `.env` (secrets)
- **Data:** `00_data/` (img, vectors, Categories.json)
- **Backend:** `01_backend/img_pipeline/` (13 steps + 2 orchestrators)
- **Frontend:** `02_frontend/src/` (React + TypeScript + Vite)
- **Entry point:** `python run_viz.py` (Flask on 5000, Vite on 5173)

For architecture details, see ARCHITECTURE.md. For how to run, see RUNBOOK.md.
