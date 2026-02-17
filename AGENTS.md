# AGENTS.md — AI-Agent Instruction Set

> **Read this before making any change to this repo.**
> Applies to all AI agents: Claude Code, Codex, Gemini Flash, and any future agent.

---

## 1. Purpose

This file defines the authoritative rules, constraints, and conventions all AI agents must follow when working in this repository. It is the primary instruction set — not a summary. Agent-specific detail lives in the `agents/` spec files linked in the [Agent Persona Index](#6-agent-persona-index).

---

## 2. Immutable Constraints

These are hard stops. If an action would violate any constraint below, the agent **must refuse and report to the user** — never proceed silently.

| Constraint | Rule |
|-----------|------|
| `01_backend/img_pipeline/` | **Never edit any file.** Read-only. Report any accidental match. |
| `00_data/` | **Never modify or delete.** `img/`, `Categories.json`, and `vectors/` are append-only. |
| `run_viz.py` Flask routes | **Never remove a route handler.** Adding routes is allowed; removing is not. |
| `01_backend/schemas.py` | **Never remove or rename fields.** These are JSON API contracts consumed by the frontend. |
| Bypass lint/tsc | **Never commit with `--no-verify` or any lint/tsc gate bypass.** All gates must pass. |
| Dynamic imports | If `importlib`, `getattr`-based dispatch, or plugin registries are found → **escalate, never auto-purge.** |

---

## 3. Verification Gates

Run **all** gates after **each** phase or meaningful change. Stop if any gate fails.

### Backend (working dir: repo root)

```powershell
# Syntax check — PASS: no errors printed
python -m compileall run_viz.py 01_backend scripts tests

# Audit — PASS: prints "Audit passed." with 0 hardcoded refs
python scripts/audit.py

# Backend smoke — PASS: prints "Backend smoke tests passed."
$env:LOD_BACKEND_TEST_MODE = "1"; python tests/backend_smoke.py

# Pipeline fixtures — PASS: prints "Pipeline tester passed on fixtures."
python tests/pipeline_tester.py
```

### Frontend (working dir: `02_frontend/`)

```powershell
# TypeScript — PASS: zero output (0 errors)
npx tsc --noEmit

# Lint — PASS: exit code 0 (warnings ok, errors not)
npm run lint

# Build — PASS: "built in Xs" with no error lines
npm run build

# Frontend smoke — PASS: "Frontend smoke test passed."
python "..\tests\frontend_smoke.py"
```

### Stop Conditions

- Any gate exits non-zero → **STOP, revert phase, report to user**
- Build bundle size increases unexpectedly → **STOP, investigate before proceeding**
- Any Flask route is missing after a change → **STOP immediately**

---

## 4. Workflow Conventions

### Branching

- Branch naming: `chore/<desc>`, `fix/<desc>`, `feat/<desc>`
- **Never commit directly to `main`** — always open a PR

### Commit Format

```
<type>(<scope>): <short description ≤72 chars>

<body — what and why, not how>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
```

Valid types: `feat`, `fix`, `chore`, `docs`, `refactor`

- One logical change per commit
- **Deprecate-first**: add `# DEPRECATED: <reason>` comment before deleting any code or file

### Rollback

- Per commit: `git revert HEAD`
- **Never `git reset --hard`** unless the user explicitly requests it
- Each phase = one commit → enables clean per-phase revert

### Pull Requests

- All gates must pass on the branch before opening a PR
- Target branch: `main` — **never force-push to main**
- PR title ≤ 70 chars

---

## 5. Code Conventions

### Python

- Python 3.12 only — no 3.11 or 3.13 syntax
- `from __future__ import annotations` at the top of every module
- Type hints required on all public functions
- No hardcoded repo root paths — use `04_config/config/loader.py:find_repo_root()`
- No hardcoded model IDs in Step files — reference `04_config/config/default.yaml`
- f-strings preferred over `.format()` or `%`
- `compileall` must pass before any Python commit

### TypeScript / React

- `strict: true` enforced — **no `any` additions**
- `noUnusedLocals: true`, `noUnusedParameters: true` enforced
- Unused parameters → prefix with `_` (e.g. `_onClose`)
- No `require()` imports — ESM `import` / `import type` only
- **No logic changes to `SemanticGraph.tsx` canvas renderer** without explicit user instruction
- API calls go through `services/api.ts` — **no inline `fetch` in components**

---

## 6. Agent Persona Index

Each agent has a dedicated spec file. Read the relevant spec before starting work.

| Agent | Spec File | Role |
|-------|-----------|------|
| Claude Code | [`agents/CLAUDE_CODE_PLAN.md`](agents/CLAUDE_CODE_PLAN.md) | Static analysis, purge maps, planning |
| Codex | [`agents/CODEX_5_3_EXECUTION.md`](agents/CODEX_5_3_EXECUTION.md) | Phased execution, gate verification, deprecation |
| Gemini Flash | [`agents/GEMINI_3_FLASH_UX.md`](agents/GEMINI_3_FLASH_UX.md) | UX briefs, accessibility checklist, handoff |
