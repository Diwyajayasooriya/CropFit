# GreenNode — Hardware & Initial Setup

Companion to `README.md` (the networking theory + config repo). This covers
the physical build: what to buy, how to bring the RPi4 up correctly, how to
get the USB adapter and ESP32 boards talking to it, and how to run/verify
everything day to day.

---

## Part 1 — Hardware list

### Hub (GreenNode itself)

| Item | Notes |
|---|---|
| Raspberry Pi 4 Model B, **4GB or 8GB** | 2GB works but is tight once `hostapd`, `dnsmasq`, an MQTT broker, FastAPI, SQLite, and two Python daemons are all running at once. Get 4GB minimum. |
| Official RPi4 USB-C power supply (5V/3A) | Not optional — this is the single most common cause of flaky USB-WiFi-adapter behavior. An underpowered supply causes intermittent USB brownouts that look exactly like a bad adapter or bad driver, and cost hours of misdiagnosis. If you already have a "5V/3A" phone charger, use the official one anyway first — many phone chargers under-deliver under sustained load. |
| microSD card, 32GB+, **A2/U3 rated** | A2 rating matters — SQLite does a lot of small random writes, and a cheap A1/no-rating card will bottleneck the whole system under load. |
| microSD card reader | For flashing from your Windows machine. |
| Ethernet cable | For first boot only (see Part 2, step 2) — avoids fighting `wlan0`'s config while you're still setting it up. |
| USB WiFi adapter for AP mode — **chipset matters, see below** | This is the one item where buying the wrong SKU wastes real time. |

### USB WiFi adapter — what to actually buy

Not every "USB WiFi dongle" supports **AP mode** in Linux, and cheap generic listings are often vague or wrong about their chipset. Two safe choices, in order of preference:

1. **Alfa Network AWUS036NHA** (Atheros AR9271 chipset) — the standard recommendation in the Linux wireless community for exactly this use case. Excellent `hostapd` AP-mode support, well-documented driver (`ath9k_htc`), works out of the box on Raspberry Pi OS with no extra driver compilation. Pricier (~$25-35) but you will not fight it.
2. **Any RT5370-chipset dongle** (commonly sold generically, sometimes labeled "802.11n USB WiFi adapter" with no brand) — cheap (~$5-8), also has solid in-kernel `hostapd` AP-mode support via the `rt2800usb` driver. The catch: generic listings don't always state the chipset honestly, so check reviews/teardowns for "RT5370" specifically before buying, or look up the exact model on the [Linux Wireless "AP mode" driver list](https://wireless.wiki.kernel.org/en/users/drivers) if buying something else.

**Avoid**, unless you've specifically confirmed AP-mode support: anything built on Realtek RTL8188EUS/RTL8192EU without checking first — many require an out-of-tree driver to be compiled manually, and AP-mode stability on some of these is genuinely poor. This includes some **TP-Link TL-WN722N** revisions — v1 uses the good AR9271 chipset, but v2/v3 silently switched to RTL8188EUS. Same model number, different hardware — check the version number on the box.

### Sub-nodes (ESP32 prototype devices)

| Item | Notes |
|---|---|
| ESP32-WROOM-32 DevKitC boards, one per prototype sensor/actuator | Cheapest, best-documented ESP32 dev board. Has onboard USB-serial (CP2102 or CH340 chip, varies by seller) — no separate programmer needed. |
| USB cable matching the board's port | Most DevKitC boards use Micro-USB; some newer ones use USB-C. Check the listing — a lot of people end up with the wrong cable on the first order. |
| Breadboard + jumper wires | For prototyping sensor wiring before anything is soldered/permanent. |
| Sensors matching your `registry/devices.csv` entries | For the soil-moisture/ambient-temp examples already in the registry: a capacitive soil moisture sensor (avoid the cheap resistive ones — they corrode within weeks) and a DHT22 (better accuracy than DHT11, worth the small extra cost). |
| A relay module or MOSFET driver board, per actuator | For anything switching real hardware (irrigation valve, vent motor) — the ESP32 GPIO pins can't drive these loads directly. |

