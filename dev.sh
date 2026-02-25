#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Fendtastic Development Launcher (Interactive)
# =============================================================================

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
UNDERLINE='\033[4m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Ports
PORT_ZENOH_TCP=7447
PORT_ZENOH_WS=8000
PORT_API=8080
PORT_FRONTEND=3000
PORT_MCP=8765
PORT_POSTGRES=5432

# Set after IP selection
BIND_IP=""
DISPLAY_IP=""

# Tracking PIDs for cleanup
PIDS=()

# ─── Logging ──────────────────────────────────────────────────────────────────

log_info()  { echo -e "  ${CYAN}ℹ${NC}  $*"; }
log_ok()    { echo -e "  ${GREEN}✔${NC}  $*"; }
log_warn()  { echo -e "  ${YELLOW}⚠${NC}  $*"; }
log_err()   { echo -e "  ${RED}✘${NC}  $*"; }
log_step()  { echo -e "\n${BOLD}${CYAN}━━ $* ━━${NC}"; }

# ─── Cleanup on exit ─────────────────────────────────────────────────────────

COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.dev.yml"

# Detect docker compose command (plugin v2 vs standalone v1)
if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
else
    echo "ERROR: Neither 'docker compose' nor 'docker-compose' found."
    echo "Install: sudo apt install docker-compose-plugin  OR  pip install docker-compose"
    exit 1
fi

cleanup() {
    echo ""
    log_step "Shutting down"

    for pid in "${PIDS[@]}"; do
        if kill -0 "$pid" 2>/dev/null; then
            log_info "Stopping process $pid"
            kill "$pid" 2>/dev/null || true
        fi
    done

    log_info "Stopping infrastructure containers..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true

    log_ok "All services stopped"
    exit 0
}

trap cleanup SIGINT SIGTERM

# ─── Banner ───────────────────────────────────────────────────────────────────

clear
echo ""
echo -e "${BOLD}${GREEN}  ╔═══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}  ║         FENDTASTIC  DEV  LAUNCHER             ║${NC}"
echo -e "${BOLD}${GREEN}  ║     Industrial Monitoring Control System       ║${NC}"
echo -e "${BOLD}${GREEN}  ╚═══════════════════════════════════════════════╝${NC}"

# =============================================================================
# 1. Dependency checks
# =============================================================================

log_step "Checking dependencies"

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
        log_ok "${cmd} ${DIM}(${version})${NC}"
        return 0
    else
        log_err "$cmd not found"
        log_info "Install: $install_hint"
        return 1
    fi
}

MISSING=0

check_command rustc  "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh" || MISSING=1
check_command cargo  "Installed with rustc above"                                       || MISSING=1
check_command node   "sudo apt install -y nodejs  OR  use nvm: https://github.com/nvm-sh/nvm" || MISSING=1
check_command npm    "Installed with nodejs"                                             || MISSING=1
check_command docker "sudo apt install -y docker.io && sudo usermod -aG docker \$USER"   || MISSING=1

# cargo-watch: auto-install if missing
if command -v cargo-watch &>/dev/null; then
    log_ok "cargo-watch ${DIM}(installed)${NC}"
else
    log_info "Installing cargo-watch (enables backend hot-reload)..."
    cargo install cargo-watch 2>&1 | tail -1
    if command -v cargo-watch &>/dev/null; then
        log_ok "cargo-watch installed"
    else
        log_warn "cargo-watch install failed — continuing without hot-reload"
    fi
fi

if [ "$MISSING" -ne 0 ]; then
    echo ""
    log_err "Missing required dependencies. Install them and re-run."
    exit 1
fi

