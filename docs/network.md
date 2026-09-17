# GreenNode Networking Layer — Theory & Implementation

This document covers the wireless networking theory behind GreenNode's hub design, then how it's actually built: Raspberry Pi 4, onboard radio in STA mode for uplink, USB WiFi adapter in AP mode hosting three isolated sub-node SSIDs, with per-device bandwidth partitioning and adaptive shedding under weak uplink conditions.

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

---

## Part 2 — Implementation

### 2.1 Layout

```
greennode-network/
├── README.md                          (this file)
├── config/
│   ├── hostapd/hostapd.conf           (multi-BSS AP config, wlan1/wlan1_1/wlan1_2)
│   ├── wpa_supplicant/wpa_supplicant.conf   (STA uplink config, wlan0)
│   ├── dnsmasq/dnsmasq.conf           (per-subnet DHCP + static reservations)
│   ├── dhcpcd/dhcpcd-append.conf      (static IPs for AP interfaces)
│   └── udev/70-greennode-net.rules    (pins USB adapter to wlan1 by MAC)
├── registry/devices.csv               (MAC → IP → tier → interface mapping — edit this per deployment)
├── scripts/
│   ├── install.sh                     (one-shot setup: packages, configs, services)
│   ├── enable-ip-forwarding.sh
│   ├── nftables-rules.sh              (NAT + inter-subnet isolation)
│   ├── tc-htb-setup.sh                (base HTB trees, 3 interfaces)
│   ├── tc-add-device-classes.sh       (per-device leaf classes from registry/devices.csv)
│   └── shedding_daemon.py             (adaptive shedding, polls RSSI + tc stats)
└── systemd/
    └── greennode-shedding.service
```

### 2.2 Deployment order

1. Flash Raspberry Pi OS (Bookworm or later), enable SSH.
2. Plug in the USB WiFi adapter, confirm it's `hostapd`-AP-mode-capable (`iw list` → check for `AP` under `Supported interface modes`).
3. Find its MAC address (`ip link show`), fill it into `config/udev/70-greennode-net.rules` so it's always named `wlan1` regardless of USB enumeration order.
4. Fill in real upstream SSID/passphrase in `config/wpa_supplicant/wpa_supplicant.conf`, and real sub-node SSIDs/passphrases in `config/hostapd/hostapd.conf`.
5. Fill in real ESP32 MAC addresses in `registry/devices.csv` as sub-nodes are provisioned.
6. Run `scripts/install.sh` as root.
7. Verify: `systemctl status hostapd dnsmasq greennode-shedding`, `tc -s class show dev wlan1`, `iw dev wlan0 link`.

See inline comments in each config/script for what needs to be filled in before first boot — placeholders are marked `CHANGE_ME`.
