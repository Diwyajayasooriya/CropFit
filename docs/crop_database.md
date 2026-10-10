# GreenNode — Database Design

This document describes the two-tier database architecture for GreenNode: a **cloud/admin tier** (source of truth, cross-user, used for ML) and an **edge/local tier** (runs on the GreenNode hub itself, real-time, must survive disconnection from the cloud).

The split exists because control-loop decisions have to keep working even when the hub loses internet access — sensors and actuators can't wait on a round trip to the cloud, but the cloud still needs a complete, aggregated picture across every deployed hub for reporting and for training the rule-derivation model.

---

## 1. Architecture at a glance

```
                    ┌─────────────────────────────────────────┐
                    │           CLOUD / ADMIN TIER             │
                    │        (PostgreSQL + TimescaleDB)        │
                    │                                           │
                    │  user_authentication                      │
                    │  nodes                                    │
                    │  node_background_history (crop/stage)     │
                    │  conditions   (hypertable, ML training)   │
                    │  actions_log_cloud (synced action audit)  │
                    │  rules        (derived from conditions)   │
                    │  node_rules   (which rules run where)     │
                    └───────────────▲───────────────────────────┘
                                    │  batch sync (periodic push)
                                    │  rule pull  (periodic pull)
                    ┌───────────────┴───────────────────────────┐
                    │            EDGE / LOCAL TIER               │
                    │         (SQLite, on the RPi4 hub)          │
                    │                                             │
                    │  node_identity     (factory-code identity)  │
                    │  connected_devices (paired sub-node allowlist) │
                    │  conditions        (real-time sensor log)   │
                    │  node_rules_cache  (offline rule copy)      │
                    │  actions_log       (actuator command audit) │
                    └─────────────────────────────────────────────┘
```

---

## 2. Cloud / Admin tier

Owned and maintained centrally. This is the platform's system of record — used for cross-hub reporting, user management, and as the training dataset for rule derivation.

### `user_authentication`
| Field | Type | Notes |
|---|---|---|
| user_id | uuid, PK | |
| email | string, unique | |
| password_hash | string | never store plaintext |
| role | string | farmer / admin / support |
| mfa_enabled | boolean | |
| last_login_at | timestamp | |
| created_at | timestamp | |

### `nodes`
Registry of every physical GreenNode hub deployed across all users.

| Field | Type | Notes |
|---|---|---|
| node_id | uuid, PK | shared with `local_node.node_id` on the hub |
| owner_user_id | uuid, FK → user_authentication | |
| node_type | string | hardware/model revision only — **not** crop type; see `node_background_history` below |
| label | string | farmer-facing name |
| location | string | address or lat/long |
| firmware_version | string | |
| status | string | online / offline / maintenance |
| last_seen_at | timestamp | |
| installed_at | timestamp | |

### `node_background_history`
What's actually growing in a given hub, and at what stage — kept as history rather than a static field on `nodes`, because both a replant and a stage transition would otherwise silently reattribute every past `conditions` row to the new background. Each row is a window; the current background is whichever row has `ended_at IS NULL`.

Calendar season was dropped from this table — these are controlled-environment greenhouses, so outdoor seasonal convention doesn't drive thresholds the way growth stage does. A seedling and a fruiting plant of the same crop need different thresholds regardless of time of year; that's the axis that actually matters here.

| Field | Type | Notes |
|---|---|---|
| history_id | bigserial, PK | |
| node_id | uuid, FK → nodes | |
| crop_type | string | what's growing — this is the field the training/pooling logic joins against, not `nodes.node_type` |
| growth_stage | string | e.g. `seeding`, `vegetative`, `flowering`, `picking` — whatever stage vocabulary the platform settles on per crop |
| started_at | timestamp | when this crop/stage began on this hub |
| ended_at | timestamp, nullable | null = still active; set when the farmer replants or the plant moves to its next stage |

### `conditions` (TimescaleDB hypertable, partitioned by time)
The large greenhouse-conditions dataset used for ML. This is an aggregate/append-only log fed by every hub's `condition_db`.

