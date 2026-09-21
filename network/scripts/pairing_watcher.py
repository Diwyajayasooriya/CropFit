#!/usr/bin/env python3
"""
GreenNode pairing watcher.

Three jobs:

1. Listens directly to hostapd's control socket for the provisioning BSS
   (wlan1_3) and records AP-STA-CONNECTED events — this is how GreenNode
   finds out a device is trying to join, the moment it associates, with
   zero cooperation needed from the device's firmware beyond joining WiFi.

2. Finalizes provisioning ENTIRELY LOCALLY, no cloud round-trip required:
   allocates an IP in the target subnet, appends a row to
   registry/devices.csv, generates a Mosquitto user + scoped ACL entry,
   regenerates dnsmasq/tc config for the new device, and inserts a
   `connected_devices` row in the local edge SQLite DB. This matches the
   project's offline-first principle — pairing a device on the LAN must
   not require internet/cloud reachability. A best-effort, non-blocking
   sync notification is sent to the cloud backend afterward if
   BACKEND_FINALIZE_URL is set; its failure never blocks provisioning.

3. Runs two small HTTP endpoints (stdlib only, no framework dependency):

   - PUBLIC (0.0.0.0:PROVISION_PORT, reachable only from the provisioning
     subnet — nftables enforces this, see scripts/nftables-rules.sh):
       GET /provision
     An ESP32 hits this after joining greennode-provision. The watcher
     maps the request's source IP back to a MAC via dnsmasq's lease file,
     checks whether that MAC was seen associating during an OPEN pairing
     window, and if so finalizes locally and hands back real credentials.

   - LOOPBACK ONLY (127.0.0.1:CONTROL_PORT):
       POST /pairing/open   body: {"seconds": 120, "device_type": "sensor",
                                    "name": "esp32-soil-moisture-02"}
       POST /pairing/close
       GET  /pairing/status
     The main backend calls /pairing/open after the operator
     re-authenticates AND has already chosen the device type + a name in
     the frontend — simplification vs. asking after the MAC is seen:
     since only one device can be paired per window anyway, asking
     upfront removes a round trip with no real UX cost given the window
     is short. See DATA_PIPELINE.md if this trade-off needs revisiting.

Configuration is via environment variables, all with sane defaults — see
the CONFIG block below. Meant to run as its own systemd service
(systemd/greennode-pairing-watcher.service), independent of the shedding
daemon and of whatever framework the main backend uses.

BACKEND INTEGRATION POINT: BACKEND_FINALIZE_URL is now optional and
best-effort only — if set, a device-registered notification is POSTed
to it in a background thread purely for cloud-side sync, after local
provisioning has already succeeded. If unset, or if the call fails
(no internet, backend down), the device is still fully usable locally;
nothing here blocks on cloud reachability.
"""

import csv
import ipaddress
import json
import logging
import os
import secrets
import socket
import sqlite3
import subprocess
import threading
import time
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

# --- Configuration (env-overridable) -----------------------------------

HOSTAPD_CTRL_PATH = os.environ.get("HOSTAPD_CTRL_PATH", "/var/run/hostapd/wlan1_3")
PROVISION_PORT = int(os.environ.get("PROVISION_PORT", "8090"))
CONTROL_PORT = int(os.environ.get("CONTROL_PORT", "8091"))
DEFAULT_WINDOW_SECONDS = int(os.environ.get("DEFAULT_WINDOW_SECONDS", "120"))
DNSMASQ_LEASES = Path(os.environ.get("DNSMASQ_LEASES", "/var/lib/misc/dnsmasq.leases"))
BACKEND_FINALIZE_URL = os.environ.get("BACKEND_FINALIZE_URL", "")  # optional, best-effort only now

REPO_ROOT = Path(__file__).resolve().parent.parent
DEVICES_CSV = Path(os.environ.get("DEVICES_CSV", str(REPO_ROOT / "registry" / "devices.csv")))
GEN_DHCP_SCRIPT = REPO_ROOT / "scripts" / "generate-dhcp-hosts.sh"
GEN_TC_SCRIPT = REPO_ROOT / "scripts" / "tc-add-device-classes.sh"

