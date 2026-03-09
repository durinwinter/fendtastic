#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT_ZENOH_TCP=7447
PORT_ZENOH_WS=8000
PORT_API=8080
PORT_FRONTEND=3000
PORT_POSTGRES=5432
PORT_NEURON_API=7000
BIND_IP=""
DISPLAY_IP=""
PIDS=()
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.dev.yml"
KILL_FRONTEND_PORT=0

log_info()  { echo -e "  ${CYAN}i${NC}  $*"; }
log_ok()    { echo -e "  ${GREEN}ok${NC} $*"; }
log_warn()  { echo -e "  ${YELLOW}!!${NC} $*"; }
log_err()   { echo -e "  ${RED}xx${NC} $*"; }
log_step()  { echo -e "\n${BOLD}${CYAN}== $* ==${NC}"; }

usage() {
  cat <<EOF
Usage: ./dev.sh [--kill-frontend-port]

Options:
  --kill-frontend-port   Kill any listener on port ${PORT_FRONTEND} before startup
  -h, --help             Show this help message
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --kill-frontend-port)
      KILL_FRONTEND_PORT=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      log_err "Unknown option: $1"
      usage
      exit 1
      ;;
  esac
done

if docker compose version &>/dev/null; then
  COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
  COMPOSE_CMD="docker-compose"
else
  echo "ERROR: docker compose not found"
  exit 1
fi

cleanup() {
  echo ""
  log_step "Shutting down"
  for pid in "${PIDS[@]:-}"; do
    if [ -n "${pid}" ] && kill -0 "$pid" 2>/dev/null; then
      kill "$pid" 2>/dev/null || true
    fi
  done
  $COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true
  log_ok "All services stopped"
}
trap cleanup SIGINT SIGTERM

check_command() {
  local cmd="$1"
  local install_hint="$2"
  if command -v "$cmd" &>/dev/null; then
    log_ok "$cmd"
  else
    log_err "$cmd not found"
    log_info "Install: $install_hint"
    exit 1
  fi
}

check_port() {
  local port="$1"
  local service="$2"
  if ss -tlnp 2>/dev/null | grep -q ":${port} " || lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then
    log_err "Port ${port} (${service}) is already in use"
    return 1
  fi
  log_ok "Port ${port} (${service})"
}

kill_port_listeners() {
  local port="$1"
  local service="$2"
  local pids=""

  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti tcp:"${port}" -sTCP:LISTEN 2>/dev/null | tr '\n' ' ')"
  fi

  if [ -z "$pids" ] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}/tcp" 2>/dev/null | tr ' ' '\n' | tr '\n' ' ')"
  fi

  if [ -z "$pids" ]; then
    log_ok "No listeners to clear on port ${port} (${service})"
    return 0
  fi

  log_warn "Killing listener(s) on port ${port} (${service}): ${pids}"
  for pid in $pids; do
    kill "$pid" 2>/dev/null || true
  done
  sleep 1
  for pid in $pids; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -9 "$pid" 2>/dev/null || true
    fi
  done
}

clear
log_step "Checking dependencies"
check_command rustc "https://rustup.rs"
check_command cargo "installed with rust"
check_command node "Node.js 18+"
check_command npm "installed with node"
check_command docker "docker engine"

NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
  log_err "Node.js 18+ required"
  exit 1
fi

log_step "Cleaning up old instances"
$COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true
for cname in fendtastic-postgres fendtastic-zenoh-router fendtastic-neuron fendtastic-backend fendtastic-frontend; do
  if docker ps -a -q --filter "name=${cname}" 2>/dev/null | grep -q .; then
    docker stop "$cname" >/dev/null 2>&1 || true
    docker rm "$cname" >/dev/null 2>&1 || true
  fi
done
for proc in api-server zenoh-bridge neuron-connector; do
  pkill -f "target/.*/${proc}" 2>/dev/null || true
done
pkill -f "node.*vite.*${SCRIPT_DIR}/frontend" 2>/dev/null || true
log_ok "Cleanup complete"

if [ "$KILL_FRONTEND_PORT" -eq 1 ]; then
  log_step "Clearing requested frontend port"
  kill_port_listeners "$PORT_FRONTEND" "Frontend"
fi

log_step "Network configuration"
BIND_IP="127.0.0.1"
DISPLAY_IP="localhost"
log_ok "Binding to ${BIND_IP}"

