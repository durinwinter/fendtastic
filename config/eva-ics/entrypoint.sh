#!/bin/bash
# =============================================================================
# EVA-ICS v4 entrypoint with automatic MCP service deployment
# https://info.bma.ai/en/actual/eva4/svc/eva-mcp.html#setup
# =============================================================================
set -e

EVA_DIR="${EVA_DIR:-/opt/eva4}"
MCP_SVC_ID="eva.mcp.1"
MCP_TEMPLATE="/mcp-config/svc-tpl-mcp.yml"

echo "[fendtastic] Starting EVA-ICS v4..."

cd "$EVA_DIR"

# Start EVA-ICS in the background
./sbin/eva-control start &
EVA_PID=$!

# Wait for the IPC bus socket to appear
echo "[fendtastic] Waiting for EVA-ICS bus..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if [ -S "${EVA_DIR}/var/bus.ipc" ]; then
        echo "[fendtastic] EVA-ICS bus is online (${WAITED}s)"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "[fendtastic] WARNING: Bus did not appear after ${MAX_WAIT}s, skipping MCP deploy"
else
    # Give eva.core a moment to finish registering services
    sleep 5

    # Check if MCP service already exists and is running
    if "${EVA_DIR}/sbin/bus" "${EVA_DIR}/var/bus.ipc" \
        rpc call eva.core svc.get \
        - <<< "{\"i\":\"${MCP_SVC_ID}\"}" 2>/dev/null | grep -q "running"; then
        echo "[fendtastic] MCP service ${MCP_SVC_ID} is already running"
    else
        echo "[fendtastic] Deploying MCP service..."
        if [ -f "$MCP_TEMPLATE" ]; then
            # Method 1: eva-shell (preferred per official docs)
            if command -v eva &>/dev/null; then
                eva svc create "$MCP_SVC_ID" "$MCP_TEMPLATE" 2>&1 && {
                    echo "[fendtastic] MCP service deployed via eva-shell"
                } || {
                    echo "[fendtastic] eva-shell deploy failed, trying bus CLI..."
                }
            fi

            # Method 2: bus CLI (fallback per official docs)
            # Check if service is now running before trying fallback
            if ! "${EVA_DIR}/sbin/bus" "${EVA_DIR}/var/bus.ipc" \
                rpc call eva.core svc.get \
                - <<< "{\"i\":\"${MCP_SVC_ID}\"}" 2>/dev/null | grep -q "running"; then

                if [ -x "${EVA_DIR}/sbin/bus" ] && [ -x "${EVA_DIR}/bin/yml2mp" ]; then
                    cd "$EVA_DIR"
                    cat "$MCP_TEMPLATE" | ./bin/yml2mp 2>/dev/null | \
                        ./sbin/bus ./var/bus.ipc rpc call eva.core svc.deploy - 2>&1 && {
                        echo "[fendtastic] MCP service deployed via bus CLI"
                    } || {
                        echo "[fendtastic] WARNING: bus CLI deploy also failed"
                    }
                fi
            fi

            # Final check
            sleep 2
            if "${EVA_DIR}/sbin/bus" "${EVA_DIR}/var/bus.ipc" \
                rpc call eva.core svc.get \
                - <<< "{\"i\":\"${MCP_SVC_ID}\"}" 2>/dev/null | grep -q "running"; then
                echo "[fendtastic] MCP service ${MCP_SVC_ID} is running on port 8765"
            else
                echo "[fendtastic] WARNING: MCP service may not have started"
                echo "[fendtastic] Manual deploy: eva svc create ${MCP_SVC_ID} ${MCP_TEMPLATE}"
            fi
        else
            echo "[fendtastic] ERROR: MCP template not found at ${MCP_TEMPLATE}"
        fi
    fi
fi

echo "[fendtastic] EVA-ICS v4 is running (PID: ${EVA_PID})"

# Wait for the EVA-ICS process (keeps container alive)
wait $EVA_PID