EDGE_DB_PATH = os.environ.get("EDGE_DB_PATH", "/opt/greennode-edge/greennode.db")
MOSQUITTO_PASSWD_FILE = os.environ.get("MOSQUITTO_PASSWD_FILE", "/etc/mosquitto/passwd")
MOSQUITTO_ACL_FILE = os.environ.get("MOSQUITTO_ACL_FILE", "/etc/mosquitto/acl.d/greennode.acl")

# Must match the corresponding wpa_passphrase values in
# config/hostapd/hostapd.conf — kept here as env vars (set in the systemd
# unit) rather than parsed out of hostapd.conf, since it's the same kind
# of "two places, must agree" constraint PROVISION_PORT already has with
# nftables-rules.sh.
TARGET_SSID = {
    "sensor": os.environ.get("TARGET_SSID_SENSORS", "greennode-sensors"),
    "actuator": os.environ.get("TARGET_SSID_ACTUATORS", "greennode-actuators"),
}
TARGET_PASSPHRASE = {
    "sensor": os.environ.get("TARGET_PASSPHRASE_SENSORS", "CHANGE_ME_sensors_passphrase"),
    "actuator": os.environ.get("TARGET_PASSPHRASE_ACTUATORS", "CHANGE_ME_actuators_passphrase"),
}
MQTT_GATEWAY_IP = {
    "sensor": os.environ.get("MQTT_GATEWAY_IP_SENSORS", "10.0.10.1"),
    "actuator": os.environ.get("MQTT_GATEWAY_IP_ACTUATORS", "10.0.11.1"),
}
SUBNET = {
    "sensor": os.environ.get("SUBNET_SENSORS", "10.0.10.0/24"),
    "actuator": os.environ.get("SUBNET_ACTUATORS", "10.0.11.0/24"),
}
IFACE = {"sensor": "wlan1", "actuator": "wlan1_1"}
DEFAULT_TIER = {"sensor": "2", "actuator": "0"}
DEFAULT_RATE_CEIL = {"sensor": ("256", "2048"), "actuator": ("512", "4096")}

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("pairing-watcher")


# --- Shared pairing state ------------------------------------------------

class PairingState:
    """Everything shared between the hostapd listener thread and the HTTP
    handlers lives here, behind one lock — keep it simple, this daemon
    handles pairing one device at a time by design (matches the "press +,
    one device joins" UX), so contention is a non-issue."""

    def __init__(self):
        self.lock = threading.Lock()
        self.window_open_until = 0.0         # epoch seconds; 0 = closed
        self.seen_macs = {}                  # mac -> first_seen epoch, this window only
        self.claimed_macs = set()            # macs already handed off successfully
        self.device_type = "sensor"          # chosen by the operator when opening the window
        self.device_name = ""                # ditto — becomes the MQTT username / device_id

    def open_window(self, seconds: int, device_type: str, name: str):
        with self.lock:
            self.window_open_until = time.time() + seconds
            self.seen_macs.clear()
            self.claimed_macs.clear()
            self.device_type = device_type if device_type in ("sensor", "actuator") else "sensor"
            self.device_name = name
        log.info("Pairing window OPEN for %ds (type=%s name=%s)", seconds, self.device_type, name)

    def close_window(self):
        with self.lock:
            self.window_open_until = 0.0
        log.info("Pairing window CLOSED")

    def is_open(self) -> bool:
        with self.lock:
            return time.time() < self.window_open_until

    def record_association(self, mac: str):
        with self.lock:
            is_open = time.time() < self.window_open_until
            if is_open and mac not in self.seen_macs:
                self.seen_macs[mac] = time.time()
        if is_open:
            log.info("Device associated during open window: %s", mac)
        else:
            log.info("Device associated outside any window (ignored for pairing): %s", mac)

    def is_claimable(self, mac: str) -> bool:
        with self.lock:
            return (
                time.time() < self.window_open_until
                and mac in self.seen_macs
                and mac not in self.claimed_macs
            )

    def claim_intent(self, mac: str) -> tuple[str, str] | None:
        """Marks claimed and returns (device_type, name) atomically, so a
        retried /provision request from the same device can't finalize
        twice."""
        with self.lock:
            if (
                time.time() < self.window_open_until
                and mac in self.seen_macs
                and mac not in self.claimed_macs
            ):
                self.claimed_macs.add(mac)
                return (self.device_type, self.device_name)
            return None

    def status(self) -> dict:
        with self.lock:
            remaining = max(0, int(self.window_open_until - time.time()))
            return {
                "window_open": remaining > 0,
                "seconds_remaining": remaining,
                "device_type": self.device_type,
                "device_name": self.device_name,
                "seen_macs": list(self.seen_macs.keys()),
                "claimed_macs": list(self.claimed_macs),
            }