### Also needed, not purchased

- **An existing WiFi network** (your home/lab router) for GreenNode's `wlan0` STA uplink to connect to during testing — this is separate from GreenNode's own AP radios and is just whatever WiFi you already have nearby.
- **A Windows machine with PlatformIO** (you already have this per your usual setup) for flashing ESP32 firmware, and an SSH client for the RPi4 — modern Windows 10/11 has `ssh`/`scp` built into PowerShell, no extra install needed.

---

## Part 2 — Bringing up the RPi4

### 1. Fix the networking stack default (Bookworm-specific, do this first)

Raspberry Pi OS Bookworm (the current release) defaults to **NetworkManager** for network config, not the classic `dhcpcd`. Everything in the `greennode-network` repo — `install.sh`'s edit to `/etc/dhcpcd.conf`, `hostapd`/`wpa_supplicant` running standalone — assumes the classic stack. If you skip this, `install.sh` will run without errors but several of its steps silently do nothing.

Fix it during first boot setup, via `raspi-config`:
```
sudo raspi-config
# Advanced Options -> Network Config -> switch from "NetworkManager" to "dhcpcd"
sudo reboot
```

### 2. Flash the OS

Use **Raspberry Pi Imager** on your Windows machine:
- OS: Raspberry Pi OS **Lite** (64-bit) — no desktop needed, this is a headless hub.
- Before writing, click the gear icon (advanced options) and set: hostname (e.g. `greennode`), enable SSH, set a username/password. **Leave WiFi unconfigured here** — connect via Ethernet for first boot instead, so you're not fighting `wlan0`'s config while `wpa_supplicant.conf` is still being deployed.
- Write to the microSD card, insert into the Pi, connect Ethernet, power on.

### 3. First SSH in

Find the Pi's IP (check your router's DHCP client list, or run `arp -a` / an equivalent scan from your Windows machine), then:
```
ssh <your-username>@<pi-ip>
```
Once in:
```
sudo apt update && sudo apt full-upgrade -y
sudo reboot
```

### 4. Copy the repo over

From your Windows machine (PowerShell):
```
scp -r greennode-network <your-username>@<pi-ip>:~/
```
Or if you have it as the `.tar.gz`:
```
scp greennode-network.tar.gz <your-username>@<pi-ip>:~/
ssh <your-username>@<pi-ip>
tar xzf greennode-network.tar.gz
```

### 5. Plug in the USB WiFi adapter, confirm it's recognized

```
lsusb                    # should show the adapter
iw dev                   # should list a new phy/interface
iw list | grep -A 10 "Supported interface modes"   # confirm "AP" is listed
```
If `AP` isn't in the supported modes list, this is the wrong adapter/driver — stop and check the chipset against Part 1's guidance before going further.

### 6. Fill in the CHANGE_ME values

```
cd ~/greennode-network
nano config/hostapd/hostapd.conf          # 4x wpa_passphrase
nano config/wpa_supplicant/wpa_supplicant.conf   # upstream ssid/psk
```
Get the USB adapter's MAC (`ip link show`, look for the newly-appeared interface) and fill it into:
```
nano config/udev/70-greennode-net.rules
```
Edit `registry/devices.csv` for any devices you're pre-registering directly (optional at this stage — devices added through the pairing flow get written automatically once the backend's finalize route exists).

### 7. Run the installer

```
sudo bash scripts/install.sh
```

### 8. Verify

```
systemctl status hostapd dnsmasq greennode-tc greennode-shedding greennode-pairing-watcher
iw dev wlan0 link                          # STA uplink connected?
iw dev wlan1 info                          # AP interface up, right channel?
tc -s class show dev wlan1                 # HTB classes present
curl http://127.0.0.1:8091/pairing/status  # pairing watcher responding
```
At this point Ethernet can be unplugged — GreenNode's uplink is now `wlan0`.

