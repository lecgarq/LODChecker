#!/usr/bin/env python3
from __future__ import annotations

import argparse
import statistics
import subprocess
import sys
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
PIPELINE = REPO_ROOT / "01_backend" / "img_pipeline" / "Run_Pipeline_Optimized.py"
VENV_PY = REPO_ROOT / "03_env" / "python" / "imgpipe_env" / "Scripts" / "python.exe"


def run_once(input_dir: Path, output_dir: Path, limit: int, provider: str) -> tuple[int, float]:
    cmd = [
        str(VENV_PY if VENV_PY.exists() else Path(sys.executable)),
        str(PIPELINE),
        "--input",
        str(input_dir),
        "--output",
        str(output_dir),
        "--limit",
        str(limit),
        "--provider",
        provider,
    ]
    start = time.perf_counter()
    proc = subprocess.run(cmd)
    elapsed = time.perf_counter() - start
    return proc.returncode, elapsed


def main() -> int:
    parser = argparse.ArgumentParser(description="Benchmark optimized pipeline runtime.")
    parser.add_argument("--input", default="00_data/img", help="Input image directory.")
    parser.add_argument("--runs", type=int, default=3, help="Benchmark repetitions.")
    parser.add_argument("--limit", type=int, default=5, help="Images per run.")
    parser.add_argument("--provider", default="Benchmark", help="Provider label for generated records.")
    parser.add_argument("--output-base", default="_bench_runs", help="Base output directory.")
    args = parser.parse_args()

    input_dir = (REPO_ROOT / args.input).resolve()
    if not input_dir.exists():
        print(f"Input directory does not exist: {input_dir}")
        return 1

    results: list[float] = []
    for i in range(args.runs):
        out_dir = (REPO_ROOT / f"{args.output_base}_{i + 1}").resolve()
        rc, elapsed = run_once(input_dir, out_dir, args.limit, args.provider)
        per_image = elapsed / max(args.limit, 1)
        print(f"Run {i+1}/{args.runs}: exit={rc}, elapsed={elapsed:.2f}s, per_image={per_image:.2f}s")
        if rc != 0:
            print("Benchmark aborted due non-zero pipeline exit.")
            return rc
        results.append(per_image)

    median = statistics.median(results)
    p95 = max(results) if len(results) < 20 else statistics.quantiles(results, n=100)[94]
    print(f"Per-image median: {median:.2f}s")
    print(f"Per-image p95: {p95:.2f}s")
    print(f"Target check (~30s): {'PASS' if median <= 30.0 else 'NOT MET'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
