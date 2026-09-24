# GreenNode Networking Layer — Theory & Implementation

This document covers the wireless networking theory behind GreenNode's hub design, then how it's actually built: Raspberry Pi 4, onboard radio in STA mode for uplink, USB WiFi adapter in AP mode hosting three isolated sub-node SSIDs plus a fourth for sub-node provisioning and a fifth for the hub's own farmer-facing WiFi setup, with per-device bandwidth partitioning and adaptive shedding under weak uplink conditions.

---

## Part 1 — Theory

### 1.1 Access Point (AP)

An AP is a device — or a radio in a specific mode — acting as the central coordinator of a wireless network. It doesn't initiate connections; it advertises its presence and reacts to stations trying to join.

WiFi is a shared medium: every device on a channel is transmitting into the same slice of spectrum, and without coordination you get collisions and garbled frames. The AP exists to solve that. It's the mandatory relay point in infrastructure mode — two stations on the same AP never talk directly to each other, everything passes through the AP first.

Mechanically, an AP does four things on loop:
1. **Beaconing** — broadcasts beacon frames (default every 100ms) announcing SSID, channel, supported rates, and security capabilities.
2. **Association handling** — processes authentication and association requests, assigns each joining station an Association ID (AID).
3. **Airtime arbitration** — participates in CSMA/CA (Carrier Sense Multiple Access / Collision Avoidance) alongside its stations to prevent simultaneous transmissions from colliding.
4. **Frame relay** — every data frame from a station, to anywhere, passes through the AP first.

On GreenNode, `hostapd` is the userspace daemon implementing all four of these on the USB radio.

### 1.2 Station (STA)

A STA is a device in client mode — it joins a network rather than coordinating one. This is the default WiFi behavior: phones, laptops, and GreenNode's onboard radio when it connects outward to an upstream router.

Mechanically:
1. **Scanning** — passively listens for beacons, or actively sends probe requests ("is network X nearby?").
2. **Authentication** — a largely vestigial step under WPA2/3; the real security handshake comes later.
3. **Association** — sends an association request; the AP replies with an AID.
4. **4-way handshake (WPA2/3)** — derives session encryption keys from the PSK without ever transmitting the PSK itself.
5. **DHCP** — requests an IP address from whatever's serving the network it just joined.

`wpa_supplicant` is the userspace daemon implementing STA behavior — on GreenNode, it runs on the onboard radio, connecting outward to the upstream WiFi network that provides backend/internet reach.

### 1.3 How AP and STA interact — the join sequence

AP and STA are asymmetric roles: the AP is passive-broadcast/reactive, the STA is active-seeker/initiator.

**Beacon frame contents** (broadcast by the AP roughly every 100ms):
- Timestamp (clock sync)
- Beacon interval
- SSID (can be hidden by omission — weak security-through-obscurity, not real security)
- Supported PHY rates
- Channel/frequency info
- Capability info (security type, QoS support)
- RSN info element (the encryption/auth parameters a STA needs)

**Full join sequence:**

```
STA                                          AP
 |                                            |
 |---- Probe Request (or passive listen) ---->|   Discovery
 |<--- Probe Response / Beacon ----------------|
 |                                            |
 |---- Authentication Request ---------------->|   Auth (vestigial under WPA2/3)
 |<--- Authentication Response -----------------|
 |                                            |
 |---- Association Request -------------------->|   Association
 |<--- Association Response (includes AID) -----|
 |                                            |
 |<==== 4-Way Handshake (EAPOL) ===============>|   Key derivation (WPA2/3)
 |                                            |
 |---- DHCP Discover -------------------------->|   IP assignment
 |<--- DHCP Offer/ACK ---------------------------|
 |                                            |
 [STA fully connected — data frames flow]
```

On GreenNode: ESP32 sub-nodes are STAs against `hostapd` on the USB radio. Simultaneously, GreenNode's own onboard radio is itself a STA against the upstream router. GreenNode plays AP role on one radio and STA role on the other, at the same time — that's the entire justification for the dual-radio split.

### 1.4 Why one radio can't cleanly do both

