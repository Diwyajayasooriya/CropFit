# GreenNode — Rule Distribution: Workflow & Implementation Plan (Phase 1)

How rules get from the cloud database onto a farmer's GreenNode hub, for the first of the three product phases.

| Phase | What drives decisions | Where this document sits |
|---|---|---|
| **1. Rule-based** | Pre-built threshold rules + a global gap→action policy, shipped per crop | **This document** |
| 2. Learning | Farmer's manual actions are logged, synced, and used to retrain / personalize | Hooks noted in §10 |
| 3. AI assistant | ScareClaw-style agent reasoning on top of the same rule + policy tables | Hooks noted in §10 |

---

## 1. The idea in one paragraph

The cloud database holds rule sets for **every** supported crop. Training and authoring happen offline, separately from the running system; the result is written into the database and then **published** as an immutable, signed, versioned *bundle* per crop. When a farmer sets up a GreenNode and picks a crop, the user app downloads **only that crop's bundle**, keeps it, and installs it onto the connected hub the moment the hub is reachable. The hub verifies the signature, swaps the rules in as one atomic transaction, and from then on evaluates everything locally — fully offline. The app keeps checking for newer bundle versions and installs them the same way.

The app is a courier, not an authority: the hub trusts the **signature**, not the phone.

---

## 2. Architecture and data flow

```
 OFFLINE (your laptop / training job)
   author + train rules, action policy
              │  write draft rows
              ▼
 ┌──────────────────────────────────────────┐
 │ CLOUD  (Django backend + PostgreSQL)      │
 │   rules, action_policy   ← all crops      │
 │   review → publish                        │
 │   rule_bundle  (one signed snapshot/crop) │
 └───────────────────┬──────────────────────┘
                     │ HTTPS  GET bundle for ONE crop
                     ▼
 ┌──────────────────────────────────────────┐
 │ USER APP  (React Native)                  │
 │   caches bundle, remembers what's pending │
 └───────────────────┬──────────────────────┘
                     │ local network  POST bundle
                     ▼
 ┌──────────────────────────────────────────┐
 │ GREENNODE HUB  (RPi4 · FastAPI · SQLite)  │
 │   verify signature → install atomically   │
 │   node_rules_cache + action_policy_cache  │
 │   evaluate locally, offline               │
 └──────────────────────────────────────────┘
```

---

## 3. Workflows

### A. Authoring and publishing (cloud side, per crop)

1. Rules and the initial action policy are produced offline: agronomic sources plus whatever offline training you run. In Phase 1 there is little farmer data, so both are **expert-seeded**, not learned from the field. Learning from manual actions begins in Phase 2.
2. Results are written into `rules` (one row per crop × growth stage, `scope = 'fleet'`) and `action_policy` as `status = 'draft'`.
3. A human reviews the draft rows and flips them to `active`.
4. A **publish** step snapshots the active rows for one crop, plus the current fleet-wide action policy, into a single payload, signs it, and stores it in `rule_bundle` with the next `bundle_version` for that crop. Published bundles are never edited; a fix is a new version.

Why a snapshot instead of letting the app read live rows: a hub must never end up with half of version 7 and half of version 8. A bundle is installed whole or not at all.

### B. First installation (onboarding)

1. Farmer picks **crop type** and **growth stage** in the app (onboarding / Action Panel).
2. App downloads that crop's latest bundle **while it still has internet**, and stores it locally. *Order matters:* during onboarding the phone joins the hub's own network, which may have no uplink yet, so fetch first, connect second.
3. App connects to the hub and calls `POST /api/v1/rules/bundle`.
4. Hub verifies the signature, checks the version is newer than what it holds, and installs atomically (§6).
5. App calls `PUT /api/v1/background` so the hub knows the active crop and stage, and tells the cloud so `node_background_history` gets its first row.
6. Hub reports success; the app clears the "pending install" flag.

If step 3 fails (hub unreachable), the bundle stays cached with a pending flag and is retried automatically (workflow C).

### C. Ongoing updates ("timely")

Triggers: app launch, a daily background check, and any time the phone reaches the hub on the local network.

