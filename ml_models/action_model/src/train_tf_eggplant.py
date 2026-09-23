"""
train_tf.py
-----------
Trains the GreenNode ACTION model (Stage 3) with TensorFlow/Keras and exports it to
ONNX (for ONNX Runtime on the Raspberry Pi hub) and, optionally, TFLite.

One network, four output heads:
    fan        -> softmax over [OFF, LOW, MEDIUM, HIGH]
    vent       -> softmax over [CLOSED, HALF, FULL]
    switches   -> 5 sigmoids: mister, heater, irrigation, lights, co2_inject
    durations  -> 6 values (0-1, scaled by each actuator's max minutes):
                  fan_min, mister_min, heater_min, irrigation_min, lights_min, co2_min

Usage:
    python src/train_tf.py                   # train + export ONNX
    python src/train_tf.py --epochs 60 --tflite
    python src/train_tf.py --data data/training_data_cucumber.csv \
        --thresholds config/thresholds_cucumber.json --models-dir models_cucumber
Outputs (models/, or --models-dir if given):
    greennode_action.keras, greennode_action.onnx, [greennode_action.tflite],
    model_meta.json, training_metrics.json
"""
import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd
import tensorflow as tf

from greennode_rules import (ROOT, FEATURE_NAMES, SWITCH_ACTUATORS, DURATION_KEYS,
                             load_thresholds, featurize_frame)
DUR_CAPS = {"fan_min": "fan_max_min", "mister_min": "mister_max_min", "heater_min": "heater_max_min",
            "irrigation_min": "irrigation_max_min", "lights_min": "lights_max_min", "co2_min": "co2_max_min"}


def load_xy(path, base):
    df = pd.read_csv(path)
    X = featurize_frame(df, base)
    caps = np.array([base["limits"][DUR_CAPS[k]] for k in DURATION_KEYS], dtype=np.float32)
    y = {
        "fan": df["fan"].to_numpy(np.int32),
        "vent": df["vent"].to_numpy(np.int32),
        "switches": df[SWITCH_ACTUATORS].to_numpy(np.float32),
        "durations": df[DURATION_KEYS].to_numpy(np.float32) / caps,
    }
    return X, y, caps


def build_model(n_features, X_train):
    inp = tf.keras.Input(shape=(n_features,), name="features", dtype=tf.float32)
    norm = tf.keras.layers.Normalization(name="normalize")
    norm.adapt(X_train)                      # mean/std are stored INSIDE the model
    x = norm(inp)
    for i, units in enumerate([128, 128, 64]):
        x = tf.keras.layers.Dense(units, activation="relu", name=f"dense_{i}")(x)
        x = tf.keras.layers.BatchNormalization(name=f"bn_{i}")(x)
        x = tf.keras.layers.Dropout(0.1, name=f"drop_{i}")(x)
    fan = tf.keras.layers.Dense(4, activation="softmax", name="fan")(x)
    vent = tf.keras.layers.Dense(3, activation="softmax", name="vent")(x)
    sw = tf.keras.layers.Dense(len(SWITCH_ACTUATORS), activation="sigmoid", name="switches")(x)
    dur = tf.keras.layers.Dense(len(DURATION_KEYS), activation="sigmoid", name="durations")(x)
    model = tf.keras.Model(inp, [fan, vent, sw, dur], name="greennode_action")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss={"fan": "sparse_categorical_crossentropy", "vent": "sparse_categorical_crossentropy",
              "switches": "binary_crossentropy", "durations": tf.keras.losses.Huber(delta=0.05)},
        loss_weights={"fan": 1.0, "vent": 1.0, "switches": 1.0, "durations": 20.0},
        metrics={"fan": ["accuracy"], "vent": ["accuracy"],
                 "switches": [tf.keras.metrics.BinaryAccuracy(name="acc")], "durations": ["mae"]},
    )
    return model


def decode(preds, caps, step=5):
    """Model outputs -> integer actions (same post-processing as predict.py)."""
    fan_p, vent_p, sw_p, dur_p = preds
    fan = fan_p.argmax(1)
    vent = vent_p.argmax(1)
    sw = (sw_p >= 0.5).astype(int)
    mins = np.round(dur_p * caps / step) * step
    on_mask = np.concatenate([(fan > 0)[:, None], sw], axis=1)  # fan_min follows fan, others follow switches
    mins = np.where(on_mask == 1, np.maximum(mins, step), 0).astype(int)
    return fan, vent, sw, mins


