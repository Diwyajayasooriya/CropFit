# Cucumber Reference Data — for a second `thresholds.json` profile

Companion to `action_model_review.md`. Built the same way as the tomato config in
`ml_models/action_model/config/thresholds.json`: same JSON schema, same field names, so it can be
dropped in as a second crop profile (e.g. `config/thresholds_cucumber.json`) without changing
`greennode_rules.py`.

**Crop:** Cucumber (*Cucumis sativus*), greenhouse slicing/European type — the closest widely-grown
companion crop to tomato in the same protected-cultivation setup, which is why I picked it over a
less-related crop: growers commonly run tomato and cucumber in the same or adjacent greenhouses,
so this is the second profile CropFit is most likely to need first.

Every number below has a source and a confidence note. Where I could not find (or could not
access, due to paywalls/robots.txt) a research-backed figure, I say so explicitly rather than
inventing one — several fields below are reasoned estimates, not measured data, and are flagged
as such.


## 2. Air temperature — confidence: HIGH (cold side), MEDIUM (hot side)

| Field | Value | Source |
|---|---|---|
| Night minimum / `heat_trigger` | **18°C (65°F)** | Three independent sources converge on this exact figure: Owen & Cockson (2021), *"Chilling Injury Symptomology of Greenhouse Cucumbers,"* e-GRO Alert 6(5), University of Kentucky — chilling injury "can occur if air temperature drops below 65°F"; Texas A&M AgriLife Extension greenhouse cucumber guide — "night temperatures no lower than 65°F will allow a rapid growth rate"; both independently landing on 65°F/18°C. |
| Recommended operating band | **20–23°C (68–74°F)**, widening to day **24–27°C (75–80°F)** | Owen & Cockson (2021) recommend 68–74°F generally; Haifa Group cucumber grower guide and Texas A&M AgriLife both separately give 75–80°F for daytime. |
| Peak tolerable (quality declines if prolonged) | **29–35°C (85–95°F)** | Texas A&M AgriLife: "peak daytime temperatures of 85 to 95°F are tolerable" but reduce fruit quality if prolonged. Alabama Cooperative Extension separately states "cucumbers grow best at 80 to 85°F [27–29°C]," growth/yield falling off above and below that. |
| Zhou et al. 2016 control condition | 25°C day / 18°C night | Zhou, Y. et al. (2016), *"Unraveling Main Limiting Sites of Photosynthesis under Below- and Above-Ground Heat Stress in Cucumber,"* Frontiers in Plant Science 7:746 — used as their control/optimal baseline, and their experimental "heat stress" treatment was a sharp 40°C, well above any practical field trigger, so it isn't usable as a `critical_high` figure. |

**What I set and why:** `heat_trigger`/night-min = 18°C is solid (3-source agreement). `opt_min`–`opt_max` = 20–27°C blends the Owen & Cockson operating band with the Haifa/TAMU day figures. `critical_high` = 35°C is the upper end of TAMU's "tolerable but quality-reducing" band — **this one is an interpolation, not a single controlled-study threshold** the way tomato's 32°C fruit-set-failure figure was (Adams et al., 2001, cited in the original review). If the team wants a harder number here, it needs a dedicated cucumber heat-stress field study, which I did not find with a clean practical (not 40°C lab-extreme) threshold.

## 3. Soil (root-zone) temperature — confidence: HIGH

Source: Refaie et al. (2026), *"Smart control of soil temperature to optimize root-zone conditions
for enhancing the physiological performance, growth, and productivity of greenhouse-grown
cucumber,"* Scientific Reports.

This is a controlled yield study, not just a stated recommendation — genuinely stronger evidence
than most of the other rows here:

| Root-zone temp tested | Result |
|---|---|
| 13°C, 16°C | Reduced photosynthesis, stomatal conductance, nutrient uptake, growth — confirmed suboptimal |
| **19°C** | Yield 3.37 ± 0.09 kg/plant — recommended for late season (energy saving) |
| **22°C** | Yield 3.71 ± 0.14 kg/plant — recommended for initial/mid-season, statistically similar to 19°C |

