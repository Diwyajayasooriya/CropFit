#!/bin/bash
# Reads registry/devices.csv and, for each device, adds:
#   - an HTB leaf class under its SSID's class (1:10), sized to its
#     configured rate/ceil
#   - a u32 filter matching the device's reserved source IP into that class
#
# Re-run any time registry/devices.csv changes (e.g. a new sub-node is
# provisioned). Safe to re-run — classids are deterministic per IP, tc will
# just update rather than duplicate.
set -euo pipefail

CSV="$(dirname "$0")/../registry/devices.csv"

while IFS=',' read -r mac ip iface tier rate_kbit ceil_kbit name; do
    # skip header/comment lines
    [[ "$mac" =~ ^#.*$ || "$mac" == "mac" || -z "$mac" ]] && continue

    last_octet=$(echo "$ip" | awk -F. '{print $4}')
    classid_hex=$(printf '%x' $((0x100 + last_octet)))

    tc class add dev "$iface" parent 1:10 classid "1:$classid_hex" htb \
        rate "${rate_kbit}kbit" ceil "${ceil_kbit}kbit" 2>/dev/null || \
    tc class change dev "$iface" parent 1:10 classid "1:$classid_hex" htb \
        rate "${rate_kbit}kbit" ceil "${ceil_kbit}kbit"

    tc filter del dev "$iface" protocol ip parent 1:0 prio 1 \
        u32 match ip src "$ip/32" flowid "1:$classid_hex" 2>/dev/null || true
    tc filter add dev "$iface" protocol ip parent 1:0 prio 1 \
        u32 match ip src "$ip/32" flowid "1:$classid_hex"

    echo "[ok] $name ($ip on $iface) -> class 1:$classid_hex (tier=$tier rate=${rate_kbit}kbit ceil=${ceil_kbit}kbit)"
done < "$CSV"
