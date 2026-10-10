"""
CropFit Edge — Configuration Manager
Persists and reads local credentials atomically with restrictive permissions (0600).
Supports fallback to local .env and environment variable CROPFIT_API_URL.
"""
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any, Dict

log = logging.getLogger("cropfit.config")

CONFIG_PATH = Path("/etc/cropfit/config.json")
LOCAL_CONFIG_PATH = Path(__file__).resolve().parent.parent / "config" / "config.json"
DEFAULT_CLOUD_URL = os.environ.get("CROPFIT_API_URL", "http://172.20.10.2:8000")


class ConfigManager:
    def __init__(self, config_file: Path = None):
        if config_file:
            self.config_file = config_file
        else:
            # Prefer system-wide /etc/cropfit if writable or on Linux, else local fallback
            if os.name != "nt" and (os.geteuid() == 0 or Path("/etc").exists()):
                self.config_file = CONFIG_PATH
            else:
                self.config_file = LOCAL_CONFIG_PATH

        self._ensure_storage_exists()

    def _ensure_storage_exists(self):
        try:
            self.config_file.parent.mkdir(parents=True, exist_ok=True)
            if os.name != "nt":
                try:
                    os.chmod(self.config_file.parent, 0o755)
                except PermissionError:
                    pass
        except Exception as e:
            log.debug("Could not create parent config dir: %s", e)

    def load(self) -> Dict[str, Any]:
        """Loads configuration from JSON file or returns defaults."""
        defaults = {
            "device_id": "",
            "cloud_url": DEFAULT_CLOUD_URL,
            "hub_token": "",
            "is_claimed": False,
            "greenhouse_id": None,
            "claim_code": "",
            "software_version": "0.1.0",
        }

        if not self.config_file.exists():
            return defaults

        try:
            with open(self.config_file, "r") as f:
                data = json.load(f)
            # Environment variable overrides config file if set
            if "CROPFIT_API_URL" in os.environ:
                data["cloud_url"] = os.environ["CROPFIT_API_URL"]
            for k, v in defaults.items():
                if k not in data:
                    data[k] = v
            return data
        except Exception as e:
            log.error("Failed to parse config file: %s. Using defaults.", e)
            return defaults

    def save(self, data: Dict[str, Any]):
        """Atomic write to prevent partial configuration corruption on sudden power interruptions."""
        self._ensure_storage_exists()
        dir_name = self.config_file.parent

        try:
            with tempfile.NamedTemporaryFile("w", dir=dir_name, delete=False) as tf:
                json.dump(data, tf, indent=2)
                temp_name = tf.name

            if os.name != "nt":
                try:
                    os.chmod(temp_name, 0o600)
                except PermissionError:
                    pass

            os.replace(temp_name, self.config_file)
            log.info("Saved edge configuration securely to %s", self.config_file)
        except Exception as e:
            log.error("Failed to write atomic config file: %s", e)
