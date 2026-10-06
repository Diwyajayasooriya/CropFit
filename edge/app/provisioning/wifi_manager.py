"""
CropFit Edge — Wi-Fi Subsystem Manager (NetworkManager nmcli safe wrapper)
"""
import logging
import socket
import subprocess
from typing import Dict, List, Optional
import httpx

log = logging.getLogger("cropfit.wifi")


def get_local_ip() -> str:
    """Returns local IP address of the active network interface."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0.5)
        # Connect to a dummy address to resolve primary interface IP
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def has_active_internet(test_host: str = "1.1.1.1") -> bool:
    """Verifies outbound internet route using quick ICMP ping."""
    cmd = ["ping", "-c", "1", "-W", "2", test_host]
    try:
        res = subprocess.run(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return res.returncode == 0
    except Exception:
        return False


def is_cloud_reachable(cloud_url: str, timeout: float = 3.0) -> bool:
    """Checks if the configured CropFit cloud backend is reachable."""
    try:
        url = cloud_url.rstrip("/") + "/api/v1/nodes/bootstrap/"
        # Simple HEAD or GET probe to see if host responds
        with httpx.Client(timeout=timeout) as client:
            res = client.get(cloud_url.rstrip("/") + "/")
            return res.status_code < 500
    except Exception:
        return False


def is_wifi_connected() -> bool:
    """Checks whether wlan0 has an active IP and connected state."""
    cmd = ["nmcli", "-t", "-f", "DEVICE,TYPE,STATE", "device"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        for line in res.stdout.strip().split("\n"):
            parts = line.split(":")
            if len(parts) >= 3 and parts[1] == "wifi" and parts[2] == "connected":
                return True
    except Exception as e:
        log.debug("Could not query nmcli device state: %s", e)
    return False


def scan_wifi_networks() -> List[Dict[str, str]]:
    """Scans and lists visible SSIDs without shell interpolation."""
    cmd = ["nmcli", "-t", "-f", "SSID,SIGNAL,SECURITY", "device", "wifi", "list", "--rescan", "yes"]
    try:
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, timeout=12)
        networks = []
        seen = set()
        for line in res.stdout.strip().split("\n"):
            if not line:
                continue
            parts = line.split(":")
            ssid = parts[0].strip()
            if ssid and ssid not in seen and not ssid.startswith("CropFit-Hub"):
                seen.add(ssid)
                signal = parts[1] if len(parts) > 1 else "0"
                security = parts[2] if len(parts) > 2 else "Open"
                networks.append({"ssid": ssid, "signal": signal, "security": security})
        return networks
    except Exception as e:
        log.warning("Wi-Fi scan failed: %s", e)
        return []


def connect_to_wifi(ssid: str, password: str = "") -> bool:
    """Connects to target Wi-Fi network using safe parameter lists."""
    if password:
        cmd = ["nmcli", "device", "wifi", "connect", ssid, "password", password]
    else:
        cmd = ["nmcli", "device", "wifi", "connect", ssid]

    try:
        log.info("Attempting connection to SSID: %s", ssid)
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if res.returncode == 0:
            log.info("Successfully joined Wi-Fi: %s", ssid)
            return True
        log.warning("nmcli connection failed: %s", res.stderr)
        return False
    except Exception as e:
        log.error("Exception during Wi-Fi connect: %s", e)
        return False

