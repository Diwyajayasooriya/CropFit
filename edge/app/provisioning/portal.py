"""
CropFit Edge — Local Captive Setup Portal
FastAPI application serving local Wi-Fi provisioning UI and JSON API on port 80 / 8080.
"""
import logging
from typing import Optional
from fastapi import FastAPI, Form, Body
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from app.provisioning.wifi_manager import scan_wifi_networks, connect_to_wifi, is_wifi_connected
from app.provisioning.hotspot import stop_setup_hotspot

log = logging.getLogger("cropfit.portal")
app = FastAPI(title="CropFit Setup Portal")
device_context = {"device_id": "GN-HUB-XXXX", "last_error": None}


class ConnectRequest(BaseModel):
    ssid: str
    password: Optional[str] = ""


def set_portal_device_id(dev_id: str):
    device_context["device_id"] = dev_id


# ==========================================
# REST API Endpoints (Phase 5)
# ==========================================
@app.get("/api/networks")
def api_networks():
    """Scans and returns nearby Wi-Fi networks in JSON format."""
    networks = scan_wifi_networks()
    return networks


@app.get("/api/status")
def api_status():
    """Returns the current connection status of the edge hub."""
    connected = is_wifi_connected()
    return {
        "device_id": device_context["device_id"],
        "wifi_connected": connected,
        "last_error": device_context.get("last_error")
    }


@app.post("/api/connect")
def api_connect(payload: ConnectRequest):
    """Programmatically triggers Wi-Fi connection."""
    if not payload.ssid:
        return JSONResponse(status_code=400, content={"status": "error", "message": "SSID is required"})

    success = connect_to_wifi(payload.ssid, payload.password or "")
    if success:
        device_context["last_error"] = None
        stop_setup_hotspot()
        return {"status": "success", "message": f"Connected to {payload.ssid}"}
    else:
        device_context["last_error"] = "Failed to connect to network. Check password."
        return JSONResponse(status_code=400, content={"status": "failed", "message": "Connection failed"})


# ==========================================
# HTML Views for Mobile Phone Browser
# ==========================================
@app.get("/", response_class=HTMLResponse)
def index():
    networks = scan_wifi_networks()
    options = "".join([f'<option value="{n["ssid"]}">{n["ssid"]} ({n["signal"]}% signal)</option>' for n in networks])
    if not options:
        options = '<option value="">No networks found (type SSID below)</option>'

    html = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
      <title>CropFit Hub Setup</title>
      <style>
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; padding: 16px; }}
        .card {{ background: #1e293b; border: 1px solid #334155; border-radius: 24px; box-shadow: 0 20px 35px -10px rgba(0,0,0,0.5); max-width: 420px; width: 100%; padding: 32px; }}
        .badge {{ display: inline-flex; align-items: center; gap: 6px; background: rgba(16,185,129,0.15); color: #34d399; padding: 4px 12px; border-radius: 9999px; font-size: 11px; font-weight: 700; border: 1px solid rgba(16,185,129,0.3); text-transform: uppercase; letter-spacing: 0.5px; }}
        .dot {{ width: 6px; height: 6px; background: #34d399; border-radius: 50%; }}
        h1 {{ font-size: 22px; font-weight: 800; margin: 16px 0 6px 0; color: #ffffff; }}
        p {{ font-size: 13px; color: #94a3b8; margin-bottom: 24px; line-height: 1.5; }}
        label {{ display: block; font-size: 11px; font-weight: 700; text-transform: uppercase; color: #cbd5e1; margin-bottom: 8px; letter-spacing: 0.5px; }}
        select, input {{ width: 100%; background: #0f172a; color: #f8fafc; border: 1px solid #475569; border-radius: 12px; padding: 12px 14px; font-size: 14px; margin-bottom: 18px; outline: none; transition: border-color 0.2s; }}
        select:focus, input:focus {{ border-color: #10b981; }}
        button {{ width: 100%; background: #10b981; color: #022c22; border: none; padding: 14px; border-radius: 12px; font-size: 15px; font-weight: 800; cursor: pointer; transition: all 0.2s; }}
        button:hover {{ background: #34d399; }}
        .divider {{ display: flex; align-items: center; text-align: center; color: #64748b; font-size: 11px; margin: 8px 0 16px 0; }}
        .divider::before, .divider::after {{ content: ''; flex: 1; border-bottom: 1px solid #334155; }}
        .divider:not(:empty)::before {{ margin-right: .5em; }}
        .divider:not(:empty)::after {{ margin-left: .5em; }}
      </style>
    </head>
    <body>
      <div class="card">
        <span class="badge"><span class="dot"></span> CropFit Edge Hub</span>
        <h1>Connect Hub to Wi-Fi</h1>
        <p>Hub ID: <strong style="color:#f8fafc;">{device_context["device_id"]}</strong><br>Select your greenhouse network to connect this hub to the cloud.</p>

        <form action="/connect" method="post">
          <label>Greenhouse Wi-Fi Network</label>
          <select name="ssid" id="ssid-select" required>
            {options}
          </select>

          <div class="divider">OR</div>

          <label>Custom / Hidden SSID</label>
          <input type="text" name="custom_ssid" placeholder="Network Name (if not listed)">

          <label>Wi-Fi Password</label>
          <input type="password" name="password" placeholder="••••••••••••">

          <button type="submit">Join Network & Pair Hub</button>
        </form>
      </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html)


@app.post("/connect", response_class=HTMLResponse)
def handle_connect(ssid: str = Form(...), custom_ssid: str = Form(None), password: str = Form(None)):
    target_ssid = custom_ssid.strip() if custom_ssid and custom_ssid.strip() else ssid
    success = connect_to_wifi(target_ssid, password or "")

    if success:
        device_context["last_error"] = None
        stop_setup_hotspot()
        return HTMLResponse(content="""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Connected</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 16px; text-align: center; }
            .card { background: #1e293b; border: 1px solid #065f46; border-radius: 24px; max-width: 400px; width: 100%; padding: 36px; }
            .icon { font-size: 40px; margin-bottom: 16px; color: #34d399; }
            h2 { font-size: 22px; color: #34d399; margin-bottom: 10px; font-weight: 800; }
            p { font-size: 14px; color: #94a3b8; line-height: 1.6; }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="icon">✓</div>
            <h2>Wi-Fi Connected!</h2>
            <p>Your CropFit Hub has joined the network and is contacting the cloud.</p>
            <p style="margin-top: 16px; color: #cbd5e1; font-weight: 600;">Please return to the CropFit Web Dashboard to complete pairing.</p>
          </div>
        </body>
        </html>
        """)
    else:
        device_context["last_error"] = "Wi-Fi connection failed"
        return HTMLResponse(status_code=400, content="""
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Connection Failed</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; justify-content: center; align-items: center; min-height: 100vh; margin: 0; padding: 16px; text-align: center; }
            .card { background: #1e293b; border: 1px solid #7f1d1d; border-radius: 24px; max-width: 400px; width: 100%; padding: 36px; }
            h2 { font-size: 20px; color: #f87171; margin-bottom: 10px; font-weight: 800; }
            p { font-size: 14px; color: #94a3b8; margin-bottom: 24px; }
            a { display: inline-block; background: #334155; color: white; padding: 12px 24px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 13px; }
            a:hover { background: #475569; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>Connection Failed</h2>
            <p>Could not join the Wi-Fi network. Please verify your password and try again.</p>
            <a href="/">← Try Again</a>
          </div>
        </body>
        </html>
        """)