1. App asks the cloud for the latest bundle version for the node's crop (`?have=<installed>` returns 304 if current).
2. App asks the hub what it has installed (`GET /api/v1/rules/status`).
3. If cloud version > hub version: download, then push as in workflow B steps 3–4.
4. Anything that fails stays in the pending queue and is retried on the next trigger.

Comparing against the **hub's** reported version, not the app's memory, is what keeps this correct when the farmer switches phones or reinstalls the app.

### D. Growth stage change

The bundle already contains every growth stage of the crop, so a stage change needs **no download**.

1. Farmer sets the new stage in the app.
2. App calls `PUT /api/v1/background` on the hub → hub switches which cached band is active, immediately, offline.
3. App also posts the change to the cloud → current `node_background_history` row gets `ended_at`, a new row opens.

### E. Failure behaviour

| Failure | Outcome |
|---|---|
| Bad / tampered signature | Hub rejects, keeps current rules |
| Older or equal version | Hub answers `already_current`, no change |
| Power loss mid-install | SQLite rolls back the transaction; old rules intact |
| Hub unreachable | Bundle stays cached in the app, retried later |
| App has no internet | Hub keeps running on what it has; nothing breaks |
| Crop has no published bundle yet | App shows it as unavailable at crop selection |

---

## 4. What a bundle contains

All numbers below are **illustrative placeholders to show the shape**, not agronomic recommendations.

```json
{
  "payload": {
    "crop_type": "tomato",
    "bundle_version": 7,
    "policy_version": 3,
    "issued_at": "2026-10-09T08:00:00Z",
    "min_hub_firmware": "1.0.0",
    "rules": [
      {
        "growth_stage": "seeding",
        "condition": {
          "temperature":   {"min": 22, "max": 26},
          "humidity":      {"min": 65, "max": 75},
          "soil_moisture": {"min": 60, "max": 80}
        }
      },
      {
        "growth_stage": "flowering",
        "condition": {
          "temperature":   {"min": 24, "max": 30},
          "humidity":      {"min": 60, "max": 70},
          "soil_moisture": {"min": 50, "max": 70}
        }
      }
    ],
    "action_policy": [
      {"variable": "temperature", "direction": "above", "gap_min": 2,  "gap_max": 5,
       "action": {"device_type": "fan", "command": "on", "intensity": "low"}},
      {"variable": "temperature", "direction": "above", "gap_min": 5,  "gap_max": null,
       "action": {"device_type": "fan", "command": "on", "intensity": "high"}},
      {"variable": "temperature", "direction": "below", "gap_min": 2,  "gap_max": null,
       "action": {"device_type": "heater", "command": "on"}}
    ]
  },
  "signature": "<base64 Ed25519 signature over the canonical payload>"
}
```

- `rules` is crop-specific; `action_policy` is the same fleet-wide table on every bundle. Gaps below the lowest bucket mean "tolerable, do nothing".
- `gap_min` / `gap_max` are **absolute** excursions past the band edge; `direction` says which edge.
- Bundles are tiny (a few KB), so shipping all growth stages together costs nothing and keeps stage changes offline.

---

## 5. Worked example: one decision on the hub

Tomato hub, growth stage `flowering`, temperature band **[24, 30] °C**.

| Reading | Out of band? | Gap | Bucket matched | Result |
|---|---|---|---|---|
| 27 °C | no | — | — | nothing |
| 31 °C | above, by 1 | 1 | below lowest bucket (2) | nothing (tolerable) |
| 33 °C | above, by 3 | 3 | 2 – 5 | fan on, low |
| 38 °C | above, by 8 | 8 | 5 – open | fan on, high |
| 21 °C | below, by 3 | 3 | below, 2 – open | heater on |

A lettuce hub at 27 °C against a [18, 22] band has a gap of 5 and lands in the same bucket as the tomato hub at 35 °C. That is the point of keeping the action policy separate from the crop rules.

```python
def decide(reading, band, policy):
    """band = {"min":..,"max":..}; policy = entries for this variable."""
    if reading > band["max"]:
        direction, gap = "above", reading - band["max"]
    elif reading < band["min"]:
        direction, gap = "below", band["min"] - reading
    else:
        return None
    for p in policy:
        if p["direction"] == direction and p["gap_min"] <= gap \
           and (p["gap_max"] is None or gap < p["gap_max"]):
            return p["action"]
    return None
```

