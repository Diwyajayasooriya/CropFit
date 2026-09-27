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
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        # established/related traffic always allowed back through
        ct state established,related accept

        # AP subnets -> wlan0 (uplink) — provisioning (wlan1_3) deliberately
        # excluded here: it gets no forwarding at all, not even to the
        # internet, only the local input-chain exception above
        iifname { "wlan1", "wlan1_1", "wlan1_2" } oifname "wlan0" accept

        # explicit inter-subnet DROP (redundant given default policy drop,
        # kept explicit + logged so it shows up clearly in logs/demos)
        iifname "wlan1"   oifname { "wlan1_1", "wlan1_2", "wlan1_3" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_1" oifname { "wlan1",   "wlan1_2", "wlan1_3" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_2" oifname { "wlan1",   "wlan1_1", "wlan1_3" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_3" oifname { "wlan1",   "wlan1_1", "wlan1_2", "wlan0" } log prefix "greennode-isolate-drop: " drop
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
