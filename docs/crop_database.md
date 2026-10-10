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
                    │  rules        (thresholds — per crop/stage) │
                    │  action_policy (global, gap → action)     │
                    │  node_rules   (which rules run where)     │
                    └───────────────▲───────────────────────────┘
                                    │  batch sync (periodic push)
                                    │  rule + policy pull (periodic pull)
                    ┌───────────────┴───────────────────────────┐
                    │            EDGE / LOCAL TIER               │
                    │         (SQLite, on the RPi4 hub)          │
                    │                                             │
                    │  node_identity     (factory-code identity)  │
                    │  connected_devices (paired sub-node allowlist) │
                    │  conditions        (real-time sensor log)   │
                    │  node_rules_cache  (offline threshold copy) │
                    │  action_policy_cache (offline, fleet-wide)  │
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
Thresholds mined from `conditions` (see §5) — **not** actions. Most rules are fleet-wide — defined per crop type and growth stage, reusable across every hub in that state — but a rule can also be personalized to a single hub once that hub has enough of its own history to justify drifting from the fleet default.

The `action` field that used to live here is gone. Baking a crop-specific action into a crop-specific threshold row meant the action side could never be reused across crops — a tomato hub's "35°C → fan on" split means nothing to a lettuce hub whose comfort band sits at a different absolute range. This table now says *whether* a hub is out of band and by how much (the gap); `action_policy` (below) says what a gap of that size and direction means, globally, regardless of crop.

| Field | Type | Notes |
|---|---|---|
| rule_id | uuid, PK | |
| node_id | uuid, FK → nodes, nullable | null = fleet-wide rule; set = personalized to this one hub |
| scope | string | `fleet` \| `node` — makes the `node_id` nullability explicit and gives the retraining job a clean way to find "the personalized rule for this hub" without inferring it from nullability alone |
| crop_type / growth_stage / node_type | string | what context the rule applies to — matched against `node_background_history` for the crop/stage part |
| condition | json | the threshold band, e.g. `{"temperature": {"min": 24, "max": 30}}` |
| priority | int | resolves conflicts when multiple rules fire — a personalized (`scope = node`) rule should be given higher priority than the fleet default it overrides |
| confidence / support | float | fit-quality metrics from the training run |
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

### `action_policy`
The global action model's output — **one table for the whole fleet**, not one per crop or per hub. `rules` answers "is this hub out of band, and by how much"; `action_policy` answers "given an excursion of this size, in this direction, what should happen". That answer is crop-agnostic: a +5°C gap means the same thing physically for a tomato hub and a lettuce hub, so one row covers both.

| Field | Type | Notes |
|---|---|---|
| policy_id | serial, PK | |
| variable | string | `temperature`, `humidity`, `soil_moisture`, ... — one policy set per sensed variable |
| direction | string | `above` \| `below` — which side of the threshold band; kept separate because "too hot" and "too cold" need different actuators |
| gap_min | float | lower bound of this bucket, as an **absolute** excursion (magnitude past the band edge), e.g. `2` |
| gap_max | float, nullable | upper bound, e.g. `5`; null = open-ended top bucket |
| action | json | e.g. `{"device_type": "fan", "command": "on", "intensity": "low"}` |
| model_version | string | |

---

# GreenNode — Database Setup for the ML Rule-Mining Pipeline

## 1. How the database and the ML pipeline relate

There are now **two independent training pipelines**, not one:

- **Threshold fitting** (→ `rules`): per crop and growth stage, what does a comfortable range look like? A statistics problem over `conditions` history — no action label required.
- **Action-policy fitting** (→ `action_policy`): given an excursion of a certain size and direction, what do farmers actually do? Supervised learning over `actions_log_cloud`, trained on the **gap** (`|reading − nearest threshold edge|`) rather than the raw reading — which is what makes one model correct for every crop and hub at once.

```
conditions (hypertable) ──┐
                           ├──►  percentile fit, grouped by       ──►  rules
node_background_history ──┘      (crop_type, growth_stage)            (thresholds)
                                                                          │ gives each reading
                                                                          │ its active threshold
                                                                          ▼
conditions ──► gap = |reading − nearest threshold edge| ──┐
                                                            ├──► DecisionTreeClassifier.fit() ──► action_policy
actions_log_cloud (triggered_by='manual') ────────────────┘     per (variable, direction),        (global)
                                                                  no crop_type filter
```

