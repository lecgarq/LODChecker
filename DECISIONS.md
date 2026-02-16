# LOD Checker - Architecture Decisions Log

This document records key architectural decisions made during the development of the LOD Checker Visual RAG system.

---

## Decision Log Format

Each decision includes:
- **Date:** When the decision was made
- **Decision:** What was decided
- **Context:** Why the decision was needed
- **Alternatives:** What other options were considered
- **Consequences:** Implications of the decision

---

## ADR-001: Use SigLIP for Image Embeddings

**Date:** TODO (confirm via git history or team)

**Decision:** Use SigLIP (`google/siglip-base-patch16-224`) for image embeddings instead of CLIP or other alternatives.

**Context:**
- Need dense embeddings for semantic search and graph clustering
- Requirements: High-quality image understanding, compatible with cosine similarity, reasonable inference speed

**Alternatives:**
1. **CLIP (OpenAI):** Widely used, proven for image-text alignment
   - Pros: Well-documented, large community
   - Cons: Slower inference, larger model size
2. **DINOv2 (Meta):** Strong self-supervised features
   - Pros: State-of-the-art image understanding
   - Cons: No native text encoding, requires separate text model
3. **SigLIP (Google):** Selected
   - Pros: Faster than CLIP, competitive quality, dual image-text encoding
   - Cons: Smaller community, less documentation

**Consequences:**
- **Positive:** Fast inference (~20s/image on RTX 5070 Ti), dual encoding (image + text)
- **Negative:** Hardcoded in Step07 and run_viz.py (no abstraction), swapping models requires cascade changes
- **Future:** Abstract behind EmbeddingProvider interface to enable model swapping

---

## ADR-002: Use Flask for Backend (Not FastAPI or Django)

**Date:** TODO (confirm)

**Decision:** Use Flask for the backend API instead of FastAPI or Django.

**Context:**
- Need lightweight backend for local development (not production deployment)
- Requirements: Serve static files (frontend), REST API (search, upload, delete), simple setup

**Alternatives:**
1. **FastAPI:**
   - Pros: Async support, auto-generated OpenAPI docs, type hints
   - Cons: Overkill for local dev, async complexity not needed
2. **Django:**
   - Pros: Batteries-included (ORM, admin, auth)
   - Cons: Heavy for local dev, unnecessary features
3. **Flask:** Selected
   - Pros: Lightweight, easy to prototype, minimal dependencies
   - Cons: No async support (not needed for local dev), manual API docs

**Consequences:**
- **Positive:** Fast prototyping, minimal overhead, simple codebase
- **Negative:** Not production-ready (no async, no built-in auth), monolithic run_viz.py (launcher + API + resource loader in one file)
- **Future:** If deploying to production, consider FastAPI migration or Flask with Gunicorn/Nginx

---

## ADR-003: Use Canvas 2D for Graph Rendering (Not Three.js or D3)

**Date:** TODO (confirm)

**Decision:** Use HTML5 Canvas 2D API for graph rendering instead of Three.js (WebGL 3D) or D3.js (SVG).

**Context:**
- Need to render 24K nodes with real-time interaction (pan, zoom, selection)
- Requirements: 60fps performance, smooth animations, support for large graphs

**Alternatives:**
1. **Three.js (WebGL 3D):**
   - Pros: GPU-accelerated, scales to millions of nodes, 3D visualization
   - Cons: Complexity (camera, shaders, scene graph), overkill for 2D graph
2. **D3.js (SVG):**
   - Pros: Declarative API, easy to prototype, rich ecosystem
   - Cons: DOM-heavy (one `<circle>` per node = 24K DOM elements), slow for large graphs
3. **Canvas 2D:** Selected
   - Pros: GPU-accelerated, single DOM element, manual control over rendering
   - Cons: Manual hit testing, no built-in zoom/pan (custom implementation)

**Consequences:**
- **Positive:** 60fps with 24K nodes, smooth animations, frustum culling + sprite batching
- **Negative:** Manual implementation of zoom/pan/hit-testing (~700 lines in SemanticGraph.tsx), harder to debug than SVG
- **Future:** If scaling to >100K nodes, consider Three.js instanced rendering or WebGL shaders

---

## ADR-004: Use UMAP for Dimensionality Reduction (Not t-SNE or PCA)

**Date:** TODO (confirm)

**Decision:** Use UMAP (Uniform Manifold Approximation and Projection) for dimensionality reduction from 768-dim embeddings to 2D graph layout.

**Context:**
- Need to visualize high-dimensional embeddings (768-dim SigLIP) in 2D graph
- Requirements: Preserve semantic clusters, fast computation, reproducible

**Alternatives:**
1. **t-SNE:**
   - Pros: Well-known, good for visualization
   - Cons: Slower than UMAP, not deterministic, crowding problem
2. **PCA:**
   - Pros: Fast, deterministic, linear
   - Cons: Linear (loses non-linear structure), poor for complex manifolds
3. **UMAP:** Selected
   - Pros: Fast, preserves global + local structure, deterministic (with seed)
   - Cons: Hyperparameter-sensitive (n_neighbors, min_dist)

**Consequences:**
- **Positive:** Clear semantic clusters in graph, fast (~10s for 24K nodes), reproducible (seed=42)
- **Negative:** Hyperparameters hardcoded (n_neighbors=15, min_dist=0.1), sensitive to changes
- **Future:** Expose hyperparameters in config, allow user tuning

---

## ADR-005: Use Optimized Pipeline with Batch GPU Processing

**Date:** TODO (confirm)

**Decision:** Use `Run_Pipeline_Optimized.py` as canonical pipeline (batch GPU processing + explicit VRAM management) instead of `Run_Pipeline.py` (sequential subprocess isolation).