| Field | Type | Notes |
|---|---|---|
| reading_id | bigserial | |
| node_id | uuid, FK → nodes | |
| ts | timestamp | hypertable time column |
| temperature, humidity, soil_moisture, light, co2 | float | extend as sensor types grow |
| source | string | `sensor_realtime` \| `aggregated` |

> **Note:** an earlier version of this table carried an `action_taken` JSON field inline. That's been removed in favor of `actions_log_cloud` (§2, cloud tier) — the flattened field had no way to distinguish a farmer's manual action from one the system already took automatically, which matters for training (see §2.1 below).

### `rules`
Rules mined from `conditions` (see §5). Most rules are fleet-wide — defined per crop type and reusable across every hub growing that crop — but a rule can also be personalized to a single hub once that hub has enough of its own history to justify drifting from the fleet default.

| Field | Type | Notes |
|---|---|---|
| rule_id | uuid, PK | |
| node_id | uuid, FK → nodes, nullable | null = fleet-wide rule; set = personalized to this one hub |
| scope | string | `fleet` \| `node` — makes the `node_id` nullability explicit and gives the retraining job a clean way to find "the personalized rule for this hub" without inferring it from nullability alone |
| crop_type / growth_stage / node_type | string | what context the rule applies to — matched against `node_background_history` for the crop/stage part |
| condition | json | e.g. `{"temperature": {"op": ">", "value": 32}}` |
| action | json | e.g. `{"device_type": "fan", "command": "on"}` |
| priority | int | resolves conflicts when multiple rules fire — a personalized (`scope = node`) rule should be given higher priority than the fleet default it overrides |
| confidence / support | float | training metrics from the model |
| model_version | string | |
| status | string | draft / active / deprecated |

### `node_rules` (junction table)
**This was the missing piece in the original design.** A node can run several rules, and a rule can be installed on many nodes — that's a many-to-many relationship, which needs its own table rather than a direct `nodes ↔ rules` link.

| Field | Type | Notes |
|---|---|---|
| node_id | uuid, FK → nodes | |
| rule_id | uuid, FK → rules | |
| installed_at | timestamp | |
| active | boolean | lets you disable a rule on one node without deleting it globally |

### `actions_log_cloud`
Synced copy of each hub's edge `actions_log`. This replaces `conditions.action_taken` as the source of action labels for training — the flattened JSON field on `conditions` had no way to carry `triggered_by`, which means a training query using it couldn't tell a farmer's manual override from an action the system already took on its own. Training directly on that would let the model partly imitate its own past predictions instead of the farmer's judgment. `actions_log_cloud` keeps the distinction intact.

| Field | Type | Notes |
|---|---|---|
| action_id | bigserial, PK | |
| node_id | uuid, FK → nodes | |
| device_id | text | the actuator that received the command, as reported by the hub |
| action | string | e.g. `open`, `close`, `set_temp:24` |
| triggered_by | string | `rule` \| `manual` \| `ml` — the field the training query filters on |
| source_ref | string | `rule_id` when `triggered_by` is `rule`/`ml`; user/session id when `manual` |
| condition_reading_id | bigint, FK → conditions.reading_id, nullable | the reading that triggered this action; null for manual overrides |
| executed_at | timestamp | |

---

# GreenNode — Database Setup for the ML Rule-Mining Pipeline

## 1. How the database and the ML pipeline relate

The ML model (a decision tree, per the design document) doesn't train on a separate dataset — it trains directly on `conditions`, joined against `node_background_history` (for crop/growth-stage context) and `actions_log_cloud` (for the label). That's the core design decision to understand before touching SQL:

```
sensor readings  ─────►  conditions (hypertable)  ───┐
                                                       │
node_background_history (crop/stage) ──────────────────┼─────►  training query
                                                       │
actions_log_cloud (triggered_by='manual') ────────────┘
                                                                │
                                                                ▼
                                                    DecisionTreeClassifier.fit()
                                                                │
                                                                ▼
                                                    one row per leaf  ─────►  rules table
                                                                │
                                                                ▼
                                              node_rules (which hub runs which rule)
```

So the schema has to satisfy two different access patterns at once:

- **High-frequency writes** — every hub pushes sensor readings continuously. This is what TimescaleDB's hypertable/chunking exists for.
- **Batch analytical reads** — the training job periodically scans a large historical slice of the same table to build a labelled dataset. This is what compression and continuous aggregates exist for.

