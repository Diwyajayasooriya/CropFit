#!/usr/bin/env bash
# ==============================================================================
# GreenNode Edge - Post-Setup Transition Script (greennode-post-setup.sh)
#
# Called after:
#   1. Wi-Fi setup is completed (or Ethernet connected)
#   2. Device has been successfully claimed by farmer
#
# Actions performed:
#   1. Marks setup complete: touch /etc/greennode/setup-complete
#   2. Disables the first-boot onboarding services
#   3. Initializes/migrates local SQLite edge database
#   4. Enables & starts production edge services:
#        - mosquitto (MQTT)
#        - hostapd & dnsmasq (local sensor/actuator AP subnets on wlan1)
#        - greennode-api
#        - greennode-ingestion
#        - greennode-dispatcher
#        - greennode-rules
# ==============================================================================

set -euo pipefail

LOG_FILE="/var/log/greennode-setup.log"
CONF_DIR="/etc/greennode"
SETUP_COMPLETE_FLAG="${CONF_DIR}/setup-complete"

log() {
    local msg="[post-setup $(date -u +'%Y-%m-%dT%H:%M:%SZ')] $1"
    echo "$msg"
    echo "$msg" >> "$LOG_FILE" 2>/dev/null || true
}

log "Transitioning GreenNode from setup mode to full production mode..."

mkdir -p "$CONF_DIR"
touch "$SETUP_COMPLETE_FLAG"

# 1. Disable one-time setup services so they never run on subsequent reboots
log "Disabling first-boot onboarding services..."
systemctl disable greennode-wifi-setup.service 2>/dev/null || true
systemctl stop greennode-wifi-setup.service 2>/dev/null || true
systemctl disable greennode-claim.service 2>/dev/null || true
systemctl stop greennode-claim.service 2>/dev/null || true

# 2. Initialize local edge SQLite database if required
if [[ -d "/opt/greennode-edge" ]]; then
    log "Checking edge database schema..."
    cd /opt/greennode-edge
    if [[ -f "init_db.py" && ! -f "greennode.db" ]]; then
        log "Running database initialization init_db.py..."
        python3 init_db.py || log "Warning: init_db.py returned non-zero"
    fi
fi

# 3. Enable and start Mosquitto MQTT broker
log "Ensuring Mosquitto MQTT broker is running..."
systemctl enable mosquitto 2>/dev/null || true
systemctl restart mosquitto 2>/dev/null || true

# 4. Start local sensor/actuator access point networks if configured
if systemctl list-unit-files | grep -q "hostapd.service"; then
    log "Starting sensor/actuator multi-BSS access point (hostapd)..."
    systemctl unmask hostapd 2>/dev/null || true
    systemctl enable hostapd 2>/dev/null || true
    systemctl restart hostapd 2>/dev/null || true
fi

if systemctl list-unit-files | grep -q "dnsmasq.service"; then
    systemctl restart dnsmasq 2>/dev/null || true
fi

# 5. Enable and start core edge services
CORE_SERVICES=(
    "greennode-api.service"
    "greennode-ingestion.service"
    "greennode-dispatcher.service"
    "greennode-rules.service"
)

for srv in "${CORE_SERVICES[@]}"; do
    if systemctl list-unit-files | grep -q "$srv"; then
        log "Starting $srv..."
        systemctl enable "$srv" 2>/dev/null || true
        systemctl restart "$srv" 2>/dev/null || true
    else
        log "Service $srv not found in unit files; skipping."
    fi
done

log "GreenNode edge transition complete! Device is fully active in production mode."