The BCM43455 onboard chip *can* run AP+STA concurrently via virtual interfaces on the same `phy`, but both interfaces are forced onto the **same channel** (a radio can only tune to one frequency at a time) and time-slice between AP and STA duty cycles. That's a real constraint, not a config limitation — it caps combined throughput and adds latency under load.

GreenNode avoids this entirely by using **two physical radios**: onboard chip dedicated to STA (uplink), USB adapter dedicated to AP (sub-node hosting). Each radio gets independent channel selection and independent airtime — no forced-same-channel constraint, no time-slicing penalty. The only residual concern is physical RF interference between two radios a few centimeters apart, minimized by picking non-overlapping channels for each.

### 1.5 Wireless channels

WiFi's 2.4GHz band (the only band standard ESP32 boards support) spans roughly 2.400–2.4835GHz, divided into channels 1–14 (1–11 typically available depending on region). Each channel is 20MHz wide but channels are spaced only 5MHz apart, so **adjacent channels overlap and interfere** even though they're nominally "different."

Only **channels 1, 6, and 11** are non-overlapping in the 20MHz-wide 2.4GHz band — the standard recommended set for any real deployment.

For GreenNode: if the upstream router (STA uplink target) sits on channel 6, the AP radio should be configured for channel 1 or 11 explicitly — maximizing separation between GreenNode's own two radios sitting on the same board. Channel width should stay at standard 20MHz; sensor traffic volume is tiny, so there's no throughput reason to go wide, and wide channels only increase interference exposure in an already-crowded band.

Sri Lanka's regulatory domain (`country=LK`) should be set explicitly in both `hostapd` and `wpa_supplicant` configs — this controls which channels and transmit power levels are legally permitted and is required for correct 802.11d/h behavior.

### 1.6 WLAN, SSID, subnetting, segmentation

**WLAN** = Wireless Local Area Network — the umbrella term for any local network using radio instead of cable. "WiFi" is the branded implementation based on 802.11; the terms are used interchangeably in practice. `wlan0`, `wlan1` etc. are the Linux kernel's naming convention for wireless interfaces.

**SSID** (Service Set Identifier) is the human-readable name identifying a specific wireless network at Layer 2. Technically it identifies a **BSS** (Basic Service Set) — the AP plus all its associated stations, forming one logical broadcast domain.

A separate SSID alone only gives Layer 2 separation. Real segmentation needs a **distinct IP subnet per SSID** too:

```
greennode-sensors    → 10.0.10.0/24
greennode-actuators  → 10.0.11.0/24
greennode-admin      → 10.0.12.0/24
```

Layer 2 separation (SSID) plus Layer 3 separation (subnet + firewall rules) together form the actual security boundary — this is what stops a compromised sensor node from directly reaching the admin subnet.

### 1.7 Multi-BSS

One physical AP radio can't run three separate `hostapd` processes fighting over the same hardware. Instead, `hostapd` supports multiple **BSS entries in one config**, each bound to its own virtual interface, all sharing the underlying physical radio:

```
phy1 (USB radio)
  ├── wlan1     (BSS0) → greennode-sensors    → 10.0.10.0/24
  ├── wlan1_1   (BSS1) → greennode-actuators  → 10.0.11.0/24
  └── wlan1_2   (BSS2) → greennode-admin      → 10.0.12.0/24
```

Each virtual BSS gets its own SSID, own security settings, own derived MAC, and its own kernel network interface — meaning firewall rules and traffic control can be applied per SSID independently.

**Constraint to keep in mind:** all three BSSes still share the same channel and the same physical radio's total airtime. They're logically separate but physically one radio's capacity — which is exactly why bandwidth partitioning (below) matters even after segmentation is in place.

### 1.8 Routing, not bridging

GreenNode sits between `wlan0` (STA, upstream subnet) and `wlan1`/`wlan1_1`/`wlan1_2` (AP, sub-node subnets) as a **router**, not a switch:

- Sub-node ESP32s get DHCP leases from `dnsmasq` on their respective AP interface, with GreenNode as gateway.
- Traffic destined for the backend gets NAT'd (masquerade) from the sub-node subnets out through `wlan0`.
- The kernel needs `net.ipv4.ip_forward=1` — by default Linux won't forward between interfaces at all.

