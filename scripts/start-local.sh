#!/usr/bin/env bash
# Start the Alchemy Cascade local test stack:
#   MongoDB + Redis, be-wsproxy, be-alchemy-cascade (gRPC 9107), this UI.
set -euo pipefail

source "$(cd "$(dirname "$0")" && pwd)/lib.sh"

install_stop_trap

require_dir "$WSPROXY_DIR"
require_dir "$GAME_DIR"
if [ ! -x "$GAME_DIR/gradlew" ] || [ ! -x "$WSPROXY_DIR/gradlew" ]; then
  echo "Gradle wrapper is missing in be-alchemy-cascade or be-wsproxy." >&2
  exit 1
fi
ensure_run_dir

echo "Alchemy local stack"
echo "  ui       $UI_DIR"
echo "  wsproxy  $WSPROXY_DIR"
echo "  game     $GAME_DIR"

if ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker Desktop, then retry." >&2
  exit 1
fi

if port_open "$MONGO_PORT" && port_open "$REDIS_PORT"; then
  echo "MongoDB (:$MONGO_PORT) and Redis (:$REDIS_PORT) already listening."
else
  if ! docker network inspect private_net >/dev/null 2>&1; then
    docker network create private_net >/dev/null
  fi
  echo "Starting MongoDB and Redis..."
  (
    cd "$WSPROXY_DIR"
    docker compose up -d mongodb redis
  )
  wait_for_port "$MONGO_PORT" "MongoDB" 60
  wait_for_port "$REDIS_PORT" "Redis" 60
fi

if port_open "$WSPROXY_HTTP_PORT"; then
  echo "be-wsproxy already listening on :$WSPROXY_HTTP_PORT"
  if ! port_open "$WSPROXY_WALLET_PORT"; then
    echo "be-wsproxy HTTP is up but wallet :$WSPROXY_WALLET_PORT is not." >&2
    echo "Stop the process on :$WSPROXY_HTTP_PORT and run this script again." >&2
    exit 1
  fi
else
  echo "Starting be-wsproxy..."
  start_logged wsproxy "$WSPROXY_DIR" \
    ./gradlew :app:bootRun --no-daemon --console=plain
  wait_for_port "$WSPROXY_HTTP_PORT" "be-wsproxy HTTP" 240 wsproxy
  wait_for_port "$WSPROXY_WALLET_PORT" "be-wsproxy wallet" 60 wsproxy
fi

if port_open "$GAME_GRPC_PORT"; then
  echo "Alchemy game already listening on :$GAME_GRPC_PORT"
else
  echo "Starting Alchemy Cascade..."
  start_logged game "$GAME_DIR" \
    env \
    SPRING_PROFILES_ACTIVE=local \
    ZMQ_WS_PUBLISHER_ADDRESS=tcp://127.0.0.1:5555 \
    APP_WALLET_ADDRESS=localhost:8086 \
    ./gradlew :app:bootRun --no-daemon --console=plain
  wait_for_port "$GAME_GRPC_PORT" "Alchemy gRPC" 240 game
fi

if port_open "$UI_PORT"; then
  echo "debug-tool-ui already listening on :$UI_PORT"
  echo "That process keeps whatever env it was started with. Stop it before switching local/staging."
else
  if [ ! -d "$UI_DIR/node_modules" ]; then
    echo "Installing debug-tool-ui dependencies..."
    (cd "$UI_DIR" && npm install)
  fi
  echo "Starting debug-tool-ui (local agency + websocket)..."
  start_logged ui "$UI_DIR" \
    env \
    VITE_API_AUTH_URL=http://localhost:9090 \
    VITE_AUTH_REFRESH_URL=http://localhost:9090/api/auth/refresh \
    VITE_AUTH_REFRESH_INTERVAL_MS=115000 \
    VITE_WS_URL=ws://localhost:9090/websocket \
    VITE_AGENT_ID=AGENCY_001 \
    VITE_WS_TIMEOUT_MS=10000 \
    npm run dev -- --host 127.0.0.1 --port "$UI_PORT" --strictPort
  wait_for_port "$UI_PORT" "debug-tool-ui" 60 ui
fi

echo ""
echo "Local Alchemy test is up."
echo "  UI      http://127.0.0.1:$UI_PORT"
echo "  Agency  http://localhost:$WSPROXY_HTTP_PORT"
echo "  WS      ws://localhost:$WSPROXY_HTTP_PORT/websocket"
echo "  Game    gRPC localhost:$GAME_GRPC_PORT (yama_01027)"
echo "  Logs    $RUN_DIR"

if [ -n "$STARTED_PIDS" ]; then
  watch_started
fi