A plain Postgres table would work for the first pattern and get slow for the second as data accumulates over a season. That's the specific reason `conditions` is a hypertable and not an ordinary table.

---

## 2. The tables that matter for ML

### 2.1 `conditions` — the feature data

Every row is the sensor-state half of a training example; the label now lives in `actions_log_cloud`, joined in at query time (§4).

```sql
CREATE TABLE conditions (
    reading_id     BIGSERIAL,
    node_id        UUID NOT NULL REFERENCES nodes(node_id),
    ts             TIMESTAMPTZ NOT NULL,
    temperature    DOUBLE PRECISION,
    humidity       DOUBLE PRECISION,
    soil_moisture  DOUBLE PRECISION,
    light          DOUBLE PRECISION,
    co2            DOUBLE PRECISION,
    source         TEXT,      -- 'sensor_realtime' | 'aggregated'
    PRIMARY KEY (reading_id, ts)
);
```

For this to be trainable data rather than just a log, two things matter more than the rest:

- **The join to `actions_log_cloud`** (via `condition_reading_id`) is what makes each row a supervised-learning example rather than a plain sensor log — and specifically, filtering that join to `triggered_by = 'manual'` is what makes it an example of *farmer* judgment rather than the system re-confirming its own prior rule firings. A reading with no matching action row is unlabeled and gets excluded, same as before.
- **`node_id`** lets you train per-hub or per-crop/stage models by joining to `node_background_history` for whichever crop and growth stage was active at `ts` (not `nodes.node_type`, which is hardware only — see §2 above), rather than lumping every greenhouse together.

> **Note:** `PRIMARY KEY (reading_id, ts)` — not `reading_id` alone — is a TimescaleDB requirement, not a stylistic choice: any unique or primary key on a hypertable must include the partitioning column (`ts`). Leaving `ts` out of the key will fail when you run `create_hypertable`.

### 2.2 `rules` — the model's output

```sql
CREATE TABLE rules (
    rule_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_id       UUID REFERENCES nodes(node_id),  -- nullable: null = fleet-wide, set = personalized
    scope         TEXT NOT NULL DEFAULT 'fleet',    -- 'fleet' | 'node'
    crop_type     TEXT,
    growth_stage  TEXT,
    node_type     TEXT,
    condition     JSONB NOT NULL,   -- e.g. {"temperature": {"op": ">", "value": 32}}
    action        JSONB NOT NULL,   -- e.g. {"device_type": "fan", "command": "on"}
    priority      INTEGER NOT NULL DEFAULT 0,
    confidence    DOUBLE PRECISION, -- from the training run
    support       DOUBLE PRECISION, -- from the training run
    model_version TEXT,
    status        TEXT NOT NULL DEFAULT 'draft'
);
```

This is a plain (non-hypertable) table — it's small, low-write-volume, and doesn't need time-partitioning. `model_version` + `status` together are what let you retrain repeatedly without losing history: a new training run inserts new `draft` rows under a new `model_version` and marks the rules it replaces `deprecated`, rather than overwriting anything. `node_id` + `scope` let the same mechanism produce two tiers of rule from two different training runs — a fleet-wide run (grouped by crop/growth-stage, no `node_id`) and, once a hub has enough of its own history, a personalized run scoped to that one `node_id` — without needing a second table.

### 2.3 `actions_log_cloud` — the label

```sql
CREATE TABLE actions_log_cloud (
    action_id             BIGSERIAL PRIMARY KEY,
    node_id               UUID NOT NULL REFERENCES nodes(node_id),
    device_id             TEXT NOT NULL,
    action                TEXT NOT NULL,   -- e.g. 'open', 'close', 'set_temp:24'
    triggered_by          TEXT NOT NULL,   -- 'rule' | 'manual' | 'ml'
    source_ref            TEXT,            -- rule_id, or a user/session id when manual
    condition_reading_id  BIGINT,          -- FK to conditions.reading_id, nullable
    executed_at           TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_actions_log_cloud_node_ts ON actions_log_cloud (node_id, executed_at DESC);
```

