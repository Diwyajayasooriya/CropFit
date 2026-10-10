#!/usr/bin/env bash
# ============================================================
# CropFit Edge — Zero-Touch Pi Installer
# Sets up NetworkManager, Python venv, edge service, and systemd.
# Run during SD image preparation / initial provisioning.
# ============================================================

set -e

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run with sudo: sudo bash install.sh"
  exit 1
fi

echo "[*] Installing CropFit Edge Hub Dependencies..."
apt update && apt install -y \
  python3-pip python3-venv \
  network-manager sqlite3 \
  jq curl git

INSTALL_DIR="/opt/cropfit-edge"
CONFIG_DIR="/etc/cropfit"

mkdir -p "$INSTALL_DIR"
mkdir -p "$CONFIG_DIR"
chmod 700 "$CONFIG_DIR"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "[*] Copying application code to $INSTALL_DIR..."
cp -r "$PROJECT_ROOT/app" "$INSTALL_DIR/"
cp -r "$PROJECT_ROOT/scripts" "$INSTALL_DIR/" 2>/dev/null || true
cp "$PROJECT_ROOT/requirements.txt" "$INSTALL_DIR/" 2>/dev/null || true

# Initialize factory configuration if not present
if [ ! -f "$CONFIG_DIR/config.json" ]; then
  echo "[*] Creating default factory configuration at $CONFIG_DIR/config.json..."
  cat <<EOF > "$CONFIG_DIR/config.json"
{
  "cloud_url": "https://api.cropfit.lk",
  "software_version": "0.1.0",
  "is_claimed": false,
  "hub_token": ""
}
EOF
  chmod 600 "$CONFIG_DIR/config.json"
fi

cd "$INSTALL_DIR"
if [ ! -d ".venv" ]; then
  echo "[*] Creating Python virtual environment..."
  python3 -m venv .venv
fi

echo "[*] Installing Python dependencies..."
.venv/bin/pip install --upgrade pip
.venv/bin/pip install httpx fastapi uvicorn paho-mqtt sqlalchemy

echo "[*] Installing systemd service..."
if [ -f "$PROJECT_ROOT/systemd/cropfit-edge.service" ]; then
  cp "$PROJECT_ROOT/systemd/cropfit-edge.service" /etc/systemd/system/
fi

systemctl daemon-reload
systemctl enable cropfit-edge.service

echo "============================================================"
echo "[+] CropFit Edge Hub installed successfully!"
echo "    Service:       cropfit-edge.service (enabled for auto-start)"
echo "    Start now:     sudo systemctl start cropfit-edge.service"
echo "    Inspect logs:  journalctl -u cropfit-edge.service -f"
echo "============================================================"