---

## Part 3 — Bringing up an ESP32 prototype device

You already work in PlatformIO/VS Code, so use that rather than the Arduino IDE.

### 1. Confirm the board is recognized

Plug the ESP32 DevKitC into your Windows machine via USB. Check Device Manager for a new COM port (shows as "Silicon Labs CP210x" or "USB-SERIAL CH340" depending on the board). If nothing appears, install the matching driver — CP2102 driver from Silicon Labs' site, or CH340 driver, whichever your board uses.

### 2. Create the PlatformIO project

New PlatformIO project, then set `platformio.ini`:
```ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
```

### 3. Minimal first firmware — just enough to test pairing

This is deliberately the bare minimum from the provisioning design: join the fixed provisioning network, then pull credentials from the known gateway IP.

```cpp
#include <WiFi.h>
#include <HTTPClient.h>

const char* PROVISION_SSID = "greennode-provision";
const char* PROVISION_PASS = "CHANGE_ME_provisioning_passphrase"; // match hostapd.conf
const char* PROVISION_URL  = "http://10.0.13.1:8090/provision";

void setup() {
  Serial.begin(115200);
  WiFi.begin(PROVISION_SSID, PROVISION_PASS);

  Serial.print("Connecting to provisioning network");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected. IP: " + WiFi.localIP().toString());

  HTTPClient http;
  http.begin(PROVISION_URL);
  int code = http.GET();
  Serial.printf("GET /provision -> HTTP %d\n", code);
  if (code == 200) {
    Serial.println(http.getString());   // credentials JSON, once backend finalize exists
  } else if (code == 403) {
    Serial.println("No open pairing window for this device — open one on GreenNode first.");
  } else if (code == 202) {
    Serial.println("Seen, pending operator confirmation (stub mode).");
  }
  http.end();
}

void loop() {}
```

### 4. Flash and watch it work

```
pio run --target upload
pio device monitor
```
On GreenNode, open a pairing window first so the ESP32's request isn't rejected:
```
curl -X POST http://127.0.0.1:8091/pairing/open -d '{"seconds": 120}'
```
Then power-cycle or reset the ESP32 and watch both the serial monitor and:
```
journalctl -u greennode-pairing-watcher -f
```
You should see the association logged, then the `/provision` request, then either a stub-mode "pending" response or real credentials once your backend's finalize route exists.

---

## Part 4 — Running guidelines (day to day)

**Check overall health:**
```
systemctl status hostapd dnsmasq greennode-tc greennode-shedding greennode-pairing-watcher
```

**Tail logs for a specific piece:**
```
journalctl -u greennode-shedding -f
journalctl -u greennode-pairing-watcher -f
journalctl -u hostapd -f
```

**See who's actually connected to the sensor AP:**
```
hostapd_cli -i wlan1 all_sta
```

**Check uplink signal quality:**
```
iw dev wlan0 link
```

**Check bandwidth class stats (which devices are being throttled/dropped):**
```
tc -s class show dev wlan1
```

**After editing `registry/devices.csv` (new permanent device, changed tier/rate):**
```
sudo bash scripts/generate-dhcp-hosts.sh
sudo systemctl restart dnsmasq
sudo bash scripts/tc-add-device-classes.sh
```

**Manually open/close a pairing window (before the frontend button is wired up):**
```
curl -X POST http://127.0.0.1:8091/pairing/open -d '{"seconds": 120}'
curl http://127.0.0.1:8091/pairing/status
curl -X POST http://127.0.0.1:8091/pairing/close
```

**If something's wrong, check in this order:** `iw dev wlan0 link` (is the uplink even connected?) → `systemctl status hostapd` (did the AP radio come up?) → `journalctl -u greennode-pairing-watcher` (is the watcher attached to hostapd's control socket?) → `tc -s class show` (are packets actually flowing through the classes you expect?).