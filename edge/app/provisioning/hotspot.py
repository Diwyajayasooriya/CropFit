"""
CropFit Edge — Hotspot Management via NetworkManager
Creates and tears down temporary AP setup hotspot.
"""
import logging
import subprocess

log = logging.getLogger("cropfit.hotspot")
HOTSPOT_CON_NAME = "CropFit-Setup-AP"


def start_setup_hotspot(ssid: str, ip_address: str = "192.168.4.1/24") -> bool:
    """Creates a temporary open Wi-Fi hotspot for farmer setup using NetworkManager."""
    stop_setup_hotspot()

    cmd = [
        "nmcli", "connection", "add",
        "type", "wifi",
        "ifname", "wlan0",
        "con-name", HOTSPOT_CON_NAME,
        "autoconnect", "no",
        "ssid", ssid,
        "mode", "ap",
        "802-11-wireless.band", "bg",
        "ipv4.method", "shared",
        "ipv4.addresses", ip_address,
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, check=True)
        subprocess.run(["nmcli", "connection", "up", HOTSPOT_CON_NAME], check=True)
        log.info("Captive Access Point active: %s @ %s", ssid, ip_address)
        return True
    except Exception as e:
        log.warning("Could not start hotspot via NetworkManager: %s", e)
        return False


def stop_setup_hotspot():
    """Tears down the temporary setup hotspot."""
    try:
        subprocess.run(["nmcli", "connection", "down", HOTSPOT_CON_NAME], capture_output=True)
        subprocess.run(["nmcli", "connection", "delete", HOTSPOT_CON_NAME], capture_output=True)
        log.info("Setup hotspot deactivated.")
    except Exception:
        pass
