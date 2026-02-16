#!/usr/bin/env python3
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
FIXTURE_DIR = REPO_ROOT / "tests" / "fixtures" / "pipeline"
STEP09_PATH = REPO_ROOT / "01_backend" / "img_pipeline" / "Step09_DataTools.py"
LOCAL_TMP_ROOT = REPO_ROOT / "tests" / ".tmp"

sys.path.insert(0, str(REPO_ROOT / "01_backend"))
from schemas import validate_graph_data, validate_registry_records  # noqa: E402


def run_pipeline_contract_harness() -> int:
    batch_fixture = FIXTURE_DIR / "batch_fixture.json"
    graph_fixture = FIXTURE_DIR / "graph_fixture.json"

    if not batch_fixture.exists() or not graph_fixture.exists():
        print("Missing pipeline fixtures.")
        return 1

    temp_root = LOCAL_TMP_ROOT / "pipeline_tester_run"
    if temp_root.exists():
        shutil.rmtree(temp_root, ignore_errors=True)
    temp_root.mkdir(parents=True, exist_ok=True)
    try:
        vectors_dir = temp_root / "vectors"
        vectors_dir.mkdir(parents=True, exist_ok=True)
        working_batch = vectors_dir / "batch_fixture.json"
        working_batch.write_text(batch_fixture.read_text(encoding="utf-8"), encoding="utf-8")

        cmd = [sys.executable, str(STEP09_PATH), "--root", str(temp_root), "--consolidate"]
        proc = subprocess.run(cmd, capture_output=True, text=True)
        if proc.returncode != 0:
            print("Step09 consolidate failed:")
            print(proc.stdout)
            print(proc.stderr)
            return 1

        master_path = vectors_dir / "master_registry.json"
        if not master_path.exists():
            print("master_registry.json was not generated.")
            return 1

        merged = json.loads(master_path.read_text(encoding="utf-8"))
        valid_records, skipped = validate_registry_records(merged)
        if skipped != 0:
            print(f"Expected all fixture records valid; skipped={skipped}")
            return 1
        if len(valid_records) != 2:
            print(f"Expected 2 records after consolidation, found {len(valid_records)}")
            return 1

        graph_payload = json.loads(graph_fixture.read_text(encoding="utf-8"))
        graph_validated, graph_skipped = validate_graph_data(graph_payload)
        if graph_skipped != 0:
            print(f"Expected graph fixture to be fully valid; skipped={graph_skipped}")
            return 1
        if len(graph_validated.get("nodes", [])) != 2:
            print("Graph fixture validation returned unexpected node count.")
            return 1

        print("Pipeline tester passed on fixtures.")
        return 0
    finally:
        shutil.rmtree(temp_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(run_pipeline_contract_harness())
