#!/bin/bash
# Regenerates /etc/dnsmasq.d/greennode-hosts.conf (static MAC->IP
# reservations) from registry/devices.csv. Run this, then
# `systemctl restart dnsmasq`, whenever the registry changes.
set -euo pipefail

CSV="$(dirname "$0")/../registry/devices.csv"
OUT="/etc/dnsmasq.d/greennode-hosts.conf"

{
    echo "# AUTO-GENERATED from registry/devices.csv — do not hand-edit."
    echo "# Re-run scripts/generate-dhcp-hosts.sh after changing the CSV."
    while IFS=',' read -r mac ip iface tier rate_kbit ceil_kbit name; do
        [[ "$mac" =~ ^#.*$ || "$mac" == "mac" || -z "$mac" ]] && continue
        echo "dhcp-host=${mac},${ip},${name},12h"
    done < "$CSV"
} > "$OUT"

echo "[ok] Wrote $OUT"
