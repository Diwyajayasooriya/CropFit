#!/bin/bash
# Writes /etc/nftables.conf and enables the nftables service.
# Implements:
#   - NAT (masquerade) for all three AP subnets out through wlan0
#   - Forwarding allowed: AP subnet <-> wlan0 (with established/related back)
#   - Forwarding blocked: AP subnet <-> AP subnet (sensors can't reach
#     actuators or admin directly, and vice versa)
#   - GreenNode itself (the RPi4) is unaffected by the forward chain — this
#     only governs traffic passing THROUGH the box, not to/from it
set -euo pipefail

cat > /etc/nftables.conf <<'EOF'
#!/usr/sbin/nft -f

flush ruleset

table inet filter {
    chain input {
        type filter hook input priority 0; policy accept;
    }

    chain forward {
        type filter hook forward priority 0; policy drop;

        # established/related traffic always allowed back through
        ct state established,related accept

        # AP subnets -> wlan0 (uplink), any of the three
        iifname { "wlan1", "wlan1_1", "wlan1_2" } oifname "wlan0" accept

        # explicit inter-subnet DROP (redundant given default policy drop,
        # kept explicit + logged so it shows up clearly in logs/demos)
        iifname "wlan1"   oifname { "wlan1_1", "wlan1_2" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_1" oifname { "wlan1",   "wlan1_2" } log prefix "greennode-isolate-drop: " drop
        iifname "wlan1_2" oifname { "wlan1",   "wlan1_1" } log prefix "greennode-isolate-drop: " drop
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
