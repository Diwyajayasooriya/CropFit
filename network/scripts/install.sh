#!/bin/bash
# One-shot setup for the GreenNode networking + edge application layers
# on Raspberry Pi OS (Bookworm+). Run as root. Expects the sibling
# "edge/" folder (../edge relative to this repo) to exist for the
# ingestion/rules-engine deployment step — see the 3-folder layout
# (network/, edge/, firmware/) in the docs.
#
# Before running: fill in every CHANGE_ME in
#   config/hostapd/hostapd.conf (includes a NEW per-unit CHANGE_ME for
#     BSS4/greennode-setup — this one must be unique per physical unit
#     and printed on its label, see the comment above that BSS)
#   config/wpa_supplicant/wpa_supplicant.conf
#   config/udev/70-greennode-net.rules
#   systemd/greennode-pairing-watcher.service (TARGET_PASSPHRASE_* — must
#     match hostapd.conf exactly)
# and edit registry/devices.csv for any devices you're pre-registering
# directly (devices added through the pairing flow are appended
# automatically — see pairing_watcher.py). NOTE: wpa_supplicant.conf's
# CHANGE_ME_upstream_ssid/passphrase no longer need to be filled in
# before shipping a unit to a farmer — that's now the whole point of
# greennode-uplink-provisioning (wlan1_4 / SoftAP + captive portal,
# see network.md Section 1.14). They're still useful to fill in for a
# dev/test unit you're setting up yourself on a known network.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Run as root (sudo)." >&2
    exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EDGE_DIR="$(cd "$REPO_DIR/../edge" 2>/dev/null && pwd || echo "")"
INSTALL_DIR="/opt/greennode-network"
EDGE_INSTALL_DIR="/opt/greennode-edge"

echo "== 1/16: packages =="
apt-get update
apt-get install -y hostapd dnsmasq nftables iw wireless-tools python3 python3-pip \
    mosquitto mosquitto-clients

# hostapd/dnsmasq are often masked by default on Raspberry Pi OS images
# that expect NetworkManager to run the show — unmask them since we're
# taking manual control.
systemctl unmask hostapd
systemctl unmask dnsmasq

# paho-mqtt and sqlalchemy for the edge app layer (ingestion service,
# actuator dispatcher, rules engine).
pip3 install --break-system-packages paho-mqtt sqlalchemy

