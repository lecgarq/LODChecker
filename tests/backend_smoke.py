#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import shutil
import sys
from pathlib import Path

import numpy as np


def main() -> int:
    os.environ["LOD_BACKEND_TEST_MODE"] = "1"
    repo_root = Path(__file__).resolve().parents[1]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    import run_viz  # noqa: WPS433

    fixture_graph = Path(__file__).resolve().parent / "fixtures" / "pipeline" / "graph_fixture.json"
    if not fixture_graph.exists():
        print("Missing backend graph fixture.")
        return 1

    tmp_vectors = repo_root / "tests" / ".tmp" / "backend_smoke_vectors"
    if tmp_vectors.exists():
        shutil.rmtree(tmp_vectors, ignore_errors=True)
    tmp_vectors.mkdir(parents=True, exist_ok=True)
    try:
        graph_target = tmp_vectors / "graph_data.json"
        graph_target.write_text(fixture_graph.read_text(encoding="utf-8"), encoding="utf-8")

        run_viz.VECTORS_DIR = tmp_vectors
        run_viz.resources.embeddings = np.array([[0.1, 0.2, 0.3, 0.4]], dtype=np.float32)
        run_viz.resources.model = object()
        run_viz.resources.processor = object()
        run_viz.resources.search = lambda query: {  # type: ignore[assignment]
            "query": query,
            "expandedQuery": query,
            "results": [{"id": "fixture-001", "score": 0.9}],
        }

        client = run_viz.app.test_client()

        health = client.get("/health")
        if health.status_code != 200:
            print(f"/health status {health.status_code}")
            return 1
        health_json = health.get_json() or {}
        if "status" not in health_json or "items" not in health_json:
            print("/health JSON contract mismatch")
            return 1

        search = client.get("/api/search?q=fixture")
        if search.status_code != 200:
            print(f"/api/search status {search.status_code}")
            return 1
        search_json = search.get_json() or {}
        if not {"query", "expandedQuery", "results"}.issubset(search_json.keys()):
            print("/api/search JSON contract mismatch")
            return 1

        graph = client.get("/vectors/graph_data.json")
        if graph.status_code != 200:
            print(f"/vectors/graph_data.json status {graph.status_code}")
            return 1
        graph_json = json.loads(graph.data.decode("utf-8"))
        if "meta" not in graph_json or "nodes" not in graph_json:
            print("/vectors graph JSON contract mismatch")
            return 1

    finally:
        shutil.rmtree(tmp_vectors, ignore_errors=True)

    print("Backend smoke tests passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