At runtime a hub does two lookups: it evaluates its cached `rules` to see whether it is outside its band (and by how much), then looks that gap up in its cached `action_policy` to decide what to do.

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
    condition     JSONB NOT NULL,   -- e.g. {"temperature": {"min": 24, "max": 30}}
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

### 2.4 `action_policy` — the global action model's output

```sql
CREATE TABLE action_policy (
    policy_id     SERIAL PRIMARY KEY,
    variable      TEXT NOT NULL,    -- 'temperature', 'humidity', ...
    direction     TEXT NOT NULL,    -- 'above' | 'below'
    gap_min       DOUBLE PRECISION NOT NULL,  -- absolute excursion
    gap_max       DOUBLE PRECISION,           -- nullable: open-ended top bucket
    action        JSONB NOT NULL,   -- e.g. {"device_type": "fan", "command": "on", "intensity": "low"}
    model_version TEXT
);
```

Deliberately no `crop_type`, `growth_stage`, or `node_id` column — that absence is the point. A crop-scoped action table can't generalize to a crop it has never seen; a gap-scoped one already has.

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

## 4. The training queries

Two separate jobs, not one — they share no query and no model.

### 4a. Threshold fitting → `rules`

No action label is needed here: this is descriptive statistics over a crop/stage's own historical range, not classification.

```sql
SELECT
    percentile_cont(0.05) WITHIN GROUP (ORDER BY c.temperature) AS temp_low,
    percentile_cont(0.95) WITHIN GROUP (ORDER BY c.temperature) AS temp_high,
    count(*) AS support
FROM conditions c
JOIN node_background_history bg
    ON bg.node_id = c.node_id
   AND c.ts >= bg.started_at
   AND (bg.ended_at IS NULL OR c.ts < bg.ended_at)
WHERE bg.crop_type = 'tomato'
  AND bg.growth_stage = 'flowering'
  AND c.ts >= now() - INTERVAL '90 days';
```

The 5th/95th percentile band is a starting point, not a fixed choice. Bounds should be anchored on agronomic priors for that crop/stage where available, with the fleet's realized data pulling the band toward what is actually achievable as history accumulates (priors first, evidence-adjusted over time). Repeat per variable to build the full `condition` json.

```python
def train_rules_for(crop_type: str, growth_stage: str, db_session, node_id: str | None = None):
    # node_id=None -> fleet-wide run, pooled across every hub growing crop_type at this stage
    # node_id set  -> personalized run, scoped to that one hub's own history
    stats = fit_threshold_bands(db_session, crop_type, growth_stage, node_id)  # the query above, per variable
    db_session.add(models.Rule(
        crop_type=crop_type, growth_stage=growth_stage,
        node_id=node_id, scope="node" if node_id else "fleet",
        condition=stats.as_condition_json(),
        support=stats.support, confidence=stats.confidence,
        model_version=new_version_tag(), status="draft",
        priority=10 if node_id else 0,   # personalized rules outrank fleet defaults
    ))
    db_session.commit()
```

### 4b. Action-policy fitting → `action_policy`

This one needs `actions_log_cloud`, but the feature is the **gap**, not the raw reading, and there is no crop filter anywhere — which is what makes the result usable fleet-wide.

```sql
SELECT
    abs(c.temperature - CASE
        WHEN c.temperature > (r.condition->'temperature'->>'max')::float
            THEN (r.condition->'temperature'->>'max')::float
        ELSE (r.condition->'temperature'->>'min')::float
    END) AS gap,
    CASE WHEN c.temperature > (r.condition->'temperature'->>'max')::float
        THEN 'above' ELSE 'below' END AS direction,
    a.action
FROM conditions c
JOIN actions_log_cloud a ON a.condition_reading_id = c.reading_id
JOIN node_rules nr ON nr.node_id = c.node_id AND nr.active
JOIN rules r ON r.rule_id = nr.rule_id AND r.status = 'active'
WHERE a.triggered_by = 'manual'
  AND (c.temperature > (r.condition->'temperature'->>'max')::float
       OR c.temperature < (r.condition->'temperature'->>'min')::float)
  AND c.ts >= now() - INTERVAL '90 days';
```