NODE_MAJOR=$(node --version | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
    log_err "Node.js 18+ required (found v${NODE_MAJOR})"
    exit 1
fi

# =============================================================================
# 2. Clean up old instances
# =============================================================================

log_step "Cleaning up old instances"

CLEANED=0

# Stop any running dev compose stack
if $COMPOSE_CMD -f "$COMPOSE_FILE" ps -q 2>/dev/null | grep -q .; then
    log_info "Stopping previous dev compose stack..."
    $COMPOSE_CMD -f "$COMPOSE_FILE" down 2>/dev/null || true
    CLEANED=1
fi

# Also clean up any leftover containers from old naming convention or production compose
for cname in fendtastic-zenoh-dev fendtastic-eva-ics-dev fendtastic-postgres-dev fendtastic-zenoh-router fendtastic-backend fendtastic-frontend fendtastic-postgres fendtastic-eva-ics; do
    if docker ps -a -q --filter "name=${cname}" 2>/dev/null | grep -q .; then
        log_info "Removing old container: ${cname}"
        docker stop "$cname" >/dev/null 2>&1 || true
        docker rm   "$cname" >/dev/null 2>&1 || true
        CLEANED=1
    fi
done

for proc in api-server zenoh-bridge eva-ics-connector; do
    if pgrep -f "target/.*/${proc}" >/dev/null 2>&1; then
        log_info "Killing old ${proc}"
        pkill -f "target/.*/${proc}" 2>/dev/null || true
        CLEANED=1
    fi
done

if pgrep -f "node.*vite.*${SCRIPT_DIR}/frontend" >/dev/null 2>&1; then
    log_info "Killing old Vite dev server"
    pkill -f "node.*vite.*${SCRIPT_DIR}/frontend" 2>/dev/null || true
    CLEANED=1
fi

if [ "$CLEANED" -ne 0 ]; then
    sleep 2
    log_ok "Old instances cleaned up"
else
    log_ok "No old instances found"
fi

# =============================================================================
# 3. Network interface selection (interactive)
# =============================================================================

log_step "Network configuration"

declare -a IP_LIST=()
declare -a IP_LABELS=()

# Always offer localhost and all-interfaces
IP_LIST+=("127.0.0.1")
IP_LABELS+=("127.0.0.1  ${DIM}— localhost only (this machine)${NC}")

IP_LIST+=("0.0.0.0")
IP_LABELS+=("0.0.0.0    ${DIM}— all interfaces (LAN accessible)${NC}")

# Discover real network interfaces
while IFS= read -r line; do
    iface=$(echo "$line" | awk '{print $1}')
    ip=$(echo "$line" | awk '{print $2}' | cut -d/ -f1)

    # Skip loopback and virtual interfaces
    case "$iface" in
        lo|docker*|veth*|br-*|virbr*) continue ;;
    esac

    [[ " ${IP_LIST[*]} " == *" ${ip} "* ]] && continue

    IP_LIST+=("$ip")
    IP_LABELS+=("${ip}  ${DIM}— ${iface}${NC}")
done < <(ip -4 -o addr show 2>/dev/null | awk '{print $2, $4}')

echo ""
echo -e "  ${BOLD}Which address should services bind to?${NC}"
echo ""

for i in "${!IP_LABELS[@]}"; do
    if [ "$i" -eq 0 ]; then
        printf "    ${CYAN}%d)${NC}  %b  ${YELLOW}(default)${NC}\n" $((i + 1)) "${IP_LABELS[$i]}"
    else
        printf "    ${CYAN}%d)${NC}  %b\n" $((i + 1)) "${IP_LABELS[$i]}"
    fi
done

echo ""
while true; do
    echo -ne "  ${BOLD}${YELLOW}▸${NC} Choice ${DIM}[1-${#IP_LIST[@]}]${NC}: "
    read -r choice </dev/tty

    if [ -z "$choice" ]; then
        choice=1
    fi

    if [[ "$choice" =~ ^[0-9]+$ ]] && [ "$choice" -ge 1 ] && [ "$choice" -le "${#IP_LIST[@]}" ]; then
        BIND_IP="${IP_LIST[$((choice - 1))]}"
        break
    else
        log_err "Enter a number between 1 and ${#IP_LIST[@]}"
    fi
done

# Determine display IP (what goes in browser URLs)
if [ "$BIND_IP" = "0.0.0.0" ]; then
    # Pick first real IP for display
    DISPLAY_IP="localhost"
    for ip in "${IP_LIST[@]}"; do
        if [ "$ip" != "127.0.0.1" ] && [ "$ip" != "0.0.0.0" ]; then
            DISPLAY_IP="$ip"
            break
        fi
    done
elif [ "$BIND_IP" = "127.0.0.1" ]; then
    DISPLAY_IP="localhost"
else
    DISPLAY_IP="$BIND_IP"
fi

echo ""
log_ok "Binding to ${BOLD}${BIND_IP}${NC}  →  URLs will use ${BOLD}${DISPLAY_IP}${NC}"

# =============================================================================
# 4. Port availability
# =============================================================================

log_step "Checking ports on ${BIND_IP}"

