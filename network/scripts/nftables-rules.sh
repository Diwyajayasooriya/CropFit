#!/bin/bash
# Writes /etc/nftables.conf and enables the nftables service.
# Implements:
#   - NAT (masquerade) for the three main AP subnets out through wlan0
#   - Forwarding allowed: AP subnet <-> wlan0 (with established/related back)
#   - Forwarding blocked: AP subnet <-> AP subnet (sensors can't reach
#     actuators or admin directly, and vice versa)
#   - NEW: provisioning subnet (wlan1_3) gets NO forwarding at all — it
#     can't reach wlan0/internet or any other AP subnet, only the pairing
#     service running locally on GreenNode itself (input chain, below)
#   - GreenNode itself (the RPi4) is unaffected by the forward chain — this
#     only governs traffic passing THROUGH the box, not to/from it. The
#     input chain rules below are what restrict traffic TO GreenNode itself.
set -euo pipefail

# Change this if pairing_watcher.py's PROVISION_PORT is customized
PROVISION_PORT=8090

# Change this if uplink_provisioning.py's SETUP_HTTP_PORT is customized
SETUP_HTTP_PORT=80

cat > /etc/nftables.conf <<EOF
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy accept;

        # NEW: lock the provisioning subnet down to ONLY the pairing
        # service's port on GreenNode itself. An unclaimed ESP32 sitting
        # on wlan1_3 cannot reach SSH, the main backend API, MQTT, or
        # anything else running on this box — just the one handoff port.
        # Order matters: these two rules must come before anything else
        # would implicitly accept wlan1_3 traffic.
        iifname "wlan1_3" tcp dport $PROVISION_PORT accept
        iifname "wlan1_3" log prefix "greennode-provision-blocked: " drop

        # NEW: same pattern for wlan1_4 (hub-uplink setup) — a phone on
        # this network can reach the setup HTTP server and this
        # interface's own dedicated dnsmasq instance (needed for the
        # wildcard captive-portal DNS hijack), and nothing else on
        # GreenNode. No separate control-port exception is needed here
        # the way wlan1_3's pairing watcher has one — the setup daemon's
        # loopback status endpoint isn't reachable from any AP subnet
        # anyway, loopback traffic never transits an iifname.
        iifname "wlan1_4" tcp dport $SETUP_HTTP_PORT accept
        iifname "wlan1_4" udp dport 53 accept
        iifname "wlan1_4" tcp dport 53 accept
        iifname "wlan1_4" log prefix "greennode-setup-blocked: " drop
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        # established/related traffic always allowed back through
        ct state established,related accept

        # AP subnets -> wlan0 (uplink) — provisioning (wlan1_3) and setup
        # (wlan1_4) deliberately excluded here: neither gets forwarding
        # at all, not even to the internet, only their respective local
        # input-chain exceptions above
        iifname { "wlan1", "wlan1_1", "wlan1_2" } oifname "wlan0" accept

        # explicit inter-subnet DROP (redundant given default policy drop,
        # kept explicit + logged so it shows up clearly in logs/demos)
        iifname "wlan1"   oifname { "wlan1_1", "wlan1_2", "wlan1_3", "wlan1_4" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_1" oifname { "wlan1",   "wlan1_2", "wlan1_3", "wlan1_4" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_2" oifname { "wlan1",   "wlan1_1", "wlan1_3", "wlan1_4" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_3" oifname { "wlan1",   "wlan1_1", "wlan1_2", "wlan1_4", "wlan0" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_4" oifname { "wlan1",   "wlan1_1", "wlan1_2", "wlan1_3", "wlan0" } log prefix "greennode-isolate-drop: " drop
    }

    chain output {
        type filter hook output priority 0; policy accept;
    }
}

table ip nat {
    chain postrouting {
        type nat hook postrouting priority 100;
        oifname "wlan0" masquerade
    }
}
EOF

systemctl enable nftables
systemctl restart nftables

echo "[ok] nftables rules loaded from /etc/nftables.conf"
