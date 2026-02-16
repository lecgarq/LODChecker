# LOD Checker Working Agreements

This file defines implementation constraints and conventions for contributors and coding agents.

## Non-Negotiable Constraints

- Windows + PowerShell target
- Python 3.12 only
- CUDA required for pipeline workflows
- No CPU-only proposal path

Do not modify/delete:
- `00_data/img/`
- `00_data/Categories.json`

Data output rule:
- Treat `00_data/vectors/` as append-only for finalized outputs.

Contract stability rule:
- Preserve existing routes and JSON contracts unless explicitly staged.

## Source of Truth

- Configuration: `config/default.yaml` loaded by `config/loader.py`
- Canonical pipeline orchestrator: `01_backend/img_pipeline/Run_Pipeline_Optimized.py`
- Backend service runtime: `run_viz.py` (`BackendResources`)

## Backend/Pipeline Conventions

- Prefer `pathlib` and repo-relative paths.
- Avoid hardcoded absolute repo roots and model IDs.
- Keep schema validation at boundaries (`01_backend/schemas.py`).
- Keep adapters/providers thin and explicit.
- Preserve behavior while refactoring internals.

## Frontend Conventions

- TypeScript strict mode must pass (`npx.cmd tsc --noEmit`).
- Keep decomposed structure:
  - `components/` for UI domains
  - `hooks/` for behavior/state orchestration
  - `services/` for API integration
  - `lib/` for deterministic helpers/constants
  - `types/` for contracts
- Maintain crash-safe behavior in dashboard/layout switching/node deletion flows.

## Testing and CI Expectations

Local checks:

```powershell
python scripts/audit.py
python tests/pipeline_tester.py
python tests/backend_smoke.py
cd 02_frontend; npx.cmd tsc --noEmit; cd ..
```

CI checks are defined in `.github/workflows/ci.yml` and should stay green for PRs.

## Git and PR Discipline

- Use small, behavior-preserving PRs.
- Keep acceptance criteria explicit.
- Document rollback path (`ROLLBACK.md`) for staged changes.
- Do not revert unrelated user changes in dirty worktrees.
