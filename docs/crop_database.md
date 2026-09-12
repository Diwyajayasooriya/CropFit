# GreenNode — Database Design

Database architecture for the GreenNode hub (BlueCircle, AgriTech Startup Spark Innovation Challenge 2026). The system is split into two tiers — a **cloud/admin tier** (source of truth, cross-user, ML training) and an **edge/local tier** (runs on the RPi4 hub, real-time, must keep working when disconnected). This split exists because control-loop decisions in a greenhouse have to survive the hub losing its uplink, while ML training and cross-farm analytics need a centralized dataset no single hub can hold.

## 1. Architecture overview

```
                     ┌─────────────────────────────┐
                     │   CLOUD / ADMIN TIER          │
                     │   (PostgreSQL + TimescaleDB)  │
                     │                               │
                     │  user_authentication          │
                     │  nodes                        │
                     │  conditions   (hypertable)     │
                     │  rules                        │
                     │  node_rules                    │
                     └───────────────▲───────────────┘
                                     │ batch sync
                                     │ (MQTT bridge / REST push)
                     ┌───────────────┴───────────────┐
                     │   EDGE / LOCAL TIER            │
                     │   (SQLite, WAL mode, on RPi4)  │
                     │                               │
                     │  local_user                    │
                     │  local_node                    │
                     │  devices                       │
                     │  condition_db (real-time log)  │
                     │  node_rules_cache               │
                     │  actions_log                    │
                     └───────────────────────────────┘
```

The admin tier is authoritative for identity, node registry, and the long-term condition history used for ML. The edge tier holds only what the hub needs to act *right now*, plus enough of a cache (rules, recent readings) to keep functioning during an outage.

## 2. Entities

### Cloud / Admin tier

| Table | Purpose | Key fields |
|---|---|---|
| `user_authentication` | Login credentials and role, platform-wide | `user_id` PK, `email`, `password_hash`, `role`, `last_login_at` |
| `nodes` | Registry of every GreenNode hub deployed across all users | `node_id` PK, `owner_user_id` FK, `node_type`, `label`, `location`, `firmware_version`, `status`, `last_seen_at` |
| `conditions` | Time-series greenhouse condition log, aggregated from all hubs — TimescaleDB hypertable | `reading_id`, `node_id` FK, `ts`, `temperature`, `humidity`, `soil_moisture`, `light`, `co2`, `action_taken` (json), `source` |
| `rules` | Actuator rules mined from `conditions` | `rule_id` PK, `crop_type`, `condition` (json), `action` (json), `priority`, `confidence`/`support`, `model_version`, `status` |
| `node_rules` | Junction: which rules are installed on which nodes | `node_id` FK, `rule_id` FK, `installed_at`, `active` |

### Edge / Local tier (per hub)

| Table | Purpose | Key fields |
|---|---|---|
| `local_user` | Cached subset of the owning user's profile, needed for local operation | `user_id`, `name`, `contact`, `config` (json — WiFi/MQTT settings) |
| `local_node` | Self-descriptor: this hub's own config | `node_id` (matches cloud UUID) PK, `user_id` FK, `config` (json), `firmware_version` |
| `devices` | Third-party sensor/actuator sub-nodes connected to this hub | `device_id` PK, `node_id` FK, `device_type`, `mac_address`, `assigned_ssid`, `health_status`, `bandwidth_usage`, `status` |
| `condition_db` | Real-time sensor log, high write volume | `reading_id`, `node_id` FK, `device_id` FK, `ts`, `temperature`, `humidity`, ..., `synced` (bool), `synced_at` |
| `node_rules_cache` | Local copy of this node's active rules, pulled from cloud `node_rules`/`rules` | `rule_id`, `node_id`, `condition` (json), `action` (json), `priority`, `pulled_at` |
| `actions_log` | Record of actuator commands actually dispatched | `action_id`, `node_id` FK, `device_id` FK (actuator), `rule_id` FK (nullable — null on manual override), `command`, `triggered_at`, `synced` (bool) |

## 3. Relationships and reasoning

