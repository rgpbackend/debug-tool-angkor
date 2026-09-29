#!/usr/bin/env bash
# Shared helpers for Alchemy local/staging start scripts. Bash 3.2 compatible.
set -euo pipefail

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UI_DIR="$(cd "$SCRIPTS_DIR/.." && pwd)"
CODES_DIR="$(cd "$UI_DIR/.." && pwd)"
GAME_DIR="$CODES_DIR/be-alchemy-cascade"
WSPROXY_DIR="$CODES_DIR/be-wsproxy"
RUN_DIR="$SCRIPTS_DIR/.run"

UI_PORT=5173
WSPROXY_HTTP_PORT=9090
WSPROXY_WALLET_PORT=8086
GAME_GRPC_PORT=9107
MONGO_PORT=27017
REDIS_PORT=6379

STARTED_PIDS=""

port_open() {
  lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1
}

require_dir() {
  if [ ! -d "$1" ]; then
    echo "Missing directory: $1" >&2
    exit 1
  fi
}

ensure_run_dir() {
  mkdir -p "$RUN_DIR"
}

mark_started() {
  STARTED_PIDS="$STARTED_PIDS $1"
  echo "$1" >"$RUN_DIR/$2.pid"
}

kill_tree() {
  local pid="$1"
  local signal="$2"
  local child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child" "$signal"
  done
  kill "-$signal" "$pid" 2>/dev/null || true
}

stop_started() {
  if [ -z "$STARTED_PIDS" ]; then
    return 0
  fi
  echo ""
  echo "Stopping processes this script started..."
  for pid in $STARTED_PIDS; do
    kill_tree "$pid" TERM
  done
  sleep 2
  for pid in $STARTED_PIDS; do
    kill_tree "$pid" KILL
  done
  rm -f "$RUN_DIR"/*.pid
  STARTED_PIDS=""
}

install_stop_trap() {
  on_signal() {
    trap - EXIT INT TERM
    stop_started
    exit 130
  }
  on_exit() {
    stop_started
  }
  trap on_signal INT TERM
  trap on_exit EXIT
}

wait_for_port() {
  local port="$1"
  local label="$2"
  local attempts="${3:-180}"
  local i=0
  while [ "$i" -lt "$attempts" ]; do
    if port_open "$port"; then
      echo "  ready: $label (:$port)"
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  echo "Timed out waiting for $label on port $port" >&2
  if [ -n "${4:-}" ] && [ -f "$RUN_DIR/$4.log" ]; then
    echo "--- $RUN_DIR/$4.log (last 40 lines) ---" >&2
    tail -n 40 "$RUN_DIR/$4.log" >&2
  fi
  return 1
}

start_logged() {
  local name="$1"
  local dir="$2"
  shift 2
  local logfile="$RUN_DIR/$name.log"
  : >"$logfile"
  (
    cd "$dir"
    exec "$@"
  ) >>"$logfile" 2>&1 &
  local pid=$!
  mark_started "$pid" "$name"
  echo "  started $name pid=$pid log=$logfile"
}

watch_started() {
  echo ""
  echo "Ctrl+C stops the processes this script started. MongoDB and Redis are left running."
  while true; do
    for pid in $STARTED_PIDS; do
      if ! kill -0 "$pid" 2>/dev/null; then
        echo "A started process exited (pid $pid). Check logs in $RUN_DIR" >&2
        exit 1
      fi
    done
    sleep 2
  done
}