state = PairingState()


# --- hostapd control-socket listener -------------------------------------

def hostapd_listener():
    """Speaks hostapd's control-interface protocol directly: a Unix
    datagram socket. ATTACH subscribes us to unsolicited events, which
    arrive as lines like '<2>AP-STA-CONNECTED aa:bb:cc:dd:ee:ff'.
    Runs forever, reconnecting with backoff if hostapd restarts."""
    local_path = f"/tmp/pairing_watcher_{os.getpid()}.sock"

    while True:
        sock = None
        try:
            sock = socket.socket(socket.AF_UNIX, socket.SOCK_DGRAM)
            try:
                os.unlink(local_path)
            except FileNotFoundError:
                pass
            sock.bind(local_path)
            sock.connect(HOSTAPD_CTRL_PATH)
            sock.send(b"ATTACH")
            reply = sock.recv(4096)
            if b"OK" not in reply:
                raise RuntimeError(f"hostapd ATTACH failed: {reply!r}")

            log.info("Attached to hostapd control socket at %s", HOSTAPD_CTRL_PATH)

            while True:
                data = sock.recv(4096).decode(errors="replace")
                if "AP-STA-CONNECTED" in data:
                    mac = data.strip().split()[-1]
                    state.record_association(mac)
                # AP-STA-DISCONNECTED is available the same way if you
                # later want to expire seen_macs entries on disconnect —
                # not needed for the pairing flow itself, since a window
                # closing already invalidates stale entries.

        except (OSError, RuntimeError) as e:
            log.warning("hostapd control socket error (%s) — retrying in 5s", e)
            time.sleep(5)
        finally:
            if sock:
                sock.close()
            try:
                os.unlink(local_path)
            except FileNotFoundError:
                pass


# --- dnsmasq lease lookup (source IP -> MAC) ------------------------------

def mac_for_ip(ip: str) -> str | None:
    """Reads dnsmasq's lease file to map a provisioning-subnet IP back to
    the MAC that holds it. Format per line:
    <expiry_epoch> <mac> <ip> <hostname-or-*> <client-id-or-*>"""
    try:
        with open(DNSMASQ_LEASES) as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 3 and parts[2] == ip:
                    return parts[1].lower()
    except FileNotFoundError:
        log.error("dnsmasq leases file not found at %s", DNSMASQ_LEASES)
    return None


# --- local finalize: IP allocation, registry, MQTT creds, edge DB --------

def allocate_ip(device_type: str) -> str:
    """Next free IP in the target subnet, based on what's already in
    devices.csv. .10-.200 range matches the dnsmasq dhcp-range for both
    subnets — keep in sync if that range is ever changed."""
    subnet = ipaddress.ip_network(SUBNET[device_type])
    used = set()
    if DEVICES_CSV.exists():
        with open(DEVICES_CSV) as f:
            for row in csv.reader(f):
                if row and not row[0].startswith("#") and row[0] != "mac" and len(row) > 1:
                    used.add(row[1])
    for host in subnet.hosts():
        candidate = str(host)
        last_octet = int(candidate.split(".")[-1])
        if 10 <= last_octet <= 200 and candidate not in used:
            return candidate
    raise RuntimeError(f"No free IP left in {subnet}")


