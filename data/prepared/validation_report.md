# Validation report

Generated: 2026-10-26T14:15:39+00:00

## Checks

| Status | Check | Detail |
|---|---|---|
| PASS | Area in hectares and production in tonnes throughout | units found: {'area': ['Hectare'], 'production': ['Tonnes']} |
| PASS | Every DES pulse item is mapped to Pulses | unmapped pulse items: none |
| PASS | 'Total' season rows removed to avoid double counting | 27,025 aggregate rows dropped; 46 of them differ from the seasonal sum by more than 0.5% of area (seasonal rows are kept as the reported detail); 0 'Total'-only records kept |
| PASS | Area is positive and production is non-negative | 0 rows with missing/non-positive area, 0 rows with negative production (set to unknown) |
| PASS | Yield recomputed as production / area matches the source yield | 0 rows differ from the source yield column by more than 1% |
| PASS | Missing production kept as unknown (not zero) | 1,746 rows have unknown production; their area is excluded from yield denominators |
| PASS | Implausible yields flagged for review | 549 rows above crop ceilings {'Rice': 10.0, 'Wheat': 8.0, 'Maize': 15.0, 'Pulses': 5.0} t/ha or over 5x the state-crop median yield (kept, flagged) |
| PASS | No duplicate district-season-crop records | 0 duplicate keys |
| PASS | Continuous year coverage | 1997-98 to 2022-23; missing: none |
| WARN | State series without internal gaps | 33 crop-state series have missing years inside their span (not interpolated) |
| PASS | DES records agree with the UPAg district extract | 17,745 overlapping district-crop-years (2013-14 to 2022-23); 99.6% agree on area within 0.5% (UPAg seasons are relabelled, so seasons are summed before comparing) |
| PASS | Completeness of each crop-year assessed | 100 of 104 crop-years are reference quality (< 2% of production from absent states and < 5% from flagged records); the rest are shown with a notice and are not used as comparison baselines |
| PASS | All FAOSTAT elements are recognised | unrecognised: none |
| PASS | No duplicate FAOSTAT crop-year-element rows | 0 duplicates |
| PASS | FAOSTAT values are numeric | 0 non-numeric values |
| PASS | Domestic supply = production + imports - exports - stock variation | holds for 100% of crop-years (alternative sign convention: 0%); a positive stock variation therefore means stocks were built up |
| PASS | Domestic supply = sum of uses (food, feed, seed, processing, losses, other, residuals) | holds for 100% of crop-years; max gap 1 thousand t |
| PASS | Every crop-year flow diagram balances (sources = destinations) | 56 of 56 crop-years reconcile within 0.5%; unreconciled years fall back to a bar chart |

## Datasets

| File | Rows |
|---|---|
| crop_production.csv | 161,148 |
| crop_production_district_year.csv | 57,822 |
| crop_production_state_year.csv | 3,070 |
| crop_production_national_season_year.csv | 512 |
| crop_year_coverage.csv | 104 |
| national_crop_balance.csv | 1,012 |
| national_balance_flows.csv | 518 |

## State series with missing years (not interpolated)

