#!/bin/bash
# Enables IPv4 forwarding, persisted across reboots.
# Required: by default the kernel won't route packets between wlan0 and the
# AP interfaces at all, regardless of what nftables/routes say.
set -euo pipefail

echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-greennode-forward.conf
sysctl -w net.ipv4.ip_forward=1

echo "[ok] IPv4 forwarding enabled (persisted in /etc/sysctl.d/99-greennode-forward.conf)"
