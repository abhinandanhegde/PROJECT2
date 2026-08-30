# Scripts

Utility and automation scripts.

| Script | Purpose |
|--------|---------|
| `setup.sh` | One-command local setup: writes `backend/.env` + `frontend/.env.local` (never overwrites existing), creates/installs backend venv + frontend deps, validates seed dry-run. Run from repo root: `bash scripts/setup.sh` |
| `seed.py` | Database seeder (idempotent, deterministic UUIDs). `python -m scripts.seed --dry-run` previews without writing. |