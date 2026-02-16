from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any


_CONFIG_CACHE: dict[str, Any] | None = None


def find_repo_root(start_path: Path | None = None) -> Path:
    current = (start_path or Path(__file__).resolve()).resolve()
    if current.is_file():
        current = current.parent

    for candidate in [current, *current.parents]:
        if (candidate / "04_config" / "config" / "default.yaml").exists():
            return candidate
    raise FileNotFoundError("Could not locate repo root containing 04_config/config/default.yaml")


def _read_default_config(repo_root: Path) -> dict[str, Any]:
    config_path = repo_root / "04_config" / "config" / "default.yaml"
    return json.loads(config_path.read_text(encoding="utf-8"))


def _coerce_env_value(value: str) -> Any:
    lowered = value.strip().lower()
    if lowered in {"true", "false"}:
        return lowered == "true"
    if lowered.isdigit() or (lowered.startswith("-") and lowered[1:].isdigit()):
        return int(lowered)
    return value


def _set_nested(data: dict[str, Any], key_path: tuple[str, ...], value: Any) -> None:
    cursor = data
    for key in key_path[:-1]:
        if key not in cursor or not isinstance(cursor[key], dict):
            cursor[key] = {}
        cursor = cursor[key]
    cursor[key_path[-1]] = value


def _apply_env_overrides(cfg: dict[str, Any]) -> dict[str, Any]:
    env_map: dict[str, tuple[str, ...]] = {
        "LOD_PATH_DATA_ROOT": ("paths", "data_root"),
        "LOD_PATH_VECTORS_DIR": ("paths", "vectors_dir"),
        "LOD_PATH_IMAGES_DIR": ("paths", "images_dir"),
        "LOD_PATH_CATEGORIES_JSON": ("paths", "categories_json"),
        "LOD_PATH_PIPELINE_OPTIMIZED": ("paths", "pipeline_optimized"),
        "LOD_PATH_PIPELINE_LEGACY": ("paths", "pipeline_legacy"),
        "LOD_PATH_DATA_TOOLS": ("paths", "data_tools"),
        "LOD_PATH_GRAPH_PREP": ("paths", "graph_prep"),
        "LOD_PATH_BACKEND_DIR": ("paths", "backend_dir"),
        "LOD_PATH_FRONTEND_DIR": ("paths", "frontend_dir"),
        "LOD_PATH_VENV_PYTHON_WINDOWS": ("paths", "venv_python_windows"),
        "LOD_MODEL_SIGLIP": ("models", "siglip"),
        "LOD_MODEL_BLIP2": ("models", "blip2"),
        "LOD_MODEL_RMBG": ("models", "rmbg"),
        "LOD_MODEL_GDINO": ("models", "gdino"),
        "LOD_MODEL_SAM": ("models", "sam"),
        "LOD_MODEL_SENTENCE_TRANSFORMER": ("models", "sentence_transformer"),
        "LOD_MODEL_OPENAI": ("models", "openai_model"),
    }

    out = json.loads(json.dumps(cfg))
    for env_name, key_path in env_map.items():
        value = os.getenv(env_name)
        if value is None:
            continue
        _set_nested(out, key_path, _coerce_env_value(value))
    return out


def load_config(start_path: Path | None = None) -> dict[str, Any]:
    global _CONFIG_CACHE
    if _CONFIG_CACHE is not None:
        return _CONFIG_CACHE

    repo_root = find_repo_root(start_path)
    cfg = _read_default_config(repo_root)
    cfg = _apply_env_overrides(cfg)
    cfg["repo_root"] = str(repo_root)
    _CONFIG_CACHE = cfg
    return _CONFIG_CACHE


def resolve_repo_path(relative_path: str, start_path: Path | None = None) -> Path:
    cfg = load_config(start_path)
    return Path(cfg["repo_root"]) / relative_path
