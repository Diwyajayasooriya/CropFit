# GreenNode Action Model (Stage 3) — "what should the farmer switch on, and for how long?"

Part of **CropFit / Green Node** by Team BlueCircle. This folder turns live sensor readings
into simple actuator instructions for the farmer, e.g.

> **Too hot (40.0°C, should be below 28°C). Turn ON the FAN at HIGH speed (100%) for 20 minutes.**
> Open the ROOF VENT full (100% open). Turn ON the MISTER for 10 minutes to help cool the air.

It implements Stage 1 (thresholds) and Stage 3 (action recommendation) from
[`../greennode-ml-rules-process.md`](../greennode-ml-rules-process.md), using **TensorFlow** for
training and **ONNX** for running the model on the Raspberry Pi hub.

---

## 1. How it works

```
 sensors ──► conditions table ──┐
                                ├─► featurize() ──► ONNX model ──► actions + minutes ──► farmer message
 node_rules_cache (thresholds) ─┘         │                                  ▲
                                          └──► rule engine (safety fallback) ┘
```

1. **Sensors** report air temperature, humidity, soil moisture, soil temperature, CO₂,
   outside temperature, time of day and light received today (DLI).
2. **Thresholds** (the "rule") come from `config/thresholds.json` → `node_rules_cache`.
   The starting values are the agronomic priors for tomato from the research table.
3. The **model** receives the readings *and* how far each reading is from its active
   threshold, so it keeps working when Stage 2 later adjusts the thresholds for a specific
   greenhouse — no retraining needed for a threshold change.
4. It predicts, in one pass:
   - fan speed: OFF / LOW (40%) / MEDIUM (70%) / HIGH (100%) + minutes
   - roof vent: CLOSED / HALF (50%) / FULL (100%)
   - mister, heater, irrigation, grow lights, CO₂ injector: ON/OFF + minutes
5. `predict.py` converts that into plain-language instructions. The **rule engine stays the
   safety fallback**: if the model ever says OFF during critical heat (≥ 32 °C), frost risk
   (< 12 °C) or dangerous CO₂ (> 1500 ppm), the rule's action is used instead.

### Why ML if we already have rules?
We have no `actions_log` history yet (cold start), so the model is first trained to
**imitate an expert policy** built from the research thresholds (imitation learning, as the
process doc recommends). The value comes next: once real farmer actions and outcomes are
logged in `actions_log`, they are added to the training data and the model learns what
actually works in *this* greenhouse — something a fixed rule table cannot do.

---

## 2. Folder structure (inside `ml_models/`)

```
ml_models/
├── greennode-ml-rules-process.md        (existing design doc)
└── action_model/
    ├── README.md                        ← this file
    ├── requirements.txt                 training PC (TensorFlow, tf2onnx)
    ├── requirements-edge.txt            Raspberry Pi (onnxruntime only)
    ├── .gitignore
    ├── config/
    │   └── thresholds.json              Stage 1 thresholds + actuator rates (edit HERE)
    ├── data/
    │   ├── training_data.csv            80,000 labelled examples (generated)
    │   └── test_scenarios.csv           33 best/average/worst test cases + expected actions
    ├── docs/
    │   ├── threshold_analysis_table.md  sensor → optimal / thresholds / actuator / timing
    │   ├── test_scenarios_table.md      full scenario table with farmer messages
    │   └── evaluation_report.md         created by evaluate.py after training
    ├── models/                          created by train_tf.py
    │   ├── greennode_action.onnx        ← deploy this to the hub
    │   ├── greennode_action.tflite      (optional, --tflite)
    │   ├── model_meta.json
    │   └── training_metrics.json
    └── src/
        ├── greennode_rules.py           thresholds, expert policy, features, messages
        ├── generate_dataset.py          builds data/training_data.csv
        ├── build_test_scenarios.py      builds the scenario table
        ├── train_tf.py                  trains the Keras model, exports ONNX/TFLite
        ├── evaluate.py                  checks the ONNX model against the table
        └── predict.py                   inference + farmer message (use from FastAPI)
```

---

## 3. Sensor threshold table (summary)

Full version with formulas: [`docs/threshold_analysis_table.md`](docs/threshold_analysis_table.md)

| Sensor | Optimal | Action trigger | Critical | Actuators |
|---|---|---|---|---|
| Air temperature | 17–27 °C | > 28 °C cool / < 12 °C heat | ≥ 32 °C | Fan, roof vent, mister, heater |
| Soil temperature | > 14 °C | < 14 °C | – | Root-zone heater (set 18 °C) |
| Relative humidity | 70–90 % | < 60 % mist / > 90 % ventilate | ≥ 95 % (disease) | Mister, fan, vent, heater |
| Soil moisture | 50–80 % | < 50 % | < 35 %, > 90 % waterlogged | Drip irrigation |
| CO₂ | 700–900 ppm (vents closed) | < 700 ppm, 07–17 h, vents closed | > 1500 ppm | CO₂ injector, fan, vent |
| Light (DLI) | ≥ 8.5 MJ/m²/day | < 8.5 by 16–18 h | – | Grow lights |