This routing design is what makes the isolation and segmentation free later: each SSID/subnet is a separately routed network, and `nftables` controls exactly what's allowed to cross between them.

### 1.9 Bandwidth partitioning theory (HTB)

**Queueing discipline (qdisc)**: the kernel structure controlling how packets are selected for transmission from an interface's queue. Default is plain FIFO — no prioritization.

**HTB (Hierarchical Token Bucket)**: a qdisc that builds a tree of classes, each with:
- `rate` — guaranteed minimum bandwidth
- `ceil` — maximum the class can borrow from idle siblings
- `prio` — among classes with unused capacity available, who gets served first

This gives the exact semantics GreenNode needs: actuator control commands get a guaranteed floor and top priority (so they preempt routine sensor telemetry when both want airtime), sensor telemetry gets a fair guaranteed floor but yields when actuator traffic needs the channel.

**Important implementation nuance:** `tc` qdiscs are per network device (per netdev), not per physical radio. Since each `hostapd` BSS gets its own kernel interface (`wlan1`, `wlan1_1`, `wlan1_2`), you can't build one literal kernel HTB tree spanning all three — instead, GreenNode runs three independent HTB trees, one per interface, each configured with a ceiling that respects the radio's real total capacity. Coordination across the three is achieved by keeping the sum of ceilings within the radio's realistic throughput and using `prio` to bias contention in the actuator branch's favor — it's a soft coordination by configuration, not a hard kernel-enforced shared budget.

**Classification granularity:** GreenNode partitions per-device (per-IP), nested under a per-SSID parent class, because the shedding decision (below) is made per device, not per SSID. This requires stable IP↔device mapping, done via static DHCP reservations keyed to each ESP32's MAC.

**Honest framing of *why* this matters:** ESP32 sensor telemetry (a few hundred bytes every few seconds to minutes over MQTT) is nowhere near enough traffic to saturate even a modest WiFi link on its own. The real value of per-device HTB classes isn't congestion avoidance — it's:
- **Isolation** — one misbehaving/bugged node can't flood the channel and starve everyone else.
- **Priority** — actuator commands (time-sensitive) preempt routine sensor telemetry.
- **A hook for adaptive shedding** — per-device classes are what let GreenNode throttle or drop specific low-priority devices when the *upstream* uplink (not the local AP) is the actual bottleneck.

### 1.10 Adaptive shedding under weak uplink

The trigger for shedding isn't local AP congestion — it's degradation on the **STA uplink** (`wlan0`), since that's the single path all sub-node traffic must ultimately cross to reach the backend. Two independent signals:

- **Uplink quality** — `iw dev wlan0 link` / `iw dev wlan0 station dump` — RSSI and negotiated bitrate. A sustained drop (e.g., RSSI below ~-70dBm, or bitrate collapsing from ~72Mbps to ~6Mbps) signals real capacity loss.
- **AP-side class stats** — `tc -s class show dev <iface>` — per-device drops/overlimits, showing which devices are actually being starved right now.

Shedding logic runs as a small daemon, polling on an interval, acting in two stages once degradation is sustained across several consecutive polls (to avoid flapping on transient dips):
1. **Soft** — shrink the lowest-priority tier's HTB `ceil` (throttle, don't disconnect).
2. **Hard** — if still constrained, deauthenticate the device from the AP entirely via `hostapd_cli deauthenticate <MAC>`. This doesn't blacklist the device — it will reassociate on its own once conditions recover and it retries.

Device priority tiers are config, not hardcoded: actuators are never shed, irrigation-linked sensors are shed last, routine ambient telemetry is shed first.

### 1.11 What a WPA2 passphrase actually is

Worth being precise about this since it underpins the provisioning design below. WPA2 is the encryption/authentication protocol; the passphrase is not itself the encryption key. What actually happens:

1. The passphrase + SSID are run through PBKDF2 (4096 iterations) to derive a **PMK (Pairwise Master Key)** — a fixed 256-bit value both sides can compute independently, without ever transmitting the passphrase itself.
2. During the 4-way handshake (Section 1.3), the AP and STA combine the PMK with random nonces exchanged in that handshake to derive a **PTK (Pairwise Transient Key)** — a session-specific key.
3. The PTK, not the passphrase or even the PMK, is what actually encrypts data frames.

