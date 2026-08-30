#!/usr/bin/env bash
# =============================================================================
# BugFlow — One-command local setup (backend + frontend + .env scaffolding)
#
# Usage:
#   bash scripts/setup.sh              # interactive: prompts for missing values
#   T2_SUPABASE_URL=... \
#   T2_SUPABASE_ANON_KEY=... \
#   T2_SUPABASE_SERVICE_ROLE_KEY=... \
#   bash scripts/setup.sh --yes        # non-interactive (CI-friendly)
#
# Produces:
#   backend/.env         (SUPABASE_* + CORS_ORIGINS + optional demo overrides)
#   frontend/.env.local  (NEXT_PUBLIC_*)
#   backend/.venv        (Python venv with requirements installed)
#   frontend/node_modules (deps installed)
# =============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
YES="${1:-}"
declare -i ERR=0

# --- helpers ----------------------------------------------------------------
require() {
  local name="$1"
  local val="${!name:-}"
  if [ -z "$val" ]; then
    if [ "$YES" == "--yes" ]; then
      echo "[error] ${name} is required (set it as an env var)." >&2
      exit 1
    fi
    read -rp "  ${name}: " val
  fi
  printf '%s' "$val"
}

note() { echo "  [SETUP] $1"; }

# --- prerequisites ----------------------------------------------------------
command -v python3 >/dev/null 2>&1 || command -v python >/dev/null 2>&1 || {
  echo "[error] Python not found. Install Python 3.10+." >&2; exit 1; }
command -v node >/dev/null 2>&1 || { echo "[error] Node not found. Install Node 18+." >&2; exit 1; }

# --- backend/.env -----------------------------------------------------------
if [ -f "$ROOT/backend/.env" ]; then
  note "backend/.env already exists — leaving untouched."
else
  echo ""
  echo "  Fill in your Supabase project values (https://supabase.com/dashboard → API):"
  SUPABASE_URL=$(require T2_SUPABASE_URL)
  SUPABASE_ANON_KEY=$(require T2_SUPABASE_ANON_KEY)
  SUPABASE_SERVICE_ROLE_KEY=$(require T2_SUPABASE_SERVICE_ROLE_KEY)
  cat > "$ROOT/backend/.env" <<EOF
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://192.168.1.11:3000
EOF
  note "wrote backend/.env"
fi

# --- frontend/.env.local ------------------------------------------------------
if [ -f "$ROOT/frontend/.env.local" ]; then
  note "frontend/.env.local already exists — leaving untouched."
else
  echo ""
  SUPABASE_URL=$(require T2_SUPABASE_URL)
  SUPABASE_ANON_KEY=$(require T2_SUPABASE_ANON_KEY)
  cat > "$ROOT/frontend/.env.local" <<EOF
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
NEXT_PUBLIC_DEMO_EMAIL=demo@bugflow.app
NEXT_PUBLIC_DEMO_PASSWORD=Demo1234!
NEXT_PUBLIC_DEMO_NAME=Demo User
EOF
  note "wrote frontend/.env.local"
fi

# --- backend python venv ------------------------------------------------------
if [ -d "$ROOT/backend/.venv" ]; then
  note "backend/.venv already exists — skipping venv creation."
else
  note "creating backend/.venv ..."
  python3 -m venv "$ROOT/backend/.venv" 2>/dev/null || python -m venv "$ROOT/backend/.venv"
fi
note "installing backend requirements ..."
"$ROOT/backend/.venv/bin/pip" install -q -r "$ROOT/backend/requirements.txt" -r "$ROOT/backend/requirements-test.txt"

# --- frontend deps ------------------------------------------------------------
if [ -d "$ROOT/frontend/node_modules" ]; then
  note "frontend/node_modules already exists — skipping npm ci."
else
  note "installing frontend dependencies (npm ci) ..."
  (cd "$ROOT/frontend" && npm ci)
fi

echo ""
echo "  Setup complete! Run:"
echo "    backend:  cd backend  && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo "    frontend: cd frontend && npm run dev"
echo "  (Windows: use .venv\\Scripts\\uvicorn.exe instead of .venv/bin/uvicorn)"
echo ""
exit "$ERR"