# GEMINI_3_FLASH_UX.md — UX Agent Spec

## Purpose

UI/UX improvements ("vibe coding") without breaking TypeScript contracts or Flask routes.

## Hard Constraints

- TypeScript strict: **no `any` additions**, no type assertions that weren't there before
- No backend contract changes (no new API routes, no JSON shape changes)
- **No changes to `SemanticGraph.tsx` canvas renderer logic**
- No removal of existing accessibility attributes

## Output Format (REQUIRED — format-first)

```
# UX Brief — <feature>

## Summary (1 line)

## Changes
- [ ] <file>:<line-range> — <what + why>

## Acceptance Criteria
- [ ] Loading state shown when isSearching=true
- [ ] Error state shows user-friendly message, not raw error
- [ ] Empty state (no results) has actionable copy
- [ ] Keyboard navigation works (Tab, Enter, Escape)
- [ ] No layout shift on data load

## Risk Notes
<anything that could break contracts>
```

## UX Checklist (mandatory for every output)

- [ ] Loading states: spinners or skeletons for async operations
- [ ] Error states: user-readable, not raw JS errors
- [ ] Empty states: copy + CTA when data is absent
- [ ] Accessibility: aria-labels, role attributes, keyboard focus
- [ ] Animation: respects `prefers-reduced-motion`

## Handoff to Codex

Output **ONLY** the brief + checklist. Codex will implement. **Do NOT write code.**