So the passphrase is the thing that lets both sides arrive at the same starting secret without saying it aloud. This matters for the provisioning network below: a passphrase baked identically into every device's firmware still encrypts that link, but it can't function as a *per-device* identity check — anyone who extracts it from one unit knows it for all of them. That's fine as long as something else is doing the real access control.

### 1.12 Device provisioning — how GreenNode identifies a new device

An unprovisioned ESP32 doesn't know any of the three real SSIDs' passphrases. So there's a fourth, deliberately low-trust network (`greennode-provision`, BSS3, `wlan1_3`, `10.0.13.0/24`) whose only job is onboarding. Its passphrase is fixed and baked into every device's firmware image before deployment — per 1.11, that's an acceptable link-encryption boundary but not an identity check, so it isn't treated as one.

The key design point: **identification does not depend on the device announcing itself at the application layer.** `hostapd` already knows the moment any device associates, via its control socket:

```
AP-STA-CONNECTED aa:bb:cc:dd:ee:ff
AP-STA-DISCONNECTED aa:bb:cc:dd:ee:ff
```

GreenNode's pairing watcher (`scripts/pairing_watcher.py`) attaches to this socket directly (Unix datagram socket, `ATTACH` command, per hostapd's control-interface protocol) and sees every association on `wlan1_3` in real time — no cooperation needed from the device's firmware beyond joining WiFi, which every device has to do anyway.

The actual access control is a **pairing window**, not the passphrase:

```
Operator (frontend)                 GreenNode                          ESP32
 |                                     |                                 |
 | 1. Press "+", re-enter password     |                                 |
 |------------------------------------>|                                 |
 |     (main backend verifies, then    |                                 |
 |      POSTs /pairing/open to the     |                                 |
 |      pairing watcher's loopback-    |                                 |
 |      only control port)             |                                 |
 |                                     |                                 |
 |                                     |   2. Window open (e.g. 120s)    |
 |                                     |                                 |
 |                                     |<-- associates on wlan1_3 -------|
 |                                     |   (fixed SSID+passphrase,       |
 |                                     |    that's ALL its firmware      |
 |                                     |    needs to do)                 |
 |                                     |                                 |
 |                                     |   3. hostapd fires               |
 |                                     |      AP-STA-CONNECTED <mac>     |
 |                                     |      -> watcher records it,     |
 |                                     |         only because a window   |
 |                                     |         is open right now       |
 |                                     |                                 |
 |                                     |<-- GET /provision --------------|
 |                                     |   (one hardcoded request to     |
 |                                     |    the gateway IP, 10.0.13.1 —   |
 |                                     |    no discovery needed, that    |
 |                                     |    IP never changes)            |
 |                                     |                                 |
 |                                     |   4. watcher maps source IP ->  |
 |                                     |      MAC via dnsmasq's lease    |
 |                                     |      file, confirms that MAC    |
 |                                     |      was seen in an open window |
 |                                     |                                 |
 |                                     |   5. hands off to the main      |
 |                                     |      backend to create the      |
 |                                     |      device record + generate   |
 |                                     |      real MQTT/WiFi credentials |
 |                                     |                                 |
 |                                     |--- 200 OK {creds} ------------->|
 |                                     |                                 |
 |                                     |   6. ESP32 stores creds in NVS, |
 |                                     |      disconnects from wlan1_3,  |
 |                                     |      joins its real SSID        |
```

Outside an open window, `AP-STA-CONNECTED` events are logged but never acted on, and `GET /provision` is rejected outright — so a device sitting on the provisioning network unclaimed can't do anything except wait. `nftables` backs this up independently: `wlan1_3` can reach nothing on GreenNode except the pairing watcher's one port, and gets no forwarding anywhere else at all (Section 2, `nftables-rules.sh`) — so even if the window/MAC checks were somehow bypassed, there's nowhere for that traffic to go.

### 1.13 Minimal config now vs. real third-party devices later