> Note: the farmer example used 30 °C as the temperature limit. The research table says
> cooling should start at 27–28 °C for tomato, so the default is **28 °C** (cool back to 26 °C).
> To use 30 °C, change `air_temp.cool_trigger` to 30 and `cool_target` to 28 in
> `config/thresholds.json` and re-run steps 5.2–5.5.

---

## 4. Test scenario table (expected actions)

These are the answers the model must reproduce. Full table with farmer messages:
[`docs/test_scenarios_table.md`](docs/test_scenarios_table.md). Unless listed, other
readings are normal (24 °C, RH 78 %, soil 65 %, soil 22 °C, CO₂ 750 ppm, outside 22 °C, 10:00).

| ID | Sensor | Case | Key readings | Fan | Roof vent | Mister | Heater | Irrigation | CO₂ | Grow lights | Stop when |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-01 | Air temperature | Best | Tin 24.0°C, Tout 22.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| T-02 | Air temperature | Average | Tin 29.0°C, Tout 26.0°C | LOW (40%) 25 min | HALF (50%) | ON 15 min | OFF | OFF | OFF | OFF | air temp ≤ 26°C |
| T-03 | Air temperature | Average | Tin 30.0°C, Tout 27.0°C | MEDIUM (70%) 20 min | HALF (50%) | ON 10 min | OFF | OFF | OFF | OFF | air temp ≤ 26°C |
| T-04 | Air temperature | Worst | Tin 40.0°C, Tout 30.0°C | HIGH (100%) 20 min | FULL (100%) | ON 10 min | OFF | OFF | OFF | OFF | air temp ≤ 26°C |
| T-05 | Air temperature | Worst | Tin 36.0°C, Tout 35.0°C | HIGH (100%) 40 min | HALF (50%) | ON 20 min | OFF | OFF | OFF | OFF | air temp ≤ 26°C |
| T-06 | Air temperature | Average | Tin 14.0°C, Tout 12.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| T-07 | Air temperature | Worst | Tin 9.0°C, Tout 7.0°C | OFF | CLOSED (0%) | OFF | ON, air set 16°C, 30 min | OFF | OFF | OFF | air temp ≥ 16°C |
| H-01 | Relative humidity | Best | RH 80%, T 24.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| H-02 | Relative humidity | Average | RH 92%, T 24.0°C | LOW (40%) 15 min | HALF (50%) | OFF | OFF | OFF | OFF | OFF | RH ≤ 80% |
| H-03 | Relative humidity | Worst | RH 97%, T 15.0°C | MEDIUM (70%) 25 min | HALF (50%) | OFF | ON, air set 16°C, 25 min | OFF | OFF | OFF | RH ≤ 80% |
| H-04 | Relative humidity | Average | RH 58%, T 24.0°C | OFF | CLOSED (0%) | ON 15 min | OFF | OFF | OFF | OFF | RH ≥ 75% |
| H-05 | Relative humidity | Worst | RH 40%, T 26.0°C | OFF | CLOSED (0%) | ON 25 min | OFF | OFF | OFF | OFF | RH ≥ 75% |
| S-01 | Soil moisture | Best | SM 65% at 10:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| S-02 | Soil moisture | Average | SM 45% at 10:00 | OFF | CLOSED (0%) | OFF | OFF | ON 25 min | OFF | OFF | soil moisture ≥ 75% |
| S-03 | Soil moisture | Worst | SM 25% at 10:00 | OFF | CLOSED (0%) | OFF | OFF | ON 45 min | OFF | OFF | soil moisture ≥ 75% |
| S-04 | Soil moisture | Average | SM 45% at 22:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| S-05 | Soil moisture | Worst | SM 30% at 22:00 | OFF | CLOSED (0%) | OFF | OFF | ON 40 min | OFF | OFF | soil moisture ≥ 75% |
| S-06 | Soil moisture | Worst | SM 95% at 10:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| R-01 | Soil temperature | Best | Tsoil 22.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| R-02 | Soil temperature | Average | Tsoil 13.0°C | OFF | CLOSED (0%) | OFF | ON, root-zone set 18°C, 50 min | OFF | OFF | OFF | soil temp ≥ 18°C |
| R-03 | Soil temperature | Worst | Tsoil 9.0°C | OFF | CLOSED (0%) | OFF | ON, root-zone set 18°C, 90 min | OFF | OFF | OFF | soil temp ≥ 18°C |
| C-01 | CO2 | Best | CO2 800 ppm, 10:00, Tin 24.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| C-02 | CO2 | Average | CO2 600 ppm, 10:00, Tin 24.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | ON 10 min | OFF | CO2 ≥ 800 ppm |
| C-03 | CO2 | Worst | CO2 380 ppm, 10:00, Tin 24.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | ON 20 min | OFF | CO2 ≥ 800 ppm |
| C-04 | CO2 | Average | CO2 600 ppm, 10:00, Tin 30.0°C | MEDIUM (70%) 20 min | HALF (50%) | ON 10 min | OFF | OFF | OFF | OFF | air temp ≤ 26°C |
| C-05 | CO2 | Average | CO2 450 ppm, 21:00, Tin 20.0°C | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| C-06 | CO2 | Worst | CO2 1700 ppm, 10:00, Tin 24.0°C | LOW (40%) 15 min | HALF (50%) | OFF | OFF | OFF | OFF | OFF | - |
| L-01 | Light (DLI) | Best | DLI 9.0 MJ/m² at 17:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| L-02 | Light (DLI) | Average | DLI 7.0 MJ/m² at 17:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | ON 180 min | DLI ≥ 8.5 MJ/m² |
| L-03 | Light (DLI) | Worst | DLI 3.0 MJ/m² at 17:00 | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | ON 240 min | DLI ≥ 8.5 MJ/m² |
| X-01 | Combined | Best | T 24.0°C, RH 78%, SM 65% | OFF | CLOSED (0%) | OFF | OFF | OFF | OFF | OFF | - |
| X-02 | Combined | Worst | T 35.0°C, RH 60%, SM 40% | HIGH (100%) 15 min | FULL (100%) | ON 10 min | OFF | ON 30 min | OFF | OFF | air temp ≤ 26°C; soil moisture ≥ 75% |
| X-03 | Combined | Worst | T 11.0°C, RH 96%, SM 65% | MEDIUM (70%) 20 min | HALF (50%) | OFF | ON, air set 16°C, 20 min | OFF | OFF | OFF | RH ≤ 80%; air temp ≥ 16°C |

