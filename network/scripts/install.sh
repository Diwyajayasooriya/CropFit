#!/bin/bash
# One-shot setup for the GreenNode networking layer on Raspberry Pi OS
# (Bookworm+). Run as root, from anywhere — it locates the repo relative
# to this script.
#
# Before running: fill in every CHANGE_ME in
#   config/hostapd/hostapd.conf
#   config/wpa_supplicant/wpa_supplicant.conf
#   config/udev/70-greennode-net.rules
# and edit registry/devices.csv for your actual sub-nodes.
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
    echo "Run as root (sudo)." >&2
    exit 1
fi

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INSTALL_DIR="/opt/greennode-network"

echo "== 1/9: packages =="
apt-get update
apt-get install -y hostapd dnsmasq nftables iw wireless-tools python3

# hostapd/dnsmasq are often masked by default on Raspberry Pi OS images
# that expect NetworkManager to run the show — unmask them since we're
# taking manual control.
systemctl unmask hostapd
systemctl unmask dnsmasq

echo "== 2/9: copy repo to $INSTALL_DIR (shedding daemon runs from here) =="
mkdir -p "$INSTALL_DIR"
cp -r "$REPO_DIR"/* "$INSTALL_DIR"/

echo "== 3/9: udev rule (stable wlan1 naming for the USB adapter) =="
cp "$REPO_DIR/config/udev/70-greennode-net.rules" /etc/udev/rules.d/
udevadm control --reload-rules

echo "== 4/9: hostapd + wpa_supplicant configs =="
cp "$REPO_DIR/config/hostapd/hostapd.conf" /etc/hostapd/hostapd.conf
sed -i 's|^#DAEMON_CONF=.*|DAEMON_CONF="/etc/hostapd/hostapd.conf"|' /etc/default/hostapd || \
    echo 'DAEMON_CONF="/etc/hostapd/hostapd.conf"' >> /etc/default/hostapd
cp "$REPO_DIR/config/wpa_supplicant/wpa_supplicant.conf" /etc/wpa_supplicant/wpa_supplicant-wlan0.conf

echo "== 5/9: static IPs for AP interfaces (dhcpcd) =="
if ! grep -q "GreenNode AP interfaces" /etc/dhcpcd.conf 2>/dev/null; then
    echo "" >> /etc/dhcpcd.conf
    echo "# --- GreenNode AP interfaces (appended by install.sh) ---" >> /etc/dhcpcd.conf
    cat "$REPO_DIR/config/dhcpcd/dhcpcd-append.conf" >> /etc/dhcpcd.conf
fi

echo "== 6/9: dnsmasq config + generated static reservations =="
mkdir -p /etc/dnsmasq.d
cp "$REPO_DIR/config/dnsmasq/dnsmasq.conf" /etc/dnsmasq.conf
bash "$REPO_DIR/scripts/generate-dhcp-hosts.sh"

echo "== 7/9: IP forwarding + nftables (NAT + inter-subnet isolation) =="
bash "$REPO_DIR/scripts/enable-ip-forwarding.sh"
bash "$REPO_DIR/scripts/nftables-rules.sh"

echo "== 8/9: HTB bandwidth trees =="
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

echo "== 9/9: shedding daemon =="
cp "$REPO_DIR/systemd/greennode-shedding.service" /etc/systemd/system/
systemctl daemon-reload
systemctl enable greennode-shedding.service

echo ""
echo "== Enabling services (will start on next boot / now) =="
systemctl enable hostapd dnsmasq
systemctl restart dhcpcd || true
systemctl restart hostapd
systemctl restart dnsmasq
systemctl start greennode-tc.service
systemctl start greennode-shedding.service

echo ""
echo "[done] Verify with:"
echo "  systemctl status hostapd dnsmasq greennode-tc greennode-shedding"
echo "  iw dev wlan0 link"
echo "  tc -s class show dev wlan1"
echo "  journalctl -u greennode-shedding -f"