The fixed-SSID-in-firmware approach above is reasonable *because GreenNode controls that firmware* — there's no vendor boundary to cross for a prototype built entirely in-house. It's the right amount of effort for proving the architecture.

A real off-the-shelf third-party sensor won't ship with GreenNode's specific SSID hardcoded in it, so a production version would need a different first step — device-as-temporary-AP (SoftAP) provisioning, BLE provisioning, or QR/NFC-assisted pairing are the standard answers, and if GreenNode ends up aggregating sensors from multiple vendors it likely needs a small plugin system (one adapter per provisioning method) rather than one fixed flow. That's a real scope decision for later, deliberately deferred rather than built now — see `learnings-and-principles.md`. Everything else in 1.12 (event-driven detection, the password-gated pairing window, the locked-down handoff subnet) carries over unchanged regardless of which first-contact mechanism eventually replaces the fixed passphrase.

### 1.14 Hub-uplink provisioning — how GreenNode gets *its own* internet credentials

Section 1.12 covers how a *sub-node* joins GreenNode. This section covers a different, earlier problem: how does GreenNode itself join the *farmer's* WiFi, given that a freshly unboxed unit has zero credentials for anything and, without an uplink, has no way to reach anything to be told any? Filling `wpa_supplicant.conf`'s `CHANGE_ME_upstream_ssid`/`passphrase` in by hand before shipping doesn't scale past a dev/test unit — a farmer's actual home/farm WiFi name and password aren't known until the unit is already in their hands.

**The solution is SoftAP + captive portal** — the standard first-contact pattern most consumer IoT devices use (Chromecast, smart plugs, etc.): GreenNode temporarily becomes an access point *of its own*, the farmer's phone joins it, and a web page served by GreenNode itself collects the real WiFi credentials.

**Why this is a 5th BSS on the existing USB radio, not a mode-switch on wlan0.** The naive version of this idea flips wlan0 (the onboard STA radio) into AP mode for setup, then back to STA once credentials arrive. That was rejected: it's exactly the single-radio AP+STA time-slicing problem Section 1.4 explains GreenNode avoids by design, and forcing wlan0 to alternate roles at runtime reintroduces it, plus adds real fragility (stopping `wpa_supplicant` and starting `hostapd` on the same physical interface, or vice versa, is a genuine source of driver/timing bugs). wlan1 (the USB radio) is *already* running multi-BSS `hostapd` with headroom for one more virtual interface, so `greennode-setup` (BSS4, `wlan1_4`, `10.0.14.0/24`) simply joins BSS0-3 as a fifth SSID on hardware already doing that job. wlan0 stays exactly what the rest of this document assumes it always is — STA-only — with no new code path for it to ever run `hostapd`.

**Access control here is deliberately different from Section 1.12's pairing window.** `greennode-provision` (wlan1_3)'s passphrase is fixed and identical across every unit GreenNode ships, which is only safe because a human operator has to explicitly open a pairing window before anything on that network can actually be claimed (Section 1.12). `greennode-setup` (wlan1_4) has no such operator in the loop — there's no "backend" to press a button, just a farmer with a phone — so instead its passphrase is **unique per physical unit**, generated at flash time and printed on that unit's label. Reading the label already requires physically holding the device, and that possession *is* the access control. A shared passphrase here would mean anyone who's ever seen one GreenNode's label could remotely reconfigure every other farmer's hub — the opposite of the intended trust model.

One consequence of that design: because the passphrase alone is a real per-unit secret, `greennode-setup` never needs to be turned off. It broadcasts permanently, the same way `greennode-provision` does, and doubles as the farmer's way to reconfigure WiFi later (moved router, changed password) — reconnect a phone to the same SSID with the same label passphrase, submit new credentials, done. No reset button, no re-authentication step, no separate "reconfigure mode" to build.

