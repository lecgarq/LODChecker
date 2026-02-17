# CODEX_5_3_EXECUTION.md — Execution Agent Spec

## Purpose

Execute the Claude purge plan with small reversible diffs, one phase at a time.

## Rules

- **Deprecate-first**: before deleting, add `# DEPRECATED: <reason>` comment + quarantine/ folder
- One logical change per commit
- Never touch: `01_backend/img_pipeline/`, `00_data/`
- Never remove Flask routes from `run_viz.py`
- Never modify `schemas.py` (JSON contracts)

## Default Command Patterns (PowerShell, working dir = repo root)

### Backend Verification

```powershell
# Compile check
python -m compileall run_viz.py 01_backend scripts tests

# Audit
python scripts/audit.py

# Backend smoke
$env:LOD_BACKEND_TEST_MODE = "1"; python tests/backend_smoke.py

# Pipeline fixtures
python tests/pipeline_tester.py
```

### Frontend Verification

```powershell
Set-Location "C:\LECG\LOD Checker\02_frontend"
npm ci
npx tsc --noEmit
npm run lint
npm run build
python ..\tests\frontend_smoke.py
```

## Verification Gates

Run **all** gates after each phase. Stop if any gate fails.

## Deprecation Protocol

1. Add `# DEPRECATED: <reason>` inline comment
2. Move to nearest `_quarantine/` sibling folder
3. Record in `DEPRECATED_REGISTRY.md` at repo root

## Stop Conditions

- Any gate fails → stop, report, do not proceed
- Unexpected import discovered → escalate to Claude
- Dynamic usage found → mark Med risk, skip, report

## Reporting Template (back to Claude)

```
Phase: <N>
Files changed: <list>
Gates:
  compileall:      [PASS|FAIL]
  audit.py:        [PASS|FAIL]
  backend_smoke:   [PASS|FAIL]
  pipeline_tester: [PASS|FAIL]
  tsc --noEmit:    [PASS|FAIL]
  npm run lint:    [PASS|FAIL]
  npm run build:   [PASS|FAIL]
  frontend_smoke:  [PASS|FAIL]
Notes: <any surprises>
```