check_port() {
    local port="$1"
    local service="$2"

    if ss -tlnp 2>/dev/null | grep -q ":${port} " || \
       lsof -i ":${port}" -sTCP:LISTEN >/dev/null 2>&1; then

        local holder
        holder=$(ss -tlnp 2>/dev/null | grep ":${port} " | awk '{print $NF}' | head -1)
        if [ -z "$holder" ]; then
            holder=$(lsof -i ":${port}" -sTCP:LISTEN -t 2>/dev/null | head -1)
            if [ -n "$holder" ]; then
                holder="pid=$holder ($(ps -p "$holder" -o comm= 2>/dev/null || echo 'unknown'))"
            fi
        fi

        log_err "Port ${port} (${service}) in use by: ${holder:-unknown}"
        log_info "Free it:  sudo fuser -k ${port}/tcp"
        return 1
    else
        log_ok "Port ${port} ${DIM}(${service})${NC}"
        return 0
    fi
}

PORT_CONFLICT=0
check_port $PORT_ZENOH_TCP "Zenoh TCP"       || PORT_CONFLICT=1
check_port $PORT_ZENOH_WS  "Zenoh WebSocket" || PORT_CONFLICT=1
check_port $PORT_API       "API Server"       || PORT_CONFLICT=1
check_port $PORT_FRONTEND  "Frontend Dev"     || PORT_CONFLICT=1
check_port $PORT_MCP       "EVA-ICS MCP"      || PORT_CONFLICT=1
check_port $PORT_POSTGRES  "PostgreSQL"       || PORT_CONFLICT=1

if [ "$PORT_CONFLICT" -ne 0 ]; then
    echo ""
    log_err "Port conflicts detected. Free the ports above and re-run."
    exit 1
fi

# =============================================================================
# 5. Environment
# =============================================================================

log_step "Environment"

cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
    if [ -f .env.example ]; then
        cp .env.example .env
        log_ok "Created .env from .env.example"
    else
        log_warn "No .env.example found — using defaults"
    fi
else
    log_ok ".env file exists"
fi

if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# =============================================================================
# 6. Frontend dependencies
# =============================================================================

log_step "Frontend dependencies"

if [ ! -d frontend/node_modules ]; then
    log_info "Running npm install (first time may take a minute)..."
    (cd frontend && npm install --loglevel=warn 2>&1)
    log_ok "Packages installed"
else
    log_ok "node_modules present"
fi

# =============================================================================
# 7. Launch services
# =============================================================================

# --- Infrastructure via Docker Compose ---

log_step "Starting infrastructure (PostgreSQL, Zenoh, EVA-ICS)"

PGDB="${POSTGRES_DB:-fendtastic}"
PGUSER="${POSTGRES_USER:-fendtastic}"
PGPASS="${POSTGRES_PASSWORD:-fendtastic}"

# Export vars for docker-compose.dev.yml interpolation
export BIND_IP PORT_POSTGRES PORT_ZENOH_TCP PORT_ZENOH_WS PORT_MCP
export POSTGRES_DB="${PGDB}" POSTGRES_USER="${PGUSER}" POSTGRES_PASSWORD="${PGPASS}"

log_info "Starting containers via docker compose..."
if ! $COMPOSE_CMD -f "$COMPOSE_FILE" up -d --wait 2>&1 | while IFS= read -r line; do
    echo -e "    ${DIM}${line}${NC}"
done; then
    log_err "docker compose up failed — check output above"
    exit 1
fi

# Verify each service came up
if $COMPOSE_CMD -f "$COMPOSE_FILE" ps --status running -q 2>/dev/null | grep -q .; then
    log_ok "PostgreSQL ${DIM}(${BIND_IP}:${PORT_POSTGRES}, db=${PGDB}, user=${PGUSER})${NC}"
    log_ok "Zenoh router ${DIM}(${BIND_IP}:${PORT_ZENOH_TCP}, :${PORT_ZENOH_WS})${NC}"
    log_ok "EVA-ICS v4 ${DIM}(${BIND_IP}:7727, OPC UA :4840, MCP :${PORT_MCP})${NC}"
else
    log_err "Some infrastructure containers failed to start"
    $COMPOSE_CMD -f "$COMPOSE_FILE" ps 2>&1 | while IFS= read -r line; do
        echo -e "    ${DIM}${line}${NC}"
    done
    exit 1
fi

# --- Deploy EVA-ICS services (core starts with no services pre-deployed) ---

log_info "Waiting for EVA-ICS core to be ready..."
EVA_READY=0
for i in $(seq 1 30); do
    # Use eva CLI which gives human-readable output
    if docker exec fendtastic-eva-ics eva item list 2>/dev/null; then
        EVA_READY=1
        break
    fi
    # Fallback: check if IPC socket exists AND core log shows ready
    if docker exec fendtastic-eva-ics test -S /opt/eva4/var/bus.ipc 2>/dev/null; then
        if docker logs fendtastic-eva-ics 2>&1 | grep -q "ready (regular mode)"; then
            EVA_READY=1
            break
        fi
    fi
    sleep 2