The action names a `device_type` (`fan`); the hub resolves it to a concrete paired actuator through `connected_devices`. If the greenhouse has no fan paired, the hub cannot act and should surface that to the farmer instead of failing silently.

---

## 6. Hub installation (FastAPI + SQLite)

A sketch of the install endpoint. Adapt names to the existing `edge/` layout.

```python
# edge/api/rules.py
import base64, json, sqlite3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

router = APIRouter(prefix="/api/v1/rules")

class BundleIn(BaseModel):
    payload: dict
    signature: str

def canonical(payload: dict) -> bytes:
    # must match exactly how the cloud signed it
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()

@router.post("/bundle")
def install_bundle(b: BundleIn, db: sqlite3.Connection = Depends(get_db)):
    try:
        PUBLIC_KEY.verify(base64.b64decode(b.signature), canonical(b.payload))
    except InvalidSignature:
        raise HTTPException(400, "invalid signature")

    p = b.payload
    row = db.execute("SELECT bundle_version FROM node_background WHERE id = 1").fetchone()
    if row and row["bundle_version"] and p["bundle_version"] <= row["bundle_version"]:
        return {"status": "already_current", "installed_version": row["bundle_version"]}

    with db:  # single transaction: commits on success, rolls back on any exception
        db.execute("DELETE FROM node_rules_cache")
        db.execute("DELETE FROM action_policy_cache")
        for r in p["rules"]:
            db.execute(
                "INSERT INTO node_rules_cache (crop_type, growth_stage, condition_json, version, updated_at) "
                "VALUES (?, ?, ?, ?, datetime('now'))",
                (p["crop_type"], r["growth_stage"], json.dumps(r["condition"]), p["bundle_version"]))
        for a in p["action_policy"]:
            db.execute(
                "INSERT INTO action_policy_cache (variable, direction, gap_min, gap_max, action_json, model_version, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, datetime('now'))",
                (a["variable"], a["direction"], a["gap_min"], a["gap_max"],
                 json.dumps(a["action"]), str(p["policy_version"])))
        db.execute(
            "UPDATE node_background SET crop_type = ?, bundle_version = ?, policy_version = ?, installed_at = datetime('now') WHERE id = 1",
            (p["crop_type"], p["bundle_version"], p["policy_version"]))
    return {"status": "installed", "installed_version": p["bundle_version"]}
```

Notes:
- The **public key** is baked into the firmware/OS image at build time. The private key lives only on the cloud side (secret store / environment, never in the repo).
- Sign and verify over the same canonical byte string. The usual bug here is the cloud and hub serializing JSON differently.
- Verify the `cryptography` API names against the version you install; the shape above is the standard one but is worth a quick check.
- With WAL mode, the rule evaluator keeps reading the old rows until the install transaction commits, then sees the new set all at once.

---

## 7. API contracts

**Cloud (Django, `CropFit`)**

| Method + path | Purpose |
|---|---|
| `GET /api/v1/crops` | Supported crops and their growth-stage vocabulary, for onboarding |
| `GET /api/v1/rule-bundles/{crop}/latest?have=N` | Signed bundle for one crop; `304` if `have` is already current |
| `POST /api/v1/nodes/{id}/background` | Record crop / growth-stage change → `node_background_history` |
| `POST /api/v1/nodes/{id}/rules-installed` | App reports `{crop, bundle_version}` so the cloud knows what each hub runs |

**Hub (FastAPI)**

| Method + path | Purpose |
|---|---|
| `GET /api/v1/rules/status` | `{crop_type, growth_stage, bundle_version, policy_version, installed_at}` |
| `POST /api/v1/rules/bundle` | Verify + install a bundle (§6) |
| `PUT /api/v1/background` | Set active `{crop_type, growth_stage}`; switches the active band locally |

---

## 8. Schema changes this plan needs

**Not yet applied** to `schema.mermaid` / `crop_database.md`. They sit on top of the split design (thresholds in `rules`, global `action_policy`).

**Cloud**

