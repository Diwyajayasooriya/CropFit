# Evaluation report — 2026-09-23

Model: `../models_eggplant/greennode_action.onnx` · tolerance for durations: ±5 min

## 1. Scenario table (best / average / worst cases)

**31/33 scenarios passed (93.9%)**

| ID | Sensor | Case | Expected | Model output | Result |
|---|---|---|---|---|---|
| T-01 | Air temperature | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| T-02 | Air temperature | Average | fan MEDIUM 15m, vent HALF, mister 10m | fan MEDIUM 15m, vent HALF, mister 10m | PASS |
| T-03 | Air temperature | Average | fan MEDIUM 20m, vent HALF, mister 10m | fan MEDIUM 15m, vent HALF, mister 10m | PASS |
| T-04 | Air temperature | Worst | fan HIGH 20m, vent FULL, mister 10m | fan HIGH 20m, vent FULL, mister 15m | PASS |
| T-05 | Air temperature | Worst | fan HIGH 30m, vent HALF, mister 15m | fan HIGH 35m, vent HALF, mister 20m | PASS |
| T-06 | Air temperature | Average | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| T-07 | Air temperature | Worst | fan OFF 0m, vent CLOSED, heater 40m | fan OFF 0m, vent CLOSED, heater 45m | PASS |
| H-01 | Relative humidity | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| H-02 | Relative humidity | Average | fan LOW 15m, vent HALF,  | fan LOW 15m, vent HALF,  | PASS |
| H-03 | Relative humidity | Worst | fan MEDIUM 25m, vent HALF, heater 25m | fan MEDIUM 25m, vent HALF, heater 25m | PASS |
| H-04 | Relative humidity | Average | fan OFF 0m, vent CLOSED, mister 15m | fan OFF 0m, vent CLOSED, mister 15m | PASS |
| H-05 | Relative humidity | Worst | fan OFF 0m, vent CLOSED, mister 25m | fan OFF 0m, vent CLOSED, mister 25m | PASS |
| S-01 | Soil moisture | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| S-02 | Soil moisture | Average | fan OFF 0m, vent CLOSED, irrigation 25m | fan OFF 0m, vent CLOSED, irrigation 25m | PASS |
| S-03 | Soil moisture | Worst | fan OFF 0m, vent CLOSED, irrigation 40m | fan OFF 0m, vent CLOSED, irrigation 40m | PASS |
| S-04 | Soil moisture | Average | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| S-05 | Soil moisture | Worst | fan OFF 0m, vent CLOSED, irrigation 40m | fan OFF 0m, vent CLOSED, irrigation 40m | PASS |
| S-06 | Soil moisture | Worst | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| R-01 | Soil temperature | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| R-02 | Soil temperature | Average | fan OFF 0m, vent CLOSED, heater 50m | fan OFF 0m, vent CLOSED, heater 55m | PASS |
| R-03 | Soil temperature | Worst | fan OFF 0m, vent CLOSED, heater 90m | fan OFF 0m, vent CLOSED, heater 90m | PASS |
| C-01 | CO2 | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| C-02 | CO2 | Average | fan OFF 0m, vent CLOSED, co2_inject 10m | fan OFF 0m, vent CLOSED, co2_inject 15m | PASS |
| C-03 | CO2 | Worst | fan OFF 0m, vent CLOSED, co2_inject 20m | fan OFF 0m, vent CLOSED, co2_inject 20m | PASS |
| C-04 | CO2 | Average | fan MEDIUM 15m, vent HALF, mister 10m | fan MEDIUM 15m, vent HALF, mister 10m | PASS |
| C-05 | CO2 | Average | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED, lights 15m | FAIL |
| C-06 | CO2 | Worst | fan LOW 15m, vent HALF,  | fan LOW 15m, vent HALF,  | PASS |
| L-01 | Light (DLI) | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| L-02 | Light (DLI) | Average | fan OFF 0m, vent CLOSED, lights 180m | fan OFF 0m, vent CLOSED, lights 230m | FAIL |
| L-03 | Light (DLI) | Worst | fan OFF 0m, vent CLOSED, lights 240m | fan OFF 0m, vent CLOSED, lights 240m | PASS |
| X-01 | Combined | Best | fan OFF 0m, vent CLOSED,  | fan OFF 0m, vent CLOSED,  | PASS |
| X-02 | Combined | Worst | fan MEDIUM 20m, vent HALF, mister 15m, irrigation 30m | fan MEDIUM 20m, vent HALF, mister 15m, irrigation 30m | PASS |
| X-03 | Combined | Worst | fan MEDIUM 25m, vent HALF, heater 35m | fan MEDIUM 20m, vent HALF, heater 40m | PASS |

## 2. Unseen random data (10,000 rows)

**Full-action match: 86.3%** (every actuator and every duration correct)

| Output | Accuracy |
|---|---|
| fan speed | 98.8% |
| roof vent | 99.2% |
| mister on/off | 99.4% |
| heater on/off | 99.6% |
| irrigation on/off | 99.7% |
| lights on/off | 99.8% |
| co2_inject on/off | 99.8% |
| fan_min within ±5 min (when ON) | 91.4% |
| mister_min within ±5 min (when ON) | 98.7% |
| heater_min within ±5 min (when ON) | 85.3% |
| irrigation_min within ±5 min (when ON) | 96.1% |
| lights_min within ±5 min (when ON) | 72.7% |
| co2_min within ±5 min (when ON) | 97.8% |
