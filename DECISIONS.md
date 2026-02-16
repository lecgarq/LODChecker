# LOD Checker Decisions

This log captures active architectural decisions in the current mainline state.

## ADR-001: Python 3.12 + CUDA as hard runtime baseline

- Decision: keep Python pinned to 3.12 and GPU/CUDA path as mandatory for pipeline operations.
- Why: tested compatibility with the current model/toolchain set.
- Consequence: no CPU-only fallback strategy is treated as acceptable project direction.

## ADR-002: Centralized configuration

- Decision: use `config/default.yaml` + `config/loader.py` as single source of truth for paths and model IDs.
- Why: remove hardcoded repo roots and model identifiers across pipeline/backend.
- Consequence: all path/model overrides must flow through config or `LOD_*` env vars.

## ADR-003: Canonical orchestrator is `Run_Pipeline_Optimized.py`

- Decision: optimized orchestrator is the maintained pipeline entrypoint.
- Why: staged batching and resource control provide better throughput and cleaner ownership.
- Consequence: `Run_Pipeline.py` remains legacy/deprecated.

## ADR-004: Schema-first tolerance at boundaries

- Decision: validate registry and graph payloads with Pydantic (`01_backend/schemas.py`), skip invalid records instead of crashing.
- Why: preserve service availability in the presence of partial bad data.
- Consequence: logs become part of operational diagnosis; data quality issues are visible but non-fatal.

## ADR-005: Embedding provider abstraction

- Decision: introduce `EmbeddingProvider` interface and `SigLIPProvider` implementation.
- Why: decouple pipeline call sites from concrete embedding model wiring.
- Consequence: future model swaps can be staged through provider implementations without route/data-contract churn.

## ADR-006: Thin model adapters for heavy model entrypoints

- Decision: BLIP2 and RMBG loading goes through adapters.
- Why: isolate model-specific loading logic from orchestration flow.
- Consequence: easier testability and smaller blast radius for model runtime changes.

## ADR-007: Backend runtime state via class-based holder

- Decision: `BackendResources` owns model/processor/embeddings/registry/query-cache state.
- Why: reduce global singleton sprawl and improve modularity while preserving API behavior.
- Consequence: route contracts stay stable; internal lifecycle becomes clearer.

## ADR-008: Frontend decomposition with stability-first fixes

- Decision: split large UI concerns into hooks/services/subcomponents while fixing known crash paths.
- Why: improve maintainability and prevent regressions in dashboard/layout/delete flows.
- Consequence: contracts stay stable; rendering logic remains canvas-based.

## ADR-009: Stage-gated validation in CI

- Decision: enforce audit/docs/backend/frontend checks in GitHub Actions (`.github/workflows/ci.yml`).
- Why: catch regressions before merge and keep staged guarantees enforceable.
- Consequence: PRs are expected to pass typecheck/lint/build/audit/smokes.

## ADR-010: Non-destructive rollback policy

- Decision: use `git revert` stage-by-stage (`ROLLBACK.md`) instead of history rewriting.
- Why: predictable recovery on `main` with auditable rollback commits.
- Consequence: rollback operations are explicit and testable after each revert.
