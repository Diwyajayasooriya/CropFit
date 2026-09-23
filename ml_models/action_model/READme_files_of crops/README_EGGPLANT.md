# Eggplant / Brinjal Reference Data — fourth crop profile

Companion to `README_tomato.md`, `README_CUCUMBER.md`, `README_CAPSICUM.md`. Same JSON schema,
so `config/thresholds_eggplant.json` drops in without changing `greennode_rules.py`.

**Crop:** Eggplant / brinjal (*Solanum melongena*), greenhouse. Chosen as the fourth profile
because it's a very commonly greenhouse-grown crop in Sri Lanka specifically (relevant to
CropFit's likely deployment context) and — like capsicum — is Solanaceae, so it's a useful check
on whether "same family as tomato" actually means "similar thresholds" (short answer, per the
numbers below: not entirely — eggplant's fertigation EC in particular is the highest of all four
crops profiled so far).

This is the **least well-sourced** of the four crop files. I'm stating that plainly rather than
presenting it with the same confidence as tomato or capsicum: several sections (relative
humidity, CO2, light) have no dedicated eggplant research behind them at all, only reasoned
carry-overs from the other crops or general Solanaceae assumptions. Sections below are marked
accordingly.

## 1. Air temperature — confidence: MEDIUM

Two extension-type sources, not fully consistent with each other (different growth stages):