| Relationship | Cardinality | Reasoning |
|---|---|---|
| `user_authentication → nodes` | 1 : N | One farmer can own several GreenNode hubs. Ownership needs to live centrally since it's used for auth/access control across the whole platform, not just one hub. |
| `nodes → conditions` | 1 : N | Every condition reading belongs to exactly one hub. Kept in the cloud tier (not local) because ML training needs data pooled across *all* nodes, not siloed per hub. |
| `nodes ↔ rules` via `node_rules` | N : M | A rule (e.g. "vent if temp > 32°C for greenhouse tomatoes") can apply to many nodes growing the same crop; one node can have several active rules (temperature, humidity, light) simultaneously. A direct FK can't express this — hence the junction table, which was missing from the original design. |
| `user_authentication → local_user` | 1 : N (cached) | Not a real FK across databases — it's a sync relationship. The hub caches only the fields it needs to operate (name, contact, connectivity config), not the full identity record, to minimize what's stored on a device that could be physically accessed. |
| `local_user → local_node` | 1 : N | Mirrors the cloud ownership relationship locally, scoped to whichever hubs share this user's local network/config. |
| `local_node → devices` | 1 : N | One hub manages many third-party sensor/actuator sub-nodes (ESP32, Pico W). This is the core "orchestration" relationship — GreenNode doesn't manufacture these devices, it aggregates and controls them. |
| `local_node → condition_db` / `devices → condition_db` | 1 : N each | A reading belongs to both the hub that ingested it and the specific device that produced it — needed to trace a bad reading back to a specific faulty sensor. |
| `local_node → actions_log` / `devices → actions_log` | 1 : N each | Every actuator command is tied to the hub that issued it and the specific actuator that received it — required for audit and for debugging false triggers. |
| `node_rules_cache → actions_log` (via `rule_id`) | 1 : N | Links a dispatched action back to the exact rule that fired it (nullable, since a farmer's manual override in the admin panel produces an action with no rule behind it). |
| `condition_db → conditions` | batch sync, not a FK | Local readings are periodically compacted and pushed to the cloud hypertable. This is intentionally *not* modeled as a database-level foreign key — it's an ETL/sync job, because the two rows can live in different databases entirely and the local row must survive even if the sync temporarily fails. |

### Why the two "Node" tables aren't the same table

`nodes` (cloud) and `local_node` (edge) describe the same physical hub but serve different purposes: `nodes` is the platform's registry entry (used for auth, billing, fleet monitoring), while `local_node` is the hub's own working copy of its config (used to boot and operate even with zero connectivity). They share a primary key (`node_id`) so they can be correlated during sync, but they are deliberately separate rows in separate databases — collapsing them into one table would mean the hub can't operate offline.

### Why `synced` flags exist on `condition_db` and `actions_log`

Without a sync-status column, the sync job has no way to know which local rows have already been pushed to the cloud — it would either resend everything (duplicate data) or risk dropping rows on a dropped connection. `synced` + `synced_at` let the sync daemon batch only new rows and support local retention pruning (e.g., delete rows older than 7 days *and* already synced, to protect the SD card).

## 4. Deriving `rules` from `conditions`

`conditions` accumulates rows shaped like `(sensor state) → (action taken)` — effectively a labeled dataset. The pipeline:

1. **Split features/label** — features: temperature, humidity, soil_moisture, light, co2, time-of-day, crop_type; label: `action_taken`.
2. **Train an interpretable model** — a decision tree (or rule-induction algorithm like RIPPER) rather than a black-box model, because each leaf path reads directly as an if-then rule that maps onto `rules.condition` / `rules.action`.
3. **Extract rules** — each root-to-leaf path becomes one `rules` row; the leaf's sample count/purity becomes the confidence/support metric.
4. **Version and retrain periodically** — a scheduled batch job re-trains against the growing `conditions` table, bumps `model_version`, and marks superseded rules `status = deprecated` rather than deleting them (so historical `actions_log` entries still resolve against the rule that actually fired).
5. **Push down, don't poll live** — updated `node_rules` rows are pulled into each hub's `node_rules_cache` on a schedule, so the hub can evaluate rules locally even if offline when a decision is actually needed.

## 5. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Cloud/admin DB | PostgreSQL + TimescaleDB | `conditions` as a hypertable for efficient time-series storage/queries; everything else as normal relational tables in the same instance |
| Edge/hub DB | SQLite (WAL mode) | Zero-admin, file-based, suited to the RPi4/SD card; WAL mode allows concurrent read (rule engine) + write (ingestion) |
| ORM | SQLAlchemy (shared across both tiers) | Same schema-as-code on cloud and edge keeps the two schemas from drifting as more hubs are deployed |
| Migrations | Alembic | Versioned schema upgrades — needed once hubs in the field are running different schema versions |
| Sync transport | MQTT bridge (Mosquitto local → cloud) or REST batch push from a local sync daemon | Reuses the existing Mosquitto/MQTT infrastructure already used for actuator commands, instead of adding a second pipeline |
| Rule mining | scikit-learn (`DecisionTreeClassifier`) + APScheduler for retraining cron | Interpretable output that maps directly onto the `rules` json schema; cheap enough to run without dedicated ML infrastructure |
| Backend API | FastAPI | Already selected — serves both the admin panel and the sync endpoints |
| Admin panel | Electron + React | Already selected |
| Mobile app | React Native | Already selected |