def append_to_registry(mac: str, ip: str, device_type: str, name: str):
    iface = IFACE[device_type]
    tier = DEFAULT_TIER[device_type]
    rate_kbit, ceil_kbit = DEFAULT_RATE_CEIL[device_type]
    with open(DEVICES_CSV, "a", newline="") as f:
        csv.writer(f).writerow([mac, ip, iface, tier, rate_kbit, ceil_kbit, name])
    log.info("Appended to registry: %s (%s, %s) on %s", name, mac, ip, iface)


def generate_mqtt_credentials(device_id: str, device_type: str) -> str:
    """Adds/updates one Mosquitto user + appends its ACL entry, then
    reloads the broker. Uses subprocess for mosquitto_passwd rather than
    touching the password file's hash format directly."""
    password = secrets.token_urlsafe(18)

    subprocess.run(
        ["mosquitto_passwd", "-b", MOSQUITTO_PASSWD_FILE, device_id, password],
        check=True,
    )

    with open(MOSQUITTO_ACL_FILE, "a") as f:
        f.write(f"\nuser {device_id}\n")
        if device_type == "actuator":
            f.write(f"topic write greennode/{device_id}/status\n")
            f.write(f"topic read greennode/{device_id}/cmd\n")
        else:
            f.write(f"topic write greennode/{device_id}/data\n")
            f.write(f"topic write greennode/{device_id}/status\n")

    subprocess.run(["systemctl", "reload", "mosquitto"], check=True)
    log.info("Generated MQTT credentials for %s and reloaded mosquitto", device_id)
    return password


def regenerate_network_configs():
    """Re-applies the same dnsmasq reservation + HTB class generation a
    human would run by hand after editing devices.csv — see
    HARDWARE_SETUP.md Part 4. Runs both scripts fresh so the new device's
    reservation/class exist without restarting anything that would
    disrupt already-connected devices (dnsmasq restart is brief; existing
    DHCP leases aren't lost)."""
    subprocess.run(["bash", str(GEN_DHCP_SCRIPT)], check=True)
    subprocess.run(["systemctl", "restart", "dnsmasq"], check=True)
    subprocess.run(["bash", str(GEN_TC_SCRIPT)], check=True)
    log.info("Regenerated dnsmasq reservations and HTB classes")


def insert_connected_device(device_id: str, device_type: str, mac: str):
    """Direct sqlite3, not SQLAlchemy — pairing_watcher.py stays
    stdlib-only by design (see module docstring), so it can run
    independently of whatever ORM/framework the main edge app uses.
    Column shape matches edge/models.py's ConnectedDevice — reconcile
    both against the real schema together if either changes."""
    conn = sqlite3.connect(EDGE_DB_PATH)
    try:
        conn.execute(
            "INSERT INTO connected_devices (device_id, device_type, name, revoked, registered_ts) "
            "VALUES (?, ?, ?, 0, ?)",
            (device_id, device_type, device_id, int(time.time())),
        )
        conn.commit()
    finally:
        conn.close()
    log.info("Inserted connected_devices row for %s", device_id)


