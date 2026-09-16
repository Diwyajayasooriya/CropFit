#!/usr/bin/env python3
"""
GreenNode adaptive shedding daemon.

Watches the STA uplink (wlan0) signal quality. When it degrades and stays
degraded for several consecutive polls (to avoid reacting to transient
dips), it acts on the lowest-priority device tier first:

  1. Soft action  — shrink that device's HTB ceiling (tc class change),
                     throttling rather than disconnecting.
  2. Hard action   — if still degraded after further polls, deauthenticate
                     the device from hostapd entirely (hostapd_cli). This
                     does not blacklist it — it will reassociate on its
                     own once it retries and conditions have recovered.

On recovery (RSSI back above threshold for the same number of consecutive
polls), both actions are reversed in the opposite order.

Device tiers, interfaces, and rate/ceil values are read from
registry/devices.csv (see that file for the schema). Tier 0 devices
(actuators) are never shed.

Run as a systemd service — see systemd/greennode-shedding.service.
"""

import csv
import logging
import subprocess
import time
from dataclasses import dataclass, field
from pathlib import Path

# --- Configuration -----------------------------------------------------

STA_IFACE = "wlan0"
REGISTRY_CSV = Path(__file__).resolve().parent.parent / "registry" / "devices.csv"

POLL_INTERVAL_SEC = 15
RSSI_DEGRADED_DBM = -70          # at/below this = "weak"
RSSI_RECOVERED_DBM = -65         # at/above this = "recovered" (hysteresis
                                  # gap between the two avoids flapping right
                                  # at a single threshold)
CONSECUTIVE_POLLS_TO_ACT = 3     # ~45s of sustained weakness before acting
CONSECUTIVE_POLLS_TO_RECOVER = 3

THROTTLE_CEIL_KBIT = 64          # soft-action ceiling (very low, not zero)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("greennode-shedding")


@dataclass
class Device:
    mac: str
    ip: str
    iface: str
    tier: int
    rate_kbit: int
    ceil_kbit: int
    name: str
    classid: str = field(init=False)
    weak_count: int = 0
    recovered_count: int = 0
    soft_throttled: bool = False
    hard_shed: bool = False

    def __post_init__(self):
        last_octet = int(self.ip.split(".")[-1])
        self.classid = f"1:{hex(0x100 + last_octet)[2:]}"


def load_registry() -> list[Device]:
    devices = []
    with open(REGISTRY_CSV, newline="") as f:
        for row in csv.reader(f):
            if not row or row[0].startswith("#") or row[0] == "mac":
                continue
            mac, ip, iface, tier, rate_kbit, ceil_kbit, name = row
            if int(tier) == 0:
                continue  # tier 0 (actuators) is never a shedding candidate
            devices.append(
                Device(mac, ip, iface, int(tier), int(rate_kbit), int(ceil_kbit), name)
            )
    # shed lowest-priority (highest tier number) first
    devices.sort(key=lambda d: -d.tier)
    return devices


def get_uplink_rssi() -> int | None:
    """Returns RSSI in dBm from `iw dev wlan0 link`, or None if not connected."""
    try:
        out = subprocess.run(
            ["iw", "dev", STA_IFACE, "link"],
            capture_output=True, text=True, timeout=5, check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
        return None

    if "Not connected" in out:
        return None

    for line in out.splitlines():
        line = line.strip()
        if line.startswith("signal:"):
            # e.g. "signal: -63 dBm"
            try:
                return int(line.split()[1])
            except (IndexError, ValueError):
                return None
    return None


def soft_throttle(dev: Device):
    if dev.soft_throttled:
        return
    log.warning("SOFT THROTTLE: %s (%s) on %s -> ceil %dkbit",
                dev.name, dev.ip, dev.iface, THROTTLE_CEIL_KBIT)
    subprocess.run(
        ["tc", "class", "change", "dev", dev.iface, "parent", "1:10",
         "classid", dev.classid, "htb",
         "rate", f"{dev.rate_kbit}kbit", "ceil", f"{THROTTLE_CEIL_KBIT}kbit"],
        check=False,
    )
    dev.soft_throttled = True


def restore_throttle(dev: Device):
    if not dev.soft_throttled:
        return
    log.info("RESTORE: %s (%s) on %s -> ceil %dkbit",
              dev.name, dev.ip, dev.iface, dev.ceil_kbit)
    subprocess.run(
        ["tc", "class", "change", "dev", dev.iface, "parent", "1:10",
         "classid", dev.classid, "htb",
         "rate", f"{dev.rate_kbit}kbit", "ceil", f"{dev.ceil_kbit}kbit"],
        check=False,
    )
    dev.soft_throttled = False


def hard_shed(dev: Device):
    if dev.hard_shed:
        return
    log.warning("HARD SHED (deauth): %s (%s) MAC=%s on %s",
                dev.name, dev.ip, dev.mac, dev.iface)
    subprocess.run(
        ["hostapd_cli", "-i", dev.iface, "deauthenticate", dev.mac],
        check=False,
    )
    dev.hard_shed = True


def clear_hard_shed(dev: Device):
    # Nothing to actively reverse — deauth isn't a blacklist, the device
    # will reassociate on its own. Just clear our tracking flag so a future
    # degradation cycle can hard-shed it again if needed.
    if dev.hard_shed:
        log.info("CLEARED hard-shed flag: %s (%s) — device may reassociate on its own",
                  dev.name, dev.ip)
    dev.hard_shed = False


def main():
    devices = load_registry()
    log.info("Loaded %d shedding-eligible devices from %s", len(devices), REGISTRY_CSV)
    for d in devices:
        log.info("  tier=%d %-28s %s on %s (class %s)", d.tier, d.name, d.ip, d.iface, d.classid)

    while True:
        rssi = get_uplink_rssi()

        if rssi is None:
            log.error("Uplink (%s) not connected or unreadable — treating as fully degraded", STA_IFACE)
            degraded, recovered = True, False
        else:
            log.info("Uplink RSSI: %d dBm", rssi)
            # hysteresis gap between the two thresholds: readings in between
            # count as neither weak nor recovered, so a signal hovering
            # right at one edge can't flap the state back and forth
            degraded = rssi <= RSSI_DEGRADED_DBM
            recovered = rssi >= RSSI_RECOVERED_DBM

        for dev in devices:
            if degraded:
                dev.weak_count += 1
                dev.recovered_count = 0
            elif recovered:
                dev.recovered_count += 1
                dev.weak_count = 0
            # else: signal is in the hysteresis gap — hold both counters

            # act on the lowest-priority tier first, escalate only if that
            # tier is already fully throttled and things are still bad
            eligible = [d for d in devices if not d.hard_shed]
            if eligible and dev is eligible[0]:
                if dev.weak_count >= CONSECUTIVE_POLLS_TO_ACT:
                    if not dev.soft_throttled:
                        soft_throttle(dev)
                    elif dev.weak_count >= CONSECUTIVE_POLLS_TO_ACT * 2:
                        hard_shed(dev)

            if dev.recovered_count >= CONSECUTIVE_POLLS_TO_RECOVER:
                if dev.hard_shed:
                    clear_hard_shed(dev)
                if dev.soft_throttled:
                    restore_throttle(dev)

        time.sleep(POLL_INTERVAL_SEC)


if __name__ == "__main__":
    main()