echo "== 2/16: copy repo to $INSTALL_DIR =="
mkdir -p "$INSTALL_DIR"
cp -r "$REPO_DIR"/* "$INSTALL_DIR"/

echo "== 3/16: udev rule (stable wlan1 naming for the USB adapter) =="
cp "$REPO_DIR/config/udev/70-greennode-net.rules" /etc/udev/rules.d/
udevadm control --reload-rules

echo "== 4/16: hostapd + wpa_supplicant configs =="
cp "$REPO_DIR/config/hostapd/hostapd.conf" /etc/hostapd/hostapd.conf
sed -i 's|^#DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd || \
    echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
cp "$REPO_DIR/config/wpa_supplicant/wpa_supplicant.conf" /etc/wpa_supplicant/wpa_supplicant-wlan0.conf

echo "== 5/16: static IPs for AP interfaces (dhcpcd) =="
if ! grep -q "GreenNode AP interfaces" /etc/dhcpcd.conf 2>/dev/null; then
    echo "" >> /etc/dhcpcd.conf
    echo "# --- GreenNode AP interfaces (appended by install.sh) ---" >> /etc/dhcpcd.conf
    cat "$REPO_DIR/config/dhcpcd/dhcpcd-append.conf" >> /etc/dhcpcd.conf
fi

echo "== 6/16: dnsmasq config + generated static reservations =="
mkdir -p /etc/dnsmasq.d
cp "$REPO_DIR/config/dnsmasq/dnsmasq.conf" /etc/dnsmasq.conf
bash "$REPO_DIR/scripts/generate-dhcp-hosts.sh"

echo "== 7/16: setup-network dnsmasq instance (wlan1_4, wildcard captive-portal DNS) =="
# Deliberately a second, independent dnsmasq process — see
# config/dnsmasq/dnsmasq-setup.conf for why this can't just be folded
# into the main instance above.
cp "$REPO_DIR/config/dnsmasq/dnsmasq-setup.conf" /etc/dnsmasq-greennode-setup.conf
cp "$REPO_DIR/systemd/greennode-dnsmasq-setup.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-dnsmasq-setup.service

echo "== 8/16: IP forwarding + nftables (NAT + inter-subnet isolation) =="
bash "$REPO_DIR/scripts/enable-ip-forwarding.sh"
bash "$REPO_DIR/scripts/nftables-rules.sh"

echo "== 9/16: Mosquitto (MQTT broker: no anonymous access, password + ACL) =="
mkdir -p /etc/mosquitto/acl.d /var/lib/mosquitto
cp "$REPO_DIR/config/mosquitto/mosquitto.conf" /etc/mosquitto/conf.d/greennode.conf
touch /etc/mosquitto/passwd
cp "$REPO_DIR/config/mosquitto/greennode.acl.base" /etc/mosquitto/acl.d/greennode.acl
systemctl enable mosquitto
systemctl restart mosquitto
# Generates credentials for anything already in devices.csv (pre-
# registered devices). Devices paired later via pairing_watcher.py get
# their credentials appended live, no re-run needed.
bash "$REPO_DIR/scripts/generate-mqtt-creds.sh" || \
    echo "[warn] generate-mqtt-creds.sh had nothing to do or failed — fine if devices.csv is still just placeholder rows"

echo "== 10/16: HTB bandwidth trees =="
# tc setup needs to re-run after each boot once interfaces exist — done via
# a oneshot systemd unit chained after hostapd brings wlan1/_1/_2 up.
cat > /etc/systemd/system/greennode-tc.service <<EOF
[Unit]
Description=GreenNode HTB bandwidth partitioning
After=hostapd.service
Requires=hostapd.service

[Service]
Type=oneshot
ExecStartPre=/bin/sleep 3
ExecStart=/bin/bash $INSTALL_DIR/scripts/tc-htb-setup.sh
ExecStart=/bin/bash $INSTALL_DIR/scripts/tc-add-device-classes.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable greennode-tc.service

echo "== 11/16: deploy edge application layer (ingestion, dispatcher, rules) =="
if [[ -n "$EDGE_DIR" ]]; then
    mkdir -p "$EDGE_INSTALL_DIR"
    cp -r "$EDGE_DIR"/*.py "$EDGE_INSTALL_DIR"/
    echo "[ok] Copied edge/ to $EDGE_INSTALL_DIR"

    # Idempotent — safe even if your real Alembic migrations already own
    # this schema and have already run; create_all() only fills in
    # tables that don't exist yet, never touches ones that do.
    (cd "$EDGE_INSTALL_DIR" && python3 init_db.py) || \
        echo "[warn] init_db.py failed — connected_devices/conditions tables may not exist yet. " \
             "pairing_watcher.py and the edge services will fail until this is fixed."
else
    echo "[warn] Sibling edge/ folder not found next to this repo — skipping." \
         "Copy it to $EDGE_INSTALL_DIR manually, matching the 3-folder layout, then run" \
         "'python3 init_db.py' inside it before starting any services."
fi

echo "== 12/16: shedding daemon =="
cp "$REPO_DIR/systemd/greennode-shedding.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-shedding.service

echo "== 13/16: pairing watcher (device detection + local provisioning finalize) =="
cp "$REPO_DIR/systemd/greennode-pairing-watcher.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-pairing-watcher.service

echo "== 14/16: hub-uplink provisioning (SoftAP + captive portal on wlan1_4) =="
cp "$REPO_DIR/systemd/greennode-uplink-provisioning.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-uplink-provisioning.service

echo "== 15/16: ingestion service + rules engine timer =="
cp "$REPO_DIR/systemd/greennode-ingestion.service" /etc/systemd/system/
cp "$REPO_DIR/systemd/greennode-rules.service" /etc/systemd/system/
cp "$REPO_DIR/systemd/greennode-rules.timer" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-ingestion.service
systemctl enable greennode-rules.timer

echo "== 16/16: NTP (clock sync — matters for reading timestamps on cold boot) =="
timedatectl set-ntp true

echo ""
echo "== Enabling services (will start on next boot / now) =="
systemctl enable hostapd dnsmasq
systemctl restart dhcpcd || true
systemctl restart hostapd
systemctl restart dnsmasq
systemctl start greennode-dnsmasq-setup.service
systemctl start greennode-tc.service
systemctl start greennode-shedding.service
systemctl start greennode-pairing-watcher.service
systemctl start greennode-uplink-provisioning.service
systemctl start greennode-ingestion.service
systemctl start greennode-rules.timer

echo ""
echo "[done] Verify with:"
echo "  systemctl status hostapd dnsmasq greennode-dnsmasq-setup mosquitto greennode-tc \\"
echo "    greennode-shedding greennode-pairing-watcher greennode-uplink-provisioning \\"
echo "    greennode-ingestion greennode-rules.timer"
echo "  iw dev wlan0 link"
echo "  tc -s class show dev wlan1"
echo "  journalctl -u greennode-shedding -f"
echo "  journalctl -u greennode-pairing-watcher -f"
echo "  journalctl -u greennode-uplink-provisioning -f"
echo "  journalctl -u greennode-ingestion -f"
echo "  curl http://127.0.0.1:8091/pairing/status    # pairing watcher control endpoint"
echo "  curl http://127.0.0.1:8092/uplink/status     # hub-uplink provisioning status"