**Wildcard DNS — why the setup network needs its own dnsmasq instance.** iOS, Android, and Windows all detect "is this WiFi network actually connected to the internet, or just a login page" by GETting a real, hardcoded hostname (`connectivitycheck.gstatic.com`, `captive.apple.com`, etc.) the instant a device joins a network, and popping the "sign in to network" prompt if that request doesn't behave the way it would on a real internet connection. Since `wlan1_4` has no forwarding at all (same isolation as `wlan1_3` — see 2.1's nftables coverage below), those real hostnames would just resolve normally and then hang until the TCP connection times out, which many phones read as "no internet, don't bother showing a portal" rather than "captive portal, show the prompt." The fix is a **wildcard DNS answer**: every hostname queried on `wlan1_4` resolves straight back to GreenNode's own gateway IP (`10.0.14.1`), so those probe requests land on GreenNode's own HTTP server immediately and the phone auto-launches its captive-portal browser. `dnsmasq`'s `address=/#/<ip>` directive that implements this is process-global, not scoped to one interface — adding it to the *main* `dnsmasq` instance (the one serving `wlan1`/`wlan1_1`/`wlan1_2`) would wildcard-hijack DNS for the sensor/actuator/admin subnets too. So `wlan1_4` runs a **second, fully independent `dnsmasq` process** (`config/dnsmasq/dnsmasq-setup.conf`, `systemd/greennode-dnsmasq-setup.service`) with its own PID file and lease file, keeping the wildcard's blast radius to exactly the one interface it's meant for.

**The setup flow itself**, implemented by `scripts/uplink_provisioning.py`:

```
Farmer's phone                      GreenNode (wlan1_4, 10.0.14.1)
 |                                            |
 |-- joins "greennode-setup" ----------------->|  (label passphrase)
 |                                            |
 |<-- captive-portal probe redirected ---------|  wildcard DNS + a 302 on
 |    to the setup page, phone auto-opens it   |  every unrecognized path
 |                                            |
 |-- GET /api/networks ------------------------>|
 |<-- nearby SSIDs, from a live wlan0 scan -----|  wpa_cli scan/scan_results
 |                                            |
 |-- POST /api/provision {ssid, password} ----->|
 |                                            |  add_network / set_network /
 |                                            |  select_network on wlan0,
 |                                            |  poll for wpa_state=COMPLETED
 |                                            |  + a real IP, up to 25s
 |<-- 200 {"detail":"connected"} ---------------|  (or roll back to whatever
 |     or 502 with a plain-English reason       |   was working before, on
 |                                            |   failure — never strands
 |                                            |   a unit that was already
 |                                            |   online because of a typo)
```

If it succeeds, `wpa_cli save_config` persists the new network into `wpa_supplicant-wlan0.conf` (the file already has `update_config=1` for exactly this). If it fails — almost always a wrong password — the new network entry is removed and, if wlan0 had a previously-working network, GreenNode re-selects it rather than sitting disconnected; the farmer sees a plain-English reason and can just retry with the form still open.

A **loopback-only status endpoint** (`127.0.0.1:8092/uplink/status`) mirrors `pairing_watcher.py`'s `/pairing/status` convention, so the edge app or admin panel can show real uplink state (`connected`, `ssid`, `ip`) in its own UI without shelling out to `wpa_cli` itself.

---

## Part 2 — Implementation

### 2.1 Layout

