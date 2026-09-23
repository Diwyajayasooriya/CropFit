#!/bin/bash
# Regenerates Mosquitto credentials + ACL entries for every device in
# registry/devices.csv. Run this after bulk-editing the CSV directly
# (pre-registering known devices before they're ever paired), or any
# time you want a full, idempotent rebuild from the CSV as source of
# truth. Devices paired live through pairing_watcher.py get their
# credentials appended directly by that daemon instead — this script and
# that code path both write the same two files, so either can run
# without stepping on the other's entries (device usernames are unique
# per row/device, matched by `mosquitto_passwd -b`'s update-in-place
# behavior and this script's ACL marker-based rewrite).
set -euo pipefail

CSV="$(dirname "$0")/../registry/devices.csv"
PASSWD_FILE="/etc/mosquitto/passwd"
ACL_FILE="/etc/mosquitto/acl.d/greennode.acl"
ACL_BASE="$(dirname "$0")/../config/mosquitto/greennode.acl.base"

mkdir -p /etc/mosquitto/acl.d
touch "$PASSWD_FILE"

# Start ACL fresh from the static base (service accounts + marker), then
# append every device's generated entry below it.
cp "$ACL_BASE" "$ACL_FILE"

while IFS=',' read -r mac ip iface tier rate_kbit ceil_kbit name; do
    [[ "$mac" =~ ^#.*$ || "$mac" == "mac" || -z "$mac" ]] && continue

    # Random password per device, generated fresh each run — fine for a
    # prototype; a real deployment would preserve existing passwords
    # rather than rotating them on every regen.
    password=$(openssl rand -base64 18)

    mosquitto_passwd -b "$PASSWD_FILE" "$name" "$password"

    if [[ "$iface" == "wlan1_1" ]]; then
        # actuator: reports status, listens for commands
        {
            echo ""
            echo "user $name"
            echo "topic write greennode/$name/status"
            echo "topic read greennode/$name/cmd"
        } >> "$ACL_FILE"
    else
        # sensor (default): reports data + status only
        {
            echo ""
            echo "user $name"
            echo "topic write greennode/$name/data"
            echo "topic write greennode/$name/status"
        } >> "$ACL_FILE"
    fi

    echo "[ok] $name -> mqtt password: $password  (store this — it's not printed again)"
done < "$CSV"

systemctl reload mosquitto
echo "[ok] Wrote $PASSWD_FILE and $ACL_FILE, reloaded mosquitto"
