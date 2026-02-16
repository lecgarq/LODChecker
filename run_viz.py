"""
RAG Visualization Server (Combined)
Serves the React app via Vite dev server and the Python Flask backend.
Run: python run_viz.py
"""
import os
import sys
import subprocess
from pathlib import Path

# ------------------------------------------------------------------------------
# AUTO-RELAUNCH: Ensure we run inside the imgpipe_env venv (CUDA + all deps)
# ------------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))
from config import load_config

CFG = load_config(ROOT_DIR)
VENV_PYTHON = ROOT_DIR / CFG["paths"]["venv_python_windows"]

if VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    print(f"[LAUNCHER] Re-launching with venv Python for CUDA support...")
    print(f"           {VENV_PYTHON}")
    sys.exit(subprocess.call([str(VENV_PYTHON), __file__] + sys.argv[1:]))

# ------------------------------------------------------------------------------
# Now running inside imgpipe_env — safe to import everything
# ------------------------------------------------------------------------------
import time
import threading
import json
import numpy as np
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# Try to import SigLIP & Torch
try:
    import torch
    from transformers import SiglipModel, SiglipProcessor
except ImportError:
    print("[BACKEND] ERROR: 'transformers' or 'torch' not found.")
    sys.exit(1)

# Try to import PIL
try:
    from PIL import Image
    import io
except ImportError:
    print("[BACKEND] PIL (Pillow) not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])
    from PIL import Image

# Try to import OpenAI
try:
    from openai import OpenAI
except ImportError:
    print("[BACKEND] OpenAI module not found. Installing...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "openai"])
    from openai import OpenAI

# ------------------------------------------------------------------------------
# CONFIGURATION & PATHS
# ------------------------------------------------------------------------------
print("[BACKEND] Initializing server (ver 2.1 - SigLIP - Combined)...")


# current file is in project root
BACKEND_DIR = ROOT_DIR / CFG["paths"]["backend_dir"]
DATA_DIR_ROOT = ROOT_DIR / CFG["paths"]["data_root"]
FRONTEND_DIR = ROOT_DIR / CFG["paths"]["frontend_dir"]

VECTORS_DIR = DATA_DIR_ROOT / "vectors"
REGISTRY_PATH = VECTORS_DIR / "master_registry.json"
GRAPH_FILE = VECTORS_DIR / "graph_data.json"

# Flask Setup
# Use a non-root static URL to avoid route conflicts with /img, /api, /vectors.
app = Flask(__name__, static_folder=str(FRONTEND_DIR / "dist"), static_url_path='/static')
CORS(app)

# OpenAI Config - Load from environment variables
from dotenv import load_dotenv
load_dotenv()

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", CFG["models"]["openai_model"])

if not OPENAI_API_KEY:
    print("[WARNING] OPENAI_API_KEY not found in environment. AI features will be disabled.")
    print("[WARNING] Please create a .env file with your API key.")

# Global State
model = None
processor = None
embeddings = None
registry = None
device = 'cpu'

# ------------------------------------------------------------------------------
# FLASK BACKEND LOGIC
# ------------------------------------------------------------------------------

def load_resources():
    global model, processor, embeddings, registry, device
    
    # 1. Load Registry & Embeddings
    if REGISTRY_PATH.exists():
        print("[BACKEND] Loading master_registry.json (this may take 15-30 seconds)...")
        try:
            with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            embedded_records = []
            extracted_embeddings = []
            
            for rec in data:
                emb = rec.get("image_embedding")
                if emb and len(emb) > 0:
                    extracted_embeddings.append(emb)
                    embedded_records.append(rec)
            
            registry = embedded_records
            embeddings = np.array(extracted_embeddings, dtype=np.float32)
            
            # Normalize for Cosine Similarity
            norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
            embeddings = embeddings / (norms + 1e-8)
            
            print(f"[BACKEND] Loaded {len(registry)} records with embeddings (dim={embeddings.shape[1]}).")
        except Exception as e:
             print(f"[BACKEND] ERROR loading registry: {e}")
    else:
        print(f"[BACKEND] ERROR: master_registry.json not found at {REGISTRY_PATH}!")

    # 2. Load SigLIP Model
    try:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        print(f"[BACKEND] Loading SigLIP model on {device}...")
        
        siglip_model = CFG["models"]["siglip"]
        model = SiglipModel.from_pretrained(siglip_model).to(device)
        processor = SiglipProcessor.from_pretrained(siglip_model, use_fast=True)
        
        print("[BACKEND] SigLIP Model loaded.")
    except Exception as e:
        print(f"[BACKEND] Failed to load model: {e}")

def verify_openai_model():
    print(f"[BACKEND] Verifying availability of OpenAI model: {OPENAI_MODEL}...")
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        # Just a quick check (listing models can be slow/limited, skipping exact check for speed)
        # But we'll try to list just to be safe if previously requested
        pass 
        # (Simplified to avoid startup delay, assuming key is valid)
    except Exception as e:
        print(f"[BACKEND] Verification skipped: {e}")

def expand_query(user_query):
    # Check cache
    if not hasattr(expand_query, '_cache'): expand_query._cache = {}
    cache_key = user_query.strip().lower()
    if cache_key in expand_query._cache:
        print(f"[BACKEND] Cache hit for: '{user_query}'")
        return expand_query._cache[cache_key]
    
    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        system_prompt = (
            "You are an expert BIM and architectural content specialist. "
            "Convert the user's search query into a detailed visual and semantic description suitable for identifying 3D models and families. "
            "Include relevant synonyms, materials, geometric features, and common Revit/BIM terminology. "
            "If the query is vague, infer the most likely architectural context. "
            "Output ONLY the expanded descriptive text, no intro."
        )
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_query}],
            max_completion_tokens=120, temperature=0.3, seed=42
        )
        expanded = response.choices[0].message.content.strip()
        print(f"[BACKEND] API Expanded: '{user_query}' -> '{expanded}'")
        expand_query._cache[cache_key] = expanded
        return expanded
    except Exception as e:
        print(f"[BACKEND] OpenAI Expansion Failed: {e}. Using original query.")
        return user_query

