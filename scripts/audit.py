#!/usr/bin/env python3
"""Stage 1 repository audit checks.

Critical failures:
- Python version is not exactly 3.12
- Required docs are missing
- Required folders are missing

Warnings:
- .env file is missing

Informational counts:
- Hardcoded absolute root path references
- Hardcoded model IDs in Step files
"""

from __future__ import annotations

import re
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
ABSOLUTE_ROOT_LITERAL = r"C:\LECG\LOD Checker"
ABSOLUTE_ROOT_LITERAL_ALT = "C:/LECG/LOD Checker"

REQUIRED_DOCS = [
    "README.md",
    "skills.md",
    "RUNBOOK.md",
    "CODEBASE_MAP.md",
    "ARCHITECTURE.md",
    "DECISIONS.md",
]

REQUIRED_FOLDERS = [
    "00_data",
    "01_backend",
    "02_frontend",
    "scripts",
]

SCAN_SUFFIXES = {
    ".py",
    ".md",
    ".txt",
    ".json",
    ".yaml",
    ".yml",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".sh",
    ".ps1",
}


def is_text_candidate(path: Path) -> bool:
    return path.suffix.lower() in SCAN_SUFFIXES


def iter_repo_files() -> list[Path]:
    ignored_dirs = {
        ".git",
        ".github",
        ".vscode",
        "__pycache__",
        "node_modules",
        "dist",
        "build",
        ".venv",
        "venv",
        "imgpipe_env",
        "00_data",
    }
    files: list[Path] = []
    for path in REPO_ROOT.rglob("*"):
        if not path.is_file():
            continue
        if any(part in ignored_dirs for part in path.parts):
            continue
        if is_text_candidate(path):
            files.append(path)
    return files


def iter_code_files() -> list[Path]:
    code_targets = [
        REPO_ROOT / "run_viz.py",
        REPO_ROOT / "01_backend",
    ]
    files: list[Path] = []
    for target in code_targets:
        if target.is_file() and is_text_candidate(target):
            files.append(target)
            continue
        if not target.exists():
            continue
        for path in target.rglob("*"):
            if not path.is_file():
                continue
            if any(part in {"imgpipe_env", "__pycache__", ".git"} for part in path.parts):
                continue
            if is_text_candidate(path):
                files.append(path)
    return files


def count_hardcoded_root_refs() -> int:
    count = 0
    for path in iter_code_files():
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        count += text.count(ABSOLUTE_ROOT_LITERAL)
        count += text.count(ABSOLUTE_ROOT_LITERAL_ALT)
    return count


def count_hardcoded_model_ids_in_steps() -> int:
    step_files = sorted((REPO_ROOT / "01_backend" / "img_pipeline").glob("Step*.py"))
    total = 0
    model_id_patterns = [
        re.compile(r"from_pretrained\(\s*[\"'][^\"']+[\"']"),
        re.compile(r"model_id\s*=\s*[\"'][^\"']+[\"']"),
        re.compile(r"checkpoint\s*=\s*[\"'][^\"']+[\"']"),
    ]
    for path in step_files:
        try:
            text = path.read_text(encoding="utf-8", errors="ignore")
        except OSError:
            continue
        for pattern in model_id_patterns:
            total += len(pattern.findall(text))
    return total


def main() -> int:
    critical_errors: list[str] = []
    warnings: list[str] = []

    if sys.version_info[:2] != (3, 12):
        critical_errors.append(
            f"Python 3.12 is required. Found {sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}."
        )

    env_path = REPO_ROOT / ".env"
    if not env_path.exists():
        warnings.append(".env file is missing (warning only).")

    missing_docs = [doc for doc in REQUIRED_DOCS if not (REPO_ROOT / doc).exists()]
    if missing_docs:
        critical_errors.append("Missing required docs: " + ", ".join(missing_docs))

    missing_dirs = [folder for folder in REQUIRED_FOLDERS if not (REPO_ROOT / folder).is_dir()]
    if missing_dirs:
        critical_errors.append("Missing required folders: " + ", ".join(missing_dirs))

    hardcoded_root_count = count_hardcoded_root_refs()
    hardcoded_model_id_count = count_hardcoded_model_ids_in_steps()

    print("=== LOD Checker Stage 1 Audit ===")
    print(f"Python version: {sys.version.split()[0]}")
    print(f"Repo root: {REPO_ROOT}")
    print()
    print(f"Hardcoded root path refs ('{ABSOLUTE_ROOT_LITERAL}'): {hardcoded_root_count}")
    print(f"Hardcoded model-id patterns in Step files: {hardcoded_model_id_count}")
    print()

    if warnings:
        print("Warnings:")
        for message in warnings:
            print(f"- {message}")
        print()

    if critical_errors:
        print("Critical failures:")
        for message in critical_errors:
            print(f"- {message}")
        return 1

    print("Audit passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