- **Oregon State University Extension**, eggplant production guide
  ([horticulture.oregonstate.edu](https://horticulture.oregonstate.edu/oregon-vegetables/eggplant-0)) —
  for **transplant production**: days 70–81°F (21–27°C), nights 64–70°F (18–21°C). Soil
  temperature: minimum 60°F (15.6°C) for planting, germination optimal 75–90°F (24–32°C).
- **Master Gardener Association of San Diego County** eggplant guide
  ([mastergardenersd.org](https://www.mastergardenersd.org/wp-content/uploads/2017/05/eggplant.pdf)) —
  for the **mature/fruiting plant**: optimal day 80–90°F (27–32°C), night minimum 60°F (15.6°C)
  — "growth of young plants will be retarded by night temperatures below 60 degrees," and cool
  temperatures on flowering plants can "affect pollen viability and failure of fruit set." Frost
  intolerant.

Both sources independently land on **60°F (15.6°C)** as the point below which growth/fertility
suffers — reasonable agreement despite being for different growth stages. I set `heat_trigger` =
16°C on that convergence.

**`critical_high` = 35°C is NOT independently confirmed** — I could not find a dedicated eggplant
heat-stress/pollen-failure study with a hard number (the Cambridge Core paper on low-temperature
fertility loss in eggplant, Nothmann & Koller 1975, *Experimental Agriculture* 11(1):33-38, was
paywalled and only its abstract was accessible, which doesn't state the exact temperature). 35°C
is a reasoned estimate — eggplant is generally described in horticultural literature as somewhat
more heat-tolerant than tomato/capsicum (both ~32°C), but I do not have a source that states this
as a number, only as a qualitative claim. **Treat 35°C as the weakest-sourced `critical_high` of
the four crop profiles.**

## 2. Soil (root-zone) temperature — confidence: LOW

No dedicated root-zone study found (unlike cucumber's Refaie et al. 2026). Set `heat_trigger` =
16°C / `heat_target` = 20°C by analogy to the air-temperature figures above, not from a soil-
specific source. Flagging this as a gap worth closing with a real study if the team has time,
the same way cucumber's soil-temp section was strongly sourced and this one isn't.

## 3. Relative humidity — confidence: LOW, no dedicated source found

I searched specifically for a growing-stage RH optimal range for eggplant and did not find one
from a research or extension source — only informal gardening-blog claims about humidity and
flower drop, which I'm not treating as reliable enough to cite as fact. The only humidity figure
that turned up in reputable sources was **90–95% for postharvest storage** (Oregon State,
UC Davis) — a completely different context (cut fruit in cold storage, not a living plant in a
greenhouse) and not usable here.

**What I did:** set the RH band (65–85% optimal) as a reasoned carry-over from tomato's band,
on the basis that eggplant is the same family and no contrary evidence turned up — but this is
explicitly a placeholder, not a sourced figure. **This is the section of the eggplant file most
in need of a real literature search or field validation before trusting it.**

## 4. Soil moisture / irrigation — confidence: MEDIUM (best-sourced section in this file)

Source: Karam et al. (2011), *"Yield and water use of eggplants (Solanum melongena L.) under full
and deficit irrigation regimes,"* Agricultural Water Management 98(8):1307–1316 — a real, cited
field-trial paper (not a review). Tested irrigation at 100% (control), 80%, 60%, and 40% of field
capacity: fresh fruit yield dropped **12% at 80% FC, 39% at 60% FC, and 60% at 40% FC** relative
to full irrigation (33.7 t/ha control).

The striking part: **even 80% of field capacity — a fairly mild deficit — already cost 12% of
yield.** That's a stronger, more immediate sensitivity to water stress than either cucumber's or
capsicum's sourced studies showed at a comparable deficit level. Same scale-mismatch caveat as
the other crop files (field-capacity % by weight, not the calibrated capacitive 0–100 scale), but
the direction of the adjustment is well-supported: I set `low_trigger` = 65 and `target` = 85,
both higher than any other crop profiled so far, specifically because this source shows yield
loss starts earlier (at a smaller deficit) for eggplant than the deficit-irrigation literature
showed for cucumber or capsicum.

## 5. CO2 — confidence: LOW-MEDIUM, unsourced for eggplant specifically

No eggplant-specific CO2 enrichment study found in this search. `enrich_target` = 850 ppm is a
simple midpoint between tomato's 800 and cucumber's 1000 — not derived from an eggplant source,
just a reasonable placeholder pending real data.

## 6. Light (DLI) — confidence: LOW, and not directly comparable to the other three crops' figures

Source: Terlizzese et al. (2025), *"Growth and yield of greenhouse eggplant under extended
photoperiods using light emitting diodes,"* Frontiers in Plant Science 16:1737061 — tested
**supplemental** DLI of 8.64 mol/m²/day (on top of natural greenhouse light, not a total daily
figure) across three photoperiod strategies (16h/20h/24h lighting); all three increased yield
124–135% over the unlit control, with no significant difference between them.

**Important distinction from the cucumber/capsicum DLI figures:** those were *total* DLI targets;
this eggplant figure is *supplemental* DLI added to whatever natural light the greenhouse already
gets — not directly comparable, and I did not find a total-DLI target for eggplant to convert the
same way. I kept `dli_min_mj` = 8.5 (tomato's figure) as a placeholder rather than derive a wrong
number from a mismatched study. **This is a genuine research gap, not just a unit-conversion
problem like cucumber/capsicum's DLI sections.**

## 7. Fertigation (EC / pH) — confidence: MEDIUM — the standout number in this file

Source: Oklahoma State University Extension, Dunn & Singh (2017) — same source used for all four
crops: eggplant **EC 2.5–3.5 mS/cm**, **pH ≈ 6.0** (the table gives a single point value rather
than a range for pH here, unlike the other three crops).

**This is the highest EC ceiling of any of the four crops profiled** — higher than tomato's
2.0–4.0 upper-range overlap, clearly higher than cucumber's 1.7–2.0 and capsicum's 0.8–1.8 (or
even capsicum's disputed 2.4 upper figure). If nothing else in this file, this number is worth
trusting: it comes from the same consistent source used across all crops, so the relative
ordering between crops (eggplant needs the richest nutrient solution, capsicum/cucumber the
leanest) is probably the most reliable single fact in this whole document, even though the
absolute numbers all carry the usual "verify against your specific cultivar and setup" caveat.

---

## Summary: confidence by section

| Section | Confidence | Why |
|---|---|---|
| Fertigation EC/pH | **Medium** | Same consistent OSU source as all four crops; relative ordering (highest EC) likely reliable |
| Soil moisture | **Medium** | Real field-trial paper (Karam et al. 2011), same scale-mismatch caveat as other crops |
| Air temp — cold side (16°C) | **Medium** | Two sources converge on 60°F/15.6°C, though for different growth stages |
| Air temp — critical_high (35°C) | **Low** | No hard eggplant-specific number found; qualitative "more heat-tolerant than tomato" claim only |
| Soil temp | **Low** | No dedicated study; set by analogy to air temp |
| CO2 | **Low-medium** | Unsourced for eggplant; generic midpoint |
| Light (DLI) | **Low** | Source measures supplemental, not total, DLI — not directly usable |
| Relative humidity | **Low** | No research or extension source found at all; pure carry-over placeholder |

**Bottom line for the team:** if effort is limited, prioritize sourcing real RH and DLI figures
for eggplant before trusting this file in the field — those two sections currently have nothing
real behind them, unlike the equivalent sections in the tomato, cucumber, and capsicum files.

## Sources

- [Oregon State University Extension — Eggplant](https://horticulture.oregonstate.edu/oregon-vegetables/eggplant-0)
- [Master Gardener Association of San Diego County — Eggplant](https://www.mastergardenersd.org/wp-content/uploads/2017/05/eggplant.pdf)
- [Oklahoma State University Extension — Electrical Conductivity and pH Guide for Hydroponics (Dunn & Singh, 2017)](https://extension.okstate.edu/fact-sheets/electrical-conductivity-and-ph-guide-for-hydroponics)
- [Karam, F., Saliba, R., Skaf, S., Breidy, J., Rouphael, Y., & Balendonck, J. (2011), "Yield and water use of eggplants (Solanum melongena L.) under full and deficit irrigation regimes," Agricultural Water Management 98(8):1307-1316](https://www.sciencedirect.com/science/article/abs/pii/S0378377411000655)
- [Terlizzese, D., Lanoue, J., Little, C., St. Louis, S., Zheng, Y., & Hao, X. (2025), "Growth and yield of greenhouse eggplant under extended photoperiods using light emitting diodes," Frontiers in Plant Science 16:1737061](https://www.frontiersin.org/journals/plant-science/articles/10.3389/fpls.2025.1737061/full)
- [UC Davis Postharvest Research & Extension Center — Eggplant](https://postharvest.ucdavis.edu/produce-facts-sheets/eggplant) (postharvest chilling injury only, not used for growing-stage thresholds)

**Not independently accessible during this research:** Nothmann & Koller (1975), *"Effects of
Low-Temperature Stress on Fertility and Fruiting of Eggplant (Solanum melongena) in a Subtropical
Climate,"* Experimental Agriculture 11(1):33-38 — paywalled at Cambridge Core, only the abstract
(confirming low temperature reduces pollen fertility, no exact number) was readable. This is the
single most useful paper to chase down for real access if the team wants to firm up the cold-side
`critical`/`heat_trigger` figures with an eggplant-specific number instead of the cross-source
60°F convergence used here.
