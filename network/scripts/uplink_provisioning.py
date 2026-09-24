#!/usr/bin/env python3
"""
GreenNode hub-uplink provisioning daemon.

Solves a different problem than pairing_watcher.py. pairing_watcher.py
answers "how does a sub-node (ESP32) get onto GreenNode's network?" — this
answers "how does GreenNode itself get onto the FARMER's network?", given
that wlan0 (the STA uplink radio) ships with no credentials at all and,
until it has some, cannot reach anything to be told any.

The fix is SoftAP + captive portal, the same first-contact pattern most
consumer IoT devices use (Chromecast, smart plugs, etc.): GreenNode hosts
a WiFi network of its own (wlan1_4 / "greennode-setup", a 5th BSS on the
already-AP USB radio — see config/hostapd/hostapd.conf), the farmer's
phone joins it, and a captive-portal page on GreenNode itself collects
the farm's real WiFi SSID/password and applies them to wlan0.

Two jobs:

1. Serves the actual setup flow on 0.0.0.0:SETUP_HTTP_PORT (reachable
   only from wlan1_4 — nftables enforces this, see
   scripts/nftables-rules.sh):
     GET  /                    the setup page (HTML + inline JS)
     GET  /api/status          {"connected": bool, "ssid": str|null}
     GET  /api/networks        nearby SSIDs seen by wlan0, for the form
     POST /api/provision       {"ssid": ..., "password": ...} -> applies it
   Plus a catch-all GET handler that answers the OS-specific captive-
   portal-detection probes (Apple/Android/Windows) with a redirect to
   `/`, so the phone auto-opens the setup page the moment it joins —
   this is what makes it feel like "connect to WiFi, get a login popup"
   rather than requiring the farmer to know to open a browser at all.

2. Runs one LOOPBACK-ONLY endpoint (127.0.0.1:CONTROL_PORT) so the edge
   app / admin panel can show real uplink status in its own UI without
   parsing wpa_cli output itself:
     GET /uplink/status        same shape as /api/status above

DELIBERATE DIFFERENCE FROM pairing_watcher.py's design: there is no
"pairing window" state machine here. Sub-node provisioning (wlan1_3)
needs one because its passphrase is fixed and shared across every unit
GreenNode ships — anyone who extracts it from one device could otherwise
provision fake sub-nodes onto any other farmer's hub, so an operator has
to explicitly open a window in the frontend first. wlan1_4's passphrase,
by contrast, is unique PER UNIT and printed on that unit's physical
label (see hostapd.conf's BSS4 comment) — reading the label already
requires having the physical device in hand, and that's the entire
access-control boundary this flow needs. So /api/provision is always
live to anyone already associated on wlan1_4; nothing further to gate.

This also means the same flow doubles as "reconfigure WiFi" for as long
as the farmer still has the unit and its label — no separate reset
button or admin trigger needed. greennode-setup stays broadcasting
permanently, the same way greennode-provision (wlan1_3) does.

Configuration is via environment variables, all with sane defaults —
mirrors pairing_watcher.py's convention. Meant to run as its own systemd
service (systemd/greennode-uplink-provisioning.service), independent of
the pairing watcher and everything else.
"""

import json
import logging
import os
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# --- Configuration (env-overridable) -----------------------------------