`triggered_by` is the field that makes this table the label source rather than `conditions.action_taken`: it's what lets the training query in §4 select only `manual` actions as the imitation-learning signal, instead of mixing in the model's own past `rule`/`ml` decisions.

---

## 3. The TimescaleDB process, step by step

### Step 1 — Enable the extension (once per database)

```sql
CREATE EXTENSION IF NOT EXISTS timescaledb;
```

### Step 2 — Create `conditions` as an ordinary table first, then convert it

TimescaleDB hypertables are created *from* a regular table, not written as one from scratch:

```sql
CREATE TABLE conditions ( ... as above ... );

SELECT create_hypertable('conditions', 'ts');
```

`create_hypertable` partitions the table into **chunks** behind the scenes — internally separate physical tables, one per time interval, that Postgres/Timescale query transparently as if they were one table. Sensor writes land in whichever chunk covers the current time; the training query's `WHERE ts BETWEEN ...` clause lets Timescale skip chunks entirely outside that range instead of scanning the whole table.

> **Note:** The default chunk interval is 7 days. You can set it explicitly:
> ```sql
> SELECT create_hypertable('conditions', 'ts', chunk_time_interval => INTERVAL '1 day');
> ```
> For a single pilot greenhouse with a handful of sensors, daily chunks are a reasonable starting point — small enough that old chunks compress cleanly, large enough not to create excessive chunk overhead. I don't have a verified benchmark for your exact sensor count/frequency, so treat this as a starting point to tune once you see real write volume, not a fixed number.

### Step 3 — Index for the training query's access pattern

```sql
CREATE INDEX idx_conditions_node_ts ON conditions (node_id, ts DESC);
```

The training job's typical query filters by `node_id` (or joins to `nodes` for `node_type`/`crop_type`) and a time range — this index supports exactly that, and TimescaleDB will apply it per-chunk automatically.

### Step 4 — Compress older chunks

This is the step that matters once you're past a few weeks of data. Compression can shrink storage substantially for time-series data like this (exact ratio depends on your data — don't take a specific percentage as given without checking your own numbers), and compressed chunks are still queryable, just not writable in place.

```sql
ALTER TABLE conditions SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'node_id'
);

SELECT add_compression_policy('conditions', INTERVAL '7 days');
```

This tells Timescale: once a chunk is older than 7 days, compress it automatically as a background job. `compress_segmentby = 'node_id'` keeps each hub's readings grouped together on disk, which matches how the training job queries (per node/crop type).

> **Note:** Recent readings (last 7 days, in this example) stay uncompressed and fully write-friendly for the live sensor stream; only historical data used for training gets compressed. Adjust the interval to whatever the sensor write pattern and query needs actually turn out to be.

### Step 5 — (Optional but recommended) Continuous aggregates for feature engineering

If the model benefits from rolled-up features — e.g. "average temperature over the last hour" rather than only instantaneous readings — a continuous aggregate keeps a materialized rollup up to date automatically, so the training query doesn't have to recompute averages over raw data every time it runs.

```sql
CREATE MATERIALIZED VIEW conditions_hourly
WITH (timescaledb.continuous) AS
SELECT
    node_id,
    time_bucket('1 hour', ts) AS bucket,
    avg(temperature)   AS avg_temperature,
    avg(humidity)       AS avg_humidity,
    avg(soil_moisture)  AS avg_soil_moisture
FROM conditions
GROUP BY node_id, bucket;

SELECT add_continuous_aggregate_policy('conditions_hourly',
    start_offset => INTERVAL '3 days',
    end_offset   => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');
```

> **Note:** `time_bucket()` and the continuous-aggregate policy functions are core TimescaleDB features, but exact argument names/defaults have changed across TimescaleDB versions in the past. Check the syntax against the TimescaleDB version you actually install before running this in production — don't copy this verbatim without confirming against current docs.

This step is optional for a first pilot — start with raw `conditions` rows as training input (Steps 2–4 are enough for that), and add continuous aggregates once you know the model actually benefits from rolled-up features rather than instantaneous ones.

### Step 6 — Retention policy (only once you're sure you don't need raw data forever)

```sql
SELECT add_retention_policy('conditions', INTERVAL '1 year');
```

