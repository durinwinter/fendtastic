#!/bin/bash
# =============================================================================
# EVA-ICS v4 entrypoint with automatic MCP service deployment
# =============================================================================
set -e

EVA_DIR="${EVA_DIR:-/opt/eva4}"
MCP_SVC_ID="eva.mcp.1"
MCP_TEMPLATE="/mcp-config/svc-tpl-mcp.yml"
MARKER_FILE="${EVA_DIR}/runtime/.mcp-deployed"

echo "[fendtastic] Starting EVA-ICS v4 with MCP auto-deployment..."

# Start EVA-ICS in the background using the default entrypoint
cd "$EVA_DIR"

# EVA-ICS typically starts via ./sbin/eva-control start or the default CMD
# Run the original entrypoint/start process in background
./sbin/eva-control start &
EVA_PID=$!

# Wait for the IPC bus to become available
echo "[fendtastic] Waiting for EVA-ICS bus to come online..."
MAX_WAIT=60
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if [ -S "${EVA_DIR}/var/bus.ipc" ]; then
        echo "[fendtastic] EVA-ICS bus is online (waited ${WAITED}s)"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "[fendtastic] WARNING: Bus did not appear after ${MAX_WAIT}s, skipping MCP deploy"
else
    # Give services a moment to register
    sleep 3

    # Check if MCP service is already deployed
    if [ -f "$MARKER_FILE" ]; then
        echo "[fendtastic] MCP service was previously deployed, checking status..."
        if "${EVA_DIR}/sbin/bus" "${EVA_DIR}/var/bus.ipc" rpc call eva.core svc.get - <<< "{\"i\":\"${MCP_SVC_ID}\"}" 2>/dev/null | grep -q "running"; then
            echo "[fendtastic] MCP service ${MCP_SVC_ID} is already running"
        else
            echo "[fendtastic] Re-deploying MCP service..."
            if [ -f "$MCP_TEMPLATE" ]; then
                cd "$EVA_DIR"
                cat "$MCP_TEMPLATE" | ./bin/yml2mp | \
                    ./sbin/bus ./var/bus.ipc rpc call eva.core svc.deploy - 2>/dev/null && \
                    echo "[fendtastic] MCP service re-deployed" || \
                    echo "[fendtastic] MCP re-deploy via bus failed, trying eva svc..."
            fi
        fi
    else
        echo "[fendtastic] Deploying MCP service (first time)..."
        if [ -f "$MCP_TEMPLATE" ]; then
            # Try deploying via the bus CLI (more reliable in containers)
            cd "$EVA_DIR"

            # Method 1: Use eva svc create if eva-shell is available
            if command -v eva &>/dev/null; then
                eva svc create "$MCP_SVC_ID" "$MCP_TEMPLATE" 2>/dev/null && {
                    echo "[fendtastic] MCP service deployed via eva-shell"
                    touch "$MARKER_FILE"
                } || echo "[fendtastic] eva-shell deploy failed, trying bus CLI..."
            fi

            # Method 2: Use bus CLI directly
            if [ ! -f "$MARKER_FILE" ] && [ -x "./sbin/bus" ] && [ -x "./bin/yml2mp" ]; then
                # Build the deployment payload
                cat "$MCP_TEMPLATE" | ./bin/yml2mp 2>/dev/null | \
                    ./sbin/bus ./var/bus.ipc rpc call eva.core svc.deploy - 2>/dev/null && {
                    echo "[fendtastic] MCP service deployed via bus CLI"
                    touch "$MARKER_FILE"
                } || echo "[fendtastic] bus CLI deploy failed"
            fi

            # Method 3: Copy template into EVA's auto-deploy dir if it exists
            if [ ! -f "$MARKER_FILE" ]; then
                SVC_DIR="${EVA_DIR}/runtime/svc_tpl"
                if [ -d "$SVC_DIR" ]; then
                    cp "$MCP_TEMPLATE" "${SVC_DIR}/svc-tpl-mcp.yml"
                    echo "[fendtastic] MCP template copied to svc_tpl dir"
                    touch "$MARKER_FILE"
                fi
            fi

            if [ -f "$MARKER_FILE" ]; then
                echo "[fendtastic] MCP service ${MCP_SVC_ID} deployed successfully"
                echo "[fendtastic] MCP SSE endpoint: http://<host>:8765"
            else
                echo "[fendtastic] WARNING: Could not auto-deploy MCP service"
                echo "[fendtastic] Manual deploy: docker exec fendtastic-eva-ics eva svc create ${MCP_SVC_ID} /mcp-config/svc-tpl-mcp.yml"
            fi
        else
            echo "[fendtastic] ERROR: MCP template not found at ${MCP_TEMPLATE}"
        fi
    fi
fi

echo "[fendtastic] EVA-ICS v4 is running (PID: ${EVA_PID})"
echo "[fendtastic] MCP Server: SSE on port 8765"

# Wait for the EVA-ICS process
wait $EVA_PID
