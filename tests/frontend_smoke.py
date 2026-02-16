#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    dist_dir = repo_root / "02_frontend" / "dist"
    index_path = dist_dir / "index.html"
    assets_dir = dist_dir / "assets"

    if not index_path.exists():
        print("Frontend smoke failed: dist/index.html missing.")
        return 1

    if not assets_dir.exists():
        print("Frontend smoke failed: dist/assets missing.")
        return 1

    has_js = any(p.suffix == ".js" for p in assets_dir.glob("*.js"))
    has_css = any(p.suffix == ".css" for p in assets_dir.glob("*.css"))
    if not (has_js and has_css):
        print("Frontend smoke failed: missing JS/CSS build artifacts.")
        return 1

    print("Frontend smoke test passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