WLAN0_IFACE = os.environ.get("WLAN0_IFACE", "wlan0")
WPA_SUPPLICANT_CONF = os.environ.get(
    "WPA_SUPPLICANT_CONF", "/etc/wpa_supplicant/wpa_supplicant-wlan0.conf"
)
SETUP_HTTP_PORT = int(os.environ.get("SETUP_HTTP_PORT", "80"))
CONTROL_PORT = int(os.environ.get("CONTROL_PORT", "8092"))
SETUP_GATEWAY_IP = os.environ.get("SETUP_GATEWAY_IP", "10.0.14.1")
CONNECT_TIMEOUT_S = int(os.environ.get("CONNECT_TIMEOUT_S", "25"))
SCAN_TIMEOUT_S = int(os.environ.get("SCAN_TIMEOUT_S", "6"))
# New network gets a priority above this, so it's preferred over whatever
# is already saved (e.g. a previous farm's WiFi, from before the unit was
# moved) without deleting that old entry outright.
NEW_NETWORK_PRIORITY = int(os.environ.get("NEW_NETWORK_PRIORITY", "10"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("uplink-provisioning")


# --- wpa_cli helpers -------------------------------------------------------

def _wpa_cli(*args: str, timeout: float = 10.0) -> str:
    """Runs `wpa_cli -i $WLAN0_IFACE <args>`, returns stdout stripped.
    wpa_cli exits 0 even on logical failure (e.g. bad network id), so
    callers must check the returned text for "FAIL" themselves — this
    just centralizes the subprocess plumbing."""
    result = subprocess.run(
        ["wpa_cli", "-i", WLAN0_IFACE, *args],
        capture_output=True, text=True, timeout=timeout, check=False,
    )
    return result.stdout.strip()


def wlan0_status() -> dict:
    """Parses `wpa_cli status` key=value output into a dict."""
    out = _wpa_cli("status")
    status = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            status[k] = v
    return status


def is_connected() -> tuple[bool, str | None, str | None]:
    """(connected, ssid, ip) — connected means wpa_supplicant has
    completed its handshake AND the interface actually has an IPv4
    address, since wpa_state can read COMPLETED for a moment before DHCP
    finishes, or stay stale after a lease expires."""
    status = wlan0_status()
    wpa_ok = status.get("wpa_state") == "COMPLETED"
    ssid = status.get("ssid")
    ip = status.get("ip_address")
    return (wpa_ok and bool(ip)), (ssid if wpa_ok else None), (ip if wpa_ok else None)


def scan_networks() -> list[dict]:
    """Triggers a scan on wlan0 and returns nearby SSIDs, deduped
    (keeping the strongest signal per SSID), sorted strongest-first.
    wlan0 can scan while still trying to associate elsewhere — scanning
    doesn't require it to already be connected."""
    _wpa_cli("scan")
    time.sleep(SCAN_TIMEOUT_S)
    out = _wpa_cli("scan_results")

    best: dict[str, int] = {}
    for line in out.splitlines()[1:]:  # header: "bssid / frequency / signal level / flags / ssid"
        parts = line.split("\t")
        if len(parts) < 5:
            continue
        try:
            signal = int(parts[2])
        except ValueError:
            continue
        ssid = parts[4].strip()
        if not ssid:
            continue  # hidden network, nothing to show in the picker
        if ssid not in best or signal > best[ssid]:
            best[ssid] = signal

    networks = [{"ssid": s, "signal_dbm": sig} for s, sig in best.items()]
    networks.sort(key=lambda n: n["signal_dbm"], reverse=True)
    return networks


def apply_new_network(ssid: str, password: str) -> tuple[bool, str]:
    """Adds and switches to a new network, waits for it to actually come
    up, and rolls back to whatever was previously active on failure so a
    typo can't strand a unit that was already online. Returns
    (success, detail)."""
    prev_status = wlan0_status()
    prev_id = prev_status.get("id")  # currently active network id, if any

    new_id = _wpa_cli("add_network")
    if not new_id.isdigit():
        return False, f"add_network failed: {new_id!r}"

    ok = True
    ok &= "OK" in _wpa_cli("set_network", new_id, "ssid", f'"{ssid}"')
    if len(password) == 0:
        ok &= "OK" in _wpa_cli("set_network", new_id, "key_mgmt", "NONE")
    else:
        ok &= "OK" in _wpa_cli("set_network", new_id, "psk", f'"{password}"')
    ok &= "OK" in _wpa_cli("set_network", new_id, "priority", str(NEW_NETWORK_PRIORITY))
    if not ok:
        _wpa_cli("remove_network", new_id)
        return False, "failed to configure the new network entry"

    _wpa_cli("enable_network", new_id)
    _wpa_cli("select_network", new_id)  # forces an immediate switch attempt

    deadline = time.time() + CONNECT_TIMEOUT_S
    while time.time() < deadline:
        connected, live_ssid, _ip = is_connected()
        if connected and live_ssid == ssid:
            _wpa_cli("save_config")  # persist to WPA_SUPPLICANT_CONF now it's proven to work
            log.info("wlan0 connected to %r", ssid)
            return True, "connected"
        time.sleep(1)

    # Didn't come up in time — most likely a wrong password. Remove the
    # bad entry and, if something was working before, switch back to it
    # rather than leaving the hub stranded with no uplink at all.
    log.warning("Failed to connect to %r within %ds, rolling back", ssid, CONNECT_TIMEOUT_S)
    _wpa_cli("remove_network", new_id)
    if prev_id is not None:
        _wpa_cli("select_network", prev_id)
    return False, "could not connect — check the WiFi name and password"


# --- HTTP: setup portal (farmer's-phone-facing) ----------------------------

CAPTIVE_PROBE_PATHS = {
    "/generate_204", "/gen_204",                       # Android
    "/hotspot-detect.html", "/library/test/success.html",  # Apple
    "/connecttest.txt", "/ncsi.txt",                   # Windows
    "/canonical.html",                                  # Firefox
}

SETUP_PAGE_HTML = """<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GreenNode Setup</title>
<style>
  body { font-family: sans-serif; max-width: 420px; margin: 2em auto; padding: 0 1em; }
  h1 { font-size: 1.3em; }
  select, input, button { width: 100%; padding: 0.6em; margin: 0.4em 0; font-size: 1em; box-sizing: border-box; }
  button { background: #2e7d32; color: white; border: none; border-radius: 4px; }
  button:disabled { background: #9e9e9e; }
  #msg { margin-top: 1em; font-weight: bold; }
</style>
</head>
<body>
<h1>Connect GreenNode to your WiFi</h1>
<p id="statusline">Checking current connection...</p>
<form id="f">
  <label for="ssid">WiFi network</label>
  <select id="ssid"><option>Scanning...</option></select>
  <input type="text" id="ssid_manual" placeholder="Or type network name manually" style="display:none">
  <label for="pw">WiFi password</label>
  <input type="password" id="pw">
  <button type="submit" id="go">Connect</button>
</form>
<div id="msg"></div>
<script>
async function refreshStatus() {
  const r = await fetch('/api/status').then(r => r.json());
  document.getElementById('statusline').textContent = r.connected
    ? ('Currently connected to: ' + r.ssid)
    : 'Not connected to any WiFi network yet.';
}
async function loadNetworks() {
  const sel = document.getElementById('ssid');
  sel.innerHTML = '<option>Scanning...</option>';
  const nets = await fetch('/api/networks').then(r => r.json());
  sel.innerHTML = '';
  nets.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n.ssid;
    opt.textContent = n.ssid;
    sel.appendChild(opt);
  });
  const other = document.createElement('option');
  other.value = '__manual__';
  other.textContent = 'Other (type name)';
  sel.appendChild(other);
}
document.getElementById('ssid').addEventListener('change', (e) => {
  document.getElementById('ssid_manual').style.display =
    e.target.value === '__manual__' ? 'block' : 'none';
});
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const sel = document.getElementById('ssid');
  const ssid = sel.value === '__manual__'
    ? document.getElementById('ssid_manual').value
    : sel.value;
  const pw = document.getElementById('pw').value;
  const msg = document.getElementById('msg');
  const btn = document.getElementById('go');
  btn.disabled = true;
  msg.textContent = 'Connecting... this can take up to 25 seconds.';
  msg.style.color = 'black';
  try {
    const res = await fetch('/api/provision', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ssid, password: pw}),
    });
    const body = await res.json();
    if (res.ok) {
      msg.style.color = 'green';
      msg.textContent = 'Connected! You can close this page and disconnect your phone from greennode-setup.';
    } else {
      msg.style.color = 'red';
      msg.textContent = body.detail || 'Could not connect.';
    }
  } catch (err) {
    msg.style.color = 'red';
    msg.textContent = 'Request failed — check your phone is still on the greennode-setup network.';
  }
  btn.disabled = false;
  refreshStatus();
});
refreshStatus();
loadNetworks();
</script>
</body>
</html>"""


class SetupHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("setup-http: " + fmt, *args)

    def _json(self, code: int, payload: dict):
        body = json.dumps(payload).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _html(self, code: int, body_str: str):
        body = body_str.encode()
        self.send_response(code)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/":
            self._html(200, SETUP_PAGE_HTML)
        elif self.path == "/api/status":
            connected, ssid, _ip = is_connected()
            self._json(200, {"connected": connected, "ssid": ssid})
        elif self.path == "/api/networks":
            try:
                self._json(200, scan_networks())
            except Exception:
                log.exception("scan_networks failed")
                self._json(500, {"detail": "scan failed"})
        elif self.path in CAPTIVE_PROBE_PATHS:
            # Redirect the OS's captive-portal probe to our own page —
            # this is what makes phones auto-pop the "sign in to
            # network" prompt the instant they join greennode-setup.
            self.send_response(302)
            self.send_header("Location", f"http://{SETUP_GATEWAY_IP}/")
            self.end_headers()
        else:
            # Any other unrecognized path also redirects to the setup
            # page rather than 404ing — a farmer poking around shouldn't
            # be able to get "stuck" on a dead end.
            self.send_response(302)
            self.send_header("Location", f"http://{SETUP_GATEWAY_IP}/")
            self.end_headers()

    def do_POST(self):
        if self.path != "/api/provision":
            self.send_response(404)
            self.end_headers()
            return

        length = int(self.headers.get("Content-Length", 0))
        try:
            parsed = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json(400, {"detail": "malformed request"})
            return

        ssid = (parsed.get("ssid") or "").strip()
        password = parsed.get("password") or ""
        if not ssid:
            self._json(400, {"detail": "network name is required"})
            return
        if password and not (8 <= len(password) <= 63):
            self._json(400, {"detail": "WPA passwords must be 8-63 characters"})
            return

        try:
            ok, detail = apply_new_network(ssid, password)
        except Exception:
            log.exception("apply_new_network failed for ssid=%r", ssid)
            self._json(500, {"detail": "internal error, check greennode-uplink-provisioning logs"})
            return

        self._json(200 if ok else 502, {"detail": detail})


# --- HTTP: loopback-only status endpoint (edge app / admin panel) ---------

class ControlHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        log.info("control-http: " + fmt, *args)

    def do_GET(self):
        if self.client_address[0] not in ("127.0.0.1", "::1"):
            self.send_response(403)
            self.end_headers()
            return
        if self.path == "/uplink/status":
            connected, ssid, ip = is_connected()
            body = json.dumps({"connected": connected, "ssid": ssid, "ip": ip}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()


def main():
    setup_server = ThreadingHTTPServer(("0.0.0.0", SETUP_HTTP_PORT), SetupHandler)
    control_server = ThreadingHTTPServer(("127.0.0.1", CONTROL_PORT), ControlHandler)

    threading.Thread(target=setup_server.serve_forever, daemon=True).start()
    log.info(
        "Setup portal on 0.0.0.0:%d (nftables restricts this to wlan1_4)",
        SETUP_HTTP_PORT,
    )

    connected, ssid, _ip = is_connected()
    log.info(
        "wlan0 current state: %s",
        f"connected to {ssid}" if connected else "not connected",
    )

    log.info("Control endpoint on 127.0.0.1:%d", CONTROL_PORT)
    control_server.serve_forever()


if __name__ == "__main__":
    main()
