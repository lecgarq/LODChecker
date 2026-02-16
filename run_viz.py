"""
RAG Visualization Server (Combined)
Serves the React app via Vite dev server and the Python Flask backend.
Run: python run_viz.py
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

import numpy as np
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

# ------------------------------------------------------------------------------
# AUTO-RELAUNCH: Ensure we run inside the imgpipe_env venv (CUDA + all deps)
# ------------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
CONFIG_ROOT = ROOT_DIR / "04_config"
if str(CONFIG_ROOT) not in sys.path:
    sys.path.append(str(CONFIG_ROOT))
if str(ROOT_DIR) not in sys.path:
    sys.path.append(str(ROOT_DIR))
from config import load_config

CFG = load_config(ROOT_DIR)
VENV_PYTHON = ROOT_DIR / CFG["paths"]["venv_python_windows"]
TEST_MODE = os.getenv("LOD_BACKEND_TEST_MODE", "0") == "1"

if not TEST_MODE and VENV_PYTHON.exists() and Path(sys.executable).resolve() != VENV_PYTHON.resolve():
    print("[LAUNCHER] Re-launching with venv Python for CUDA support...")
    print(f"           {VENV_PYTHON}")
    sys.exit(subprocess.call([str(VENV_PYTHON), __file__] + sys.argv[1:]))

# ------------------------------------------------------------------------------
# Runtime imports
# ------------------------------------------------------------------------------
if TEST_MODE:
    torch = None  # type: ignore[assignment]
    SiglipModel = None  # type: ignore[assignment]
    SiglipProcessor = None  # type: ignore[assignment]

    class OpenAI:  # type: ignore[override]
        def __init__(self, *args, **kwargs):
            pass
else:
    try:
        import torch
        from transformers import SiglipModel, SiglipProcessor
    except ImportError:
        print("[BACKEND] ERROR: 'transformers' or 'torch' not found.")
        sys.exit(1)

    try:
        from PIL import Image  # noqa: F401
    except ImportError:
        print("[BACKEND] PIL (Pillow) not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "Pillow"])

    try:
        from openai import OpenAI
    except ImportError:
        print("[BACKEND] OpenAI module not found. Installing...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "openai"])
        from openai import OpenAI

from dotenv import load_dotenv

BACKEND_SCHEMA_DIR = ROOT_DIR / "01_backend"
if str(BACKEND_SCHEMA_DIR) not in sys.path:
    sys.path.append(str(BACKEND_SCHEMA_DIR))
from schemas import validate_graph_data, validate_registry_records

IMG_PIPELINE_DIR = ROOT_DIR / "01_backend" / "img_pipeline"
if str(IMG_PIPELINE_DIR) not in sys.path:
    sys.path.append(str(IMG_PIPELINE_DIR))
from hf_utils import hf_common_kwargs

print(f"[BACKEND] Initializing server (ver 2.2 - Modular Resources, test_mode={TEST_MODE})...")

BACKEND_DIR = ROOT_DIR / CFG["paths"]["backend_dir"]
DATA_DIR_ROOT = ROOT_DIR / CFG["paths"]["data_root"]
FRONTEND_DIR = ROOT_DIR / CFG["paths"]["frontend_dir"]

VECTORS_DIR = DATA_DIR_ROOT / "vectors"
REGISTRY_PATH = VECTORS_DIR / "master_registry.json"
GRAPH_FILE = VECTORS_DIR / "graph_data.json"

app = Flask(__name__, static_folder=str(FRONTEND_DIR / "dist"), static_url_path="/static")
CORS(app)

load_dotenv(ROOT_DIR / ".env")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", CFG["models"]["openai_model"])

if not OPENAI_API_KEY:
    print("[WARNING] OPENAI_API_KEY not found in environment. AI features will be disabled.")
    print("[WARNING] Please create a .env file with your API key.")


class BackendResources:
    def __init__(self) -> None:
        self.model = None
        self.processor = None
        self.embeddings = None
        self.registry: list[dict] = []
        self.device = "cpu"
        self.query_cache: dict[str, str] = {}

    @property
    def ready(self) -> bool:
        return self.model is not None and self.embeddings is not None

    def load_resources(self) -> None:
        self._load_registry()
        self._load_siglip()

    def _load_registry(self) -> None:
        self.registry = []
        self.embeddings = None

        if not REGISTRY_PATH.exists():
            print(f"[BACKEND] ERROR: master_registry.json not found at {REGISTRY_PATH}!")
            return

        print("[BACKEND] Loading master_registry.json (this may take 15-30 seconds)...")
        try:
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as exc:
            print(f"[BACKEND] ERROR loading registry: {exc}")
            return

        if not isinstance(data, list):
            print("[BACKEND] ERROR: master_registry.json is not a list.")
            return

        valid_records, skipped = validate_registry_records(data)
        if skipped:
            print(f"[BACKEND] Schema validation skipped {skipped} invalid registry records.")

        extracted_embeddings: list[list[float]] = []
        embedded_records: list[dict] = []
        for rec in valid_records:
            emb = rec.get("image_embedding")
            if isinstance(emb, list) and len(emb) > 0:
                extracted_embeddings.append(emb)
                embedded_records.append(rec)

        self.registry = embedded_records
        if not extracted_embeddings:
            print("[BACKEND] No valid embeddings found in registry.")
            return

        self.embeddings = np.array(extracted_embeddings, dtype=np.float32)
        norms = np.linalg.norm(self.embeddings, axis=1, keepdims=True)
        self.embeddings = self.embeddings / (norms + 1e-8)
        print(f"[BACKEND] Loaded {len(self.registry)} records with embeddings (dim={self.embeddings.shape[1]}).")

    def _load_siglip(self) -> None:
        if TEST_MODE:
            self.device = "cpu"
            self.model = object()
            self.processor = object()
            print("[BACKEND] Test mode active: skipping SigLIP model load.")
            return
        try:
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            print(f"[BACKEND] Loading SigLIP model on {self.device}...")
            siglip_model = CFG["models"]["siglip"]
            hf_kwargs = hf_common_kwargs()
            if hf_kwargs.get("local_files_only"):
                print("[BACKEND] Network unavailable; using local_files_only=True (fail-fast).")
            self.model = SiglipModel.from_pretrained(siglip_model, **hf_kwargs).to(self.device)
            self.processor = SiglipProcessor.from_pretrained(siglip_model, use_fast=True, **hf_kwargs)
            print("[BACKEND] SigLIP Model loaded.")
        except Exception as exc:
            print(f"[BACKEND] Failed to load model: {exc}")
            self.model = None
            self.processor = None

    def expand_query(self, user_query: str) -> str:
        cache_key = user_query.strip().lower()
        if cache_key in self.query_cache:
            print(f"[BACKEND] Cache hit for: '{user_query}'")
            return self.query_cache[cache_key]

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
                max_completion_tokens=120,
                temperature=0.3,
                seed=42,
            )
            expanded = response.choices[0].message.content.strip()
            print(f"[BACKEND] API Expanded: '{user_query}' -> '{expanded}'")
            self.query_cache[cache_key] = expanded
            return expanded
        except Exception as exc:
            print(f"[BACKEND] OpenAI Expansion Failed: {exc}. Using original query.")
            return user_query

    def search(self, query: str) -> dict:
        refined_query = self.expand_query(query)
        print(f"[BACKEND] Searching for: {refined_query}")

        inputs = self.processor(
            text=[query, refined_query],
            padding="max_length",
            truncation=True,
            max_length=64,
            return_tensors="pt",
        )
        text_inputs = {k: v.to(self.device) for k, v in inputs.items() if k in ("input_ids", "attention_mask")}

        with torch.no_grad():
            text_features = self.model.get_text_features(**text_inputs)

        if text_features.dim() == 3:
            embeddings_batch = text_features.mean(dim=1)
        else:
            embeddings_batch = text_features

        embeddings_batch = embeddings_batch / (embeddings_batch.norm(dim=-1, keepdim=True) + 1e-8)
        embeddings_batch = embeddings_batch.cpu().numpy().astype(np.float32)

        query_emb = (0.3 * embeddings_batch[0]) + (0.7 * embeddings_batch[1])
        query_emb = query_emb / (np.linalg.norm(query_emb) + 1e-8)
        scores = np.dot(self.embeddings, query_emb)

        search_terms = query.lower().split()
        for i, rec in enumerate(self.registry):
            text_field = (
                str(rec.get("name_of_file", ""))
                + " "
                + str(rec.get("final_category", ""))
                + " "
                + str(rec.get("family_name", ""))
                + " "
                + str(rec.get("provider", ""))
            ).lower()

            matches = 0
            for term in search_terms:
                if len(term) > 2 and term in text_field:
                    matches += 1
            if matches > 0:
                scores[i] += matches * 0.15

        top_k = 200
        top_indices = np.argsort(scores)[-top_k:][::-1]
        results = []
        for idx in top_indices:
            rec = self.registry[int(idx)]
            results.append({"id": rec.get("id", rec.get("name_of_file")), "score": round(float(scores[idx]), 4)})

        return {"query": query, "expandedQuery": refined_query, "results": results}

    def remove_from_memory(self, filename: str) -> bool:
        if not self.registry or self.embeddings is None:
            return False

        target_idx = -1
        for i, rec in enumerate(self.registry):
            if rec.get("name_of_file") == filename:
                target_idx = i
                break

        if target_idx == -1:
            return False

        self.registry.pop(target_idx)
        if target_idx < len(self.embeddings):
            self.embeddings = np.delete(self.embeddings, target_idx, axis=0)
        print(f"[DELETE] Removed from memory. New count: {len(self.registry)}")
        return True


resources = BackendResources()


@app.route("/health")
def health():
    return jsonify({"status": "ok", "items": len(resources.embeddings) if resources.embeddings is not None else 0})


@app.route("/api/search")
def search():
    query = request.args.get("q", "")
    if not query:
        return jsonify({"error": "No query provided"}), 400
    if not resources.ready:
        return jsonify({"error": "Server not ready"}), 503

    try:
        return jsonify(resources.search(query))
    except Exception as exc:
        print(f"[BACKEND] Search error: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/vectors/<path:path>")
def serve_vectors(path):
    try:
        return send_from_directory(VECTORS_DIR, path)
    except Exception as exc:
        return jsonify({"error": str(exc)}), 500


def _serve_image_from_data(path):
    img_dir = DATA_DIR_ROOT / "img"
    return send_from_directory(img_dir, path)


def _serve_thumbnail_from_data(path):
    thumb_dir = DATA_DIR_ROOT / "img" / "thumb"
    return send_from_directory(thumb_dir, path)


@app.route("/img/<path:path>")
def serve_image(path):
    return _serve_image_from_data(path)


@app.route("/img/thumb/<path:path>")
def serve_thumbnail(path):
    return _serve_thumbnail_from_data(path)


def _rebuild_graph_neighbors_after_deletion(nodes: list[dict], kept_indices: list[int]) -> list[dict]:
    old_to_new: dict[int, int] = {old_idx: new_idx for new_idx, old_idx in enumerate(kept_indices)}
    rebuilt_nodes: list[dict] = []

    for old_idx in kept_indices:
        node = dict(nodes[old_idx])
        raw_neighbors = node.get("neighbors", [])
        if not isinstance(raw_neighbors, list):
            raw_neighbors = []

        remapped_neighbors: list[int] = []
        seen: set[int] = set()
        for neighbor_idx in raw_neighbors:
            if not isinstance(neighbor_idx, int):
                continue
            new_neighbor_idx = old_to_new.get(neighbor_idx)
            if new_neighbor_idx is None:
                continue
            if new_neighbor_idx == old_to_new[old_idx]:
                continue
            if new_neighbor_idx in seen:
                continue
            seen.add(new_neighbor_idx)
            remapped_neighbors.append(new_neighbor_idx)

        node["neighbors"] = remapped_neighbors
        node["idx"] = old_to_new[old_idx]
        rebuilt_nodes.append(node)

    return rebuilt_nodes


@app.route("/api/analyze_batch", methods=["POST"])
def analyze_batch():
    try:
        data = request.json or {}
        lods = data.get("lods", [])
        categories = data.get("categories", [])
        if not lods:
            return jsonify({"analysis": "No data available to analyze."})

        avg_lod = "N/A"
        try:
            vals = []
            for l in lods:
                s = str(l).lower()
                if "100" in s or "low" in s:
                    vals.append(100)
                elif "200" in s or "medium" in s:
                    vals.append(200)
                elif "300" in s:
                    vals.append(300)
                elif "400" in s or "high" in s:
                    vals.append(400)
            if vals:
                avg_lod = int(sum(vals) / len(vals))
        except Exception:
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
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=150,
            temperature=0.3,
        )
        return jsonify({"analysis": response.choices[0].message.content.strip()})
    except Exception as exc:
        print(f"[BACKEND] Analysis Failed: {exc}")
        return jsonify({"analysis": "AI Analysis unavailable at this moment."})


@app.route("/api/run/local_pipeline", methods=["POST"])
def run_local_pipeline():
    import shutil

    if "files" not in request.files:
        return jsonify({"error": "No files part"}), 400
    files = request.files.getlist("files")
    if not files or files[0].filename == "":
        return jsonify({"error": "No selected file"}), 400

    timestamp = time.strftime("%Y%m%d_%H%M%S")
    upload_dir = DATA_DIR_ROOT / "uploads" / f"batch_{timestamp}"
    upload_dir.mkdir(parents=True, exist_ok=True)

    saved_paths = []
    for file in files:
        if file:
            save_path = upload_dir / file.filename
            file.save(save_path)
            saved_paths.append(str(save_path))

    print(f"[PIPELINE] Saved {len(saved_paths)} files to {upload_dir}")
    try:
        pipeline_script = ROOT_DIR / CFG["paths"]["pipeline_optimized"]
        cmd_pipeline = [
            sys.executable,
            str(pipeline_script),
            "--input",
            str(upload_dir),
            "--output",
            str(DATA_DIR_ROOT),
            "--provider",
            "LECG Arquitectura",
        ]
        print(f"[PIPELINE] Executing: {' '.join(cmd_pipeline)}")
        res = subprocess.run(cmd_pipeline, capture_output=True, text=True)
        if res.returncode != 0:
            print(f"[PIPELINE] Error: {res.stderr}")
            return jsonify({"success": False, "error": f"Pipeline failed: {res.stderr}"}), 500
        print("[PIPELINE] Image processing complete.")

        datatools_script = ROOT_DIR / CFG["paths"]["data_tools"]
        subprocess.run([sys.executable, str(datatools_script), "--root", str(DATA_DIR_ROOT), "--consolidate"], check=True)

        graph_script = ROOT_DIR / CFG["paths"]["graph_prep"]
        subprocess.run([sys.executable, str(graph_script)], check=True)

        print("[PIPELINE] Reloading backend resources...")
        resources.load_resources()

        try:
            shutil.rmtree(upload_dir, ignore_errors=True)
            print(f"[PIPELINE] Cleaned up upload folder: {upload_dir}")
        except Exception as exc:
            print(f"[PIPELINE] Warning: Could not clean upload folder: {exc}")

        results = []
        master_path = DATA_DIR_ROOT / "vectors" / "master_registry.json"
        if master_path.exists():
            try:
                with open(master_path, "r", encoding="utf-8") as f:
                    all_records = json.load(f)
                results = all_records[-len(saved_paths):] if all_records else []
            except Exception as exc:
                print(f"[PIPELINE] Error loading master registry for results: {exc}")

        return jsonify(
            {
                "success": True,
                "message": "Pipeline completed successfully",
                "count": len(saved_paths),
                "results": results,
            }
        )
    except Exception as exc:
        print(f"[PIPELINE] Critical Error: {exc}")
        return jsonify({"success": False, "error": str(exc)}), 500


@app.route("/api/delete/image", methods=["DELETE"])
def delete_image():
    try:
        data = request.get_json() or {}
        filename = data.get("filename")
        if not filename:
            return jsonify({"error": "Filename required"}), 400

        print(f"[DELETE] Request to delete: {filename}")
        img_path = DATA_DIR_ROOT / "img" / filename
        thumb_path = DATA_DIR_ROOT / "img" / "thumb" / filename
        deleted_files = []

        if img_path.exists():
            img_path.unlink()
            deleted_files.append("original")
        if thumb_path.exists():
            thumb_path.unlink()
            deleted_files.append("thumb")

        if REGISTRY_PATH.exists():
            with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
                reg_data = json.load(f)
            original_len = len(reg_data)
            new_reg = [r for r in reg_data if r.get("name_of_file") != filename]
            if len(new_reg) < original_len:
                with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
                    json.dump(new_reg, f, indent=2)
                print(f"[DELETE] Removed from master_registry.json ({original_len} -> {len(new_reg)})")

        if GRAPH_FILE.exists():
            with open(GRAPH_FILE, "r", encoding="utf-8") as f:
                raw_graph_data = json.load(f)
            graph_data, skipped = validate_graph_data(raw_graph_data)
            if skipped:
                print(f"[DELETE] Schema validation skipped {skipped} invalid graph nodes.")
            nodes = graph_data.get("nodes", [])
            kept_indices = [i for i, node in enumerate(nodes) if not str(node.get("img", "")).endswith(f"/{filename}")]
            if len(kept_indices) < len(nodes):
                new_nodes = _rebuild_graph_neighbors_after_deletion(nodes, kept_indices)
                graph_data["nodes"] = new_nodes
                if "meta" not in graph_data or not isinstance(graph_data["meta"], dict):
                    graph_data["meta"] = {}
                graph_data["meta"]["count"] = len(new_nodes)
                with open(GRAPH_FILE, "w", encoding="utf-8") as f:
                    json.dump(graph_data, f)
                print("[DELETE] Removed from graph_data.json and rebuilt neighbor indices")

        removed_from_memory = resources.remove_from_memory(filename)
        return jsonify(
            {
                "success": True,
                "message": f"Deleted {filename}",
                "files": deleted_files,
                "memory_updated": removed_from_memory,
            }
        )
    except Exception as exc:
        print(f"[DELETE] Error: {exc}")
        return jsonify({"error": str(exc)}), 500


@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR / "dist", "index.html")


@app.route("/<path:path>")
def serve_static(path):
    if (FRONTEND_DIR / "dist" / path).exists():
        return send_from_directory(FRONTEND_DIR / "dist", path)
    return serve_index()


def run_vite_dev():
    print("[VITE] Starting Vite development server...")
    os.chdir(FRONTEND_DIR)
    subprocess.run(["npm", "run", "dev"], shell=True)


def main():
    print("=" * 50)
    print("   LOD Checker - Combined Server & Launcher")
    print("=" * 50)

    if not GRAPH_FILE.exists():
        print("[PREP] graph_data.json not found. Generating...")
        prep_script = ROOT_DIR / CFG["paths"]["graph_prep"]
        subprocess.run([sys.executable, str(prep_script)])

    resources.load_resources()

    flask_thread = threading.Thread(
        target=lambda: app.run(host="0.0.0.0", port=5000, debug=False, use_reloader=False),
        daemon=True,
    )
    flask_thread.start()
    print("[INFO] Backend running at http://localhost:5000")
    print("[INFO] Open your browser to http://localhost:5173 (Vite React App)")
    print("[LAUNCHER] Waiting 3 seconds for Backend to stabilize...")
    time.sleep(3)
    run_vite_dev()


if __name__ == "__main__":
    main()