def sync_to_cloud_async(device_id: str, device_type: str, mac: str, ip: str):
    """Best-effort only — runs in a background thread, never blocks or
    fails provisioning. If BACKEND_FINALIZE_URL is unset or unreachable,
    the device is already fully functional locally; this is purely for
    the cloud-side copy of the device registry to catch up whenever
    connectivity allows."""
    if not BACKEND_FINALIZE_URL:
        return

    def _post():
        payload = json.dumps({
            "device_id": device_id, "device_type": device_type,
            "mac": mac, "ip": ip,
        }).encode()
        req = urllib.request.Request(
            BACKEND_FINALIZE_URL, data=payload,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        try:
            urllib.request.urlopen(req, timeout=5)
            log.info("Cloud sync notified for %s", device_id)
        except Exception as e:
            log.warning("Cloud sync notification failed for %s (device still fully "
                        "functional locally): %s", device_id, e)

    threading.Thread(target=_post, daemon=True).start()


def finalize_locally(mac: str, ip: str) -> dict | None:
    """The whole local provisioning sequence. Returns the credential
    payload to hand back to the ESP32, or None if this MAC wasn't
    claimable (window closed / already claimed / never seen)."""
    intent = state.claim_intent(mac)
    if intent is None:
        return None
    device_type, device_id = intent

    target_ip = allocate_ip(device_type)
    append_to_registry(mac, target_ip, device_type, device_id)
    mqtt_password = generate_mqtt_credentials(device_id, device_type)
    regenerate_network_configs()
    insert_connected_device(device_id, device_type, mac)
    sync_to_cloud_async(device_id, device_type, mac, target_ip)

    return {
        "device_id": device_id,
        "target_ssid": TARGET_SSID[device_type],
        "target_passphrase": TARGET_PASSPHRASE[device_type],
        "mqtt_host": MQTT_GATEWAY_IP[device_type],
        "mqtt_port": 1883,
        "mqtt_user": device_id,
        "mqtt_pass": mqtt_password,
    }


# --- HTTP: public provisioning endpoint (ESP32-facing) --------------------

class ProvisionHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("provision-http: " + fmt, *args)

    def do_GET(self):
        if self.path != "/provision":
            self.send_response(404)
            self.end_headers()
            return

        client_ip = self.client_address[0]
        mac = mac_for_ip(client_ip)

        if not mac:
            log.warning("No lease found for %s — device not on provisioning subnet?", client_ip)
            self.send_response(404)
            self.end_headers()
            self.wfile.write(b"unknown device")
            return

        if not state.is_claimable(mac):
            log.info("Rejected /provision from %s (%s): not seen in an open window", mac, client_ip)
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"no open pairing window for this device")
            return

        try:
            creds = finalize_locally(mac, client_ip)
        except Exception:
            log.exception("Local finalize failed for %s (%s)", mac, client_ip)
            self.send_response(500)
            self.end_headers()
            self.wfile.write(b"provisioning failed, check greennode-pairing-watcher logs")
            return

        if creds is None:
            self.send_response(403)
            self.end_headers()
            self.wfile.write(b"no open pairing window for this device")
            return

        body = json.dumps(creds).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
        log.info("Provisioned device %s (%s) successfully", mac, client_ip)


# --- HTTP: loopback-only control endpoint (main backend-facing) -----------

class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("control-http: " + fmt, *args)

    def _reject_non_loopback(self) -> bool:
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self.send_response(403)
            self.end_headers()
            return True
        return False

    def do_POST(self):
        if self._reject_non_loopback():
            return

        if self.path == "/pairing/open":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length) if length else b"{}"
            try:
                parsed = json.loads(body)
            except json.JSONDecodeError:
                parsed = {}
            seconds = int(parsed.get("seconds", DEFAULT_WINDOW_SECONDS))
            device_type = parsed.get("device_type", "sensor")
            name = parsed.get("name", "")
            if not name:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(b'{"error": "name is required"}')
                return
            state.open_window(seconds, device_type, name)
            self.send_response(200)
            self.end_headers()
        elif self.path == "/pairing/close":
            state.close_window()
            self.send_response(200)
            self.end_headers()
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self._reject_non_loopback():
            return
        if self.path == "/pairing/status":
            body = json.dumps(state.status()).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def main():
    threading.Thread(target=hostapd_listener, daemon=True).start()

    provision_server = ThreadingHTTPServer(("0.0.0.0", PROVISION_PORT), ProvisionHandler)
    control_server = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), ControlHandler)

    threading.Thread(target=provision_server.serve_forever, daemon=True).start()
    log.info("Public provisioning endpoint on 0.0.0.0:%d (nftables restricts this to wlan1_3)", PROVISION_PORT)

    log.info("Control endpoint on 127.0.0.1:%d", CONTROL_PORT)
    control_server.serve_forever()


if __name__ == "__main__":
    main()
