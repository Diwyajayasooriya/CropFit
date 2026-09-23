# Sensor threshold analysis (Stage 1 agronomic priors — eggplant / brinjal)

Same format as the tomato/cucumber/capsicum tables. Full sourcing and confidence ratings are in
`README_EGGPLANT.md` — read that before trusting this file, since several sections here are
placeholders rather than sourced figures (flagged in the Confidence column).

| Sensor | Unit | Optimal range | Lower trigger | Upper trigger | Critical | Actuator(s) | Setting / how to operate | Stop when | How minutes are calculated | Confidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Air temperature | °C | 21 – 29 | < 16 (heat) | > 30 (cool) | ≥ 35 (unconfirmed) | Fan, roof vent, mister, heater | Fan LOW/MEDIUM/HIGH scaling same as other crops. Heater set to 20°C, vents closed. | Cooling: ≤ 27°C. Heating: ≥ 20°C | (T − 27) ÷ cooling rate; heating (20 − T) ÷ 0.25°C/min | **Medium** (cold side, 2-source agreement on 15.6°C) / **Low** (critical_high, no hard source) |
| Soil (root-zone) temperature | °C | – | < 16 | – | – | Root-zone / floor heater | Set to 20°C | ≥ 20°C | (20 − Tsoil) ÷ 0.1°C/min, max 90 min | **Low** — no dedicated study, set by analogy to air temp |
| Relative humidity | % | 65 – 85 | < 60 (stress) | > 85 | ≥ 95 (generic) | Mister (low); fan + roof vent (high) | Low: mister ON. High: vent HALF, fan LOW. | Low: RH ≥ 75%. High: RH ≤ 78% | Low: (75 − RH) ÷ 1.5%/min. High: (RH − 78) ÷ 0.8%/min | **Low** — no research or extension source found at all; carried over from tomato |
| Soil moisture | % (0 dry – 100 saturated) | 65 – 90 (target 85) | < 65; < 45 critical | > 90 waterlogged | < 45 | Drip irrigation valve | ON, same night-deferral logic as other crops. | ≥ 85% | (85 − SM) ÷ 1.2%/min, 5–45 min | **Medium** — real field-trial paper (Karam et al. 2011), same scale-mismatch caveat as other crops |
| CO₂ | ppm | 700 – 850 (vents closed) | < 700, daytime, vents closed | > 1500 | > 1500 (worker safety) | CO₂ injector; fan + vent (high) | Inject only when vents closed. | ≥ 850 ppm | (850 − CO₂) ÷ 25 ppm/min, max 30 min | **Low-medium** — unsourced for eggplant, generic midpoint of the other three crops |
| Light (daily light integral) | MJ/m²/day | ≥ 8.5 | < 8.5 by 16:00–18:00 | – | – | Grow lights | ON in the evening window | DLI ≥ 8.5 | (8.5 − DLI) ÷ 0.5 MJ/m²/h, 15–240 min | **Low** — source study measured supplemental, not total, DLI; not directly usable, placeholder kept |
| Fertigation EC | mS/cm | 2.5 – 3.5 | – | – | – | Not yet in the model schema | — | — | — | **Medium** — highest of all four crops, from the same consistent OSU source used throughout |
| Fertigation pH | — | ≈ 6.0 | – | – | – | Same as above | — | — | — | **Medium** — source gives a point value, not a range |
| Internal air velocity | m/s | < 0.5 | – | 0.5 | – | Circulation fan | Hardware constraint, not crop-specific | – | Constraint, not a model output | Not implemented in code (same as all four crops) |
| External wind | m/s | — | – | unverified | – | Roof vent | Same unverified figure as the other three crop files — hardware question | – | Constraint, not a model output | Unverified for all four crops |

**Reading this against the other three crops:** eggplant's fertigation EC (2.5–3.5 mS/cm) is
clearly the richest of all four — meaningfully above tomato's 2.0–4.0 overlap range and far above
cucumber (1.7–2.0) or capsicum (0.8–1.8, disputed). Its soil-moisture sensitivity (yield loss
starting at just 80% of field capacity, per Karam et al. 2011) is also the sharpest of the four —
worth prioritizing a tighter irrigation trigger for eggplant nodes specifically once real sensor
calibration data exists. On the other hand, **this is the crop file with the most placeholder
sections** (RH, CO2, DLI) — treat those three rows as needing real research before field use,
not as equally trustworthy to the fertigation and soil-moisture rows.
