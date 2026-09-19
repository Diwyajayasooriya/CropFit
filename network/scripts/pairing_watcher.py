#!/usr/bin/env python3
"""
GreenNode pairing watcher.

Two jobs:

1. Listens directly to hostapd's control socket for the provisioning BSS
   (wlan1_3) and records AP-STA-CONNECTED events — this is how GreenNode
   finds out a device is trying to join, the moment it associates, with
   zero cooperation needed from the device's firmware beyond joining WiFi.

2. Runs two small HTTP endpoints (stdlib only, no framework dependency):

   - PUBLIC (0.0.0.0:PROVISION_PORT, reachable only from the provisioning
     subnet — nftables enforces this, see scripts/nftables-rules.sh):
       GET /provision
     An ESP32 hits this after joining greennode-provision. The watcher
     maps the request's source IP back to a MAC via dnsmasq's lease file,
     checks whether that MAC was seen associating during an OPEN pairing
     window, and if so hands off to the main backend to finalize
     registration and get back real credentials.

   - LOOPBACK ONLY (127.0.0.1:CONTROL_PORT):
       POST /pairing/open    body: {"seconds": 120}   -- open a window
       POST /pairing/close                            -- close it early
       GET  /pairing/status                           -- window state +
                                                          devices seen
     The main backend calls these after the operator re-authenticates
     in the frontend (see README.md Part 3 for the full sequence).

Configuration is via environment variables, all with sane defaults — see
the CONFIG block below. Meant to run as its own systemd service
(systemd/greennode-pairing-watcher.service), independent of the shedding
daemon and of whatever framework the main backend uses.

BACKEND INTEGRATION POINT: if BACKEND_FINALIZE_URL is unset, this runs in
"stub mode" — pending devices are written to registry/pending-devices.txt
for manual/visual confirmation instead of being auto-registered. This is
deliberately usable on its own before the real backend's finalize route
exists, so the pairing/detection half of the system can be tested
independently. Set BACKEND_FINALIZE_URL once that route is built.
"""

import json
import logging
import os
import socket
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
BACKEND_FINALIZE_URL = os.environ.get("BACKEND_FINALIZE_URL", "")  # e.g. http://127.0.0.1:8000/internal/provision/finalize
PENDING_FILE = Path(__file__).resolve().parent.parent / "registry" / "pending-devices.txt"

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

    def open_window(self, seconds: int):
        with self.lock:
            self.window_open_until = time.time() + seconds
            self.seen_macs.clear()
            self.claimed_macs.clear()
        log.info("Pairing window OPEN for %ds", seconds)

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

    def mark_claimed(self, mac: str):
        with self.lock:
            self.claimed_macs.add(mac)

    def status(self) -> dict:
        with self.lock:
            remaining = max(0, int(self.window_open_until - time.time()))
            return {
                "window_open": remaining > 0,
                "seconds_remaining": remaining,
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


# --- backend handoff -------------------------------------------------------

def finalize_with_backend(mac: str, ip: str) -> dict | None:
    """Calls the main backend's internal finalize route to actually create
    the device record and get back real credentials. Returns None (stub
    mode) if BACKEND_FINALIZE_URL isn't configured — the device is written
    to pending-devices.txt for manual handling instead."""
    if not BACKEND_FINALIZE_URL:
        PENDING_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(PENDING_FILE, "a") as f:
            f.write(f"{int(time.time())},{mac},{ip}\n")
        log.info("STUB MODE: wrote pending device %s (%s) to %s — "
                  "set BACKEND_FINALIZE_URL to auto-finalize instead", mac, ip, PENDING_FILE)
        return None

    payload = json.dumps({"mac": mac, "ip": ip}).encode()
    req = urllib.request.Request(
        BACKEND_FINALIZE_URL, data=payload,
        headers={"Content-Type": "application/json"}, method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception as e:
        log.error("Backend finalize call failed for %s: %s", mac, e)
        return None


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

        creds = finalize_with_backend(mac, client_ip)
        if creds is None:
            self.send_response(202)  # accepted, pending manual handling
            self.end_headers()
            self.wfile.write(b"pending operator confirmation")
            return

        state.mark_claimed(mac)
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
                seconds = json.loads(body).get("seconds", DEFAULT_WINDOW_SECONDS)
            except json.JSONDecodeError:
                seconds = DEFAULT_WINDOW_SECONDS
            state.open_window(int(seconds))
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
