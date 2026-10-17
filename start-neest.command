#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Neest macOS Finder launcher (double-click in Finder to start server)
# ---------------------------------------------------------------------------
cd "$(dirname "$0")"

./start-neest.sh "$@"
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo ""
  read -r -p "  Press Enter to close..." _
fi
exit $STATUS
