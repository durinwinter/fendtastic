#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Fendtastic Development Launcher
# Cleans up old instances, checks dependencies, verifies port availability,
# and starts all services for local development on Ubuntu Linux.
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Required ports
PORT_ZENOH_TCP=7447
PORT_ZENOH_WS=8000
PORT_API=8080
PORT_FRONTEND=3000

# Tracking PIDs for cleanup
PIDS=()

log_info()  { echo -e "${CYAN}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()   { echo -e "${RED}[ERROR]${NC} $*"; }
log_step()  { echo -e "\n${BOLD}${CYAN}── $* ──${NC}"; }

cleanup() {
    echo ""
    log_step "Shutting down"

    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping process $pid"
            kill "$pid" 2>/dev/null || true
        fi
    done

    # Stop zenoh container if we started it
    if docker ps -q --filter "name=fendtastic-zenoh-dev" 2>/dev/null | grep -q .; then
        log_info "Stopping Zenoh router container"
        docker stop fendtastic-zenoh-dev >/dev/null 2>&1 || true
        docker rm fendtastic-zenoh-dev >/dev/null 2>&1 || true
    fi

    log_ok "All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# =============================================================================
# Dependency checks
# =============================================================================

check_command() {
    local cmd="$1"
    local install_hint="$2"

    if command -v "$cmd" &>/dev/null; then
        local version
        case "$cmd" in
            rustc)   version="$(rustc --version 2>/dev/null | awk '{print $2}')" ;;
            cargo)   version="$(cargo --version 2>/dev/null | awk '{print $2}')" ;;
            node)    version="$(node --version 2>/dev/null)" ;;
            npm)     version="$(npm --version 2>/dev/null)" ;;
            docker)  version="$(docker --version 2>/dev/null | awk '{print $3}' | tr -d ',')" ;;
            *)       version="found" ;;
        esac
        log_ok "$cmd ($version)"
        return 0
    else
        log_err "$cmd not found"
        log_info "Install: $install_hint"
        return 1
    fi
}

log_step "Checking dependencies"

MISSING=0

check_command rustc  "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" || MISSING=1
check_command cargo  "Installed with rustc above"                                       || MISSING=1
check_command node   "sudo apt install -y nodejs  OR  use nvm: https://github.com/nvm-sh/nvm" || MISSING=1
check_command npm    "Installed with nodejs"                                             || MISSING=1
check_command docker "sudo apt install -y docker.io && sudo usermod -aG docker \$USER"   || MISSING=1

# Optional but helpful
if command -v cargo-watch &>/dev/null; then
    log_ok "cargo-watch (installed)"
else
    log_warn "cargo-watch not installed (optional, enables hot-reload for backend)"
    log_info "Install: cargo install cargo-watch"
fi

if [ "$MISSING" -ne 0 ]; then
    echo ""
    log_err "Missing required dependencies. Install them and re-run this script."
    exit 1
fi

# Check Node.js version >= 18
NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
    log_err "Node.js 18+ required (found v${NODE_MAJOR})"
    log_info "Update: nvm install 18 && nvm use 18"
    exit 1
fi

# =============================================================================
# Clean up previous Fendtastic instances
# =============================================================================

log_step "Cleaning up old Fendtastic instances"

CLEANED=0

# --- Docker containers ---

# Dev container from this script
if docker ps -a -q --filter "name=fendtastic-zenoh-dev" 2>/dev/null | grep -q .; then
    log_info "Removing old fendtastic-zenoh-dev container"
    docker stop fendtastic-zenoh-dev >/dev/null 2>&1 || true
    docker rm   fendtastic-zenoh-dev >/dev/null 2>&1 || true
    CLEANED=1
fi

# Docker Compose containers (fendtastic-zenoh-router, fendtastic-backend, fendtastic-frontend)
for cname in fendtastic-zenoh-router fendtastic-backend fendtastic-frontend; do
    if docker ps -a -q --filter "name=${cname}" 2>/dev/null | grep -q .; then
        log_info "Removing old ${cname} container"
        docker stop "$cname" >/dev/null 2>&1 || true
        docker rm   "$cname" >/dev/null 2>&1 || true
        CLEANED=1
    fi
done

# --- Fendtastic backend processes ---

# Kill api-server instances
if pgrep -f "target/.*/api-server" >/dev/null 2>&1; then
    log_info "Killing old api-server processes"
    pkill -f "target/.*/api-server" 2>/dev/null || true
    CLEANED=1
fi

# Kill zenoh-bridge instances
if pgrep -f "target/.*/zenoh-bridge" >/dev/null 2>&1; then
    log_info "Killing old zenoh-bridge processes"
    pkill -f "target/.*/zenoh-bridge" 2>/dev/null || true
    CLEANED=1
fi

# Kill eva-ics-connector instances
if pgrep -f "target/.*/eva-ics-connector" >/dev/null 2>&1; then
    log_info "Killing old eva-ics-connector processes"
    pkill -f "target/.*/eva-ics-connector" 2>/dev/null || true
    CLEANED=1