Runs once per `variable` across the **entire fleet** — no `crop_type` or `node_id` filter — because the premise of `action_policy` is that a given gap means the same thing whichever crop produced it.

```python
from sklearn.tree import DecisionTreeClassifier

def train_action_policy_for(variable: str, db_session):
    X, y = load_gap_training_data(db_session, variable)   # one row per (gap, direction) -> action
    for direction in ("above", "below"):
        mask = X.direction == direction
        clf = DecisionTreeClassifier(max_depth=3, min_samples_leaf=30)
        clf.fit(X.loc[mask, ["gap"]], y[mask])
        for gap_min, gap_max, action, support in extract_gap_buckets(clf):
            db_session.add(models.ActionPolicy(
                variable=variable, direction=direction,
                gap_min=gap_min, gap_max=gap_max,
                action=action, model_version=new_version_tag()))
    db_session.commit()
```

> **Note:** `extract_gap_buckets()` is a placeholder for logic you write against the fitted tree's `tree_.feature`, `tree_.threshold` and `tree_.value` attributes — it is not a built-in scikit-learn function. Verify those attribute names against the current scikit-learn docs before implementing.

---

## 5. Summary of the flow

1. Hubs write raw sensor readings into `conditions`, and every action (manual or automated) into edge `actions_log`, continuously.
2. `create_hypertable` chunks `conditions` by time; `actions_log` syncs to `actions_log_cloud` on the same batch pattern.
3. Older chunks get compressed on a schedule, keeping storage down without deleting anything.
4. (Optional) continuous aggregates pre-compute rolled-up features if either model needs them.
5. **Threshold job** (§4a): computes percentile-based bands per crop/growth stage from `conditions` alone and writes `draft` rows into `rules` — fleet-wide by default, or scoped to one `node_id` for a personalized retrain.
6. **Action-policy job** (§4b): computes each reading's gap against its hub's active threshold, joins `actions_log_cloud` filtered to `triggered_by = 'manual'`, and fits one small decision tree per `(variable, direction)` across the whole fleet, writing into `action_policy`.
7. Once reviewed/approved, `rules` rows flip to `active` and link to hubs via `node_rules` → `node_rules_cache`. `action_policy` rows flip to active and are pulled to **every** hub's `action_policy_cache`, since the same policy applies fleet-wide.
8. At runtime a hub evaluates its cached thresholds first (out of band, and by how much), then looks that gap up in its cached action policy. A personalized rule's higher `priority` only decides which threshold wins; the action-policy lookup afterward is identical.

This is the minimum needed to get the database and the ML pipelines talking to each other correctly. Retention policies and continuous aggregates (§3, Steps 5–6) are refinements for once the pilot generates real data volume.

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