---

## 5. How to run it (training PC)

Use **Python 3.10 or 3.11** (TensorFlow 2.15 does not support 3.12+).

```bash
cd ml_models/action_model

# 5.1 create a virtual environment
python -m venv .venv
# Windows:            .venv\Scripts\activate
# macOS / Linux:      source .venv/bin/activate
pip install -r requirements.txt

# 5.2 build the training data (80,000 labelled rows)
python src/generate_dataset.py --rows 80000 --seed 42

# 5.3 build the test-scenario table
python src/build_test_scenarios.py

# 5.4 train and export to ONNX (add --tflite for a TFLite copy)
python src/train_tf.py --epochs 60

# 5.5 check accuracy against the table + 10,000 unseen cases
python src/evaluate.py

# 5.6 try one reading (the 40 °C example)
python src/predict.py --air_temp 40 --rh 78 --soil_moisture 65 --soil_temp 22 --co2 750 --outside_temp 30 --hour 12 --dli_so_far 5
```

**What "accurate" means here.** A test case passes only if fan speed, vent opening and every
ON/OFF switch are exactly right **and** every duration is within ±5 minutes.
`evaluate.py` writes the results to `docs/evaluation_report.md`. If the scenario table is
below ~95 %, train longer (`--epochs 100`) or generate more rows (`--rows 150000`).

### On the Raspberry Pi hub
Copy `src/`, `config/` and `models/` to the hub, then:
```bash
pip install -r requirements-edge.txt
python src/predict.py --air_temp 33 --rh 70 --outside_temp 29 --hour 13
```
From the FastAPI backend:
```python
from predict import ActionModel
model = ActionModel()
result = model.recommend(latest_readings, thresholds_from_node_rules_cache)
# result["farmer_message"] -> list of sentences for the dashboard / mobile app
# result["actions"]        -> machine-readable actions for automatic control
```

---

## 6. Retraining with real farm data (Stage 2 / Stage 3)

Every row in `actions_log` joined with the `conditions` reading at that moment is one new
training example. Export them to a CSV with the same columns as `data/training_data.csv`
(readings, the 7 threshold columns, and the actions actually taken), append them, and re-run
steps 5.4–5.5. Real data is more valuable than generated data, so consider duplicating real
rows 5–10× when mixing. Keep the scenario table as a regression test: a new model should
never do worse on it than the previous one.

Public dataset for later: the **Autonomous Greenhouse Challenge, 2nd edition (2019)**
from Wageningen UR (cherry tomato, CC0) contains indoor/outdoor climate, actuator status and
setpoints — useful for learning real actuator response rates.
DOI: 10.4121/uuid:88d22c60-21b3-4ea8-90db-20249a5be2a7

---

## 7. Assumptions to confirm with the team

- Crop profile is **tomato**; other crops need their own values in `thresholds.json`.
- Actuators assumed: circulation/exhaust fan (3 speeds), roof vent, mister, heater
  (air + root zone), drip irrigation, grow lights, CO₂ injector. If a greenhouse lacks one,
  ignore that output in `predict.py`.
- Soil moisture is a calibrated capacitive % (0 dry – 100 saturated).
- Actuator response rates are estimates — calibrate them in the Phase 3 pilot.