@app.route('/health')
def health():
    return jsonify({"status": "ok", "items": len(embeddings) if embeddings is not None else 0})

@app.route('/api/search')
def search():
    query = request.args.get('q', '')
    if not query: return jsonify({"error": "No query provided"}), 400
    if model is None or embeddings is None: return jsonify({"error": "Server not ready"}), 503

    try:
        refined_query = expand_query(query)
        print(f"[BACKEND] Searching for: {refined_query}")
        
        # Dual Encoding: Encode both Original Query and Expanded Query
        inputs = processor(text=[query, refined_query], padding="max_length", truncation=True, max_length=64, return_tensors="pt")
        text_inputs = {k: v.to(device) for k, v in inputs.items() if k in ('input_ids', 'attention_mask')}
        
        with torch.no_grad():
            text_features = model.get_text_features(**text_inputs)
            
        # Normalize both
        if text_features.dim() == 3:
            # If batch, seq, hidden -> pool
            embeddings_batch = text_features.mean(dim=1)
        else:
            embeddings_batch = text_features

        # Normalize
        embeddings_batch = embeddings_batch / (embeddings_batch.norm(dim=-1, keepdim=True) + 1e-8)
        embeddings_batch = embeddings_batch.cpu().numpy().astype(np.float32)

        # Average: 0.3 Original (Grounding) + 0.7 Expanded (Semantic)
        # We rely more on the visual description now, but we will fix grounding with the Keyword Boost below
        query_emb = (0.3 * embeddings_batch[0]) + (0.7 * embeddings_batch[1])
        query_emb = query_emb / (np.linalg.norm(query_emb) + 1e-8)
        
        # 1. Base Vector Scores (Semantic)
        scores = np.dot(embeddings, query_emb)
        
        # 2. KEYWORD GROUNDING BOOST (Hybrid Search)
        # Boost results that actually contain the user's exact search terms.
        # This fixes the "weirdness" where similar but wrong items appear.
        search_terms = query.lower().split()
        
        # Pre-calculate boost to avoid loop overhead if possible, but loop is fine for <50k items in python
        # We'll just iterate, it's fast enough.
        for i, rec in enumerate(registry):
            # Construct a comprehensive text field for matching
            text_field = (
                str(rec.get('name_of_file', '')) + " " + 
                str(rec.get('final_category', '')) + " " + 
                str(rec.get('family_name', '')) + " " +
                str(rec.get('provider', ''))
            ).lower()
            
            matches = 0
            for term in search_terms:
                if len(term) > 2 and term in text_field:
                    matches += 1
            
            # Apply Boost: +0.15 per matching term is significant given cosine scores are usually 0.0-0.4 range for SigLIP
            if matches > 0:
                scores[i] += (matches * 0.15)
        
        TOP_K = 200
        top_indices = np.argsort(scores)[-TOP_K:][::-1]
        
        results = []
        for idx in top_indices:
            rec = registry[int(idx)]
            results.append({
                "id": rec.get('id', rec.get('name_of_file')),
                "score": round(float(scores[idx]), 4)
            })
        return jsonify({"query": query, "expandedQuery": refined_query, "results": results})
    except Exception as e:
        print(f"[BACKEND] Search error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/vectors/<path:path>')
def serve_vectors(path):
    try:
        return send_from_directory(VECTORS_DIR, path)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

def _serve_image_from_data(path):
    img_dir = DATA_DIR_ROOT / 'img'
    return send_from_directory(img_dir, path)

@app.route('/img/<path:path>')
def serve_image(path):
    # Main image route used by frontend (e.g. /img/example.png)
    return _serve_image_from_data(path)

@app.route('/img/thumb/<path:path>')
def serve_thumbnail(path):
    # Backward-compatible route: current frontend uses /img/*, but keep this too.
    return _serve_image_from_data(path)

@app.route('/api/analyze_batch', methods=['POST'])
def analyze_batch():
    """
    Generates an AI explanation for the batch results.
    Non-blocking: Frontend calls this asynchronously.
    """
    try:
        data = request.json
        lods = data.get('lods', [])
        categories = data.get('categories', [])
        
        if not lods:
            return jsonify({"analysis": "No data available to analyze."})

        # Summarize for Context
        avg_lod = "N/A"
        try:
             # Simple parsing logic tailored to our LOD strings
             vals = []
             for l in lods:
                 s = str(l).lower()
                 if '100' in s or 'low' in s: vals.append(100)
                 elif '200' in s or 'medium' in s: vals.append(200)
                 elif '300' in s: vals.append(300)
                 elif '400' in s or 'high' in s: vals.append(400)
             if vals:
                 avg_lod = int(sum(vals) / len(vals))
        except:
             pass

        prompt = (
            f"Analyze this batch of {len(lods)} processed BIM elements.\n"
            f"Average LOD Score: {avg_lod}\n"
            f"Category Distribution: {', '.join(categories[:10])}...\n\n"
            "Explain in 2 short sentences WHY the results are like this. "
            "Focus on the relationship between the object categories and their typical geometry complexity. "
            "For example, if furniture is LOD 200, explain that it's standard for visualization but lacks fabrication detail."
        )

        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=OPENAI_MODEL,
            messages=[
                {"role": "system", "content": "You are a BIM Quality Assurance Expert. Provide concise, professional insights."},
                {"role": "user", "content": prompt}
            ],
            max_completion_tokens=150,
            temperature=0.3
        )
        return jsonify({"analysis": response.choices[0].message.content.strip()})

    except Exception as e:
        print(f"[BACKEND] Analysis Failed: {e}")
        return jsonify({"analysis": "AI Analysis unavailable at this moment."})


