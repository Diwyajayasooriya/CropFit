# Sensor threshold analysis (Stage 1 agronomic priors — cucumber)

Same format as `docs/threshold_analysis_table.md` (tomato). Full sourcing and confidence ratings
per field are in `cucumber_action_model_reference.md` in the Green NODE project — this file only
documents the numbers that are actually in `config/thresholds_cucumber.json`. "Trigger" = the
value at which the hub recommends an action. "Stop when" = when the farmer (or the automation)
switches the actuator back off.

| Sensor | Unit | Optimal range | Lower trigger | Upper trigger | Critical | Actuator(s) | Setting / how to operate | Stop when | How minutes are calculated | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Air temperature | °C | 20 – 27 | < 18 (heat) | > 28 (cool) | ≥ 35 (critical heat) | Fan, roof vent, mister, heater | Fan LOW 40% if ≤3°C above 26; MEDIUM 70% if 3–7°C; HIGH 100% if >7°C. Vent HALF/FULL scaling the same way as tomato. Mister on if RH < 80%. Heater set to 20°C, vents closed. | Cooling: ≤ 26°C. Heating: ≥ 20°C | Same formulas as tomato: (T − 26) ÷ cooling rate; heating (20 − T) ÷ 0.25°C/min | **High** (cold side, 3-source agreement) / **Medium** (hot side, interpolated) |
| Soil (root-zone) temperature | °C | 19 – 22 | < 16 | – | – | Root-zone / floor heater | Set to 20°C | ≥ 20°C | (20 − Tsoil) ÷ 0.1°C/min, max 90 min | **High** — dedicated 2026 yield study (Refaie et al.) |
| Relative humidity | % | 60 – 75 | < 55 (stress) | > 75 | ≥ 90 (disease risk, unconfirmed exact figure) | Mister (low); fan + roof vent (+ heater if < 20°C) (high) | Low: mister ON. High: vent HALF, fan LOW (MEDIUM if ≥ 90%). | Low: RH ≥ 65%. High: RH ≤ 68% | Low: (65 − RH) ÷ 1.5%/min. High: (RH − 68) ÷ 0.8%/min | **Medium** — optimal band sourced (Alabama Extension); disease-risk ceiling not cucumber-specific, source was paywalled |
| Soil moisture | % (0 dry – 100 saturated) | 55 – 90 (target 80) | < 55; < 40 critical | > 90 waterlogged | < 40 | Drip irrigation valve | ON. Night rule same as tomato: only if < 40%, else wait for morning. Never if > 90%. | ≥ 80% | (80 − SM) ÷ 1.2%/min, 5–45 min | **Low** — measurement-scale mismatch with the source study (field-capacity %, not calibrated capacitive %); reasoned adjustment off tomato's baseline, not a direct figure |
| CO₂ | ppm | 700 – 1300 (vents closed) | < 700, daytime 07–17, vents closed | > 1500 | > 1500 (worker safety) | CO₂ injector; fan + vent (high) | Inject ONLY when vents closed. High: vent HALF + fan LOW 15 min. | ≥ 1000 ppm | (1000 − CO₂) ÷ 25 ppm/min, max 30 min | **Medium-high** — AHDB (UK industry research body), citation-backed |
| Light (daily light integral) | MJ/m²/day | ≥ 9.0 | < 9.0 by 16:00–18:00 | – | – | Grow lights | ON in the evening window | DLI ≥ 9.0 | (9.0 − DLI) ÷ 0.5 MJ/m²/h, 15–240 min | **Low** — converted from a mol/m²/day PAR figure (20–35 mol/m²/day); the MJ number is an approximate unit conversion, not directly sourced |
| Fertigation EC | mS/cm | 1.7 – 2.0 | – | – | – | Not yet in the model schema (no `ec`/`ph` block exists in `thresholds.json` yet — see original review, gap 3) | — | — | — | **Medium** — Oklahoma State Extension, same source used for tomato's figures |
| Fertigation pH | — | 5.0 – 5.5 | – | – | – | Same as above | — | — | — | **Medium** — same source |
| Internal air velocity | m/s | < 0.5 | – | 0.5 | – | Circulation fan | Same hardware constraint as tomato — not crop-specific | – | Constraint, not a model output | Not implemented in code (same as tomato) |
| External wind | m/s | — | – | unverified | – | Roof vent | The tomato file's own "> 2 m/s → reduce vent" figure could not be sourced from research either — flagged as an unverified placeholder in the original review, carried over unchanged since it's a hardware/structural question, not a crop one | – | Constraint, not a model output (no wind sensor yet) | Unverified for both crops |

**Reading this against tomato's table:** the two crops diverge most on relative humidity (cucumber
wants it noticeably lower — 60–75% vs tomato's 70–90% — consistent with cucumber's greater
mildew susceptibility) and fertigation (cucumber's EC ceiling of ~2.0 mS/cm sits almost exactly
where tomato's floor of 2.0 mS/cm begins) — a single shared threshold file genuinely could not
serve both crops correctly, which was the original point of gap 1 in the review.

**Full sourcing** (which paper/extension guide each number came from, and why some are flagged
lower confidence) is in `cucumber_action_model_reference.md`, sections 2–8.