# Rollback Runbook

This document defines stage-by-stage rollback via `git revert` for the 5-stage refactor sequence.

## Principles
- Use non-destructive rollback (`git revert`), not history rewriting.
- Revert in reverse order if multiple stages must be undone.
- Validate after each revert before proceeding.

## Stage Rollback Steps

### Stage 1 - Docs + Audit Scaffolding
1. `git checkout main`
2. `git revert <stage1_commit_or_merge_sha>`

### Stage 2 - Folder Structure + Centralized Config
1. `git checkout main`
2. `git revert <stage2_commit_or_merge_sha>`

### Stage 3 - Frontend Stability Fixes
1. `git checkout main`
2. `git revert <stage3_commit_or_merge_sha>`

### Stage 4 - Pipeline Modularity + Contracts
1. `git checkout main`
2. `git revert <stage4_commit_or_merge_sha>`

### Stage 5 - Remote Tester + CI Gates
1. `git checkout main`
2. `git revert <stage5_commit_or_merge_sha>`

## If PRs Were Squash-Merged
- Use the squash commit SHA from `main` for each stage.

## If PRs Were Merge-Commit Strategy
- Revert the merge commit SHA:
1. `git checkout main`
2. `git revert -m 1 <merge_commit_sha>`

## Post-Rollback Validation
1. `python scripts/audit.py`
2. `python tests/pipeline_tester.py`
3. `python tests/backend_smoke.py`
4. `cd 02_frontend && npm run build && cd ..`