```
greennode-network/
├── README.md                          (this file)
├── config/
│   ├── hostapd/hostapd.conf           (multi-BSS AP config: wlan1/wlan1_1/wlan1_2/wlan1_3/wlan1_4)
│   ├── wpa_supplicant/wpa_supplicant.conf   (STA uplink config, wlan0 — see 1.14, no longer needs pre-filling for shipped units)
│   ├── dnsmasq/dnsmasq.conf           (per-subnet DHCP + static reservations + sub-node provisioning; wlan1_4 deliberately NOT here, see below)
│   ├── dnsmasq/dnsmasq-setup.conf     (NEW — standalone 2nd dnsmasq instance, wlan1_4 only, wildcard captive-portal DNS — see 1.14)
│   ├── dhcpcd/dhcpcd-append.conf      (static IPs for AP interfaces, incl. wlan1_4)
│   └── udev/70-greennode-net.rules    (pins USB adapter to wlan1 by MAC)
├── registry/
│   ├── devices.csv                    (MAC → IP → tier → interface mapping — permanent, provisioned devices)
│   └── pending-devices.txt            (auto-created; provisioning watcher's stub-mode output, see 2.3)
├── scripts/
│   ├── install.sh                     (one-shot setup: packages, configs, services)
│   ├── enable-ip-forwarding.sh
│   ├── nftables-rules.sh              (NAT + inter-subnet isolation + provisioning/setup lockdown)
│   ├── tc-htb-setup.sh                (base HTB trees, 5 interfaces incl. provisioning + setup flat caps)
│   ├── tc-add-device-classes.sh       (per-device leaf classes from registry/devices.csv)
│   ├── generate-dhcp-hosts.sh         (regenerates dnsmasq static reservations from registry/devices.csv)
│   ├── shedding_daemon.py             (adaptive shedding, polls RSSI + tc stats)
│   ├── pairing_watcher.py             (SUB-NODE device detection via hostapd events + provisioning handoff — see 1.12)
│   └── uplink_provisioning.py         (NEW — HUB'S OWN uplink SoftAP + captive portal — see 1.14)
└── systemd/
    ├── greennode-shedding.service
    ├── greennode-pairing-watcher.service
    ├── greennode-dnsmasq-setup.service        (NEW)
    └── greennode-uplink-provisioning.service  (NEW)
```

### 2.2 Deployment order

1. Flash Raspberry Pi OS (Bookworm or later), enable SSH.
2. Plug in the USB WiFi adapter, confirm it's `hostapd`-AP-mode-capable (`iw list` → check for `AP` under `Supported interface modes`).
3. Find its MAC address (`ip link show`), fill it into `config/udev/70-greennode-net.rules` so it's always named `wlan1` regardless of USB enumeration order.
4. Fill in real sub-node/provisioning SSIDs/passphrases in `config/hostapd/hostapd.conf` — **including a fresh, unique-per-unit passphrase for BSS4 (`greennode-setup`)**, generated at flash time and printed on that physical unit's label (see 1.14; do NOT reuse one passphrase across units the way BSS0-3 do). `config/wpa_supplicant/wpa_supplicant.conf`'s upstream SSID/passphrase can now be left as `CHANGE_ME` for units shipping to a farmer — that's the problem 1.14 solves — but still fill it in for a dev/test unit on a network you already control.
5. Fill in real ESP32 MAC addresses in `registry/devices.csv` for any devices you're pre-registering directly; devices onboarded through the pairing flow (1.12) get added automatically once the main backend's finalize route exists.
6. Run `scripts/install.sh` as root.
7. Verify: `systemctl status hostapd dnsmasq greennode-dnsmasq-setup greennode-shedding greennode-pairing-watcher greennode-uplink-provisioning`, `tc -s class show dev wlan1`, `iw dev wlan0 link`, `curl http://127.0.0.1:8091/pairing/status`, `curl http://127.0.0.1:8092/uplink/status`.
8. For a shipped (not dev/test) unit with no upstream credentials yet: connect a phone to `greennode-setup` using the label passphrase, and the captive portal should open automatically — see 1.14 for the flow.

See inline comments in each config/script for what needs to be filled in before first boot — placeholders are marked `CHANGE_ME`.

### 2.3 Pairing watcher — standalone-testable by design

`pairing_watcher.py` runs independently of the main FastAPI backend and works two ways:

- **Stub mode** (default, no config needed): `BACKEND_FINALIZE_URL` unset. Detected devices are appended to `registry/pending-devices.txt` (`epoch,mac,ip`) instead of being auto-registered. This lets you test the whole detection/pairing-window/handoff path — open a window, join an ESP32, watch it get logged — before the main backend's device-registration route exists at all.
- **Integrated mode**: set `BACKEND_FINALIZE_URL` to your FastAPI app's internal finalize route (e.g. `http://127.0.0.1:8000/internal/provision/finalize`), uncomment the `Environment=` line in `systemd/greennode-pairing-watcher.service`. The watcher then POSTs `{"mac": ..., "ip": ...}` to it and expects back the JSON credential payload to hand the ESP32.