def report(y, dec, caps, tol=5):
    fan, vent, sw, mins = dec
    true_mins = np.round(y["durations"] * caps).astype(int)
    res = {"fan_accuracy": float((fan == y["fan"]).mean()),
           "vent_accuracy": float((vent == y["vent"]).mean())}
    for i, k in enumerate(SWITCH_ACTUATORS):
        res[f"{k}_accuracy"] = float((sw[:, i] == y["switches"][:, i]).mean())
    for i, k in enumerate(DURATION_KEYS):
        on = true_mins[:, i] > 0
        err = np.abs(mins[:, i] - true_mins[:, i])
        res[f"{k}_MAE_when_on"] = float(err[on].mean()) if on.any() else 0.0
        res[f"{k}_within_{tol}min"] = float((err[on] <= tol).mean()) if on.any() else 1.0
    exact = ((fan == y["fan"]) & (vent == y["vent"]) & (sw == y["switches"]).all(1)
             & (np.abs(mins - true_mins) <= tol).all(1))
    res["full_action_match"] = float(exact.mean())
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", default=str(ROOT / "data" / "training_data.csv"))
    ap.add_argument("--epochs", type=int, default=60)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--tflite", action="store_true", help="also export a .tflite model")
    ap.add_argument("--thresholds", default=None,
                   help="Path to a thresholds JSON (e.g. config/thresholds_cucumber.json). "
                        "Defaults to config/thresholds.json when omitted. Must match whatever "
                        "--thresholds was used to generate --data, or the threshold-distance "
                        "features will be wrong.")
    ap.add_argument("--models-dir", default=str(ROOT / "models"),
                   help="Where to save the trained model. Use a separate directory per crop "
                        "(e.g. models_cucumber) so training one crop doesn't overwrite another's "
                        "deployed model.")
    args = ap.parse_args()

    MODELS = Path(args.models_dir)
    tf.keras.utils.set_random_seed(args.seed)
    base = load_thresholds(args.thresholds) if args.thresholds else load_thresholds()
    X, y, caps = load_xy(args.data, base)

    # 80 / 10 / 10 split
    idx = np.random.default_rng(args.seed).permutation(len(X))
    n_tr, n_va = int(0.8 * len(X)), int(0.9 * len(X))
    tr, va, te = idx[:n_tr], idx[n_tr:n_va], idx[n_va:]
    pick = lambda d, i: {k: v[i] for k, v in d.items()}

    model = build_model(X.shape[1], X[tr])
    model.summary()
    cb = [tf.keras.callbacks.EarlyStopping(monitor="val_loss", patience=8, restore_best_weights=True),
          tf.keras.callbacks.ReduceLROnPlateau(monitor="val_loss", factor=0.5, patience=4, min_lr=1e-5)]
    model.fit(X[tr], pick(y, tr), validation_data=(X[va], pick(y, va)),
              epochs=args.epochs, batch_size=args.batch, callbacks=cb, verbose=2)

    metrics = report(pick(y, te), decode(model.predict(X[te], verbose=0), caps), caps)
    print("\n=== Held-out test set ===")
    for k, v in metrics.items():
        print(f"  {k:<32} {v:.3f}")

    MODELS.mkdir(parents=True, exist_ok=True)
    model.save(MODELS / "greennode_action.keras")

    # ---- ONNX export --------------------------------------------------------
    import tf2onnx
    spec = (tf.TensorSpec((None, X.shape[1]), tf.float32, name="features"),)
    tf2onnx.convert.from_keras(model, input_signature=spec, opset=13,
                               output_path=str(MODELS / "greennode_action.onnx"))
    print(f"Saved {MODELS / 'greennode_action.onnx'}")

    if args.tflite:
        conv = tf.lite.TFLiteConverter.from_keras_model(model)
        conv.optimizations = [tf.lite.Optimize.DEFAULT]
        (MODELS / "greennode_action.tflite").write_bytes(conv.convert())
        print(f"Saved {MODELS / 'greennode_action.tflite'}")

    meta = {"feature_names": FEATURE_NAMES, "switch_actuators": SWITCH_ACTUATORS,
            "duration_keys": DURATION_KEYS, "duration_caps_min": caps.tolist(),
            "output_order": ["fan", "vent", "switches", "durations"],
            "round_to_min": base["limits"]["round_to_min"],
            "trained_on": args.data, "rows": int(len(X))}
    (MODELS / "model_meta.json").write_text(json.dumps(meta, indent=2))
    (MODELS / "training_metrics.json").write_text(json.dumps(metrics, indent=2))
    print(f"Saved {MODELS / 'model_meta.json'} and {MODELS / 'training_metrics.json'}")


if __name__ == "__main__":
    main()