| Crop | State | First | Last | Years missing |
|---|---|---|---|---|
| Maize | Assam | 1997-98 | 2022-23 | 1 |
| Maize | Chandigarh | 1998-99 | 2022-23 | 3 |
| Maize | Dadra and Nagar Haveli and Daman and Diu | 1998-99 | 2019-20 | 4 |
| Maize | Jammu and Kashmir | 1997-98 | 2019-20 | 2 |
| Maize | Jharkhand | 1997-98 | 2022-23 | 3 |
| Maize | Tamil Nadu | 1997-98 | 2022-23 | 1 |
| Pulses | Andaman and Nicobar Islands | 2000-01 | 2022-23 | 8 |
| Pulses | Dadra and Nagar Haveli and Daman and Diu | 1998-99 | 2019-20 | 2 |
| Pulses | Goa | 1997-98 | 2022-23 | 10 |
| Pulses | Himachal Pradesh | 1998-99 | 2022-23 | 2 |
| Pulses | Jharkhand | 1997-98 | 2022-23 | 3 |
| Pulses | Ladakh | 1999-00 | 2022-23 | 3 |
| Pulses | Manipur | 1997-98 | 2022-23 | 2 |
| Pulses | Mizoram | 1997-98 | 2022-23 | 1 |
| Pulses | Puducherry | 1999-00 | 2022-23 | 1 |
| Pulses | Tripura | 1998-99 | 2022-23 | 4 |
| Rice | Andaman and Nicobar Islands | 2000-01 | 2022-23 | 5 |
| Rice | Dadra and Nagar Haveli and Daman and Diu | 1998-99 | 2022-23 | 1 |
| Rice | Goa | 1997-98 | 2022-23 | 6 |
| Rice | Jammu and Kashmir | 1997-98 | 2020-21 | 2 |
| Rice | Jharkhand | 1997-98 | 2022-23 | 3 |
| Wheat | Andhra Pradesh | 1997-98 | 2022-23 | 2 |
| Wheat | Chhattisgarh | 1997-98 | 2022-23 | 1 |
| Wheat | Dadra and Nagar Haveli and Daman and Diu | 1998-99 | 2019-20 | 1 |
| Wheat | Jammu and Kashmir | 1997-98 | 2022-23 | 2 |
| Wheat | Jharkhand | 1997-98 | 2022-23 | 3 |
| Wheat | Kerala | 2012-13 | 2021-22 | 1 |
| Wheat | Ladakh | 1997-98 | 2022-23 | 4 |
| Wheat | Manipur | 2008-09 | 2022-23 | 2 |
| Wheat | Meghalaya | 1997-98 | 2022-23 | 2 |
| Wheat | Mizoram | 1997-98 | 2004-05 | 4 |
| Wheat | Nagaland | 1998-99 | 2022-23 | 1 |
| Wheat | Tamil Nadu | 1998-99 | 2016-17 | 11 |

## Sources

- **Crop-wise Area, Production & Yield (district-wise, 1997-98 to 2022-23)** (Directorate of Economics & Statistics (DES), Ministry of Agriculture & Farmers Welfare). Retrieved 2026-10-26T13:11:44+00:00 from https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/f980409d-49a2-42ae-9eb0-182365005c04/download/crop-wise-area-production-yield.csv. Origin: https://www.data.gov.in/resource/district-wise-season-wise-crop-production-statistics-1997. India Data Portal (ISB) mirror, licence ODC-By; the data.gov.in resource points to aps.dac.gov.in/APY/apy.csv, which was unreachable at retrieval time
- **Crop-wise Area, Production & Yield (UPAg district extract, 2013-14 to 2024-25)** (DES district data published via UPAg, Ministry of Agriculture & Farmers Welfare). Retrieved 2026-10-26T13:11:47+00:00 from https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/6f70d961-3a4f-4caa-b08f-f72f708791e1/download/cropwise-area-production-yield-upag.csv. Origin: https://upag.gov.in/dash-reports/desdistrictwisecompletedatasetreport. India Data Portal (ISB) mirror, licence ODC-By. Used only as a cross-check
- **FAOSTAT Food Balances (2010-)** (Food and Agriculture Organization of the United Nations (FAO)). Retrieved 2026-10-26T13:12:00+00:00 from https://bulks-faostat.fao.org/production/FoodBalanceSheets_E_All_Data_(Normalized).zip. Origin: https://data.fao.org/catalog/dataset/e463c4cc-0ed1-4ef8-80c5-2add3a0b75ca. FAOSTAT bulk download (CC BY 4.0)
- **India state boundaries (Admin2)** (DataMeet India community). Retrieved 2026-10-26T13:17:06+00:00 from https://raw.githubusercontent.com/datameet/maps/master/States/Admin2.shp. Origin: https://github.com/datameet/maps/tree/master/States. GitHub, licence CC BY 4.0