This automatically drops chunks older than the interval. **Be careful with this one** — it deletes data outright, including data the model might benefit from retraining on later. For a 6-month pilot, you likely don't need this yet; it matters more once the platform is running long enough that raw historical data becomes a real storage cost rather than a training asset.

---

## 4. The training query itself

This is the SQL the training job runs to pull a labelled dataset for one crop type and growth stage before handing it to scikit-learn. Three changes from the earlier version: it joins `node_background_history` for crop type *and* growth stage instead of misusing `nodes.node_type` (which is hardware, not crop) or a calendar season (which doesn't drive thresholds in a controlled environment); and it joins `actions_log_cloud` filtered to `triggered_by = 'manual'` instead of reading `conditions.action_taken`, so the label reflects farmer judgment rather than the system's own past decisions.

```sql
SELECT
    c.temperature,
    c.humidity,
    c.soil_moisture,
    c.light,
    c.co2,
    EXTRACT(HOUR FROM c.ts) AS hour_of_day,
    a.action
FROM conditions c
JOIN node_background_history bg
    ON bg.node_id = c.node_id
   AND c.ts >= bg.started_at
   AND (bg.ended_at IS NULL OR c.ts < bg.ended_at)
JOIN actions_log_cloud a
    ON a.condition_reading_id = c.reading_id
WHERE bg.crop_type = 'tomato'
  AND bg.growth_stage = 'flowering'
  AND a.triggered_by = 'manual'
  AND c.ts >= now() - INTERVAL '90 days';
```

For the **fleet-wide** run this is the whole query — it pools every hub currently growing that crop at that stage. A **personalized** run for one hub adds `AND c.node_id = :node_id` and writes its output rows with that `node_id` and `scope = 'node'` set on `rules`, rather than leaving them fleet-wide.

Feed this into the training script:

```python
from sklearn.tree import DecisionTreeClassifier

def train_rules_for(crop_type: str, growth_stage: str, db_session, node_id: str | None = None):
    # node_id=None -> fleet-wide run, pooled across every hub growing crop_type at this stage
    # node_id set  -> personalized run, scoped to that one hub's own history
    X, y = load_training_data(db_session, crop_type, growth_stage, node_id)   # runs the query above
    clf = DecisionTreeClassifier(max_depth=4, min_samples_leaf=20)
    clf.fit(X, y)
    for leaf_condition, leaf_action, support, confidence in extract_leaves(clf, X, y):
        db_session.add(models.Rule(
            crop_type=crop_type,
            growth_stage=growth_stage,
            node_id=node_id,
            scope="node" if node_id else "fleet",
            condition=leaf_condition,
            action=leaf_action,
            support=support,
            confidence=confidence,
            model_version=new_version_tag(),
            status="draft",
            priority=10 if node_id else 0,  # personalized rules outrank fleet defaults
        ))
    db_session.commit()
```

> **Note:** `extract_leaves()` is a placeholder for logic you write against the fitted tree's `tree_.feature`, `tree_.threshold` and `tree_.value` attributes — it isn't a built-in scikit-learn function. Verify those attribute names against the current scikit-learn docs before implementing; internal estimator APIs are exactly the kind of detail worth double-checking rather than trusting from memory.

---

## 5. Summary of the flow

1. Hubs write raw sensor readings into `conditions`, and every action (manual or automated) into edge `actions_log`, continuously.
2. `create_hypertable` chunks `conditions` by time so writes stay fast as data accumulates; `actions_log` syncs to `actions_log_cloud` on the same batch pattern.
3. Older chunks get compressed on a schedule, keeping storage down without deleting anything.
4. (Optional) continuous aggregates pre-compute rolled-up features if the model needs them.
5. A scheduled job queries `conditions` (joined to `node_background_history` for crop type and growth stage, and to `actions_log_cloud` filtered to `triggered_by = 'manual'` for the label) as labelled training data, fits a decision tree, and writes the result into `rules` as new `draft` rows tied to a `model_version` — fleet-wide by default, or scoped to one `node_id` for a personalized retrain.
6. Once reviewed/approved, `rules` rows flip to `active` and get linked to specific hubs via `node_rules`, which the hub then pulls down into its local `node_rules_cache` to run offline. A personalized rule's higher `priority` lets it override its fleet-wide counterpart on that one hub without disabling the rule anywhere else.

This is the minimum you need to get the database and the ML pipeline talking to each other correctly. Retention policies and continuous aggregates (§3, Steps 5–6) are refinements to add once the pilot is generating real data volume — they're not required to get a first training run working.

## 3. Edge / Local tier — Node Database Implementation

This section is the **actual build** of the single-node edge database — what runs on one GreenNode hub, in SQLite, on the RPi4 itself. It supersedes the earlier `local_user` / `local_node` sketch: a single hub doesn't need a multi-row "nodes" abstraction locally, it needs its own durable identity, its own allowlist of paired sub-devices, and a lean operational log. Cloud-side bookkeeping (owner, billing, fleet status) stays where it belongs — in the cloud tier's `nodes` and `user_authentication` tables.

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous  = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA foreign_keys = ON;
```

WAL mode lets the ingestion writer and the rule-evaluation reader work concurrently without locking each other out. `synchronous = NORMAL` trades a sliver of durability for meaningfully better write throughput on high-frequency sensor telemetry. `busy_timeout` absorbs the brief contention that comes from SQLite's single-writer limit. `foreign_keys = ON` is required because SQLite doesn't enforce FK constraints by default.

### `node_identity`
The hub's own durable identity — set once at provisioning, never overwritten by normal app logic. Enforced as a **single row** via the `CHECK (id = 1)` constraint. This is what lets the cloud (and a human, physically) verify "this data really came from this device."

| Field | Type | Notes |
|---|---|---|
| id | integer, PK | always `1` — enforces single-row table |
| node_uid | text, unique | the node's factory code — a random UUIDv4 generated at first boot; this is what goes out in every synced row and rule reference |
| hardware_serial | text | the RPi4's own CPU serial (read from `/proc/cpuinfo`), kept for physical cross-verification against `node_uid` |
| firmware_version | text | |
| provisioned_at | timestamp | |

```python
import uuid

def provision_node(db_conn):
    node_uid = str(uuid.uuid4())
    hw_serial = get_cpu_serial()  # reads 'Serial' line from /proc/cpuinfo
    db_conn.execute(
        "INSERT INTO node_identity (id, node_uid, hardware_serial) VALUES (1, ?, ?)",
        (node_uid, hw_serial)
    )
```
Runs once, guarded by "only if `node_identity` is empty" — not on every app start.

### `connected_devices`
The allowlist of third-party sensors/actuators (ESP32, Pico W, etc.) this hub trusts. **This is the enforcement point** — a device must be paired (inserted here) before any of its readings or command receipts are accepted, which prevents a rogue or misconfigured sub-node from injecting fake data.

| Field | Type | Notes |
|---|---|---|
| device_id | text, PK | sub-node's own hardware-reported ID (MAC address or chip ID) |
| device_category | string | `sensor` \| `actuator` — broad class; tells ingestion whether this device reports into `conditions` or receives commands via `actions_log` |
| device_type | string | specific capability within that category, e.g. `temperature`, `humidity`, `soil_moisture`, `co2`, `light` for sensors; `valve`, `fan`, `light`, `heater` for actuators |
| label | string | human-friendly display name only, e.g. "Zone 2 Soil Moisture" — cosmetic, no longer used for identification |
| status | string | `active` \| `revoked` \| `offline` |
| paired_at | timestamp | |
| last_seen | timestamp | |
| synced | boolean | whether the pairing record has been pushed to the cloud registry |

Splitting the old single `device_type` (`sensor`/`actuator`) into `device_category` + `device_type` generalizes device identification: a node can now be queried or matched by exact capability ("give me this node's `humidity` sensor") instead of by its free-text `label`, which was never meant to be parsed. It also directly lines up with the `device_type` key already used in `rules.action` and `actions_log.action` (e.g. `{"device_type": "fan", "command": "on"}`) — the same vocabulary identifies a device here and drives what a rule targets there. New device types (e.g. a `co2` actuator, a `pressure` sensor) are just new `device_type` values, no schema change needed.

Ingestion checks `status = 'active'` before writing anything to `conditions` — an unregistered or revoked `device_id` is rejected, not silently stored.

### `conditions`
Real-time sensor log — the highest write-volume table on the hub. Records greenhouse condition changes over time, each attributed to the specific device that reported it.

| Field | Type | Notes |
|---|---|---|
| id | integer, PK, autoincrement | local to this node — see composite-key note below |
| device_id | text, FK → connected_devices | which sensor produced this reading |
| metric | string | e.g. `soil_moisture`, `temperature`, `co2` |
| value | float | |
| recorded_at | timestamp | |
| synced | boolean | tracks whether this row has been pushed to cloud `conditions` |

Indexes: `(metric, recorded_at)` for rule-evaluation lookups, and a partial index on `synced = 0` so the sync job's "find everything pending" query stays cheap as the table grows across a season.

### `node_rules_cache`
Local copy of whichever `rules` are installed on this node (pulled from the cloud tier's `node_rules`), so the hub can evaluate rules and make decisions entirely offline.

| Field | Type | Notes |
|---|---|---|
| rule_id | integer, PK | |
| condition_json | json | e.g. `{"metric":"soil_moisture","op":"<","value":30}` |
| action_json | json | e.g. `{"actuator":"valve_1","command":"open"}` |
| version | integer | bumped on refresh, so the sync job can tell if the rule set changed without diffing every row |
| updated_at | timestamp | |

### `actions_log`
Every action taken in response to a condition — automated **or manual** — with enough context to trace *why* it happened. This is the audit trail: "why did the valve open at 3:14pm" resolves straight to the reading that caused it.

| Field | Type | Notes |
|---|---|---|
| id | integer, PK, autoincrement | |
| device_id | text, FK → connected_devices | the actuator that received the command |
| action | string | e.g. `open`, `close`, `set_temp:24` |
| triggered_by | string | `rule` \| `manual` \| `ml` |
| source_ref | string | `rule_id` when `triggered_by` is `rule`/`ml`; user/session/device id when `manual` |
| condition_id | integer, FK → conditions, nullable | the reading that triggered this action — null for manual overrides |
| executed_at | timestamp | |
| synced | boolean | tracks whether this row has been pushed to the cloud, for later fleet-wide use |

**Composite key note for sync:** local `id` values in `conditions` and `actions_log` are autoincrement integers, unique only *within this node's file*. When the sync job pushes rows up to the cloud tier, the cloud side must key on `(node_uid, local_id)`, not on local `id` alone — otherwise rows from different hubs will collide once aggregated.

---

## 4. Relationships and reasoning

| Relationship | Type | Why |
|---|---|---|
| `user_authentication` → `nodes` | 1:N | One farmer can own several GreenNode hubs. |
| `nodes` → `node_identity` | 1:1, shared key | Same physical hub, represented at two tiers. Cloud `nodes.node_id` matches edge `node_identity.node_uid` — this is what lets synced rows be traced back to a verified physical device rather than an arbitrary local id. |
| `nodes` → `node_rules` → `rules` | M:N via junction | A node can run several active rules; a rule (e.g. "vent if temp > 32°C for tomatoes") can apply to every tomato-crop hub on the platform. A direct `nodes → rules` link can't express this correctly. |
| `rules` ← `conditions` (cloud) | derived-from, not FK | Cloud `conditions` is the historical dataset the rule-mining model trains on; `rules` is the output. There's no live FK here, only a data-lineage/model-training relationship. |
| `node_identity` → `connected_devices` | 1:N | One hub pairs with many third-party sensors/actuators — each must be explicitly registered (paired) before its data is trusted. |
| `connected_devices` → `conditions` (edge) | 1:N | Each reading is attributed to the specific paired device that reported it, not just the hub in general — this is also the enforcement boundary: an unpaired or revoked `device_id` gets rejected at ingestion. |
| `conditions` (edge) → `conditions` (cloud) | batch sync, not FK | Local real-time readings periodically push into the cloud aggregate table, keyed by `(node_uid, local_id)`. This is a pipeline/job, not a relational constraint — hence the `synced` flag rather than a foreign key. |
| `node_rules` → `node_rules_cache` | periodic pull | The hub polls (or gets pushed) its active rule set from the cloud into a local cache, so rule evaluation never depends on the hub being online at decision time. |
| `conditions` (edge) → `actions_log` | 1:N, nullable | Every automated action links back to the exact reading that triggered it via `condition_id`, so any action is traceable to its cause. Manual overrides leave this null and use `triggered_by = 'manual'` with `source_ref` identifying who acted. |
| `connected_devices` → `actions_log` | 1:N | Every action is attributed to the specific actuator that received the command. |
| `nodes` → `node_background_history` | 1:N | A hub's crop and growth stage change over its lifetime (replanting, stage transitions); kept as a history of windows rather than overwritten, so past `conditions` rows stay correctly attributed to whatever was actually growing — and at what stage — when they were recorded. |
| `nodes` → `rules` | 1:N, nullable | Most rules are fleet-wide (`node_id` null); a rule with `node_id` set is a personalized override for that one hub, installed via `node_rules` at higher `priority` than the fleet default it supersedes. |
| `actions_log` (edge) → `actions_log_cloud` | batch sync, not FK | Same sync pattern as `conditions_edge` → `conditions`, keyed by `(node_uid, local_id)`. This is what makes `triggered_by` available cloud-side for training. |
| `conditions` (cloud) → `actions_log_cloud` | 1:N, nullable | Mirrors the edge-side relationship: an automated action links back to the reading that triggered it; manual overrides leave this null. |

---

## 5. How `rules` are derived from `conditions`

1. **Treat it as supervised learning.** Each `conditions` row is a labeled example: sensor state (temperature, humidity, soil_moisture, light, co2, time-of-day, crop_type) → the action that was taken.
2. **Use an interpretable model, not a black box.** A decision tree (e.g. `sklearn.tree.DecisionTreeClassifier`) or a rule-induction algorithm (RIPPER/CN2) — each root-to-leaf path reads directly as an if/then rule, which maps cleanly onto the `rules.condition` / `rules.action` json fields. A neural net would give accuracy but nothing storable as a legible rule.
3. **Extract each leaf as a `rules` row** — the conjunction of splits along that path becomes `condition`, the leaf's majority action becomes `action`, and the leaf's sample count/purity becomes the confidence/support fields.
4. **Re-train periodically** (nightly/weekly batch job) as `conditions` grows. Bump `model_version` and mark superseded rules `status = deprecated` rather than deleting them, so historical `actions_log` rows still resolve against the rule version that actually fired.
5. **Push down, don't poll live** — updated `node_rules` entries get pulled into each hub's `node_rules_cache` on a schedule (e.g. hourly), so decisions can still be made if the hub is offline when the greenhouse needs one.

This is deliberately lighter-weight than a TFLite/ONNX model — reserve those for genuinely complex prediction tasks (e.g. disease detection from imagery, yield forecasting), and keep the actuator decision loop itself interpretable and cheap to run on-device.

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Cloud/admin database | PostgreSQL + TimescaleDB | `conditions` as a hypertable for efficient time-series storage/queries; everything else as ordinary relational tables in the same instance — no separate system needed. |
| Edge/hub database | SQLite (WAL mode) | Zero-admin, file-based, minimal footprint — ideal for an RPi4/SD card. WAL mode allows the ingestion process and the rule-evaluation process to read/write concurrently without locking issues. |
| ORM | SQLAlchemy (shared models across both tiers) | Keeps the cloud and edge schemas defined from the same source, reducing drift as more hubs get deployed with different schema versions. |
| Migrations | Alembic | Versioned schema upgrades — important once hubs are in the field running different firmware/schema versions. |
| Sync transport | Mosquitto MQTT bridge (local broker → cloud broker), or a REST batch-push sync daemon | Reuses the MQTT infrastructure already used for actuator commands rather than standing up a second data pipeline. |
| Rule mining | scikit-learn (`DecisionTreeClassifier`) + APScheduler for the retraining job | Interpretable output that maps directly onto the `rules` json schema; cheap enough to run as a periodic batch job rather than needing dedicated ML infrastructure. |
| Backend API | FastAPI | Already the project's chosen backend; serves both the admin panel and the sync/ingestion endpoints. |
| Admin panel | Electron + React | Already decided; consumes the cloud tier directly. |
| Mobile app | React Native | Already decided. |