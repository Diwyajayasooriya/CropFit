"""
CropFit Edge — State Machine Controller
Manages all edge lifecycle states, transitions, fallback recovery, and cloud synchronization.
"""
from enum import Enum
import logging
import os
import threading
import time
from typing import Optional

from app.config_manager import ConfigManager
from app.device_identity import derive_device_id
from app.cloud_client import CloudClient
from app.provisioning.wifi_manager import (
    has_active_internet,
    is_cloud_reachable,
    is_wifi_connected,
    get_local_ip,
    saved_wifi_profiles,
    reconnect_saved_wifi,
)
from app.provisioning.hotspot import start_setup_hotspot, stop_setup_hotspot
from app.provisioning.portal import app as portal_app, set_portal_device_id

log = logging.getLogger("cropfit.fsm")


class EdgeState(str, Enum):
    BOOT = "BOOT"
    CHECK_NETWORK = "CHECK_NETWORK"
    PROVISIONING = "PROVISIONING"
    BOOTSTRAP = "BOOTSTRAP"
    WAIT_FOR_CLAIM = "WAIT_FOR_CLAIM"
    EXCHANGE_CREDENTIAL = "EXCHANGE_CREDENTIAL"
    FETCH_CONFIG = "FETCH_CONFIG"
    RUNNING = "RUNNING"
    ERROR_RECOVERY = "ERROR_RECOVERY"