log_step "Checking ports"
check_port $PORT_ZENOH_TCP "Zenoh TCP"
check_port $PORT_ZENOH_WS "Zenoh WebSocket"
check_port $PORT_API "API Server"
check_port $PORT_FRONTEND "Frontend"
check_port $PORT_POSTGRES "PostgreSQL"
check_port $PORT_NEURON_API "Default Frontend (Neuron)"

log_step "Environment"
cd "$SCRIPT_DIR"
if [ ! -f .env ] && [ -f .env.example ]; then
  cp .env.example .env
  log_ok "Created .env from .env.example"
fi
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

log_step "Frontend dependencies"
if [ ! -d frontend/node_modules ]; then
  (cd frontend && npm install --loglevel=warn)
fi
log_ok "Frontend dependencies ready"

log_step "Starting infrastructure"
export BIND_IP PORT_POSTGRES PORT_ZENOH_TCP PORT_ZENOH_WS PORT_NEURON_API
export POSTGRES_DB="${POSTGRES_DB:-fendtastic}"
export POSTGRES_USER="${POSTGRES_USER:-fendtastic}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-fendtastic}"
$COMPOSE_CMD -f "$COMPOSE_FILE" up -d --wait
log_ok "PostgreSQL (${BIND_IP}:${PORT_POSTGRES})"
log_ok "Zenoh router (${BIND_IP}:${PORT_ZENOH_TCP}, ${BIND_IP}:${PORT_ZENOH_WS})"
log_ok "Default frontend: Neuron (${BIND_IP}:${PORT_NEURON_API})"

log_step "Building backend"
(cd backend && cargo build | tail -3)
log_ok "Backend compiled"

log_step "Starting API server"
export API_HOST="${BIND_IP}"
export API_PORT="${PORT_API}"
export ZENOH_ROUTER="tcp/${BIND_IP}:${PORT_ZENOH_TCP}"
export PEA_CONFIG_DIR="${SCRIPT_DIR}/data/pea-configs"
export POL_DB_DIR="${SCRIPT_DIR}/data/pol"
export RECIPE_DIR="${SCRIPT_DIR}/data/recipes"
export DATABASE_URL="postgres://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${BIND_IP}:${PORT_POSTGRES}/${POSTGRES_DB}"
(cd backend && cargo run --bin api-server >/tmp/fendtastic-api.log 2>&1) &
api_pid=$!
PIDS+=("${api_pid}")
sleep 2
log_ok "API server (${BIND_IP}:${PORT_API})"

log_step "Starting frontend"
export VITE_API_URL="http://${DISPLAY_IP}:${PORT_API}/api/v1"
(cd frontend && npx vite --host "${BIND_IP}" --port "${PORT_FRONTEND}" >/tmp/fendtastic-frontend.log 2>&1) &
frontend_pid=$!
PIDS+=("${frontend_pid}")
sleep 3
log_ok "Frontend (${BIND_IP}:${PORT_FRONTEND})"

echo ""
echo -e "  ${BOLD}Dashboard:${NC}    ${UNDERLINE}${CYAN}http://${DISPLAY_IP}:${PORT_FRONTEND}${NC}"
echo -e "  ${BOLD}API:${NC}          ${UNDERLINE}${CYAN}http://${DISPLAY_IP}:${PORT_API}${NC}"
echo -e "  ${BOLD}Health:${NC}       ${UNDERLINE}${CYAN}http://${DISPLAY_IP}:${PORT_API}/health${NC}"
echo -e "  ${BOLD}Zenoh WS:${NC}     ${UNDERLINE}${CYAN}ws://${DISPLAY_IP}:${PORT_ZENOH_WS}${NC}"
echo -e "  ${BOLD}Frontend:${NC}     ${UNDERLINE}${CYAN}http://${DISPLAY_IP}:${PORT_NEURON_API}${NC} ${DIM}(Neuron default)${NC}"
echo ""
echo -e "  ${DIM}Default frontend credentials (Neuron): admin / 0000${NC}"
echo -e "  ${DIM}Configure runtime nodes in Runtime Studio to point at ${DISPLAY_IP}:${PORT_NEURON_API} or another supported frontend such as Siemens Industrial Edge or a direct driver service.${NC}"
echo ""
wait