done

if [ "$EVA_READY" -eq 1 ]; then
    log_ok "EVA-ICS core is ready ${DIM}(${i}s)${NC}"

    # Deploy standard services (ACL, auth, file manager, HMI) if not already present
    log_info "Deploying EVA-ICS base services..."
    docker exec -i fendtastic-eva-ics eva -T30 cloud deploy https://pub.bma.ai/eva4/docker/deploy/standard.yml 2>&1 | while IFS= read -r line; do
        echo -e "    ${DIM}${line}${NC}"
    done

    # Deploy MCP service
    log_info "Deploying MCP service..."
    if docker exec fendtastic-eva-ics eva svc create eva.mcp.1 /mcp-config/svc-tpl-mcp.yml 2>&1 | while IFS= read -r line; do
        echo -e "    ${DIM}${line}${NC}"
    done; then
        # Wait for MCP port to be listening
        MCP_READY=0
        for j in $(seq 1 30); do
            if docker exec fendtastic-eva-ics sh -c \
                "ss -tln 2>/dev/null | grep -q ':8765 ' || netstat -tln 2>/dev/null | grep -q ':8765 '" 2>/dev/null; then
                MCP_READY=1
                break
            fi
            sleep 1
        done

        if [ "$MCP_READY" -eq 1 ]; then
            log_ok "MCP service is listening on port ${PORT_MCP}"
        else
            log_warn "MCP service deployed but port ${PORT_MCP} not yet listening"
            log_info "  Check: docker logs fendtastic-eva-ics"
        fi
    else
        log_warn "MCP service deployment failed"
        log_info "  Manual deploy: docker exec fendtastic-eva-ics eva svc create eva.mcp.1 /mcp-config/svc-tpl-mcp.yml"
    fi
else
    log_warn "EVA-ICS core did not become ready within 60s"
    log_info "  Check: docker logs fendtastic-eva-ics"
fi

# --- Backend build ---

log_step "Building backend"
echo -e "  ${DIM}(first build may take several minutes)${NC}"

(cd backend && cargo build 2>&1 | tail -3)
log_ok "Backend compiled"

# --- API Server ---

log_step "Starting API server"

export API_HOST="${BIND_IP}"
export API_PORT="${PORT_API}"
export ZENOH_ROUTER="tcp/${BIND_IP}:${PORT_ZENOH_TCP}"
export EVA_ICS_URL="http://${BIND_IP}:7727"
export EVA_ICS_API_KEY="${EVA_ICS_API_KEY:-default-key}"
export PEA_CONFIG_DIR="${SCRIPT_DIR}/data/pea-configs"
export RECIPE_DIR="${SCRIPT_DIR}/data/recipes"
export DATABASE_URL="postgres://${PGUSER}:${PGPASS}@${BIND_IP}:${PORT_POSTGRES}/${PGDB}"

(cd backend && cargo run --bin api-server 2>&1 &)
PIDS+=($!)
sleep 2
log_ok "API server ${DIM}(${BIND_IP}:${PORT_API})${NC}"

# --- EVA-ICS Connector ---

log_step "Starting EVA-ICS connector"

(cd backend && cargo run --bin eva-ics-connector 2>&1 &)
PIDS+=($!)
sleep 1
log_ok "EVA-ICS connector ${DIM}(bridges Zenoh ↔ EVA-ICS)${NC}"

# --- Frontend Vite ---

log_step "Starting frontend"

export VITE_API_URL="http://${DISPLAY_IP}:${PORT_API}/api/v1"

(cd frontend && npx vite --host "${BIND_IP}" --port "${PORT_FRONTEND}" 2>&1 &)
PIDS+=($!)
sleep 3
log_ok "Frontend dev server ${DIM}(${BIND_IP}:${PORT_FRONTEND})${NC}"

# =============================================================================
# 8. Final summary with clickable links
# =============================================================================

URL_DASH="http://${DISPLAY_IP}:${PORT_FRONTEND}"
URL_API="http://${DISPLAY_IP}:${PORT_API}"
URL_HEALTH="http://${DISPLAY_IP}:${PORT_API}/health"
URL_WS_API="ws://${DISPLAY_IP}:${PORT_API}/api/v1/ws"
URL_OPCUA="opc.tcp://${DISPLAY_IP}:4840"
URL_MCP="http://${DISPLAY_IP}:${PORT_MCP}"