The main backend controls pairing windows via the watcher's loopback-only control API:
```
POST http://127.0.0.1:8091/pairing/open   {"seconds": 120}
POST http://127.0.0.1:8091/pairing/close
GET  http://127.0.0.1:8091/pairing/status
```
This is the integration point for the "+ Add device" button's server-side handler — after your FastAPI route verifies the operator's password, it calls `/pairing/open` on this control port.

### 2.4 What's customizable — checklist

Everything below is a point where the repo hands you a working default that you're expected to change per deployment or per your own backend's shape. Grouped by file:

| File | What to customize |
|---|---|
| `config/hostapd/hostapd.conf` | The four sub-node `wpa_passphrase` values (`CHANGE_ME_*`); **BSS4's `wpa_passphrase` must be a fresh value generated per physical unit** (see 1.14), never reused; `channel=1` if your site's upstream router isn't on channel 6 (pick a non-overlapping channel — 1/6/11 — away from whatever `wpa_supplicant` connects to); `country_code` if deploying outside Sri Lanka |
| `config/wpa_supplicant/wpa_supplicant.conf` | Real upstream `ssid`/`psk` for a dev/test unit; leave as `CHANGE_ME` for units shipping to a farmer (they set this themselves via `greennode-setup`, see 1.14). Add more `network={}` blocks for fallback sites (e.g. a backup mobile hotspot) — `priority=` picks between them |
| `config/udev/70-greennode-net.rules` | The USB adapter's real MAC address (`CHANGE_ME:MAC:...`) |
| `config/dnsmasq/dnsmasq.conf` | DHCP range sizes per subnet if you expect more than ~190 devices on one SSID; lease times (provisioning is deliberately short, 5m — sensors/actuators are 12h) |
| `config/dnsmasq/dnsmasq-setup.conf` | Lease time (15m default) if farmers need longer to complete setup; this file must stay wlan1_4-only — see 1.14 for why the wildcard can't move into the main `dnsmasq.conf` |
| `registry/devices.csv` | Every row — this is your actual device fleet: MAC, reserved IP, interface, priority tier, rate/ceil, name |
| `scripts/tc-htb-setup.sh` | `TOTAL_RATE` (set to your USB adapter's realistic throughput, not its PHY rate); the per-SSID `rate`/`ceil`/`prio` triples if your actuator:sensor traffic ratio differs from the assumed split |
| `scripts/nftables-rules.sh` | `PROVISION_PORT` if you change `pairing_watcher.py`'s `PROVISION_PORT` env var; `SETUP_HTTP_PORT` if you change `uplink_provisioning.py`'s `SETUP_HTTP_PORT` env var — each pair must match |
| `scripts/pairing_watcher.py` | `DEFAULT_WINDOW_SECONDS` (how long a pairing window stays open); `BACKEND_FINALIZE_URL` (unset = stub mode, see 2.3) |
| `systemd/greennode-pairing-watcher.service` | Uncomment + set `Environment=BACKEND_FINALIZE_URL=...` once your FastAPI finalize route exists |
| `scripts/uplink_provisioning.py` | `CONNECT_TIMEOUT_S`/`SCAN_TIMEOUT_S` if your greenhouse site's real routers are slow to associate against or scan results take longer to settle; `NEW_NETWORK_PRIORITY` if you introduce more than two `network={}` blocks and need finer priority ordering |
| `scripts/shedding_daemon.py` | `RSSI_DEGRADED_DBM`/`RSSI_RECOVERED_DBM` thresholds and `CONSECUTIVE_POLLS_TO_ACT` — tune these once you have real RSSI readings from your actual greenhouse site rather than the placeholder defaults |

Not customizable per-deployment, but worth knowing where they live if requirements change: the inter-subnet isolation logic (`nftables-rules.sh` forward chain), the HTB tree structure itself (`tc-htb-setup.sh`'s `setup_tree` function), the hostapd-event detection mechanism (`pairing_watcher.py`'s `hostapd_listener` function), and the connect/rollback logic (`uplink_provisioning.py`'s `apply_new_network` function) — these are architecture, not per-site configuration.

Everything not covered by `pairing_watcher.py`'s stub mode — the actual FastAPI `/internal/provision/finalize` route, the SQLite `devices` table, MQTT credential/ACL generation — lives in your main backend codebase, outside this repo, and is the next piece to build.