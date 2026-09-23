# GreenNode Action Model — Terminal Commands (all 4 crops)

Run these from `D:\Academic\Projects\CropFit\ml_models\action_model` in a Windows terminal
(PowerShell or cmd). All scripts (`predict.py`, `evaluate.py`, `train_tf.py`,
`generate_dataset.py`) accept `--thresholds` and `--models-dir` so the same script works for
every crop — you just swap those two flags together, always as a matching pair.

## 0. One-time setup

To **run/test** already-trained models, you only need:
```
pip install onnxruntime numpy pandas
```

To **retrain** a model from scratch, you also need:
```
pip install tensorflow tf2onnx
```

## 1. Get a single action recommendation (`predict.py`)

Feed it a sensor reading, get back what the actuators should do.

**Tomato** (default thresholds/models dir — flags optional, shown for clarity):
```
python src\predict.py --thresholds config\thresholds.json --models-dir models_tomato --air_temp 40 --rh 78 --soil_moisture 65 --soil_temp 22 --co2 750 --outside_temp 30 --hour 12 --dli_so_far 5
```

**Cucumber:**
```
python src\predict.py --thresholds config\thresholds_cucumber.json --models-dir models_cucumber --air_temp 32 --rh 55 --soil_moisture 50 --soil_temp 20 --co2 600 --outside_temp 28 --hour 13 --dli_so_far 6
```

**Capsicum:**
```
python src\predict.py --thresholds config\thresholds_capsicum.json --models-dir models_capsicum --air_temp 30 --rh 60 --soil_moisture 55 --soil_temp 19 --co2 650 --outside_temp 26 --hour 13 --dli_so_far 8
```

**Eggplant:**
```
python src\predict.py --thresholds config\thresholds_eggplant.json --models-dir models_eggplant --air_temp 32 --rh 55 --soil_moisture 60 --soil_temp 16 --co2 600 --outside_temp 28 --hour 13 --dli_so_far 7
```

Change the `--air_temp`, `--rh`, etc. values to whatever reading you want to test — these are
just example "hot, drying-out" readings to confirm the model responds sensibly.

## 2. Re-run the 33-scenario evaluation table + accuracy report (`evaluate.py`)

Checks the trained model against the hand-built best/average/worst scenarios and a fresh batch
of unseen random data, and writes a markdown report to `docs/`.

**Tomato:**
```
python src\evaluate.py --thresholds config\thresholds.json --scenarios data\test_scenarios.csv --models-dir models_tomato --report-out docs\evaluation_report_tomato.md
```

**Cucumber:**
```
python src\evaluate.py --thresholds config\thresholds_cucumber.json --scenarios data\test_scenarios_cucumber.csv --models-dir models_cucumber --report-out docs\evaluation_report_cucumber.md
```

**Capsicum:**
```
python src\evaluate.py --thresholds config\thresholds_capsicum.json --scenarios data\test_scenarios_capsicum.csv --models-dir models_capsicum --report-out docs\evaluation_report_capsicum.md
```

**Eggplant:**
```
python src\evaluate.py --thresholds config\thresholds_eggplant.json --scenarios data\test_scenarios_eggplant.csv --models-dir models_eggplant --report-out docs\evaluation_report_eggplant.md
```

Optional flags on any of the above: `--tol 5` (minutes tolerance, default 5), `--unseen 10000`
(how many fresh random rows to test against, default 10000).

## 3. Retrain from scratch (`train_tf.py`)

Only needed if you change a `thresholds_<crop>.json` file, regenerate the training data, or want
different hyperparameters. Takes a few minutes per crop on CPU.

**Tomato:**
```
python src\train_tf.py --data data\training_data.csv --thresholds config\thresholds.json --models-dir models_tomato
```

**Cucumber:**
```
python src\train_tf.py --data data\training_data_cucumber.csv --thresholds config\thresholds_cucumber.json --models-dir models_cucumber
```

**Capsicum:**
```
python src\train_tf.py --data data\training_data_capsicum.csv --thresholds config\thresholds_capsicum.json --models-dir models_capsicum
```

**Eggplant:**
```
python src\train_tf.py --data data\training_data_eggplant.csv --thresholds config\thresholds_eggplant.json --models-dir models_eggplant
```

Optional flags: `--epochs 60` (default), `--batch 256` (default), `--seed 42` (default),
`--tflite` (also export a `.tflite` file for on-device use, not exported by default).

## 4. Regenerate the synthetic training data (`generate_dataset.py`)

Only needed if you edit a `thresholds_<crop>.json` file and want new training data that reflects
the change — the existing 80,000-row CSVs stay valid otherwise.

**Tomato:**
```
python src\generate_dataset.py --rows 80000 --seed 42 --thresholds config\thresholds.json --out data\training_data.csv
```

**Cucumber:**
```
python src\generate_dataset.py --rows 80000 --seed 42 --thresholds config\thresholds_cucumber.json --out data\training_data_cucumber.csv
```

**Capsicum:**
```
python src\generate_dataset.py --rows 80000 --seed 42 --thresholds config\thresholds_capsicum.json --out data\training_data_capsicum.csv
```

**Eggplant:**
```
python src\generate_dataset.py --rows 80000 --seed 42 --thresholds config\thresholds_eggplant.json --out data\training_data_eggplant.csv
```

## Full workflow for one crop, start to finish

If you ever change a crop's `thresholds_<crop>.json` and want everything rebuilt consistently,
run these four in order (example: capsicum):
```
python src\generate_dataset.py --rows 80000 --seed 42 --thresholds config\thresholds_capsicum.json --out data\training_data_capsicum.csv
python src\train_tf.py --data data\training_data_capsicum.csv --thresholds config\thresholds_capsicum.json --models-dir models_capsicum
python src\build_test_scenarios_capsicum.py
python src\evaluate.py --thresholds config\thresholds_capsicum.json --scenarios data\test_scenarios_capsicum.csv --models-dir models_capsicum --report-out docs\evaluation_report_capsicum.md
```

## Rule of thumb

`--thresholds` and `--models-dir` (and `--scenarios`/`--out`/`--data` where relevant) must always
point at the **same crop**. Mixing them — e.g. cucumber thresholds with the tomato model — will
run without an error but silently produce wrong distance-from-threshold features and meaningless
results. There is no built-in check for this; it's on you to keep the pairing consistent, which
is why every command above spells out the full matching set rather than relying on defaults.