echo ""
echo ""
echo -e "${BOLD}${GREEN}  ╔═══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${GREEN}  ║              FENDTASTIC IS RUNNING                        ║${NC}"
echo -e "${BOLD}${GREEN}  ╚═══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Bound to:${NC}        ${CYAN}${BIND_IP}${NC}"
echo ""
echo -e "  ${BOLD}Dashboard:${NC}       ${UNDERLINE}${CYAN}${URL_DASH}${NC}"
echo -e "  ${BOLD}API Server:${NC}      ${UNDERLINE}${CYAN}${URL_API}${NC}"
echo -e "  ${BOLD}Health Check:${NC}    ${UNDERLINE}${CYAN}${URL_HEALTH}${NC}"
echo -e "  ${BOLD}WebSocket:${NC}       ${UNDERLINE}${CYAN}${URL_WS_API}${NC}"
echo -e "  ${BOLD}OPC UA:${NC}          ${UNDERLINE}${CYAN}${URL_OPCUA}${NC}"

# MCP Server credentials box
echo ""
echo -e "${BOLD}${YELLOW}  ┌───────────────────────────────────────────────────────────┐${NC}"
echo -e "${BOLD}${YELLOW}  │            MCP SERVER (Model Context Protocol)             │${NC}"
echo -e "${BOLD}${YELLOW}  └───────────────────────────────────────────────────────────┘${NC}"
echo ""
echo -e "  ${BOLD}MCP Endpoint:${NC}    ${UNDERLINE}${CYAN}${URL_MCP}${NC}"
echo -e "  ${BOLD}Transport:${NC}       ${CYAN}SSE (Server-Sent Events)${NC}"
echo -e "  ${BOLD}Service ID:${NC}      ${CYAN}eva.mcp.1${NC}"
echo -e "  ${BOLD}Container:${NC}       ${CYAN}fendtastic-eva-ics${NC}"
echo ""
echo -e "  ${DIM}Add to MCP clients with:${NC}"
echo ""
echo -e "  ${BOLD}Claude Code CLI:${NC}"
echo -e "    ${DIM}claude mcp add eva-ics --transport sse ${URL_MCP}/sse${NC}"
echo ""

# --- Generate full JSON configs ---

MCP_JSON_CLAUDE=$(cat <<ENDJSON
{
  "mcpServers": {
    "eva-ics": {
      "type": "sse",
      "url": "${URL_MCP}/sse"
    }
  }
}
ENDJSON
)

MCP_JSON_ANTIGRAVITY=$(cat <<ENDJSON
{
  "mcpServers": {
    "eva-ics": {
      "serverUrl": "${URL_MCP}/sse"
    }
  }
}
ENDJSON
)

echo -e "  ${BOLD}Claude Code / Claude Desktop ${DIM}(.mcp.json / claude_desktop_config.json)${NC}${BOLD}:${NC}"
echo -e "${DIM}"
echo "$MCP_JSON_CLAUDE" | sed 's/^/    /'
echo -e "${NC}"

echo -e "  ${BOLD}Google Antigravity ${DIM}(mcp_config.json → Manage MCP Servers → View raw config)${NC}${BOLD}:${NC}"
echo -e "${DIM}"
echo "$MCP_JSON_ANTIGRAVITY" | sed 's/^/    /'
echo -e "${NC}"

echo -e "  ${BOLD}VS Code ${DIM}(settings.json)${NC}${BOLD}:${NC}"
echo -e "    ${DIM}\"mcp\": { \"servers\": { \"eva-ics\": { \"url\": \"${URL_MCP}/sse\" } } }${NC}"
echo ""
echo -e "  ${BOLD}Manual deploy:${NC}"
echo -e "    ${DIM}docker exec fendtastic-eva-ics eva svc create eva.mcp.1 /mcp-config/svc-tpl-mcp.yml${NC}"

# If bound to all interfaces, show every reachable address
if [ "$BIND_IP" = "0.0.0.0" ]; then
    echo ""
    echo -e "  ${BOLD}Reachable from any of these addresses:${NC}"
    for ip in "${IP_LIST[@]}"; do
        if [ "$ip" != "0.0.0.0" ]; then
            echo -e "    ${DIM}•${NC} ${UNDERLINE}${CYAN}http://${ip}:${PORT_FRONTEND}${NC}"
            echo -e "    ${DIM}  MCP:${NC} ${UNDERLINE}${CYAN}http://${ip}:${PORT_MCP}${NC}"
        fi
    done
fi

echo ""
echo -e "  Press ${BOLD}Ctrl+C${NC} to stop all services."
echo ""

# Keep script alive
wait
