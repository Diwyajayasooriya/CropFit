# GreenNode — Prototype Completion: MQTT Broker, Local Provisioning, Missing Services

Addendum to `network.md` and `DATA_PIPELINE.md`, covering the round of
gap-fixing that completes the first working prototype loop: a device
connects, gets provisioned, and its data/commands actually flow — with
nothing silently missing in between.

---

## 1. Mosquitto was never actually set up — now it is

Every part of the data pipeline assumed a running, configured broker; none
of the scripts installed or configured one. Fixed:

- `config/mosquitto/mosquitto.conf` — no anonymous access, password file +
  ACL file, both required.
- `config/mosquitto/greennode.acl.base` — the static part of the ACL
  (service accounts: `greennode-ingest` reads all `data`/`status` topics,
  `greennode-dispatch` writes all `cmd` topics), with a marker line below
  which per-device entries live.
- `scripts/generate-mqtt-creds.sh` — bulk generator from
  `registry/devices.csv`, mirrors `generate-dhcp-hosts.sh`'s pattern. Run
  this after hand-editing the CSV directly; devices paired live don't need
  it (see below).
- `install.sh` now installs `mosquitto`/`mosquitto-clients`, deploys the
  config, and runs the bulk generator as part of setup.

**You'll need two more MQTT users beyond the per-device ones**: create
`greennode-ingest` and `greennode-dispatch` credentials manually
(`mosquitto_passwd -b /etc/mosquitto/passwd greennode-ingest <password>`,
same for dispatch) and put those passwords into `ingestion_service.py`'s
`MQTT_PASS` and `actuator_dispatcher.py`'s `mqtt_pass` — these two aren't
generated automatically since they're fixed service accounts, not
per-device.

## 2. Provisioning finalize is now fully local — no cloud round-trip

This was a real design contradiction, not just a missing piece: pairing a
*local* device on the *local* network required reaching a possibly-cloud-
hosted backend, directly against the offline-first principle already
established elsewhere in the project.

`pairing_watcher.py`'s finalize step now does everything itself:

```
ESP32 hits GET /provision
        |
        v
allocate_ip()            — next free IP in the target subnet, based on
                            what's already in devices.csv
append_to_registry()      — writes the new device's row
generate_mqtt_credentials() — mosquitto_passwd + ACL append + broker reload
regenerate_network_configs() — re-runs the dnsmasq + HTB generators, same
                                as a human would after editing the CSV
insert_connected_device() — local SQLite insert (direct sqlite3, not
                             SQLAlchemy — keeps this daemon stdlib-only)
sync_to_cloud_async()     — best-effort, backgrounded, only if
                             BACKEND_FINALIZE_URL is set; failure here
                             never blocks or fails provisioning
        |
        v
credentials handed back to the ESP32 — device is fully usable even if
the internet is down for the whole exchange
```

**One UX simplification worth knowing about, since it changes what was
discussed earlier**: rather than asking the operator "what kind of device
is this?" *after* the MAC is seen, `/pairing/open` now takes
`device_type` and `name` up front, before the ESP32 even associates.
Given only one device can be paired per window anyway (by design), this
removes a round trip for no real UX cost — the frontend's "+" flow just
needs to ask device type + a name before opening the window, not after.
Revisit this if it turns out to matter in practice.

**New required config**: `TARGET_PASSPHRASE_SENSORS` /
`TARGET_PASSPHRASE_ACTUATORS` env vars in
`systemd/greennode-pairing-watcher.service` must match
`config/hostapd/hostapd.conf`'s actual passphrases exactly — same
"two places, must agree" pattern `PROVISION_PORT` already has with
`nftables-rules.sh`.

## 3. Missing systemd units — added

Nothing kept the ingestion service or the rules engine running:

- `systemd/greennode-ingestion.service` — long-running, same shape as the
  shedding daemon's unit.
- `systemd/greennode-rules.service` + `systemd/greennode-rules.timer` —
  the rules engine is a *oneshot* pass, not a long-running process (it
  reads latest readings, evaluates, exits), so it's wired as a systemd
  timer firing every 30s rather than a `while True` loop with its own
  sleep — lets `systemctl status`/`journalctl` show each pass distinctly
  rather than one continuous process.

`install.sh` now also deploys `edge/*.py` to `/opt/greennode-edge` (a new
step, since the edge application code previously had no install path at
all) and enables both new units.

## 4. Smaller fixes

- **MQTT reconnect backoff**: both `ingestion_service.py` and
  `actuator_dispatcher.py` now call `reconnect_delay_set(min_delay=1,
  max_delay=30)` — a Mosquitto reload (which happens on every new device
  pairing) shouldn't risk a reconnect storm from every connected client
  doing so at once.
- **NTP**: `install.sh` now runs `timedatectl set-ntp true` explicitly.
  Doesn't eliminate the cold-boot clock problem (there's still a window
  before the STA uplink is up and NTP has synced) but ensures it's not
  silently disabled either.

## 5. Still deliberately not built

Unchanged from `DATA_PIPELINE.md`'s list — actuator state feedback,
real third-party vendor integration, rule conflict resolution.

**Resolved since this was first written:** table creation now has an
owner — `edge/init_db.py` (idempotent `Base.metadata.create_all()`),
run automatically by `install.sh` right after `edge/` is deployed, before
any service that touches the DB starts. If real Alembic migrations end
up owning this schema instead, run `init_db.py` once against a fresh DB
and let Alembic take over from there — don't run both against the same
fresh DB.
