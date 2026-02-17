# LOD Checker Working Agreements

Agent specs live in the `agents/` directory:

- `agents/CLAUDE_CODE_PLAN.md` — planner agent: code analysis, purge maps, handoff packets
- `agents/CODEX_5_3_EXECUTION.md` — execution agent: phased diffs, verification gates, deprecation protocol
- `agents/GEMINI_3_FLASH_UX.md` — UX agent: UI briefs, accessibility checklist, handoff to Codex

Hard constraints (apply to all agents):
- Never touch `01_backend/img_pipeline/` or `00_data/`
- Never remove Flask routes from `run_viz.py`
- Never modify `01_backend/schemas.py` (JSON contracts)
- Deprecate-first: comment + quarantine before delete
- Run all verification gates after each phase