**Context:**
- Need faster pipeline execution (target: ≤30s per image)
- Baseline pipeline (`Run_Pipeline.py`) processes images sequentially via subprocesses (~60-120s per image)

**Alternatives:**
1. **Run_Pipeline.py (Baseline):**
   - Pros: Subprocess isolation (VRAM cleanup automatic), simple logic
   - Cons: Slow (one image at a time), no batch processing
2. **Run_Pipeline_Optimized.py:** Selected
   - Pros: Batch GPU processing (load models once, process all images), explicit VRAM cleanup, ~20s/image
   - Cons: More complex (6-stage architecture), manual VRAM management

**Consequences:**
- **Positive:** 3-6× faster (~20s/image vs ~60-120s), efficient GPU utilization
- **Negative:** Two orchestrators exist (confusion), manual VRAM management (`gc.collect()` + `torch.cuda.empty_cache()`)
- **Future:** Deprecate `Run_Pipeline.py`, rename to `Run_Pipeline_Legacy.py`

---

## ADR-006: Use Append-Only Data Storage for Vectors

**Date:** TODO (confirm)

**Decision:** Treat `00_data/vectors/` as append-only storage (manual edits discouraged, only pipeline writes finalized outputs).

**Context:**
- Need stable data artifacts for reproducibility and debugging
- Requirements: Prevent accidental data loss, maintain audit trail

**Alternatives:**
1. **Mutable storage (allow manual edits):**
   - Pros: Flexibility, easy fixes for corrupted data
   - Cons: Risk of data loss, no audit trail, hard to debug
2. **Append-only (discourage manual edits):** Selected
   - Pros: Reproducible, audit trail (batch_*.json files), safe rollback
   - Cons: Harder to fix corrupted data (must regenerate)

**Consequences:**
- **Positive:** Reproducible pipeline outputs, safe rollback (delete batch files and re-consolidate)
- **Negative:** Corrupted data requires re-running pipeline (no quick manual fixes)
- **Future:** Add validation in Step09 to detect and skip corrupted records

---

## ADR-007: Use Python 3.12 ONLY (No 3.11 or 3.13)

**Date:** TODO (confirm)

**Decision:** Pin Python version to 3.12 (no upgrades to 3.13, no downgrades to 3.11).

**Context:**
- PyTorch 2.6.0+cu124 is tested with Python 3.12
- CUDA 12.4 compatibility requires careful version alignment
- RTX 5070 Ti (Blackwell) requires recent CUDA/PyTorch versions

**Alternatives:**
1. **Python 3.11:**
   - Pros: More stable, longer community support
   - Cons: PyTorch CUDA builds less tested, may break compatibility
2. **Python 3.13:**
   - Pros: Latest features, performance improvements
   - Cons: PyTorch not yet tested, high risk of dependency breakage
3. **Python 3.12:** Selected
   - Pros: PyTorch 2.6.0+cu124 compatibility, proven with RTX 5070 Ti
   - Cons: Locked to specific version (no flexibility)

**Consequences:**
- **Positive:** Stable CUDA/PyTorch environment, reproducible builds
- **Negative:** Cannot use Python 3.13 features, locked to specific version
- **Future:** Monitor PyTorch releases for 3.13 support, but do NOT upgrade until tested

---

## ADR-008: Use OpenAI GPT for Categorization (Not Local Model)

**Date:** TODO (confirm)

**Decision:** Use OpenAI GPT (default: `gpt-4`) for BIM taxonomy categorization (Step06) instead of local models (e.g., Llama, Mistral).

**Context:**
- Need accurate BIM category classification (560+ categories in Categories.json)
- Requirements: High accuracy, semantic understanding, reasoning about BIM context

**Alternatives:**
1. **Local LLM (Llama 3.x, Mistral):**
   - Pros: No API cost, offline capability, privacy
   - Cons: Requires 24+ GB VRAM (not feasible on RTX 5070 Ti with other models), lower accuracy
2. **OpenAI GPT:** Selected
   - Pros: High accuracy, semantic reasoning, small API cost (~$0.01/image)
   - Cons: Requires internet, API key, privacy concerns (images sent to OpenAI)

**Consequences:**
- **Positive:** Accurate categorization, low VRAM footprint (only API call)
- **Negative:** Requires internet + API key, privacy trade-off, API cost (scalable to 1000s of images)
- **Future:** Consider local LLM if VRAM budget increases or privacy concerns escalate

---

## TODO: Additional Decisions to Document

These decisions should be filled in after confirming with the team or git history:

- **ADR-009:** Why React (not Vue, Svelte)?
- **ADR-010:** Why Tailwind CSS (not styled-components, CSS modules)?
- **ADR-011:** Why Vite (not Webpack, Parcel)?
- **ADR-012:** Why kNN precomputation (not on-demand graph links)?
- **ADR-013:** Why local-first (not cloud-based pipeline)?
- **ADR-014:** Why Windows/PowerShell target (not cross-platform)?

---

## Summary

This log documents key architectural decisions for the LOD Checker system:
- **Embeddings:** SigLIP (fast, dual encoding)
- **Backend:** Flask (lightweight, local dev)
- **Graph rendering:** Canvas 2D (60fps with 24K nodes)
- **Dimensionality reduction:** UMAP (fast, preserves clusters)
- **Pipeline:** Optimized batch processing (3-6× faster)
- **Data storage:** Append-only vectors (reproducible)
- **Python:** 3.12 ONLY (CUDA/PyTorch compatibility)
- **Categorization:** OpenAI GPT (high accuracy, low VRAM)

For future refactors, consult this log before making architectural changes.