# ------------------------------------------------------------------------------
# LOCAL PIPELINE EXECUTION
# ------------------------------------------------------------------------------
@app.route('/api/run/local_pipeline', methods=['POST'])
def run_local_pipeline():
    """
    Receives images, runs the pipeline with provider="LECG Arquitectura",
    consolidates data, regenerates graph, and reloads system.
    """
    import shutil
    
    # 1. Save Uploads
    if 'files' not in request.files:
        return jsonify({"error": "No files part"}), 400
        
    files = request.files.getlist('files')
    if not files or files[0].filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Create a unique batch directory
    timestamp = time.strftime("%Y%m%d_%H%M%S")
    upload_dir = DATA_DIR_ROOT / "uploads" / f"batch_{timestamp}"
    upload_dir.mkdir(parents=True, exist_ok=True)
    
    saved_paths = []
    for file in files:
        if file:
            filename = file.filename
            save_path = upload_dir / filename
            file.save(save_path)
            saved_paths.append(str(save_path))
            
    print(f"[PIPELINE] Saved {len(saved_paths)} files to {upload_dir}")
    
    try:
        # 2. Run Pipeline (Step 01 - Step 08)
        # We run this as a subprocess to ensure clean environment usage
        pipeline_script = ROOT_DIR / CFG["paths"]["pipeline_optimized"]
        cmd_pipeline = [
            sys.executable, str(pipeline_script),
            "--input", str(upload_dir),
            "--output", str(DATA_DIR_ROOT),
            "--provider", "LECG Arquitectura"
        ]
        
        print(f"[PIPELINE] Executing: {' '.join(cmd_pipeline)}")
        res = subprocess.run(cmd_pipeline, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[PIPELINE] Error: {res.stderr}")
            return jsonify({"success": False, "error": f"Pipeline failed: {res.stderr}"}), 500
            
        print("[PIPELINE] Image processing complete.")

        # 3. Consolidate Data (Step 09)
        # Merges the new batch JSON into master_registry.json
        datatools_script = ROOT_DIR / CFG["paths"]["data_tools"]
        cmd_consolidate = [
            sys.executable, str(datatools_script),
            "--root", str(DATA_DIR_ROOT),
            "--consolidate"
        ]
        print("[PIPELINE] Consolidating data...")
        subprocess.run(cmd_consolidate, check=True)
        
        # 4. Regenerate Graph (Step 13)
        # Updates graph_data.json with new nodes
        graph_script = ROOT_DIR / CFG["paths"]["graph_prep"]
        cmd_graph = [
            sys.executable, str(graph_script)
        ]
        print("[PIPELINE] Regenerating graph...")
        subprocess.run(cmd_graph, check=True)
        
        # 5. Hot-Reload Backend Resources
        # Reloads the in-memory registry and embeddings so the new items are searchable immediately
        # 5. Hot-Reload Backend Resources
        print("[PIPELINE] Reloading backend resources...")
        load_resources()
        
        # 6. Cleanup upload folder (processed images are already in 00_data/img/)
        try:
            shutil.rmtree(upload_dir, ignore_errors=True)
            print(f"[PIPELINE] 🧹 Cleaned up upload folder: {upload_dir}")
        except Exception as e:
            print(f"[PIPELINE] Warning: Could not clean upload folder: {e}")

        # 7. Return results from master registry (batch files are cleaned up by Step09)
        results = []
        master_path = DATA_DIR_ROOT / "vectors" / "master_registry.json"
        if master_path.exists():
            try:
                with open(master_path, 'r', encoding='utf-8') as f:
                    all_records = json.load(f)
                # Return only the most recent records (matching the uploaded count)
                results = all_records[-len(saved_paths):] if all_records else []
            except Exception as e:
                print(f"[PIPELINE] Error loading master registry for results: {e}")

        return jsonify({
            "success": True, 
            "message": "Pipeline completed successfully",
            "count": len(saved_paths),
            "results": results
        })

    except Exception as e:
        print(f"[PIPELINE] Critical Error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

# ------------------------------------------------------------------------------
# DELETE ENDPOINT
# ------------------------------------------------------------------------------
@app.route('/api/delete/image', methods=['DELETE'])
def delete_image():
    """
    Deletes an image file and removes its metadata from the registry.
    Expects JSON: { "filename": "example.png" }
    """
    try:
        data = request.get_json()
        filename = data.get('filename')
        if not filename:
            return jsonify({"error": "Filename required"}), 400
            
        print(f"[DELETE] Request to delete: {filename}")
        
        # 1. Delete Files
        img_path = DATA_DIR_ROOT / "img" / filename
        thumb_path = DATA_DIR_ROOT / "img" / "thumb" / filename
        
        deleted_files = []
        if img_path.exists():
            img_path.unlink()
            deleted_files.append("original")
            
        if thumb_path.exists():
            thumb_path.unlink()
            deleted_files.append("thumb")
            
        # 2. Update Master Registry (Persistent)
        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH, 'r', encoding='utf-8') as f:
                reg_data = json.load(f)
            
            original_len = len(reg_data)
            new_reg = [r for r in reg_data if r.get('name_of_file') != filename]
            
            if len(new_reg) < original_len:
                with open(REGISTRY_PATH, 'w', encoding='utf-8') as f:
                    json.dump(new_reg, f, indent=2)
                print(f"[DELETE] Removed from master_registry.json ({original_len} -> {len(new_reg)})")
                
        # 3. Update Graph Data (Persistent)
        if GRAPH_FILE.exists():
            with open(GRAPH_FILE, 'r', encoding='utf-8') as f:
                graph_data = json.load(f)
            
            nodes = graph_data.get('nodes', [])
            target_img_path = f"/img/{filename}"
            # Robust check: filter if img path ends with the filename (handles /img/ and /img/thumb/)
            new_nodes = [n for n in nodes if not n.get('img', '').endswith(f"/{filename}")]
            
            if len(new_nodes) < len(nodes):
                graph_data['nodes'] = new_nodes
                if 'meta' in graph_data: graph_data['meta']['count'] = len(new_nodes)
                with open(GRAPH_FILE, 'w', encoding='utf-8') as f:
                    json.dump(graph_data, f)
                print(f"[DELETE] Removed from graph_data.json")
        
        # 4. Update In-Memory State (Live)
        global registry, embeddings
        removed_from_memory = False
        
        if registry and embeddings is not None:
             target_idx = -1
             for i, r in enumerate(registry):
                 if r.get('name_of_file') == filename:
                     target_idx = i
                     break
             
             if target_idx != -1:
                 # Remove from registry list
                 registry.pop(target_idx)
                 # Remove from embeddings array (axis 0)
                 if target_idx < len(embeddings):
                    embeddings = np.delete(embeddings, target_idx, axis=0)
                 removed_from_memory = True
                 print(f"[DELETE] Removed from memory. New count: {len(registry)}")

        return jsonify({
            "success": True, 
            "message": f"Deleted {filename}",
            "files": deleted_files,
            "memory_updated": removed_from_memory
        })

    except Exception as e:
        print(f"[DELETE] Error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/')
def serve_index():
    return send_from_directory(FRONTEND_DIR / 'dist', 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    if (FRONTEND_DIR / 'dist' / path).exists():
        return send_from_directory(FRONTEND_DIR / 'dist', path)
    return serve_index()

# ------------------------------------------------------------------------------
# LAUNCHER LOGIC
# ------------------------------------------------------------------------------

def run_vite_dev():
    """Start Vite dev server (for React app)."""
    print("[VITE] Starting Vite development server...")
    os.chdir(FRONTEND_DIR)
    # Use 'npm' directly
    subprocess.run(["npm", "run", "dev"], shell=True)

def main():
    print("=" * 50)
    print("   LOD Checker - Combined Server & Launcher")
    print("=" * 50)
    
    # 0. Check data prep
    if not GRAPH_FILE.exists():
        print("[PREP] graph_data.json not found. Generating...")
        prep_script = ROOT_DIR / CFG["paths"]["graph_prep"]
        subprocess.run([sys.executable, str(prep_script)])
    
    # 1. Load resources (Main Thread)
    # Loading here ensures we don't start serving until resources are ready,
    # OR we can load in the thread effectively.
    # Let's call load_resources() here so startup log shows progress.
    load_resources()
    
    # 2. Start Flask in Background Thread
    # We use threading so we can also run Vite or keep the main thread alive/blocking
    flask_thread = threading.Thread(target=lambda: app.run(host='0.0.0.0', port=5000, debug=False, use_reloader=False), daemon=True)
    flask_thread.start()
    
    print("[INFO] Backend running at http://localhost:5000")
    print("[INFO] Open your browser to http://localhost:5173 (Vite React App)")
    
    # 3. Start Vite (Blocking)
    # This keeps the script running. If Vite stops (Ctrl+C), script ends.
    # WAIT for Flask to bind port 5000
    print("[LAUNCHER] Waiting 3 seconds for Backend to stabilize...")
    time.sleep(3)
    
    run_vite_dev()

if __name__ == "__main__":
    main()
