#!/bin/bash
# greennode-wifi-setup.sh
#
# "If no Wi-Fi, start hotspot" wrapper for Balena WiFi Connect.
#
# Design:
#   - On first boot (no saved network): starts a captive-portal hotspot
#     called "GreenNode-Setup" so the farmer can pick their home WiFi from
#     a phone, no app needed.
#   - On subsequent boots where the saved WiFi is reachable: wifi-connect
#     detects the existing connection and exits immediately, so the hotspot
#     never appears.
#   - If the saved WiFi disappears (router dies, SSID renamed): the hotspot
#     reappears automatically so the farmer can re-configure.
#
# Prerequisites:
#   - NetworkManager active (Bookworm default — do NOT switch to dhcpcd
#     before running this; the post-setup transition handles that)
#   - Balena WiFi Connect installed at /usr/local/sbin/wifi-connect
#     Install: bash <(curl -sL https://github.com/balena-os/wifi-connect/raw/master/scripts/raspbian-install.sh)
#
# This script is called by greennode-wifi-setup.service (systemd).
# It blocks until the user finishes the portal or an existing connection
# is found, then exits.

set -euo pipefail

CLAIMED_FLAG="/etc/greennode/claimed"
DEVICE_ID_FILE="/etc/greennode/device_id"
WIFI_CONNECT="/usr/local/sbin/wifi-connect"
PORTAL_SSID="GreenNode-Setup"
PORTAL_GATEWAY="192.168.42.1"
PORTAL_DHCP_RANGE="192.168.42.2,192.168.42.254"
PORTAL_PORT=80
UI_DIR="/opt/greennode-network/setup-portal"
SETUP_TIMEOUT=600  # 10 minutes — then restart and try again

# -----------------------------------------------------------------
# 1. Ethernet bypass: if eth0 has an IP, skip the hotspot entirely.
#    The farmer (or a technician) plugged in a cable.
# -----------------------------------------------------------------
if ip -4 addr show eth0 2>/dev/null | grep -q "inet "; then
    echo "[wifi-setup] Ethernet connected — skipping WiFi setup hotspot."
    exit 0
fi

# -----------------------------------------------------------------
# 2. Already on WiFi? wifi-connect handles this itself, but we can
#    short-circuit even faster by checking NetworkManager.
# -----------------------------------------------------------------
if nmcli -t -f TYPE,STATE device | grep -q "^wifi:connected$"; then
    echo "[wifi-setup] Already connected to WiFi — hotspot not needed."
    exit 0
fi

# -----------------------------------------------------------------
# 3. wifi-connect binary must exist.
# -----------------------------------------------------------------
if [[ ! -x "$WIFI_CONNECT" ]]; then
    echo "[wifi-setup] ERROR: wifi-connect not found at $WIFI_CONNECT"
    echo "[wifi-setup] Install it first:"
    echo "  bash <(curl -sL https://github.com/balena-os/wifi-connect/raw/master/scripts/raspbian-install.sh)"
    exit 1
fi

# -----------------------------------------------------------------
# 4. Load device_id for the portal page (if it exists yet).
# -----------------------------------------------------------------
DEVICE_ID="unknown"
if [[ -f "$DEVICE_ID_FILE" ]]; then
    DEVICE_ID="$(cat "$DEVICE_ID_FILE")"
fi
export GREENNODE_DEVICE_ID="$DEVICE_ID"

# -----------------------------------------------------------------
# 5. Start the captive-portal hotspot.
#    wifi-connect blocks here until the user submits credentials
#    and the Pi successfully joins the selected network, then exits.
# -----------------------------------------------------------------
echo "[wifi-setup] No WiFi connection found. Starting setup hotspot: $PORTAL_SSID"
echo "[wifi-setup] Device ID: $DEVICE_ID"
echo "[wifi-setup] Farmer should connect to '$PORTAL_SSID' from their phone."

WIFI_CONNECT_ARGS=(
    --portal-ssid "$PORTAL_SSID"
    --portal-gateway "$PORTAL_GATEWAY"
    --portal-dhcp-range "$PORTAL_DHCP_RANGE"
    --portal-listening-port "$PORTAL_PORT"
)

# Use custom UI if available (logo, device name, crop-themed styling)
if [[ -d "$UI_DIR" ]]; then
    WIFI_CONNECT_ARGS+=(--ui-directory "$UI_DIR")
    echo "[wifi-setup] Using custom portal UI from $UI_DIR"
fi

# Run with a timeout so systemd can restart if something hangs
timeout "$SETUP_TIMEOUT" "$WIFI_CONNECT" "${WIFI_CONNECT_ARGS[@]}" || {
    EXIT_CODE=$?
    if [[ $EXIT_CODE -eq 124 ]]; then
        echo "[wifi-setup] Timed out after ${SETUP_TIMEOUT}s — systemd will restart us."
    else
        echo "[wifi-setup] wifi-connect exited with code $EXIT_CODE"
    fi
    exit $EXIT_CODE
}

echo "[wifi-setup] WiFi configured successfully. Pi is now online."

# -----------------------------------------------------------------
# 6. After WiFi is up, kick off the claim/registration service
#    (if the device hasn't been claimed yet).
# -----------------------------------------------------------------
if [[ ! -f "$CLAIMED_FLAG" ]]; then
    echo "[wifi-setup] Device not yet claimed. Starting claim service..."
    systemctl start greennode-claim.service --no-block || true
fi

exit 0
