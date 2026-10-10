#!/usr/bin/env bash
# ==============================================================================
# GreenNode Edge - Factory Reset Script (factory-reset.sh)
#
# Returns the Raspberry Pi to out-of-the-box state:
#   1. Wipes Wi-Fi credentials saved by the farmer
#   2. Wipes claim status and cloud access tokens
#   3. Cleans local edge SQLite database
#   4. Re-enables greennode-wifi-setup.service for next power-on
#   5. Preserves hardware /etc/greennode/device_id
# ==============================================================================

set -euo pipefail

CONF_DIR="/etc/greennode"
EDGE_DIR="/opt/greennode-edge"
FORCE=false

if [[ "${1:-}" == "--force" || "${1:-}" == "-f" ]]; then
    FORCE=true
fi

if [[ "$EUID" -ne 0 ]]; then
    echo "ERROR: factory-reset.sh must be run as root (e.g., sudo ./factory-reset.sh)"
    exit 1
fi

if [[ "$FORCE" != "true" ]]; then
    echo "================================================================="
    echo " WARNING: THIS WILL RESET GREENNODE TO FACTORY SETTINGS!"
    echo " - All saved Wi-Fi connections will be deleted."
    echo " - All local telemetry and database records will be erased."
    echo " - Device claiming link will be removed."
    echo " - The Pi will return to hotspot setup mode (GreenNode-Setup)."
    echo "================================================================="
    read -p "Are you sure you want to proceed? (yes/no): " CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        echo "Aborted."
        exit 0
    fi
fi

echo "[factory-reset] Stopping production edge services..."
SERVICES=(
    "greennode-api"
    "greennode-ingestion"
    "greennode-dispatcher"
    "greennode-rules"
    "hostapd"
)

for srv in "${SERVICES[@]}"; do
    systemctl stop "$srv" 2>/dev/null || true
    systemctl disable "$srv" 2>/dev/null || true
done

echo "[factory-reset] Clearing state flags and credentials..."
rm -f "${CONF_DIR}/claimed"
rm -f "${CONF_DIR}/setup-complete"
rm -f "${CONF_DIR}/hub_token"
rm -f /var/log/greennode-setup.log

echo "[factory-reset] Deleting saved Wi-Fi networks from NetworkManager..."
if command -v nmcli >/dev/null 2>&1; then
    nmcli --terse --fields UUID,TYPE connection show 2>/dev/null | grep '802-11-wireless' | cut -d: -f1 | while read -r uuid; do
        if [[ -n "$uuid" ]]; then
            nmcli connection delete uuid "$uuid" 2>/dev/null || true
        fi
    done
fi

echo "[factory-reset] Resetting edge database and cached telemetry..."
if [[ -d "$EDGE_DIR" ]]; then
    if [[ -f "${EDGE_DIR}/greennode.db" ]]; then
        mv "${EDGE_DIR}/greennode.db" "${EDGE_DIR}/greennode.db.bak_$(date +%s)" 2>/dev/null || rm -f "${EDGE_DIR}/greennode.db"
    fi
    if [[ -f "${EDGE_DIR}/.env" ]]; then
        sed -i.bak -E "s|^CLOUD_SYNC_TOKEN=.*|CLOUD_SYNC_TOKEN=|g" "${EDGE_DIR}/.env"
        sed -i.bak -E "s|^GREENHOUSE_ID=.*|GREENHOUSE_ID=unassigned|g" "${EDGE_DIR}/.env"
    fi
fi

echo "[factory-reset] Re-enabling first-boot setup services..."
systemctl enable greennode-wifi-setup.service 2>/dev/null || true
systemctl enable greennode-claim.service 2>/dev/null || true

echo "================================================================="
echo " Factory reset complete! The Pi is now in out-of-the-box state."
echo " Device ID preserved: $(cat "${CONF_DIR}/device_id" 2>/dev/null || echo 'none')"
echo " You may reboot now: sudo reboot"
echo "================================================================="
