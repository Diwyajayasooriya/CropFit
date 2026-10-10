# Edge network recovery

Configured hubs remain in network recovery during router outages. After the
initial 30-second grace period, the daemon activates one saved NetworkManager
client profile per attempt, rotating through saved profiles. Each activation
has a 15-second nmcli wait limit (20-second process timeout), followed by a
15-second pause on failure. Network checks and the main loop add some overhead.
Setup AP profiles are excluded. No Wi-Fi passwords are read by the daemon.

A claimed hub, a hub with a token, or an unclaimed hub with saved Wi-Fi does not
automatically enter hotspot setup. A NetworkManager query failure also keeps
the hub in recovery. Automatic setup is reserved for a new hub with no saved
client profiles. Missing or changed Wi-Fi credentials require intentional setup.

When connectivity returns, a claimed hub resumes config fetch and heartbeats
using its existing credentials. Ownership and greenhouse assignment are not
reset. The backend considers a heartbeat older than 90 seconds offline; the
sidebar and greenhouse cards poll every 15 seconds while the page is visible.

## Installer deployment and intentional Wi-Fi changes

Deploy the updated `edge/app/state_machine.py`, `edge/app/provisioning/wifi_manager.py`
and `edge/app/main.py` to the matching paths under the installed edge directory
(the supplied service uses `/opt/cropfit-edge`). Restart `cropfit-edge.service`.
Do not replace `/etc/cropfit/config.json` or reset hub ownership.

An installer can deliberately open setup without clearing credentials. In the
Pi terminal, stop the background daemon before running the foreground setup:

```sh
sudo systemctl stop cropfit-edge
sudo /opt/cropfit-edge/.venv/bin/python /opt/cropfit-edge/app/main.py --setup-wifi
```

The farmer joins the `CropFit-Hub-<device suffix>` hotspot, opens
`http://192.168.4.1`, and enters the new Wi-Fi name and password. After connection,
the installer stops the foreground process with Ctrl+C and restores the service:

```sh
sudo systemctl start cropfit-edge
```

These terminal operations are installer-only; normal outages need no farmer action.

## Verification

Local mocked tests: `python -m unittest discover -s edge/tests -v`.
They cover retry rotation, extended outages, profile-query errors, first-time
setup, explicit setup, and preservation of claim credentials.

Hardware acceptance still required after deployment:

1. With an already claimed hub running, switch off its router for several minutes.
2. Check that its dashboard status becomes Offline and no setup hotspot appears.
3. Restore the same router and credentials. Confirm the hub reconnects, resumes
   heartbeats, and returns Online on the dashboard without a reload or new claim.
4. Repeat with only the router's internet disconnected; Wi-Fi should remain joined.
5. Reboot the Pi while the router is off, then restore the router and repeat the check.

This change covers network recovery and heartbeat status. It does not establish
hardware validation of buffered sensor uploads or local actuator operation.
