# GreenNode — Rules & ML Process

This document lays out how the "rules" concept and the ML pipeline fit together, and how both connect to the edge database (`conditions`, `node_rules_cache`, `actions_log`).

## What a "rule" actually is

A rule isn't a single fixed number — it's the desired state of the greenhouse at a given moment, expressed as a combination of thresholds across several sensed variables (temperature, humidity, soil moisture, light, CO2, whatever the connected sub-nodes report). That combination depends on context that doesn't change minute-to-minute: the greenhouse's location, the crop being grown, and the season of plantation. So a rule is really a lookup into a much larger space — "for tomatoes, in the Kandy hills, mid-growing-season, the acceptable band is X" — and the greenhouse's live sensor readings drift in and out of that band constantly. The system's job is to hold the greenhouse inside the band, and to let the band itself evolve if evidence suggests the original band was wrong for this specific greenhouse.

That gives two separate things the ML layer needs to produce, not one:

1. **The threshold itself** — what's the target band, given location/crop/season.
2. **The action** — given that the greenhouse has drifted outside the band, what should actually be switched on, and for how long, to bring it back.

Those are genuinely different problems and probably deserve different models.

## Stage 1 — Establishing the threshold

This is closer to a knowledge/prior-driven problem than a pure learning problem, at least at first, because a brand-new greenhouse has no history to learn from. A reasonable approach:

- Start from **agronomic priors**: published or extension-service ideal ranges per crop (temperature, humidity, soil moisture, etc.), adjusted for season (a monsoon-season band differs from a dry-season band for the same crop).
- Adjust priors for **location** using whatever's available — regional climate normals, elevation, or just letting the farmer's own historical `conditions` data pull the band toward what's actually achievable at that site.
- Store the resulting band as the greenhouse's *initial* rule set — this is what populates `node_rules_cache` before any learning has happened.
- Treat this as a cold-start problem: the initial threshold is a reasonable prior, not a claim of correctness. It exists so the system has something to act on from day one.

## Stage 2 — Adapting the threshold over time

Once a greenhouse has accumulated `conditions` history, the threshold stops being purely prior-driven and starts being evidence-driven. Two signals matter here:

- **Outcome evidence** — if the greenhouse consistently sits near one edge of the band without ill effect (assuming you have some proxy for "ill effect," even just yield or farmer-reported plant health), the band itself may be too tight or miscentered for this specific site.
- **Farmer override evidence** — if farmers repeatedly act *before* the threshold is breached, or repeatedly leave a breach uncorrected, that's a signal the system's threshold doesn't match the farmer's actual judgment for their crop and site.

This is where the "adaptive threshold" idea lives. It doesn't need to be fully automatic recalibration from day one — even a periodic batch job that flags "this greenhouse's realized comfortable range looks different from its assigned rule, consider updating" is a reasonable first version. Full closed-loop adaptation (the threshold silently drifting based on behavior) is a later-stage goal, and one worth being cautious about, since a threshold that adapts to bad farmer habits isn't actually good.

## Stage 3 — Learning what action to recommend

This is the part that turns "temperature is 2°C above threshold" into "turn on the fan for 15 minutes" instead of just restating the number back at the farmer. The `actions_log` table is the training signal here: every time a farmer manually acts (or an automated rule fires and an actuator is engaged), that's a labeled example of (condition state → action taken).

Practical framing: this is closer to **imitation learning** than classic supervised regression. You're not predicting a target value, you're predicting *which actuator, at what intensity/duration, given this condition vector*. A few ways to approach it, roughly in order of complexity:

- **Rule mining / association**, honestly the simplest starting point given the stack already includes scikit-learn: bucket condition states and actuator responses, and mine which action reliably follows which condition pattern for a given crop/greenhouse. This is enough to generate the "turn on fan for a while" style suggestion without needing a farmer-behavior model that's sophisticated.
- **Supervised classification**, once there's enough `actions_log` volume: condition vector (+ crop/season/location context) → action label (which actuator, coarse duration bucket). This is where scikit-learn's existing place in the stack does real work.
- **Contextual bandits / offline RL**, as a later stage, if the goal is to actually optimize outcomes rather than imitate farmer behavior — useful once there's enough data to know which actions produced good outcomes, not just which actions farmers happened to take. Worth deferring until the imitation-learning version is working, since farmer behavior itself is a reasonable teacher signal before there's ground truth on "what worked."

Either way, the recommendation surfaced to the farmer should stay at the actuator/action level ("fan on, 15 min") rather than the setpoint level ("reduce to 24°C") — the model's internal representation can still be threshold-based, but the *output* to the farmer is an action, translated from whatever the model predicts.

## How this ties into the schema

- `conditions` — the raw sensed history; source of both threshold-fitting evidence and the input features for action prediction.
- `node_rules_cache` — holds the *current* active thresholds per node/greenhouse; this is what Stage 1 populates and Stage 2 periodically revises. Local rule evaluation reads from here, not from a live model, so the greenhouse stays controllable even offline.
- `actions_log` — both the record of what was done (for offline resilience / audit) and the training data for Stage 3. Every entry is implicitly a (context, condition, action) tuple.

The inference split follows the existing edge/cloud architecture: rule *evaluation* (is the greenhouse outside its cached threshold right now?) has to run on-device via `node_rules_cache`, since that's what keeps the system working offline. Threshold *fitting* and action-model *training* are heavier and can live cloud-side, periodically pushing an updated `node_rules_cache` and an updated action model back down to the RPi4 for local (TFLite/ONNX) inference.

## Open questions worth deciding early

- What counts as "ground truth" for a good outcome in Stage 2 — is it just staying near the prior band, or is there a farmer-facing feedback mechanism (yield, plant health rating) that could serve as a real outcome signal?
- Duration/intensity granularity for actions — how coarse should "turn on fan for a while" be in practice? A fixed duration, a farmer-configurable range, or a predicted continuous duration bucketed for display?
- Cold-start handling for a brand-new greenhouse with no `actions_log` history yet — does it inherit action-model behavior from similar crop/location greenhouses, or start rule-only until enough data accumulates?
- How much of Stage 3's action vocabulary needs to be fixed in advance (a known set of actuator/action types) versus discovered from whatever actuators a given greenhouse actually has connected, since actuators are third-party and not standardized.
