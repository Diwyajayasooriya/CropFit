#!/usr/bin/env bash
# ============================================================
# CropFit Edge — Technician Reset Utility
# Supports:
# 1. Soft Reset: Wipes credentials/token and restarts claim flow
# 2. Network Reset: Wipes saved Wi-Fi profiles
# 3. Factory Reset: Full clean wipe including SQLite DB & token
# ============================================================

set -e

MODE="${1:-soft}"

echo "========================================="
echo "CropFit Hub Reset Tool — Mode: ${MODE}"
echo "========================================="

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root (sudo bash reset_device.sh [soft|network|factory])"
  exit 1
fi

case "$MODE" in
  soft)
    echo "[*] Performing Soft Reset (Wiping hub token & claim state)..."
    if [ -f /etc/cropfit/config.json ]; then
      # Reset token & claim status, preserve device_id and cloud_url
      DEV_ID=$(jq -r '.device_id // ""' /etc/cropfit/config.json 2>/dev/null || echo "")
      CLOUD_URL=$(jq -r '.cloud_url // "http://172.20.10.2:8000"' /etc/cropfit/config.json 2>/dev/null || echo "http://172.20.10.2:8000")
      cat <<EOF > /etc/cropfit/config.json
{
  "device_id": "${DEV_ID}",
  "cloud_url": "${CLOUD_URL}",
  "hub_token": "",
  "is_claimed": false,
  "greenhouse_id": null
}
EOF
      chmod 600 /etc/cropfit/config.json
      echo "[+] Cleared hub_token. Device is ready to be claimed again."
    fi
    systemctl restart cropfit-edge.service 2>/dev/null || true
    ;;

  network)
    echo "[*] Performing Network Reset (Deleting Wi-Fi connections)..."
    nmcli --terse --fields UUID,TYPE connection show | grep "802-11-wireless" | cut -d: -f1 | while read -r uuid; do
      nmcli connection delete uuid "$uuid" || true
    done
    echo "[+] All saved Wi-Fi connections removed. Device will boot into AP Hotspot mode."
    systemctl restart cropfit-edge.service 2>/dev/null || true
    ;;

  factory)
    echo "[!] Performing Full Factory Reset..."
    rm -f /etc/cropfit/config.json
    rm -f /var/lib/cropfit/*.db
    nmcli --terse --fields UUID,TYPE connection show | grep "802-11-wireless" | cut -d: -f1 | while read -r uuid; do
      nmcli connection delete uuid "$uuid" || true
    done
    echo "[+] Full Factory Reset Complete. Rebooting in 3 seconds..."
    sleep 3
    reboot
    ;;

  *)
    echo "Usage: sudo bash reset_device.sh [soft | network | factory]"
    exit 1
    ;;
esac