Splitting the old single `device_type` (`sensor`/`actuator`) into `device_category` + `device_type` generalizes device identification: a node can now be queried or matched by exact capability ("give me this node's `humidity` sensor") instead of by its free-text `label`, which was never meant to be parsed. It also directly lines up with the `device_type` key already used in `action_policy.action` and `actions_log.action` (e.g. `{"device_type": "fan", "command": "on"}`) — the same vocabulary identifies a device here and drives what a policy targets there. New device types (e.g. a `co2` actuator, a `pressure` sensor) are just new `device_type` values, no schema change needed.

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
Local copy of whichever threshold `rules` are installed on this node (pulled from the cloud tier's `node_rules`), so the hub can evaluate its comfort band entirely offline. Thresholds only — what to *do* about an excursion comes from `action_policy_cache` below.

| Field | Type | Notes |
|---|---|---|
| rule_id | integer, PK | |
| condition_json | json | e.g. `{"temperature":{"min":24,"max":30}}` |
| version | integer | bumped on refresh, so the sync job can tell if the rule set changed without diffing every row |
| updated_at | timestamp | |

### `action_policy_cache`
Local copy of the fleet-wide `action_policy` table. Identical on every hub regardless of crop, so it can be installed at shipping time and refreshed by the same pull mechanism as `node_rules_cache`.

| Field | Type | Notes |
|---|---|---|
| policy_id | integer, PK | |
| variable | string | `temperature`, `humidity`, ... |
| direction | string | `above` \| `below` |
| gap_min | float | absolute excursion lower bound |
| gap_max | float, nullable | null = open-ended top bucket |
| action_json | json | e.g. `{"device_type":"fan","command":"on","intensity":"low"}` |
| model_version | string | |
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
| `rules` ← `conditions` (cloud) | derived-from, not FK | Cloud `conditions` is the historical dataset the threshold fit runs over; `rules` is the output. No live FK, only data lineage. |
| `action_policy` ← `conditions` + `actions_log_cloud` | derived-from, not FK | Trained on gap (reading vs. each hub's active threshold) and the manual action taken. Global: no crop or node key, which is what makes one policy valid for every hub. |
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
| `action_policy` → `action_policy_cache` | periodic pull, fleet-wide | No per-node junction: every hub receives the same full table, since the policy is crop-agnostic. |

---

## 5. How `rules` and `action_policy` are derived

**Thresholds (`rules`)**
1. **Statistics, not classification.** For each `(crop_type, growth_stage)`, fit a comfort band per variable from the historical `conditions` of hubs in that state (percentile band, anchored on agronomic priors while data is thin).
2. **Store the band as `condition`** with sample count and fit quality as `support` / `confidence`.
3. **Personalize later.** Once a hub has enough of its own history, a node-scoped run writes a higher-`priority` rule that overrides the fleet default on that hub only.

**Actions (`action_policy`)**
1. **Supervised learning on the gap.** Each manual action is a labeled example: `|reading − nearest threshold edge|`, direction → the action the farmer took.
2. **Interpretable model.** A shallow `DecisionTreeClassifier` per `(variable, direction)`; each leaf becomes a gap bucket with an action. A neural net would give nothing storable as a legible policy.
3. **Global by construction.** No crop or node filter, so a crop with no installations yet still inherits a trained response.

**Both pipelines**
- **Re-train periodically** (nightly/weekly batch). Bump `model_version` and mark superseded rows `deprecated` rather than deleting them, so historical `actions_log` rows still resolve against the version that actually fired.
- **Push down, don't poll live.** Approved rows reach each hub's `node_rules_cache` / `action_policy_cache` on a schedule, so decisions still work if the hub is offline when the greenhouse needs one.

This is deliberately lighter-weight than a TFLite/ONNX model — reserve those for genuinely complex prediction tasks (disease detection from imagery, yield forecasting) and keep the actuator decision loop interpretable and cheap to run on-device.

---

## 6. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Cloud/admin database | PostgreSQL + TimescaleDB | `conditions` as a hypertable for efficient time-series storage/queries; everything else as ordinary relational tables in the same instance — no separate system needed. |
| Edge/hub database | SQLite (WAL mode) | Zero-admin, file-based, minimal footprint — ideal for an RPi4/SD card. WAL mode allows the ingestion process and the rule-evaluation process to read/write concurrently without locking issues. |
| ORM | SQLAlchemy (shared models across both tiers) | Keeps the cloud and edge schemas defined from the same source, reducing drift as more hubs get deployed with different schema versions. |
| Migrations | Alembic | Versioned schema upgrades — important once hubs are in the field running different firmware/schema versions. |
| Sync transport | Mosquitto MQTT bridge (local broker → cloud broker), or a REST batch-push sync daemon | Reuses the MQTT infrastructure already used for actuator commands rather than standing up a second data pipeline. |
| Threshold + action-policy training | scikit-learn (`DecisionTreeClassifier` for the action policy; percentile fits for thresholds) + APScheduler for the retraining jobs | Interpretable output that maps directly onto the `rules` / `action_policy` json schemas; cheap enough to run as periodic batch jobs without dedicated ML infrastructure. |
| Backend API | FastAPI | Already the project's chosen backend; serves both the admin panel and the sync/ingestion endpoints. |
| Admin panel | Electron + React | Already decided; consumes the cloud tier directly. |
| Mobile app | React Native | Already decided. |