class EdgeStateMachine:
    def __init__(self, config_mgr: Optional[ConfigManager] = None, setup_wifi: bool = False):
        self.config_mgr = config_mgr or ConfigManager()
        self.config = self.config_mgr.load()
        self.state = EdgeState.BOOT
        self.start_time = time.time()
        self.portal_server_started = False
        self.network_check_start = 0.0
        self.consecutive_cloud_errors = 0
        self.setup_wifi = setup_wifi
        self.wifi_retry_index = 0

    def transition_to(self, new_state: EdgeState, reason: str = ""):
        log.info(
            "FSM Transition: %s ──► %s %s",
            self.state.value,
            new_state.value,
            f"({reason})" if reason else "",
        )
        self.state = new_state

    def start_portal_server(self):
        """Runs the FastAPI captive portal on port 80 (or 8080) in a background thread."""
        if self.portal_server_started:
            return

        import uvicorn
        port = 80 if (os.name != "nt" and os.geteuid() == 0) else 8080
        set_portal_device_id(self.config["device_id"])

        def _run():
            try:
                uvicorn.run(portal_app, host="0.0.0.0", port=port, log_level="warning")
            except Exception as e:
                log.warning("Setup portal server encountered error: %s", e)

        t = threading.Thread(target=_run, daemon=True)
        t.start()
        self.portal_server_started = True
        log.info("Provisioning setup portal running on port %d (http://192.168.4.1:%d)", port, port)

    def run(self):
        log.info("Starting CropFit Edge State Machine...")

        while True:
            try:
                if self.state == EdgeState.BOOT:
                    self._handle_boot()

                elif self.state == EdgeState.CHECK_NETWORK:
                    self._handle_check_network()

                elif self.state == EdgeState.PROVISIONING:
                    self._handle_provisioning()

                elif self.state == EdgeState.BOOTSTRAP:
                    self._handle_bootstrap()

                elif self.state == EdgeState.WAIT_FOR_CLAIM:
                    self._handle_wait_for_claim()

                elif self.state == EdgeState.EXCHANGE_CREDENTIAL:
                    self._handle_exchange_credential()

                elif self.state == EdgeState.FETCH_CONFIG:
                    self._handle_fetch_config()

                elif self.state == EdgeState.RUNNING:
                    self._handle_running()

                elif self.state == EdgeState.ERROR_RECOVERY:
                    self._handle_error_recovery()

                time.sleep(1.0)
            except KeyboardInterrupt:
                log.info("CropFit Edge shutting down cleanly.")
                break
            except Exception as e:
                log.error("Unhandled error in state loop: %s", e, exc_info=True)
                time.sleep(5.0)

    # -------------------------------------------------------------
    # State Handlers
    # -------------------------------------------------------------
    def _handle_boot(self):
        # 1. Derive device identity automatically
        if not self.config.get("device_id"):
            self.config["device_id"] = derive_device_id()
            self.config_mgr.save(self.config)

        log.info("Initialized CropFit Hub Device ID: %s", self.config["device_id"])
        self.network_check_start = time.time()
        if self.setup_wifi:
            self.setup_wifi = False
            self.transition_to(EdgeState.PROVISIONING, "Explicit Wi-Fi setup requested")
            return
        self.transition_to(EdgeState.CHECK_NETWORK, "Device identity loaded")

    def _handle_check_network(self):
        """
        Retry saved Wi-Fi indefinitely for configured hubs. Only a new hub with
        no saved client profiles enters setup automatically after the grace period.
        """
        cloud_url = self.config.get("cloud_url", "")

        # Check Wi-Fi state or general internet/cloud reachability
        if is_wifi_connected() or has_active_internet() or is_cloud_reachable(cloud_url):
            log.info("Active network connection verified (IP: %s).", get_local_ip())
            # If already claimed and has permanent token, skip bootstrap/claim flow
            if self.config.get("is_claimed") and self.config.get("hub_token"):
                self.transition_to(EdgeState.FETCH_CONFIG, "Device already claimed with valid credential")
            else:
                self.transition_to(EdgeState.BOOTSTRAP, "Network up, starting cloud registration")
            return

        elapsed = time.time() - self.network_check_start
        if elapsed < 30.0:
            log.info("Waiting for saved Wi-Fi connection... (%ds/30s)", int(elapsed))
            time.sleep(3.0)
        else:
            profiles = saved_wifi_profiles()
            configured = self.config.get("is_claimed") or self.config.get("hub_token")
            if configured or profiles or profiles is None:
                if profiles:
                    profile = profiles[self.wifi_retry_index % len(profiles)]
                    self.wifi_retry_index += 1
                    if reconnect_saved_wifi(profile):
                        # Verify connectivity on the next pass before resuming cloud traffic.
                        return
                log.info("Waiting for saved network recovery; retrying in 15 seconds.")
                time.sleep(15.0)
                return
            self.transition_to(EdgeState.PROVISIONING, "First-time Wi-Fi setup required")

    def _handle_provisioning(self):
        """Creates temporary SoftAP hotspot and serves local setup portal."""
        dev_suffix = self.config["device_id"].split("-")[-1]
        ssid = f"CropFit-Hub-{dev_suffix}"

        if not start_setup_hotspot(ssid):
            log.warning("Setup hotspot failed to start; retrying in 5 seconds.")
            time.sleep(5.0)
            return
        self.start_portal_server()

        log.info("Captive SoftAP active [%s]. Waiting for farmer Wi-Fi setup via http://192.168.4.1...", ssid)

        # Wait until farmer submits credentials and network connects
        while not (is_wifi_connected() or has_active_internet()):
            time.sleep(2.0)

        log.info("Wi-Fi connected successfully via portal!")
        stop_setup_hotspot()
        self.network_check_start = time.time()
        self.transition_to(EdgeState.CHECK_NETWORK, "Farmer Wi-Fi provisioning completed")

    def _handle_bootstrap(self):
        """Announces hub to cloud backend /api/v1/nodes/bootstrap/"""
        client = CloudClient(self.config["cloud_url"], self.config["device_id"])
        ip_addr = get_local_ip()
        res = client.bootstrap(claim_code=self.config.get("claim_code", ""), ip_address=ip_addr)

        if not res:
            log.warning("Cloud bootstrap failed (backend unreachable). Retrying...")
            time.sleep(4.0)
            return

        status = res.get("status")
        if status == "claimed" and self.config.get("hub_token"):
            self.config["is_claimed"] = True
            self.config_mgr.save(self.config)
            self.transition_to(EdgeState.FETCH_CONFIG, "Bootstrap confirmed device is claimed")
        else:
            self.transition_to(EdgeState.WAIT_FOR_CLAIM, "Bootstrap complete, waiting for farmer pairing")

    def _handle_wait_for_claim(self):
        """Polls cloud /api/v1/nodes/poll-claim/ until farmer pairs the hub."""
        client = CloudClient(self.config["cloud_url"], self.config["device_id"])
        log.info("Polling cloud for claim authorization on %s...", self.config["device_id"])

        res = client.poll_claim()
        if res and res.get("status") == "claimed":
            log.info("Claim detected! Received exchange authorization.")
            self.config["exchange_token"] = res.get("exchange_token")
            self.config["hub_token"] = res.get("hub_token") or self.config.get("hub_token")
            self.config["greenhouse_id"] = res.get("greenhouse_id")
            self.config["is_claimed"] = True
            self.config_mgr.save(self.config)

            if res.get("exchange_token"):
                self.transition_to(EdgeState.EXCHANGE_CREDENTIAL, "Received one-time exchange token")
            else:
                self.transition_to(EdgeState.FETCH_CONFIG, "Claimed directly with token")
        else:
            time.sleep(4.0)

    def _handle_exchange_credential(self):
        """Trades one-time claim token for permanent hub secret."""
        client = CloudClient(self.config["cloud_url"], self.config["device_id"])
        exchange_tok = self.config.get("exchange_token")

        if not exchange_tok:
            self.transition_to(EdgeState.FETCH_CONFIG, "No exchange token needed")
            return

        permanent_token = client.exchange_token(exchange_tok)
        if permanent_token:
            self.config["hub_token"] = permanent_token
            self.config["exchange_token"] = ""
            self.config_mgr.save(self.config)
            log.info("Successfully traded exchange token for permanent hub secret.")
            self.transition_to(EdgeState.FETCH_CONFIG, "Permanent hub token secured")
        else:
            log.warning("Token exchange failed, retrying...")
            time.sleep(5.0)

    def _handle_fetch_config(self):
        """Down-syncs sensor allowlist & actuator configuration from cloud."""
        client = CloudClient(
            self.config["cloud_url"],
            self.config["device_id"],
            self.config.get("hub_token", ""),
        )
        config_data = client.fetch_config()
        if config_data:
            log.info(
                "Synced cloud config: %d sensors, %d actuators registered.",
                len(config_data.get("sensors", [])),
                len(config_data.get("actuators", [])),
            )
        self.transition_to(EdgeState.RUNNING, "Configuration synchronized")

    def _handle_running(self):
        """Normal steady state: sends 30s heartbeat telemetry."""
        client = CloudClient(
            self.config["cloud_url"],
            self.config["device_id"],
            self.config.get("hub_token", ""),
        )
        uptime = int(time.time() - self.start_time)
        ip_addr = get_local_ip()

        ok = client.send_heartbeat(uptime_seconds=uptime, ip_address=ip_addr)
        if ok:
            self.consecutive_cloud_errors = 0
            try:
                from app.command_worker import CommandWorker
                journal = os.environ.get('CROPFIT_COMMAND_JOURNAL') or (
                    self.config_mgr.config_file.parent / 'command-results.sqlite3'
                    if os.name == 'nt' else '/var/lib/cropfit/command-results.sqlite3'
                )
                CommandWorker(client, journal).tick()
            except Exception:
                log.exception('Command delivery failed; heartbeat service will continue')
            log.info("✓ Heartbeat ACK (uptime=%ds, ip=%s)", uptime, ip_addr)
            time.sleep(30.0)
        else:
            self.consecutive_cloud_errors += 1
            log.warning("Heartbeat failed (%d consecutive failures)", self.consecutive_cloud_errors)
            if self.consecutive_cloud_errors >= 4:
                self.transition_to(EdgeState.ERROR_RECOVERY, "Persistent cloud communication failure")
            else:
                time.sleep(10.0)

    def _handle_error_recovery(self):
        """Gracefully verifies whether network is dropped or if only cloud is down."""
        log.info("Running error recovery diagnostics...")
        if not is_wifi_connected():
            log.warning("Wi-Fi connection lost. Attempting network check...")
            self.network_check_start = time.time()
            self.transition_to(EdgeState.CHECK_NETWORK, "Wi-Fi link lost")
            return

        # Wi-Fi is still alive, but cloud is not responding
        cloud_url = self.config.get("cloud_url", "")
        if is_cloud_reachable(cloud_url):
            log.info("Cloud backend is reachable again! Resuming normal operation.")
            self.consecutive_cloud_errors = 0
            self.transition_to(EdgeState.RUNNING, "Cloud reachability restored")
        else:
            log.warning("Wi-Fi is active but cloud is still unreachable. Backing off 15s...")
            time.sleep(15.0)
