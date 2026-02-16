# Legacy Backend Items

This folder contains backend files quarantined during `chore/repo-structure-v1`.

## Why this exists
- Items were verified as unused by active runtime entrypoints (`run_viz.py` + optimized pipeline).
- They are preserved for rollback/comparison before permanent deletion.

## Contents
- `run_ui.py`: legacy Tkinter launcher not used by current local full-stack path.
- `dotnet-install.ps1`: local helper script not referenced by runtime or CI.

## Removal policy
- Keep until one stable release cycle confirms no operational dependency.
- If needed, restore by moving files back to original locations.
