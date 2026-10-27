# Crop Journey: shared datasets (mobile app and Tableau)

Official source files → `scripts/prepare_data.py` → validated CSVs in `data/prepared/` → mobile app **and** Tableau.
Both read the same files and use the same formulas; nothing is calculated twice with different rules.

## Refresh procedure

```bash
python -m venv .venv && .venv/Scripts/pip install -r scripts/requirements.txt   # once
npm run data:fetch      # downloads raw files to data/raw/ and records URL, size, SHA-256, time in SOURCES.json
npm run data:prepare    # writes data/prepared/*.csv, metadata.json, validation_report.md
npm run data:map        # optional: rebuilds the simplified state map
```

`data:fetch` never reports a failed download as success. If a file cannot be downloaded it says which file to
save by hand into `data/raw/`. In the app, **Data & Methods → Import** loads a replacement `crop_production.csv`
or `national_crop_balance.csv` for the current session after validating its columns, years, crops and duplicates.

## Sources

| Data | Source | Coverage | Retrieved via |
|---|---|---|---|
| Crop area, production, yield by district, season, crop | Directorate of Economics & Statistics, Ministry of Agriculture & Farmers Welfare (data.gov.in "District-wise, season-wise crop production statistics"; https://data.desagri.gov.in) | crop years 1997-98 to 2022-23 | India Data Portal mirror (ODC-By); the data.gov.in file URL `aps.dac.gov.in/APY/apy.csv` was unreachable |
| Cross-check only | UPAg district extract of the same DES data (https://upag.gov.in) | 2013-14 to 2024-25 | India Data Portal mirror; 99.6% of overlapping district-crop-years agree on area |
| National supply and utilization | FAOSTAT Food Balances (2010-), India (item codes 2807, 2511, 2514, 2911) | 2010 to 2023 | FAOSTAT bulk download (CC BY 4.0) |
| State boundaries | DataMeet India community, `States/Admin2` | n/a | GitHub (CC BY 4.0) |

The UPAg API requires authentication, so it was not used for ingestion. Retrieval dates are in `data/raw/SOURCES.json`.

## Prepared files (`data/prepared/`)

| File | Grain | Use |
|---|---|---|
| `crop_production.csv` | year × state × district × season × crop item | detail; the import format |
| `crop_production_district_year.csv` | year × district × crop | district tables |
| `crop_production_state_year.csv` | year × state × crop | map, rankings, trends |
| `crop_production_national_season_year.csv` | year × crop × season | national totals (sum over seasons) |
| `crop_year_coverage.csv` | year × crop | completeness of each crop-year |
| `national_crop_balance.csv` | year × crop × FAOSTAT element | long format, original units |
| `national_balance_flows.csv` | year × crop × flow | Sankey/utilization decomposition |
| `crop_mapping.csv` | source item → canonical crop | mapping, commodity form, comparability |
| `metadata.json`, `validation_report.md` | | checks, sources, row counts |

### `crop_production.csv`

| Column | Meaning |
|---|---|
| `year` | first calendar year of the July–June crop year (2022 = 2022-23) |
| `crop_year` | label, e.g. `2022-23` |
| `state`, `state_code`, `district`, `district_code` | present-day names and codes as in the source, state names normalised (see `data/reference/state_names.csv`) |
| `season` | Kharif, Rabi, Summer, Autumn, Winter or Whole Year. Source rows with season `Total` are removed because they duplicate the seasonal rows |
| `crop` | Rice, Wheat, Maize or Pulses |
| `crop_item` | source item (pulses = tur, gram, urad, moong, masoor, horse-gram, moth, peas & beans, cowpea and minor/other pulses) |
| `area_hectares` | hectares |
| `production_tonnes` | tonnes; **blank = unknown, never zero** |
| `yield_tonnes_per_hectare` | `production_tonnes / area_hectares` when both are known |
| `quality_flag` | `production_missing`, `zero_production_reported`, `yield_above_plausible_ceiling` (rice 10, wheat 8, maize 15, pulses 5 t/ha) or `yield_far_above_history` (> 5× the median yield of that item in that state). Flagged rows are kept in all totals |

### Aggregate files: shared formulas (identical in `prepare_data.py` and `src/data/aggregate.ts`)

| Column | Definition |
|---|---|
| `area_hectares` | `SUM(area_hectares)` over all records |
| `production_tonnes` | `SUM(production_tonnes)` over records where it is known; blank if none is known |
| `area_with_production_hectares` | `SUM(area_hectares)` over records with known production |
| `yield_tonnes_per_hectare` | `production_tonnes / area_with_production_hectares` |
| `production_flagged_tonnes` | production of records with a `yield_*` flag (included in `production_tonnes`) |
| `n_records`, `n_records_missing_production` | record counts |

**Tableau:** compute yield as `SUM([production_tonnes]) / SUM([area_with_production_hectares])`, never as an average of yields.
National totals are sums of district records and can differ from the all-India estimates DES publishes separately.

### `crop_year_coverage.csv`

A state is *absent* from a crop-year when it has no production there but reports production in every adjacent crop year (year−1, year+1). `absent_share_of_total` = mean adjacent-year production of absent states ÷ (that + the year's national production): how understated the total is, not an estimate of the missing values. A crop-year is `reference_quality` when `absent_share_of_total < 2%` and `flagged_production_share < 5%`. Long-run comparisons in the app use only reference-quality years as baselines (for example 1997-98 rice lacks Odisha, Chhattisgarh and Madhya Pradesh, about 13% of the total). Nothing is interpolated.

### `national_crop_balance.csv` (FAOSTAT)

Columns: `year` (calendar), `country`, `crop`, `crop_or_commodity`, `item_code`, `element`, `element_code`, `element_role`, `value`, `unit`, `commodity_basis`, `source`, `data_status` (E estimated, I imputed by a receiving agency, X external), `data_status_description`.
Quantities are `1000 t`; per-capita elements keep FAOSTAT units (kg/cap/yr, kcal/cap/d, g/cap/d).

Verified for all 56 crop-years: **domestic supply = production + imports − exports − stock variation** (positive stock variation = stocks built up) and **domestic supply = food + feed + seed + processing + losses + other uses + residuals** (within 1 thousand t).

### `national_balance_flows.csv`

Sankey decomposition. Sources: production, imports, stock drawdown (−stock variation when negative), negative residual. Destinations: exports, stock build-up (stock variation when positive), food, feed, seed, processing, losses, other uses, tourist consumption, residual (when positive). `share_of_total_supply` = value ÷ total sources. All 56 crop-years balance within 0.5% (`reconciled`).

## Definitions and limits

- **Crop year** runs July to June. FAOSTAT years are calendar years, so production and utilization are shown in separate views and never joined.
- **Rice:** FAOSTAT records rice in *paddy equivalent*; DES records rice as reported by states. Their tonnages are never plotted together. Shares within each FAOSTAT balance are comparable across crops.
- **Food supply** is the quantity available for human consumption, not what people eat.
- **Pulses** in DES are the sum of all pulse items; in FAOSTAT the aggregate group 2911.
- Districts change over time, so districts are listed in tables, not mapped; the source maps records to present-day states.
- State series with missing years are listed in `validation_report.md`; they appear as gaps.
- The analysis is descriptive and says nothing about causes, farm incomes or the destination of individual harvests.
