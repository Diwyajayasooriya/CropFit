"""Regression checks for the distinction between a setup AP and client Wi-Fi."""
import subprocess
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

# These unit tests exercise NetworkManager only, not the HTTP cloud probe.
with patch.dict(sys.modules, {"httpx": types.ModuleType("httpx")}):
    from app.provisioning.wifi_manager import is_wifi_connected
from app.provisioning.hotspot import start_setup_hotspot


def result(output):
    return subprocess.CompletedProcess([], 0, stdout=output, stderr="")


class WifiProvisioningTests(unittest.TestCase):
    @patch.object(subprocess, "run")
    def test_setup_hotspot_is_not_a_client_connection(self, run):
        run.side_effect = [result("setup-uuid:802-11-wireless\n"), result("ap\n")]
        self.assertFalse(is_wifi_connected())

    @patch.object(subprocess, "run")
    def test_farmer_wifi_is_connected(self, run):
        run.side_effect = [result("farm-uuid:802-11-wireless\n"), result("infrastructure\n")]
        self.assertTrue(is_wifi_connected())
        self.assertEqual(run.call_args.args[0][-2:], ["uuid", "farm-uuid"])

    @patch.object(subprocess, "run")
    def test_ap_and_client_on_separate_adapters(self, run):
        run.side_effect = [
            result("setup-uuid:wifi\nfarm-uuid:wifi\n"),
            result("ap\n"), result("infrastructure\n"),
        ]
        self.assertTrue(is_wifi_connected())

    @patch.object(subprocess, "run")
    def test_ethernet_and_loopback_do_not_count_as_wifi(self, run):
        run.return_value = result("eth-uuid:802-3-ethernet\nlo-uuid:loopback\n")
        self.assertFalse(is_wifi_connected())
        self.assertEqual(run.call_count, 1)

    @patch.object(subprocess, "run")
    def test_networkmanager_failure_is_not_a_connection(self, run):
        run.side_effect = subprocess.CalledProcessError(10, "nmcli")
        self.assertFalse(is_wifi_connected())

    @patch("app.provisioning.hotspot.stop_setup_hotspot")
    @patch("app.provisioning.hotspot.subprocess.run")
    def test_hotspot_activation_failure_is_reported(self, run, stop):
        run.side_effect = [result(""), subprocess.CalledProcessError(10, "nmcli", stderr="Wi-Fi is disabled")]
        with self.assertLogs("cropfit.hotspot", level="WARNING") as logs:
            self.assertFalse(start_setup_hotspot("CropFit-Hub-C554"))
        self.assertIn("Wi-Fi is disabled", logs.output[0])


if __name__ == "__main__":
    unittest.main()
