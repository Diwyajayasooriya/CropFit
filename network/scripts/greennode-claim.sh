#!/usr/bin/env bash
# ==============================================================================
# GreenNode Edge - Device Claiming Daemon (greennode-claim.sh)
#
# Runs on the Raspberry Pi after WiFi connection is established.
# Periodically polls the Cloud Backend to check if the farmer has claimed this
# device via QR code (cropfit.com/claim?code=XXXX) or the web dashboard.
#
# Once claimed:
#   1. Saves the issued hub authentication token to /etc/greennode/hub_token
#   2. Updates edge .env with GREENHOUSE_ID and CLOUD_SYNC_TOKEN
#   3. Writes /etc/greennode/claimed flag
#   4. Executes /opt/greennode/network/scripts/greennode-post-setup.sh
# ==============================================================================

set -euo pipefail

CONF_DIR="/etc/greennode"
DEVICE_ID_FILE="${CONF_DIR}/device_id"
CLAIMED_FLAG="${CONF_DIR}/claimed"
HUB_TOKEN_FILE="${CONF_DIR}/hub_token"
POST_SETUP_SCRIPT="/opt/greennode/network/scripts/greennode-post-setup.sh"
EDGE_ENV_FILE="/opt/greennode-edge/.env"

# Cloud URL override or fallback
CLOUD_URL_FILE="${CONF_DIR}/cloud_url"
DEFAULT_CLOUD_URL="https://api.cropfit.io"

mkdir -p "$CONF_DIR"

# 1. Ensure device_id exists
if [[ ! -s "$DEVICE_ID_FILE" ]]; then
    # If not pre-flashed, generate persistent UUID based on Pi serial
    PI_SERIAL=$(cat /proc/cpuinfo 2>/dev/null | grep Serial | cut -d ' ' -f 2 || true)
    if [[ -z "$PI_SERIAL" || "$PI_SERIAL" == "0000000000000000" ]]; then
        PI_SERIAL=$(cat /etc/machine-id 2>/dev/null || tr -dc 'a-f0-9' </dev/urandom | head -c 16)
    fi
    DEVICE_ID="gn-hub-${PI_SERIAL}"
    echo "$DEVICE_ID" > "$DEVICE_ID_FILE"
    chmod 644 "$DEVICE_ID_FILE"
    echo "[greennode-claim] Generated device ID: $DEVICE_ID"
fi

DEVICE_ID=$(cat "$DEVICE_ID_FILE" | tr -d '[:space:]')

# Determine cloud API base URL
if [[ -f "$CLOUD_URL_FILE" ]]; then
    CLOUD_BASE_URL=$(cat "$CLOUD_URL_FILE" | tr -d '[:space:]')
elif [[ -f "$EDGE_ENV_FILE" ]] && grep -q "^CLOUD_BACKEND_URL=" "$EDGE_ENV_FILE"; then
    CLOUD_BASE_URL=$(grep "^CLOUD_BACKEND_URL=" "$EDGE_ENV_FILE" | cut -d '=' -f2- | tr -d '[:space:]"')
else
    CLOUD_BASE_URL="$DEFAULT_CLOUD_URL"
fi
CLOUD_BASE_URL="${CLOUD_BASE_URL%/}"

echo "[greennode-claim] Starting claim polling for Device ID: $DEVICE_ID against $CLOUD_BASE_URL"

POLL_INTERVAL=5
MAX_INTERVAL=30
RETRY_COUNT=0

# Polling loop
while [[ ! -f "$CLAIMED_FLAG" ]]; do
    POLL_URL="${CLOUD_BASE_URL}/api/v1/edge/poll-claim/?device_id=${DEVICE_ID}"

    # Query cloud endpoint
    RESPONSE=$(curl -s -S --max-time 10 "$POLL_URL" 2>/dev/null || echo '{"status":"curl_failed"}')

    STATUS=$(echo "$RESPONSE" | grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "unknown")

    if [[ "$STATUS" == "claimed" ]]; then
        echo "[greennode-claim] Device has been claimed by farmer!"

        # Extract credentials from JSON response
        HUB_TOKEN=$(echo "$RESPONSE" | grep -o '"hub_token"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
        GREENHOUSE_ID=$(echo "$RESPONSE" | grep -o '"greenhouse_id"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "")
        NODE_NAME=$(echo "$RESPONSE" | grep -o '"node_name"[[:space:]]*:[[:space:]]*"[^"]*"' | cut -d'"' -f4 || echo "Greenhouse Hub")

        if [[ -n "$HUB_TOKEN" ]]; then
            echo "$HUB_TOKEN" > "$HUB_TOKEN_FILE"
            chmod 600 "$HUB_TOKEN_FILE"
            echo "[greennode-claim] Saved hub token to $HUB_TOKEN_FILE"
        fi

        # Update edge .env if present
        if [[ -f "$EDGE_ENV_FILE" ]]; then
            if [[ -n "$HUB_TOKEN" ]]; then
                sed -i.bak -E "s|^CLOUD_SYNC_TOKEN=.*|CLOUD_SYNC_TOKEN=${HUB_TOKEN}|g" "$EDGE_ENV_FILE"
            fi
            if [[ -n "$GREENHOUSE_ID" ]]; then
                sed -i.bak -E "s|^GREENHOUSE_ID=.*|GREENHOUSE_ID=${GREENHOUSE_ID}|g" "$EDGE_ENV_FILE"
            fi
            sed -i.bak -E "s|^NODE_ID=.*|NODE_ID=${DEVICE_ID}|g" "$EDGE_ENV_FILE"
            echo "[greennode-claim] Updated $EDGE_ENV_FILE with claimed credentials"
        fi

        # Touch claimed flag
        echo "$(date -u +'%Y-%m-%dT%H:%M:%SZ') claimed: node_name=${NODE_NAME}" > "$CLAIMED_FLAG"
        echo "[greennode-claim] Successfully claimed. Triggering post-setup transition..."

        # Run post setup transition script if exists
        if [[ -f "$POST_SETUP_SCRIPT" ]]; then
            bash "$POST_SETUP_SCRIPT"
        fi

        exit 0

    elif [[ "$STATUS" == "unclaimed" ]]; then
        echo "[greennode-claim] Device is registered but pending farmer QR claim (interval: ${POLL_INTERVAL}s)..."
    elif [[ "$STATUS" == "not_registered" ]]; then
        echo "[greennode-claim] Device ID not found in manufacturing database. Please register device in Cloud DB."
    else
        echo "[greennode-claim] Cloud unreachable or error ($STATUS). Retrying in ${POLL_INTERVAL}s..."
    fi

    sleep "$POLL_INTERVAL"

    # Mild backoff up to MAX_INTERVAL
    RETRY_COUNT=$((RETRY_COUNT + 1))
    if [[ "$RETRY_COUNT" -gt 6 && "$POLL_INTERVAL" -lt "$MAX_INTERVAL" ]]; then
        POLL_INTERVAL=$((POLL_INTERVAL + 5))
    fi
done

echo "[greennode-claim] Device already claimed. Exiting."
exit 0
