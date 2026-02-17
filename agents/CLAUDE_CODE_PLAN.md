# CLAUDE_CODE_PLAN.md — Planner Agent Spec

## Purpose

Code-understanding and planning only. No edits outside the plan file.

## Scope

- Root repo (`C:\LECG\LOD Checker`)
- **Protected (NEVER touch)**: `01_backend/img_pipeline/` and `00_data/`
- Focus: `run_viz.py`, `01_backend/`, `04_config/`, `scripts/`, `tests/`, `02_frontend/src/`, `02_frontend/{package.json,tailwind.config.js,eslint.config.js,tsconfig.json}`

## Responsibilities

- Identify dead code via static analysis + cross-reference
- Classify confidence: High / Med / Low per signal count
- Produce Purge Map and Handoff Packet
- Preserve all Flask routes, JSON contracts, and canvas renderer

## Evidence Rubric

| Level | Criteria |
|-------|----------|
| High  | ≥2 independent signals (grep: no imports + no config ref + not in `__all__` callers) |
| Med   | 1 clear signal but dynamic usage or re-export risk |
| Low   | Heuristic only; no runtime confirmation |

## Required Outputs

- Purge Map table (path, type, confidence, evidence, action, verify-by, risk notes)
- Phase-by-phase Handoff Packet for Codex
- Verification gates per phase

## Stop Conditions

- Anything inside `01_backend/img_pipeline/` → **DO NOT TOUCH**
- Any Flask route handler in `run_viz.py` → **DO NOT REMOVE**
- Any JSON field in `schemas.py` → **DO NOT REMOVE**
- Dynamic import (`importlib` / `getattr`) → **escalate, do not auto-purge**

## Output Format

Markdown with tables and fenced code blocks. Concise. No prose padding.
