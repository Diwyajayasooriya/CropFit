#!/bin/bash
# Builds the base HTB tree on each of the three AP interfaces.
# Per-device leaf classes are added separately by tc-add-device-classes.sh
# (run this script first, then that one).
#
# Note: tc qdiscs are per network device, not per physical radio. wlan1,
# wlan1_1 and wlan1_2 are three separate netdevs riding the same USB radio's
# airtime underneath, so this sets up three independent HTB trees whose
# ceilings are chosen to respect the radio's real total capacity — it's
# soft coordination by configuration, not a literal shared kernel budget.
set -euo pipefail

# Adjust to your USB adapter's real-world throughput (802.11n 2.4GHz single
# stream is realistically ~20-25mbit usable, well under the 72mbit PHY rate)
TOTAL_RATE=20mbit

setup_tree() {
    local iface=$1
    local class_rate=$2   # this SSID's guaranteed floor
    local class_ceil=$3   # this SSID's burst ceiling (can borrow up to this)
    local prio=$4         # 0 = highest priority among sibling classes

    tc qdisc del dev "$iface" root 2>/dev/null || true

    # Root qdisc + root class capping everything at TOTAL_RATE
    tc qdisc add dev "$iface" root handle 1: htb default 999
    tc class add dev "$iface" parent 1: classid 1:1 htb rate "$TOTAL_RATE" ceil "$TOTAL_RATE"

    # This SSID's class, under the root
    tc class add dev "$iface" parent 1:1 classid 1:10 htb \
        rate "$class_rate" ceil "$class_ceil" prio "$prio"

    # Default/catch-all class for any traffic not matched by a per-device
    # filter yet (e.g. a device before its reservation/class exists)
    tc class add dev "$iface" parent 1:1 classid 1:999 htb \
        rate 128kbit ceil "$TOTAL_RATE" prio 7
    tc qdisc add dev "$iface" parent 1:999 handle 999: sfq perturb 10

    echo "[ok] HTB root tree on $iface (rate=$class_rate ceil=$class_ceil prio=$prio)"
}

# sensors: highest floor (most devices), lowest priority — routine telemetry
setup_tree wlan1   15mbit 20mbit 3

# actuators: smaller floor, HIGHEST priority — time-sensitive control commands
setup_tree wlan1_1 5mbit  20mbit 0

# admin: small floor, mid priority — occasional admin/diagnostic traffic
setup_tree wlan1_2 2mbit  20mbit 5

echo "[ok] Base HTB trees ready. Run tc-add-device-classes.sh next."
