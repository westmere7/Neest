#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Neest development server launcher (macOS / Linux)
#  - Ensures Node.js >= 20 is available (checks Homebrew, nvm, fnm, Volta)
#  - Installs dependencies on first run (or when package.json changed)
#  - Starts the Vite dev server with hot reload and opens the browser
#  - Code edits and changes to project files in ./projects/ appear live
#
#  Usage:
#    ./start-neest.sh            (this computer only, opens browser)
#    ./start-neest.sh --lan      (reachable from phones/PCs on your network)
#    ./start-neest.sh --no-open  (do not auto-open browser tab)
# ---------------------------------------------------------------------------
set -euo pipefail

cd "$(dirname "$0")"

# Ensure common macOS / Linux Node locations are in PATH when launched from Finder
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.volta/bin:$HOME/.asdf/shims:$HOME/.local/bin:$PATH"

if ! command -v node >/dev/null 2>&1; then
  if [ -s "${NVM_DIR:-$HOME/.nvm}/nvm.sh" ]; then
    # shellcheck disable=SC1090
    . "${NVM_DIR:-$HOME/.nvm}/nvm.sh"
  elif command -v fnm >/dev/null 2>&1; then
    eval "$(fnm env)"
  fi
fi

if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  Node.js 20 or newer is required. Install it from https://nodejs.org and run this file again."
  echo ""
  exit 1
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo ""
  echo "  Node.js $(node -v) detected; Neest needs Node.js 20 or newer."
  echo ""
  exit 1
fi

NEED_INSTALL=0
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
  NEED_INSTALL=1
elif [ "package.json" -nt "node_modules/.package-lock.json" ] || [ "package-lock.json" -nt "node_modules/.package-lock.json" ]; then
  NEED_INSTALL=1
elif ! npm ls --depth=0 >/dev/null 2>&1; then
  NEED_INSTALL=1
fi

if [ "$NEED_INSTALL" -eq 1 ]; then
  echo "  Installing dependencies..."
  if ! npm install --no-audit --no-fund; then
    echo "  npm install failed. Check your network connection and try again."
    exit 1
  fi
fi

PORT=5173
OPEN_ARG="--open"
EXTRA_ARGS=()

for arg in "$@"; do
  case "$arg" in
    --lan)
      EXTRA_ARGS+=("--host")
      echo "  LAN mode: other devices can open the Network address printed below. The projects/ folder is writable by them."
      ;;
    --no-open)
      OPEN_ARG=""
      ;;
    *)
      EXTRA_ARGS+=("$arg")
      ;;
  esac
done

echo ""
echo "  Starting Neest on http://localhost:$PORT  (press Ctrl+C to stop)"
echo ""

VITE_ARGS=("--port" "$PORT")
if [ -n "$OPEN_ARG" ]; then
  VITE_ARGS+=("$OPEN_ARG")
fi
if [ "${#EXTRA_ARGS[@]}" -gt 0 ]; then
  VITE_ARGS+=("${EXTRA_ARGS[@]}")
fi

npm run dev -- "${VITE_ARGS[@]}"
