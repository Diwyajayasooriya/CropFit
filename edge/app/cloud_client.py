"""
CropFit Edge — Cloud Client
Handles HTTP REST interactions with Django backend:
- Bootstrap announcement
- Claim polling & one-time token exchange
- Heartbeat reporting
- Config down-sync
"""
import logging
import time
from typing import Any, Dict, Optional
import httpx

log = logging.getLogger("cropfit.cloud")


class CloudClient:
    def __init__(self, base_url: str, device_id: str, hub_token: str = ""):
        self.base_url = base_url.rstrip("/")
        self.device_id = device_id
        self.hub_token = hub_token
        self.timeout = 10.0

    def _headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.hub_token:
            headers["Authorization"] = f"Bearer {self.hub_token}"
        return headers

    def bootstrap(self, claim_code: str = "", ip_address: str = "") -> Optional[Dict[str, Any]]:
        """Announces presence to /api/v1/nodes/bootstrap/"""
        url = f"{self.base_url}/api/v1/nodes/bootstrap/"
        payload = {
            "device_id": self.device_id,
            "claim_code": claim_code,
            "software_version": "0.1.0",
            "hardware": "Raspberry Pi 4B",
            "ip_address": ip_address,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if res.status_code in (200, 201):
                    return res.json()
                log.warning("Bootstrap returned status %d: %s", res.status_code, res.text[:100])
        except Exception as e:
            log.warning("Bootstrap connection failed: %s", e)
        return None

    def poll_claim(self) -> Optional[Dict[str, Any]]:
        """Queries /api/v1/nodes/poll-claim/?device_id=XXXX"""
        url = f"{self.base_url}/api/v1/nodes/poll-claim/?device_id={self.device_id}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers={"Content-Type": "application/json"})
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            log.debug("Poll claim error: %s", e)
        return None

    def exchange_token(self, exchange_token: str) -> Optional[str]:
        """Trades one-time claim token for permanent hub_token via /api/v1/nodes/exchange-token/"""
        url = f"{self.base_url}/api/v1/nodes/exchange-token/"
        payload = {
            "device_id": self.device_id,
            "exchange_token": exchange_token,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                if res.status_code == 200:
                    data = res.json()
                    return data.get("hub_token")
                log.warning("Token exchange failed: %d %s", res.status_code, res.text[:100])
        except Exception as e:
            log.error("Exception during token exchange: %s", e)
        return None

    def send_heartbeat(self, uptime_seconds: int = 0, ip_address: str = "") -> bool:
        """Sends periodic heartbeat to /api/v1/nodes/heartbeat/"""
        if not self.hub_token:
            return False

        url = f"{self.base_url}/api/v1/nodes/heartbeat/"
        payload = {
            "device_id": self.device_id,
            "software_version": "0.1.0",
            "ip_address": ip_address,
            "uptime_seconds": uptime_seconds,
        }
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.post(url, json=payload, headers=self._headers())
                return res.status_code == 200
        except Exception as e:
            log.debug("Heartbeat failed: %s", e)
            return False

    def fetch_config(self) -> Optional[Dict[str, Any]]:
        """Fetches active sensor and actuator configuration via /api/v1/nodes/config/"""
        if not self.hub_token:
            return None

        url = f"{self.base_url}/api/v1/nodes/config/?node_id={self.device_id}"
        try:
            with httpx.Client(timeout=self.timeout) as client:
                res = client.get(url, headers=self._headers())
                if res.status_code == 200:
                    return res.json()
        except Exception as e:
            log.warning("Config fetch error: %s", e)
        return None
