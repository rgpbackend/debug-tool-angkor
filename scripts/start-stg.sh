#!/usr/bin/env bash
# Start this UI against staging agency + gob02 websocket.
# Alchemy and wsproxy stay on the staging hosts; this script does not boot them locally.
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

install_stop_trap

ensure_run_dir

echo "Alchemy staging UI"
echo "  ui     $UI_DIR"
echo "  agency https://agency001.relaxwmestu.xyz/api/v1"
echo "  ws     wss://gob02-ws.relaxwmestu.xyz/websocket"

if port_open "$UI_PORT"; then
  echo "debug-tool-ui is already listening on :$UI_PORT." >&2
  echo "Stop that process before starting the staging UI on the same port." >&2
  exit 1
fi

if [ ! -d "$UI_DIR/node_modules" ]; then
  echo "Installing debug-tool-ui dependencies..."
  (cd "$UI_DIR" && npm install)
fi

echo "Starting debug-tool-ui (staging)..."
start_logged ui "$UI_DIR" \
  env \
  VITE_API_AUTH_URL=https://agency001.relaxwmestu.xyz/api/v1 \
  VITE_AUTH_REFRESH_URL=https://authentication.relaxwmestu.xyz/api/auth/refresh \
  VITE_AUTH_REFRESH_INTERVAL_MS=115000 \
  VITE_WS_URL=wss://gob02-ws.relaxwmestu.xyz/websocket \
  VITE_AGENT_ID=AGENCY_001 \
  VITE_WS_TIMEOUT_MS=10000 \
  npm run dev -- --host 127.0.0.1 --port "$UI_PORT" --strictPort

wait_for_port "$UI_PORT" "debug-tool-ui" 60 ui

echo ""
echo "Staging Alchemy UI is up."
echo "  UI   http://127.0.0.1:$UI_PORT"
echo "  Logs $RUN_DIR/ui.log"
echo "Login uses the staging agency. The game server is the deployed Alchemy plugin, not this laptop."

watch_started
