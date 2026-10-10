"""
CropFit Edge — Device Hardware Identity Module
Derives persistent, deterministic device_id from CPU serial or primary MAC address.
"""
import logging
import re
import uuid

log = logging.getLogger("cropfit.identity")


def get_cpu_serial() -> str:
    """Reads hardware serial from /proc/cpuinfo (standard on Raspberry Pi OS)."""
    try:
        with open("/proc/cpuinfo", "r") as f:
            for line in f:
                if line.startswith("Serial"):
                    serial = line.split(":")[1].strip()
                    if serial and set(serial) != {"0"}:
                        return serial.upper()
    except Exception as e:
        log.debug("Could not read /proc/cpuinfo: %s", e)
    return ""


def get_mac_address() -> str:
    """Fallback MAC address extraction."""
    mac = uuid.getnode()
    return ":".join(re.findall("..", "%012X" % mac))


def derive_device_id() -> str:
    """
    Returns deterministic device_id in the format: GN-HUB-XXXX
    Uses the last 4 to 6 characters of CPU serial or MAC address.
    """
    serial = get_cpu_serial()
    if serial:
        short_id = serial[-4:].upper()
        return f"GN-HUB-{short_id}"

    # Fallback to last octets of MAC address
    mac_clean = get_mac_address().replace(":", "")
    return f"GN-HUB-{mac_clean[-4:].upper()}"