```
rule_bundle
  bundle_id       uuid PK
  crop_type       text
  bundle_version  int            -- unique together with crop_type
  payload         jsonb          -- the signed payload, stored verbatim
  signature       text
  status          text           -- published | withdrawn
  created_at      timestamptz
```

**Hub (SQLite)**

```
node_rules_cache  + crop_type text, growth_stage text
                  -- lets a stage change be a local filter, not a re-download

node_background   (single row, id = 1)
  crop_type, growth_stage, bundle_version, policy_version,
  installed_at, stage_updated_at
```

The evaluator reads `WHERE growth_stage = (SELECT growth_stage FROM node_background WHERE id = 1)`.

In Phase 1 `node_rules` is not the distribution mechanism (a bundle is per crop, not per node). It remains useful as the record of what each hub runs, filled from the app's `rules-installed` report, and becomes the delivery path for personalized rules in Phase 2.

---

## 9. Implementation plan

| Step | Component | Work | Done when |
|---|---|---|---|
| **M0** | Content | Fix the crop list and each crop's growth-stage vocabulary; author rule sets for 2–3 pilot crops and the initial action policy | Reviewed JSON exists for each pilot crop |
| **M1** | Cloud | Django models + migrations for `rules`, `action_policy`, `rule_bundle`; `publish_bundle <crop>` command (snapshot → canonicalize → sign → store); `crops` and `rule-bundles` endpoints | A published, signed bundle can be fetched with curl |
| **M2** | Hub | Alembic migration (§8 edge changes); `status`, `bundle`, `background` endpoints; signature check with baked-in public key; atomic install; evaluator that reads the cache and applies `decide()` | A hand-made bundle installs by curl, and a decision fires from cached rules with the network unplugged |
| **M3** | App | Crop + stage selection in onboarding; fetch-then-connect ordering; local bundle cache and pending queue; push to hub; installed-version display | Fresh hub goes from empty to rule-driven using only the app |
| **M4** | App + cloud | Update loop (launch, daily, on hub reachable); `?have=` check; report `rules-installed`; stage-change flow incl. `node_background_history` | Publishing bundle v+1 reaches a hub with no manual step |
| **M5** | All | Hardening tests: tampered payload, old-version replay, kill power mid-install, hub unreachable then reachable, phone switched | Each case behaves as in §3E |
| **M6** | Pilot | Run on a real hub + greenhouse; compare decisions with what the farmer would do | Notes feed the Phase 2 design |

Build M2 before M3: the hub endpoints can be tested completely with curl and a fake bundle, which keeps hub bugs from hiding behind app bugs.

---

## 10. How Phases 2 and 3 plug in

- **Phase 2 (learning).** The hub already logs manual actions (`triggered_by = 'manual'`) and syncs them to `actions_log_cloud`. The two training jobs (thresholds per crop/stage, global gap→action) run offline exactly as in `crop_database.md`, and their output is published as a new `bundle_version` through this same pipeline. Personalized (`scope = 'node'`) rules travel the same channel via `node_rules`, installed at higher priority.
- **Phase 3 (AI assistant).** The assistant reads the same cached rules and policy as its ground truth for what "in range" and "what to do" mean, and can propose changes that go through the same review → publish path rather than writing to a hub directly.

Nothing in Phase 1 needs to be undone to get there.

---

## 11. Open questions

1. **Suggest vs. act.** In Phase 1, does a policy match execute the actuator automatically, or show a suggestion in the Action Panel? Presumably this follows the existing Manual / ScareClaw mode, but it needs an explicit decision.
2. **Who may install?** The signature protects integrity, but not *who* may call `POST /rules/bundle` on the hub's local network. This should reuse the app↔hub pairing/auth that onboarding already sets up; confirm what that auth is.
3. **Stage vocabulary.** Free-text `growth_stage` is fine for the pilot, but bundles and the evaluator now depend on the strings matching exactly, which argues for a per-crop stage list from `GET /crops`.
4. **Key rotation.** A baked-in public key needs a plan for the day the signing key changes (for example, a key id in the bundle and a short list of trusted keys on the hub).
5. **One crop per hub?** This plan assumes one crop at a time per greenhouse. A multi-crop greenhouse would need rules keyed per zone, which the current schema does not model.