fi

# --- Vite dev servers started from this project ---

# Match vite processes whose cwd is within this project's frontend dir
if pgrep -f "node.*vite.*${SCRIPT_DIR}/frontend" >/dev/null 2>&1; then
    log_info "Killing old Vite dev server"
    pkill -f "node.*vite.*${SCRIPT_DIR}/frontend" 2>/dev/null || true
    CLEANED=1
fi

# Give processes a moment to release ports
if [ "$CLEANED" -ne 0 ]; then
    sleep 2
    log_ok "Old instances cleaned up"
else
    log_ok "No old instances found"
fi

# =============================================================================
# Port availability (after cleanup)
# =============================================================================

log_step "Checking port availability"

check_port() {
    local port="$1"
    local service="$2"

    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then

        # Try to identify what's holding the port
        local holder
        holder=$(ss -tlnp 2>/dev/null | grep ":${port} " | awk '{print $NF}' | head -1)
        if [ -z "$holder" ]; then
            holder=$(lsof -i ":${port}" -sTCP:LISTEN -t 2>/dev/null | head -1)
            if [ -n "$holder" ]; then
                holder="pid=$holder ($(ps -p "$holder" -o comm= 2>/dev/null || echo 'unknown'))"
            fi
        fi

        log_err "Port $port ($service) is still in use by: ${holder:-unknown}"
        log_info "Free it with:  sudo kill \$(lsof -t -i :${port})  or  sudo fuser -k ${port}/tcp"
        return 1
    else
        log_ok "Port $port ($service) is available"
        return 0
    fi
}

PORT_CONFLICT=0
check_port $PORT_ZENOH_TCP "Zenoh TCP"       || PORT_CONFLICT=1
check_port $PORT_ZENOH_WS  "Zenoh WebSocket" || PORT_CONFLICT=1
check_port $PORT_API       "API Server"       || PORT_CONFLICT=1
check_port $PORT_FRONTEND  "Frontend Dev"     || PORT_CONFLICT=1

if [ "$PORT_CONFLICT" -ne 0 ]; then
    echo ""
    log_err "Port conflicts detected. A non-Fendtastic process is using one of the required ports."
    log_info "Free the ports listed above and re-run this script."
    exit 1
fi

# =============================================================================
# Environment setup
# =============================================================================

log_step "Checking environment"

cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        log_ok "Created .env from .env.example"
    else
        log_warn "No .env or .env.example found — using defaults"
    fi
else
    log_ok ".env file exists"
fi

# Source .env if present
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# =============================================================================
# Install frontend dependencies if needed
# =============================================================================

log_step "Checking frontend dependencies"

if [ ! -d frontend/node_modules ]; then
    log_info "Installing npm packages..."
    (cd frontend && npm install)
    log_ok "npm packages installed"
else
    log_ok "node_modules exists (run 'cd frontend && npm install' to update)"
fi

# =============================================================================
# Start services
# =============================================================================

log_step "Starting Zenoh router (Docker)"

docker run -d \
    --name fendtastic-zenoh-dev \
    -p ${PORT_ZENOH_TCP}:7447 \
    -p ${PORT_ZENOH_WS}:8000 \
    -v "${SCRIPT_DIR}/config/zenoh-router.json5:/etc/zenoh/config.json5:ro" \
    eclipse/zenoh:latest \
    -c /etc/zenoh/config.json5 \
    >/dev/null

log_ok "Zenoh router running (TCP :${PORT_ZENOH_TCP}, WS :${PORT_ZENOH_WS})"

# Wait briefly for zenoh to initialise
sleep 2

# ---------------------------------------------------------------------------

log_step "Building backend (first run may take a while)"

(cd backend && cargo build 2>&1 | tail -1)
log_ok "Backend compiled"

# ---------------------------------------------------------------------------

log_step "Starting API server"

(cd backend && cargo run --bin api-server 2>&1 &)
PIDS+=($!)
sleep 2
log_ok "API server starting on :${PORT_API}"

# ---------------------------------------------------------------------------

log_step "Starting frontend dev server"

(cd frontend && npm run dev 2>&1 &)
PIDS+=($!)
sleep 2
log_ok "Frontend dev server starting on :${PORT_FRONTEND}"

# =============================================================================
# Summary
# =============================================================================

echo ""
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════${NC}"
echo -e "${BOLD}${GREEN}  Fendtastic is running!${NC}"
echo -e "${BOLD}${GREEN}════════════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard:     ${CYAN}http://localhost:${PORT_FRONTEND}${NC}"
echo -e "  API Server:    ${CYAN}http://localhost:${PORT_API}${NC}"
echo -e "  API Health:    ${CYAN}http://localhost:${PORT_API}/health${NC}"
echo -e "  Zenoh WS:      ${CYAN}ws://localhost:${PORT_ZENOH_WS}${NC}"
echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo ""

# Keep script alive until interrupted
wait
