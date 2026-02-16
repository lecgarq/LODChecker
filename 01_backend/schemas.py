from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, ValidationError


class RegistryRecord(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(min_length=1)
    image_embedding: list[float] = Field(min_length=1)
    name_of_file: str | None = None
    final_category: str | None = None
    family_name: str | None = None
    provider: str | None = None


class GraphNodeModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    idx: int | None = None
    id: str = Field(min_length=1)
    x: float
    y: float
    neighbors: list[int] = Field(default_factory=list)
    img: str | None = None
    name: str | None = None
    final_category: str | None = None
    lod_label: str | None = None
    provider: str | None = None


class GraphMetaModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    count: int | None = None
    umap: dict[str, Any] | None = None
    knn: dict[str, Any] | None = None
    bounds: dict[str, Any] | None = None


class GraphDataModel(BaseModel):
    model_config = ConfigDict(extra="allow")

    meta: GraphMetaModel | dict[str, Any] | None = None
    nodes: list[GraphNodeModel] = Field(default_factory=list)


def validate_registry_records(records: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    valid: list[dict[str, Any]] = []
    skipped = 0
    for rec in records:
        try:
            validated = RegistryRecord.model_validate(rec)
            valid.append(validated.model_dump())
        except ValidationError:
            skipped += 1
    return valid, skipped


def validate_graph_data(graph_data: dict[str, Any]) -> tuple[dict[str, Any], int]:
    skipped = 0
    meta = graph_data.get("meta", {})
    nodes = graph_data.get("nodes", [])
    valid_nodes: list[dict[str, Any]] = []

    for node in nodes:
        try:
            validated = GraphNodeModel.model_validate(node)
            valid_nodes.append(validated.model_dump())
        except ValidationError:
            skipped += 1

    try:
        validated_meta = GraphMetaModel.model_validate(meta).model_dump()
    except ValidationError:
        validated_meta = {}

    out = {"meta": validated_meta, "nodes": valid_nodes}
    if "meta" in out and isinstance(out["meta"], dict):
        out["meta"]["count"] = len(valid_nodes)
    return out, skipped
