"""Outage recovery must preserve ownership and avoid an unwanted setup AP."""
import subprocess
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# Keep unit tests independent of the Pi's HTTP/portal dependencies. Remove only
# the stubs afterwards, retaining the modules under test for normal patching.
stubs = {"httpx": Mock(), "app.cloud_client": Mock(), "app.provisioning.portal": Mock()}
originals = {name: sys.modules.get(name) for name in stubs}
sys.modules.update(stubs)
try:
    from app.state_machine import EdgeState, EdgeStateMachine
    from app.provisioning.wifi_manager import saved_wifi_profiles, reconnect_saved_wifi
finally:
    for name, original in originals.items():
        if original is None:
            sys.modules.pop(name, None)
        else:
            sys.modules[name] = original


class NetworkRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.config = {"device_id": "GN-TEST", "cloud_url": "https://cloud.test", "is_claimed": True, "hub_token": "test-secret", "greenhouse_id": 7}
        self.manager = Mock()
        self.manager.load.return_value = self.config.copy()
        self.machine = EdgeStateMachine(self.manager)
        self.machine.state = EdgeState.CHECK_NETWORK
        self.machine.network_check_start = 0
        self.mocks = {}
        for name, value in [("is_wifi_connected", False), ("has_active_internet", False), ("is_cloud_reachable", False), ("saved_wifi_profiles", ["farm-uuid"]), ("reconnect_saved_wifi", False), ("get_local_ip", "192.168.1.5"), ("time.sleep", None)]:
            patcher = patch(f"app.state_machine.{name}", return_value=value)
            self.mocks[name] = patcher.start()
            self.addCleanup(patcher.stop)

    def test_long_outage_keeps_retrying_and_preserves_credentials(self):
        for _ in range(10):
            self.machine._handle_check_network()
            self.assertEqual(self.machine.state, EdgeState.CHECK_NETWORK)
        self.assertEqual(self.mocks["reconnect_saved_wifi"].call_count, 10)
        self.assertEqual(self.machine.config, self.config)
        self.manager.save.assert_not_called()

    def test_saved_profiles_are_tried_in_rotation(self):
        self.mocks["saved_wifi_profiles"].return_value = ["first", "second"]
        for _ in range(3):
            self.machine._handle_check_network()
        self.assertEqual([call.args[0] for call in self.mocks["reconnect_saved_wifi"].call_args_list], ["first", "second", "first"])

    def test_configured_hub_without_profiles_does_not_open_hotspot(self):
        self.mocks["saved_wifi_profiles"].return_value = []
        self.machine._handle_check_network()
        self.assertEqual(self.machine.state, EdgeState.CHECK_NETWORK)

    def test_new_hub_with_saved_wifi_retries_before_claiming(self):
        self.machine.config.update(is_claimed=False, hub_token="")
        self.machine._handle_check_network()
        self.assertEqual(self.machine.state, EdgeState.CHECK_NETWORK)
        self.mocks["reconnect_saved_wifi"].assert_called_once()

    def test_first_time_setup_requires_confirmed_absence_of_saved_wifi(self):
        self.machine.config.update(is_claimed=False, hub_token="")
        self.mocks["saved_wifi_profiles"].return_value = None
        self.machine._handle_check_network()
        self.assertEqual(self.machine.state, EdgeState.CHECK_NETWORK)
        self.mocks["saved_wifi_profiles"].return_value = []
        self.machine._handle_check_network()
        self.assertEqual(self.machine.state, EdgeState.PROVISIONING)

    def test_wifi_recovery_resumes_config_fetch_without_bootstrap(self):
        self.mocks["is_wifi_connected"].return_value = True
        self.machine._handle_check_network()
        self.assertEqual(self.machine.state, EdgeState.FETCH_CONFIG)
        self.mocks["reconnect_saved_wifi"].assert_not_called()
        self.assertEqual(self.machine.config, self.config)

    def test_cloud_only_outage_does_not_activate_wifi_or_hotspot(self):
        self.machine.state = EdgeState.ERROR_RECOVERY
        self.mocks["is_wifi_connected"].return_value = True
        self.machine._handle_error_recovery()
        self.assertEqual(self.machine.state, EdgeState.ERROR_RECOVERY)
        self.mocks["reconnect_saved_wifi"].assert_not_called()
        self.mocks["is_cloud_reachable"].return_value = True
        self.machine._handle_error_recovery()
        self.assertEqual(self.machine.state, EdgeState.RUNNING)

    def test_explicit_setup_preserves_claim_and_resumes_without_internet(self):
        machine = EdgeStateMachine(self.manager, setup_wifi=True)
        machine._handle_boot()
        self.assertEqual(machine.state, EdgeState.PROVISIONING)
        self.mocks["is_wifi_connected"].return_value = True
        with patch("app.state_machine.start_setup_hotspot", return_value=True), patch("app.state_machine.stop_setup_hotspot"), patch.object(machine, "start_portal_server"):
            machine._handle_provisioning()
        self.assertEqual(machine.state, EdgeState.CHECK_NETWORK)
        machine._handle_check_network()
        self.assertEqual(machine.state, EdgeState.FETCH_CONFIG)
        self.assertEqual(machine.config, self.config)
        self.manager.save.assert_not_called()


class SavedWifiTests(unittest.TestCase):
    @patch("app.provisioning.wifi_manager.subprocess.run")
    def test_only_client_profiles_are_selected(self, run):
        run.side_effect = [Mock(stdout="ap:wifi\nfarm:802-11-wireless\neth:802-3-ethernet\n"), Mock(stdout="ap\n"), Mock(stdout="infrastructure\n")]
        self.assertEqual(saved_wifi_profiles(), ["farm"])

    @patch("app.provisioning.wifi_manager.subprocess.run")
    def test_query_failure_is_distinct_from_no_profiles(self, run):
        run.side_effect = subprocess.TimeoutExpired("nmcli", 5)
        self.assertIsNone(saved_wifi_profiles())

    @patch("app.provisioning.wifi_manager.subprocess.run")
    def test_reconnect_uses_stored_profile_and_bounded_timeout(self, run):
        run.return_value.returncode = 0
        self.assertTrue(reconnect_saved_wifi("farm-uuid"))
        self.assertEqual(run.call_args.args[0], ["nmcli", "--wait", "15", "connection", "up", "uuid", "farm-uuid"])
        self.assertEqual(run.call_args.kwargs["timeout"], 20)
        run.side_effect = subprocess.TimeoutExpired("nmcli", 20)
        self.assertFalse(reconnect_saved_wifi("farm-uuid"))


if __name__ == "__main__":
    unittest.main()