I set `heat_trigger` = 16°C (the study's confirmed-suboptimal point) and `heat_target` = 20°C
(middle of the 19–22°C recommended band) — directly traceable to this study's numbers, unlike
tomato's soil-temp figures which came from the general threshold table rather than a dedicated
study.

## 4. Relative humidity — confidence: MEDIUM

| Field | Value | Source |
|---|---|---|
| Optimal band | **60–70%** | Alabama Cooperative Extension System, "Greenhouse Cucumber Production" — "cucumbers grow well in high humidity (60 percent to 70 percent)... humidity exceeding this range increases disease pressure and reduces crop yield." |
| Disease-risk ceiling | Not independently confirmed | I found a directly relevant paper — a 2023 IOP Conference Series study on RH and cucumber downy mildew in Baghdad greenhouses — but could not access its full text (blocked by the publisher's robots.txt), so I could not pull its exact RH threshold. The 90% figure in the JSON above is carried over from the general cross-crop convergence in disease literature (most fungal/oomycete greenhouse pathogens accelerate sharply above ~90–95% RH with leaf wetness), **not a cucumber-specific sourced number** — flagging this rather than presenting it as equally solid to the Alabama Extension figure. |

The Alabama Extension band (60–70%) is notably *lower* than tomato's Shamshiri-sourced optimal
band (70–90%, pollination favored ~60%) — this is a real, plausible crop difference (cucumber's
higher susceptibility to powdery/downy mildew is well documented, even where I couldn't pull an
exact number), not just noise between sources.

## 5. Soil moisture / irrigation — confidence: LOW (flagged, not silently guessed)

This is the weakest-sourced section, and I want to be upfront about why rather than present it
with false confidence.

Source found: Song et al. (2022), *"Regulating Vapor Pressure Deficit and Soil Moisture Improves
Tomato and Cucumber Plant Growth and Water Productivity in the Greenhouse,"* Horticulturae 8(2):147
— tested cucumber at 100% field capacity (FC, well-watered) vs. 60% FC (water-stress treatment,
confirmed to reduce growth).

**The problem:** that's measured as % of field capacity by substrate weight. Your `thresholds.json`
schema uses a calibrated capacitive-sensor 0–100 scale (0 = bone dry, 100 = saturated, with the
tomato file's own comment noting ~50% ≈ −30 kPa, ~80% ≈ −10 kPa/field capacity). These are
different measurement principles and don't convert cleanly without knowing your specific sensor's
calibration curve for cucumber's substrate/soil type — the tomato file's own thresholds needed
that calibration too, and it's flagged there as a to-do for the Phase 3 field trial.

What I did: rather than reuse tomato's exact numbers (50/35/75/90) or invent a precise cucumber
number I can't source, I nudged the thresholds moderately higher (55/40/80/90) to reflect that
cucumber is consistently described across the literature I found as less drought-tolerant / more
water-sensitive than tomato (Song et al. above test both crops side by side under identical
conditions specifically because they respond differently to water stress). **Treat this whole
block as a reasoned placeholder, not a sourced target** — it needs the same on-site capacitive-sensor
calibration tomato's does, arguably more urgently since I have less to anchor it to.

## 6. CO2 — confidence: MEDIUM-HIGH

Source: AHDB (Agriculture and Horticulture Development Board, UK), "CO2 best practice guide:
Background," citing Nederhoff & Vegter (1994) and Nederhoff (2004). AHDB is a UK statutory
industry research/levy body, not a peer-reviewed journal, but it's a reputable, citation-backed
applied-research source specifically for protected cropping.

- Ambient outdoor CO2 (used as the model's `ambient_min`): ~380 ppm at time of writing, though
  I kept 340 ppm to match the tomato file's more conservative constant — worth reconciling; 340
  is somewhat dated as an "ambient" figure (global background CO2 has risen), but since both
  profiles use it as a floor rather than a precise target, the discrepancy is minor.
- Seedling/raising stage target: 800–1,000 ppm.
- Mature-crop enrichment: economically-optimal range 1,000–1,300 ppm under good light, higher
  than tomato's 800 ppm `enrich_target`.
- No explicit safety ceiling was given in this source — I kept 1,500 ppm from the tomato file,
  which is a general workplace air-quality limit rather than a crop-specific figure to begin with,
  so it's reasonable to carry over unchanged.

I set `enrich_target` = 1000 ppm (top of the seedling range / entry point to the mature-crop
range) as a middle-ground figure — the team could reasonably push this to 1200–1300 for a
mature, well-lit crop if enrichment cost isn't a constraint.

## 7. Light (DLI) — confidence: LOW, unit-conversion caveat

**Important mismatch to flag:** the tomato `thresholds.json` measures light as `dli_min_mj`,
i.e. total daily solar radiation in MJ/m²/day. Nearly everything published on cucumber DLI in
horticultural lighting literature instead reports **mol/m²/day of PAR** (photosynthetically
active photons) — a different quantity, not a different unit for the same thing. Converting
between them depends on the spectral composition of the light source and isn't a fixed constant.

What I found (PAR-based, mol/m²/day):
- Heliospectra (a commercial horticultural-LED company, practitioner source, not peer-reviewed):
  cucumber develops best at **20–35 mol/m²/day or higher**.

Using a commonly cited approximate conversion (~2.1–2.3 mol PAR per MJ of total solar radiation,
itself a rule-of-thumb rather than a precise constant), 20–35 mol/m²/day works out to roughly
**9–16 MJ/m²/day** — I used the low end (9.0) as a conservative `dli_min_mj` estimate, close to
tomato's own 8.5 figure, which is plausible but **I would not treat this converted number as
reliable without checking it against your actual light sensor's calibration**, since the
conversion factor is exactly the kind of thing that varies by sensor and light spectrum. This is
the single number in this file I'm least confident in.

## 8. Fertigation (EC / pH) — confidence: MEDIUM

Same methodology as the tomato addendum, same source for direct comparability:

- Oklahoma State University Extension, Dunn & Singh (2017), "Electrical Conductivity and pH
  Guide for Hydroponics": cucumber **EC 1.7–2.0 mS/cm**, **pH 5.0–5.5** (hydroponic/soilless).
- Haifa Group cucumber grower guide (practitioner source): EC should stay **below 2 dS/m**
  (calcium-deficiency risk above that), pH 6.0–6.5 on mineral soils / 5.0–5.5 on organic soils —
  broadly consistent with the OSU figures on the soilless/organic side, but notably higher on
  mineral soil, which the guide attributes to soil's natural pH buffering.

Compared to tomato (EC 2.0–4.0 mS/cm, pH 5.5–6.5 per the same OSU source), cucumber wants a
**lower EC ceiling and a slightly more acidic pH** — this is a genuine, sourced crop difference,
not noise, and reinforces the original review's point that a single hardcoded fertigation profile
can't serve both crops. This block isn't in the current `thresholds.json` schema at all yet (see
gap 3 in the original review) — included here as forward-looking data for whenever that field
gets added.

## 9. Actuator rates and limits — unchanged from tomato, on purpose

`actuator_rates` (fan cooling rate, heater rate, mister rate, irrigation rate, CO2 injection
rate, grow-light rate) and `limits` (max minutes per actuator) describe the **physical hardware**
— fan CFM, heater wattage, drip emitter flow rate — not the crop. There's no agronomic literature
to cite here because these aren't biological parameters; they're the same as tomato's file unless
cucumber is grown in a differently-equipped greenhouse. The tomato file's own note that these are
"engineering estimates... calibrate in the Phase 3 field trial" applies identically here.

---

## Summary: confidence by section

| Section | Confidence | Why |
|---|---|---|
| Air temp — cold side (18°C) | **High** | 3 independent sources converge exactly |
| Soil temp | **High** | Single dedicated yield study with numeric results (Refaie et al. 2026) |
| CO2 | **Medium-high** | Authoritative industry source (AHDB), citation-backed |
| Air temp — hot side (35°C) | **Medium** | Interpolated from "tolerable but quality-reducing" ranges, not a failure-threshold study like tomato had |
| RH optimal band | **Medium** | Solid extension source for the 60–70% band; the 90% disease-risk figure is not cucumber-specific (source paywalled) |
| Fertigation (EC/pH) | **Medium** | Same reputable extension source as tomato, cross-checked against a second practitioner source |
| Light (DLI) | **Low** | Unit mismatch (mol/m²/day PAR vs. MJ/m²/day solar) forces an approximate, unverified conversion |
| Soil moisture | **Low** | No source uses the same capacitive 0–100 scale as `thresholds.json`; values are a reasoned adjustment, not a measurement |

## Sources

- [Owen, W.G. & Cockson, P.A. (2021), "Chilling Injury Symptomology of Greenhouse Cucumbers," e-GRO Alert 6(5), University of Kentucky](https://www.e-gro.org/pdf/E605.pdf)
- [Texas A&M AgriLife Extension — Greenhouse Cucumber Production](https://aggie-hort.tamu.edu/greenhouse/hydroponics/cucumber.html)
- [Alabama Cooperative Extension System — Greenhouse Cucumber Production](https://www.aces.edu/blog/topics/crop-production/greenhouse-cucumber-production/)
- [Haifa Group — Cucumber grower guide](https://www.haifa-group.com/files/Guides/Cucumber.pdf)
- [Zhou, Y. et al. (2016), "Unraveling Main Limiting Sites of Photosynthesis under Below- and Above-Ground Heat Stress in Cucumber and the Alleviatory Role of Luffa Rootstock," Frontiers in Plant Science 7:746](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2016.00746/full)
- [Refaie et al. (2026), "Smart control of soil temperature to optimize root-zone conditions for enhancing the physiological performance, growth, and productivity of greenhouse-grown cucumber," Scientific Reports](https://www.nature.com/articles/s41598-026-40825-8)
- [Song et al. (2022), "Regulating Vapor Pressure Deficit and Soil Moisture Improves Tomato and Cucumber Plant Growth and Water Productivity in the Greenhouse," Horticulturae 8(2):147](https://www.mdpi.com/2311-7524/8/2/147)
- [AHDB — CO2 best practice guide: Background](https://horticulture.ahdb.org.uk/knowledge-library/co2-best-practice-guide-background)
- [Heliospectra — Greenhouse Cucumbers: High Light Vegetable Series](https://heliospectra.com/blog/greenhouse-cucumbers-high-light-vegetable-series/)
- [Oklahoma State University Extension — Electrical Conductivity and pH Guide for Hydroponics (Dunn & Singh, 2017)](https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics)

**Not independently accessible during this research** (noted rather than silently omitted): a 2023
IOP Conference Series paper specifically on RH and cucumber downy mildew (Baghdad greenhouse
study) was blocked by the publisher's robots.txt; a PMC article on comprehensive disease
prediction in greenhouse cucumbers (low-temp/high-humidity diseases) returned a CAPTCHA wall on
fetch. Both looked directly relevant to tightening the RH `disease_risk` figure in section 4 — if
the team has literature access, those two are the first things I'd go back for.