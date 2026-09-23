# Capsicum (Bell Pepper) Reference Data — third crop profile

Companion to `README_tomato.md` and `README_CUCUMBER.md`. Built the same way — same JSON schema,
same field names — so `config/thresholds_capsicum.json` drops in without changing
`greennode_rules.py`.

**Crop:** Capsicum / sweet (bell) pepper (*Capsicum annuum*), greenhouse. Chosen as the third
profile because it's the third leg of the classic protected-cultivation trio grown alongside
tomato and cucumber (all three appear together constantly in the greenhouse literature and in
commercial mixed-crop houses), and because — as the numbers below show — it needs a genuinely
different EC/pH and humidity profile from either of the first two, which is a good stress-test of
whether the per-crop config design actually holds up for a third, more different crop.

Every number has a source and a confidence note, same rules as the cucumber doc: where sources
disagree, both are shown rather than silently picking one; where nothing research-backed was
found, that's stated rather than guessed.

## 1. Air temperature — confidence: HIGH (stage bands), MEDIUM (single-figure triggers)

Primary source: Carey & Deuter, *"Capsicum Critical Temperature Thresholds,"* DAF Queensland /
PLD Horticulture (DCAP research report).
([PDF](https://data.longpaddock.qld.gov.au/static/dcap/DCAP3/DCAP%203__3%20Capsicum%20CTT%20Final.pdf))
— this is a government research-station document specifically built around defining critical
temperature thresholds per growth stage, stronger sourcing than a single blended figure:

| Stage | Optimal | Critical band |
|---|---|---|
| Vegetative (juvenile) | 20–25°C | >10°C & <31°C |
| Flowering & pollination | Night min 17–21°C; day max 28°C | >15°C & <28°C |
| Fruit development/ripening | >10°C & <30°C | >10°C & <31°C |
| Germination | optimal 25–27°C | >15°C & <30°C |

Heat stress: **"Temperatures >32°C are known to reduce pollen germination, pollen tube growth and
fruit set in peppers"** — the same source used an operational threshold of 33°C sustained for 3
consecutive days to simulate cumulative heat damage. Cold: **"capsicums grow very poorly at
temperatures below 13°C"** and are frost-sensitive at any stage.

Corroborating source: Government of Alberta, "Production of Sweet Bell Peppers"
([alberta.ca](https://www.alberta.ca/production-of-sweet-bell-peppers)) — a provincial
agriculture-extension guide: after establishment, day 21°C / night 16–17°C, targeting a
24-hour average of 20–21°C for both vegetative growth and yield.

**What I set and why:** `opt_min`–`opt_max` = 20–25°C matches the vegetative-stage optimal band
(and sits close to Alberta's 21°C day-average target). `heat_trigger` = 15°C sits between the
flowering stage's 17°C night-minimum and the "poorly below 13°C" line — a reasoned middle point,
not a single-source number. `critical_high` = 32°C is directly the DAF source's pollen/fruit-set
failure threshold — this is the strongest-sourced `critical_high` of the three crop profiles,
comparable to tomato's Adams et al. figure.

## 2. Soil (root-zone) temperature — confidence: MEDIUM

Source: Government of Alberta guide (same as above). Target range **19–22°C**, maintained at
**20°C** through the season. Two explicit warnings: **above 23°C causes interveinal chlorosis on
young leaves**, and **around 15°C pushes the plant toward vegetative growth and increases flower
abortion** — i.e. pepper's root zone has both a low-end and (unusually, compared to tomato/
cucumber) a meaningful high-end concern, though the current schema (`heat_trigger`/`heat_target`
only, no cooling side) can't represent the chlorosis ceiling — flagging this as a schema gap
worth raising, not something I can encode with the existing fields.

## 3. Relative humidity — confidence: MEDIUM

Source: Government of Alberta guide — target **70–80%** during establishment. No dedicated
disease-risk ceiling found specifically for capsicum (same limitation as the cucumber file); the
90% `disease_risk` figure is carried over from general cross-crop fungal/oomycete convergence,
not a capsicum-specific number.

This 70–80% band sits between tomato's (70–90%) and cucumber's (60–75%) — plausible given
capsicum's disease profile is generally intermediate between the two in the literature, though I
did not find a study directly comparing all three crops' humidity tolerance to confirm that
ordering.

## 4. Soil moisture / irrigation — confidence: LOW (flagged explicitly)

Source: Gramillo-Avila et al. (2024), *"Physiological and Productivity Responses in Two Chili
Pepper Morphotypes (Capsicum annuum L.) under Different Soil Moisture Contents,"* Horticulturae
10(1):92. Tested 25%±2 soil moisture (≈100% field capacity, optimal) against 20%±2 (≈81.5% field
capacity, stress) — the lower level cut yield **24.1% (jalapeño) to 52.3% (chilaca)** depending on
cultivar.

**Same measurement-scale problem as cucumber:** this is weight-based soil moisture %, not the
calibrated capacitive 0–100 scale `thresholds.json` uses. The finding that ~81.5% of field
capacity already caused a serious yield hit is a genuinely useful signal though — it argues for
a *higher* `low_trigger` than tomato's, since capsicum apparently tolerates less drawdown before
yield suffers. I set `low_trigger` = 60 (vs. tomato's 50, cucumber's 55) on that basis — a
reasoned adjustment, not a directly transferable figure.

## 5. CO2 — confidence: MEDIUM

Source: Government of Alberta guide — **maintain 800–1,000 ppm** during establishment. I set
`enrich_target` = 900 ppm (midpoint), between tomato's 800 and cucumber's 1000. No dedicated
capsicum safety-ceiling source found; kept 1500 ppm (general worker-safety limit, not crop-derived
for any of the three profiles).

## 6. Light (DLI) — confidence: LOW, same unit-conversion caveat as cucumber

Source: Adame-Adame et al. (2025), *"Daily Light Integral and Nutrient Solution Electrical
Conductivity for Tomato and Bell Pepper Seedling Production in an Indoor Vertical Farm with
Artificial Lighting,"* Horticulturae 11(5):454 — tested bell pepper seedlings at **23.7, 31.7, and
39.6 mol/m²/day PAR**; the highest (39.6) produced the most biomass, "surpassing greenhouse-grown
seedlings by 333%." Their own greenhouse control (natural light) measured **~22.6 mol/m²/day**.

Same mol/m²/day (PAR) vs. MJ/m²/day (total solar) mismatch as the cucumber file. Using the same
approximate ~2.1–2.3 mol/MJ conversion, the greenhouse-control figure (22.6 mol/m²/day) converts
to roughly **10 MJ/m²/day**, which is what I used for `dli_min_mj` — deliberately the more
conservative "matches ordinary greenhouse light," not the seedling-optimal 39.6 mol figure, since
that study's high end was achieved with supplemental LED, not something CropFit's model should
assume as a baseline trigger. **Low confidence, same as cucumber's DLI figure, for the same
unit-conversion reason.**

## 7. Fertigation (EC / pH) — confidence: MEDIUM, with a genuine source conflict

Two sources disagree, and I'm showing both rather than picking one:

- **Oklahoma State University Extension**, Dunn & Singh (2017) — same source used for tomato and
  cucumber: pepper **EC 0.8–1.8 mS/cm**, **pH 5.5–6.0**. Notably the *lowest* EC ceiling of the
  three crops.
- **Adame-Adame et al. (2025)**, the same peer-reviewed seedling study cited for DLI above —
  tested EC 1.6 / 2.0 / 2.4 dS/m for bell pepper and found **2.4 dS/m (the highest tested) gave
  the optimal outcome combined with high DLI**, i.e. bell pepper "tolerating higher nutrient
  concentrations than tomato" in their words — the opposite conclusion from the OSU figure's
  implication that pepper needs the *lowest* EC of the three crops.

**I did not resolve this conflict** — it may come down to seedling-stage vs. mature-plant EC
tolerance (Adame-Adame studied seedlings specifically), or simple inter-source disagreement, which
is common in agronomy. I used the OSU figures (0.8–1.8, 5.5–6.0) in the JSON for consistency with
how tomato and cucumber's fertigation numbers were sourced (same extension guide, comparable
methodology across all three crops), but flagging clearly: **if the team validates this in the
field, checking whether capsicum actually tolerates a higher EC than the OSU figure suggests
should be an early test**, given a peer-reviewed source says the opposite of the extension
guide's ordering.

## 8. Wind — not researched further

Same conclusion as the cucumber file: the tomato config's own "external wind >2 m/s → reduce
vent" figure was already flagged as unverified/likely a placeholder in the original review, and
that's a hardware/structural question, not a crop-specific one — nothing new to add per crop here.

---

## Summary: confidence by section

| Section | Confidence | Why |
|---|---|---|
| Air temp — critical_high (32°C) | **High** | Direct figure from a dedicated government temperature-threshold study, comparable strength to tomato's fruit-set-failure source |
| Air temp — stage bands | **High** | Same DAF source, per-stage breakdown |
| CO2 | **Medium** | Single extension source (Alberta), no independent corroboration |
| Soil temp | **Medium** | Single extension source; the chlorosis high-end warning doesn't fit the current schema at all |
| RH | **Medium** | Optimal band sourced (Alberta); disease-risk ceiling not crop-specific |
| Fertigation EC/pH | **Medium, flagged conflict** | Two real sources disagree on EC direction — see section 7 |
| Soil moisture | **Low** | Scale mismatch with source study, same limitation as cucumber |
| Light (DLI) | **Low** | Same PAR-to-solar unit conversion issue as cucumber |

## Sources

- [Carey & Deuter — Capsicum Critical Temperature Thresholds, DAF Queensland / PLD Horticulture (DCAP)](https://data.longpaddock.qld.gov.au/static/dcap/DCAP3/DCAP%203__3%20Capsicum%20CTT%20Final.pdf)
- [Government of Alberta — Production of Sweet Bell Peppers](https://www.alberta.ca/production-of-sweet-bell-peppers)
- [Oklahoma State University Extension — Electrical Conductivity and pH Guide for Hydroponics (Dunn & Singh, 2017)](https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics)
- [Adame-Adame et al. (2025), "Daily Light Integral and Nutrient Solution Electrical Conductivity for Tomato and Bell Pepper Seedling Production in an Indoor Vertical Farm with Artificial Lighting," Horticulturae 11(5):454](https://www.mdpi.com/2311-7524/11/5/454)
- [Gramillo-Avila et al. (2024), "Physiological and Productivity Responses in Two Chili Pepper Morphotypes (Capsicum annuum L.) under Different Soil Moisture Contents," Horticulturae 10(1):92](https://www.mdpi.com/2311-7524/10/1/92)
