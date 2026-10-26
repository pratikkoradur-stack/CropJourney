"""Prepare the shared Crop Journey datasets (mobile app + Tableau).

Reads the raw files listed in data/raw/SOURCES.json and the hand-maintained
lookups in data/reference/, and writes flat, validated CSVs to data/prepared/.

    python scripts/prepare_data.py

Every derived metric is defined here once and documented in data/README.md.
The app reads these outputs directly; when a user imports a replacement CSV in
the app, src/data/aggregate.ts and src/data/balance.ts apply the same rules.
"""

from __future__ import annotations

import datetime as dt
import json
import shutil
import sys
import zipfile
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
REF = ROOT / "data" / "reference"
OUT = ROOT / "data" / "prepared"

CROPS = ["Rice", "Wheat", "Maize", "Pulses"]
# Plausibility ceilings (t/ha) used only to flag records for review; flagged
# records are kept and included in totals because they are the reported values.
YIELD_FLAG_CEILING = {"Rice": 10.0, "Wheat": 8.0, "Maize": 15.0, "Pulses": 5.0}
HISTORY_FLAG_RATIO = 5.0
FAO_INDIA_AREA_CODE = 100
# A crop-year is "reference quality" when states absent from it carry < 2% of production and
# flagged records carry < 5% of production. Used as the baseline for long-run comparisons.
COVERAGE_MAX_ABSENT = 0.02
COVERAGE_MAX_FLAGGED = 0.05

FBS_ROLES = {
    "Production": "supply",
    "Import quantity": "supply",
    "Export quantity": "trade_out",
    "Stock Variation": "stock",
    "Domestic supply quantity": "total",
    "Food": "utilization",
    "Feed": "utilization",
    "Seed": "utilization",
    "Losses": "utilization",
    "Processing": "utilization",
    "Other uses (non-food)": "utilization",
    "Tourist consumption": "utilization",
    "Residuals": "utilization",
    "Food supply quantity (kg/capita/yr)": "per_capita",
    "Food supply (kcal/capita/day)": "per_capita",
    "Protein supply quantity (g/capita/day)": "per_capita",
    "Fat supply quantity (g/capita/day)": "per_capita",
    "Food supply (kcal)": "nutrient_total",
    "Protein supply quantity (t)": "nutrient_total",
    "Fat supply quantity (t)": "nutrient_total",
}
USE_ELEMENTS = ["Food", "Feed", "Seed", "Processing", "Losses", "Other uses (non-food)", "Tourist consumption", "Residuals"]
FLOW_LABEL = {"Other uses (non-food)": "Other uses (non-food)", "Residuals": "Residual"}

checks: list[dict] = []


def check(cid: str, label: str, ok: bool, detail: str, warn_only: bool = False) -> None:
    checks.append({"id": cid, "label": label, "status": "pass" if ok else ("warn" if warn_only else "fail"), "detail": detail})


def crop_year_label(start: int) -> str:
    return f"{start}-{str(start + 1)[-2:]}"


def write_csv(df: pd.DataFrame, name: str) -> Path:
    path = OUT / name
    df.to_csv(path, index=False, float_format="%.10g", lineterminator="\n")
    return path


# --------------------------------------------------------------------------- #
# A. Crop production (DES district-wise APY)
# --------------------------------------------------------------------------- #
def prepare_production(mapping: pd.DataFrame, states: dict[str, str]) -> tuple[pd.DataFrame, dict]:
    src = RAW / "des_apy_district_1997_2023.csv"
    wanted = ["year", "state_name", "state_code", "district_name", "district_code", "crop_name", "crop_type",
              "season", "area", "area_unit", "production", "production_unit", "yield"]
    m = mapping[mapping.source == "DES_APY"][["source_item_name", "crop", "crop_item"]]
    names = set(m.source_item_name)

    # The file has ~455k rows covering every crop; read it in chunks and keep only the crops in
    # scope (plus any pulse row, so unmapped pulse items can be reported) to bound memory use.
    header = [c.strip().lower().replace(" ", "_") for c in pd.read_csv(src, nrows=0).columns]
    missing_cols = set(wanted) - set(header)
    if missing_cols:
        raise SystemExit(f"DES file is missing columns: {sorted(missing_cols)}")
    kept, source_rows = [], 0
    area_units: set[str] = set()
    production_units: set[str] = set()
    pulse_names: set[str] = set()
    for chunk in pd.read_csv(src, usecols=lambda c: c.strip().lower().replace(" ", "_") in wanted,
                             dtype={"state_code": "Int64", "district_code": "Int64"}, chunksize=100_000):
        chunk.columns = [c.strip().lower().replace(" ", "_") for c in chunk.columns]
        for col in ["state_name", "district_name", "crop_name", "crop_type", "season", "year"]:
            chunk[col] = chunk[col].astype("string").str.strip().str.replace(r"\s+", " ", regex=True)
        source_rows += len(chunk)
        area_units |= set(chunk["area_unit"].dropna().unique())
        production_units |= set(chunk["production_unit"].dropna().unique())
        pulse_names |= set(chunk.loc[chunk.crop_type == "Pulses", "crop_name"])
        kept.append(chunk[chunk.crop_name.isin(names)])
    raw = pd.concat(kept, ignore_index=True)
    report: dict = {"source_rows": int(source_rows)}

    units = {"area": sorted(area_units), "production": sorted(production_units)}
    check("units", "Area in hectares and production in tonnes throughout",
          units == {"area": ["Hectare"], "production": ["Tonnes"]}, f"units found: {units}")

    df = raw.merge(m, left_on="crop_name", right_on="source_item_name", how="inner")
    unmapped_pulses = sorted(pulse_names - names)
    check("pulse_mapping", "Every DES pulse item is mapped to Pulses", not unmapped_pulses,
          f"unmapped pulse items: {unmapped_pulses or 'none'}")
    report["rows_in_scope"] = int(len(df))

    # Season 'Total' rows are aggregates of the seasonal rows. Verify, then drop them.
    key = ["year", "state_name", "district_code", "crop_item"]
    is_total = df.season.eq("Total")
    seasonal = df[~is_total].groupby(key, dropna=False)[["area", "production"]].sum(min_count=1)
    totals = df[is_total].set_index(key)[["area", "production"]]
    joined = totals.merge(seasonal, left_index=True, right_index=True, suffixes=("", "_seasonal"))
    rel = (joined["area"] - joined["area_seasonal"]).abs() / joined["area"].where(joined["area"] > 0)
    mismatch = int((rel > 0.005).sum())
    # A 'Total' row with no seasonal rows is the only record for that crop-district-year: keep it.
    idx = pd.MultiIndex.from_frame(df[key])
    only_total = is_total & ~idx.isin(idx[~is_total])
    df.loc[only_total, "season"] = "Total (no seasonal split)"
    df = df[~(is_total & ~only_total)]
    report["season_total_rows_dropped"] = int((is_total & ~only_total).sum())
    report["season_total_only_rows_kept"] = int(only_total.sum())
    report["season_total_area_mismatch"] = mismatch
    check("season_total", "'Total' season rows removed to avoid double counting", True,
          f"{report['season_total_rows_dropped']:,} aggregate rows dropped; {mismatch:,} of them differ from the seasonal sum "
          f"by more than 0.5% of area (seasonal rows are kept as the reported detail); "
          f"{report['season_total_only_rows_kept']} 'Total'-only records kept")

    df["state"] = df["state_name"].map(lambda s: states.get(s, s))
    df["year_start"] = df["year"].str.slice(0, 4).astype(int)
    df["crop_year"] = df["year_start"].map(crop_year_label)

    df["area_hectares"] = pd.to_numeric(df["area"], errors="coerce")
    df["production_tonnes"] = pd.to_numeric(df["production"], errors="coerce")
    bad_area = int((df.area_hectares.isna() | (df.area_hectares <= 0)).sum())
    neg_prod = int((df.production_tonnes < 0).sum())
    df.loc[df.area_hectares <= 0, "area_hectares"] = np.nan
    df.loc[df.production_tonnes < 0, "production_tonnes"] = np.nan
    check("numeric_ranges", "Area is positive and production is non-negative", bad_area == 0 and neg_prod == 0,
          f"{bad_area} rows with missing/non-positive area, {neg_prod} rows with negative production (set to unknown)")

    has_both = df.production_tonnes.notna() & df.area_hectares.gt(0)
    df["yield_tonnes_per_hectare"] = np.where(has_both, df.production_tonnes / df.area_hectares, np.nan)
    src_yield = pd.to_numeric(df["yield"], errors="coerce")
    yield_diff = (df.yield_tonnes_per_hectare - src_yield).abs()
    yield_mismatch = int((yield_diff > 0.01 + 0.01 * src_yield.abs()).sum())
    check("yield_recomputed", "Yield recomputed as production / area matches the source yield", yield_mismatch == 0,
          f"{yield_mismatch} rows differ from the source yield column by more than 1%", warn_only=True)

    flags = pd.Series("", index=df.index, dtype="string")
    flags[df.production_tonnes.isna()] = "production_missing"
    flags[df.production_tonnes.eq(0)] = "zero_production_reported"
    # Flag A: yield above an absolute ceiling for the crop. Flag B: yield more than five times the
    # median yield of the same crop item in the same state across all years. Flagged records are kept
    # in every total (they are the reported values) and disclosed through production_flagged_tonnes.
    ceiling = df.crop.map(YIELD_FLAG_CEILING)
    over_ceiling = df.yield_tonnes_per_hectare > ceiling
    history = df.groupby(["crop_item", "state"])["yield_tonnes_per_hectare"].transform("median")
    over_history = (df.yield_tonnes_per_hectare > HISTORY_FLAG_RATIO * history) & history.gt(0) & df.production_tonnes.ge(1000)
    flags[over_history] = "yield_far_above_history"
    flags[over_ceiling] = "yield_above_plausible_ceiling"
    outlier = over_ceiling | over_history
    df["quality_flag"] = flags
    report["production_missing_rows"] = int(df.production_tonnes.isna().sum())
    report["zero_production_rows"] = int(df.production_tonnes.eq(0).sum())
    report["yield_flagged_rows"] = int(outlier.sum())
    check("missing_production", "Missing production kept as unknown (not zero)", True,
          f"{report['production_missing_rows']:,} rows have unknown production; their area is excluded from yield denominators")
    check("yield_outliers", "Implausible yields flagged for review", True,
          f"{report['yield_flagged_rows']} rows above crop ceilings {YIELD_FLAG_CEILING} t/ha or over {HISTORY_FLAG_RATIO:g}x the state-crop median yield (kept, flagged)", warn_only=report["yield_flagged_rows"] > 0)

    dup_key = ["year_start", "state", "district_code", "season", "crop_item"]
    dups = int(df.duplicated(dup_key).sum())
    check("duplicates", "No duplicate district-season-crop records", dups == 0, f"{dups} duplicate keys")
    df = df.drop_duplicates(dup_key)

    out = pd.DataFrame({
        "year": df.year_start,
        "crop_year": df.crop_year,
        "state": df.state,
        "state_code": df.state_code,
        "district": df.district_name,
        "district_code": df.district_code,
        "season": df.season,
        "crop": df.crop,
        "crop_item": df.crop_item,
        "area_hectares": df.area_hectares.round(3),
        "production_tonnes": df.production_tonnes.round(3),
        "yield_tonnes_per_hectare": df.yield_tonnes_per_hectare.round(4),
        "quality_flag": df.quality_flag,
        "source": "DES district-wise APY",
    }).sort_values(["crop", "year", "state", "district", "season", "crop_item"]).reset_index(drop=True)
    out["crop"] = pd.Categorical(out["crop"], CROPS)
    out = out.sort_values(["crop", "year", "state", "district", "season", "crop_item"]).reset_index(drop=True)
    out["crop"] = out["crop"].astype(str)

    years = sorted(out.year.unique().tolist())
    expected = list(range(years[0], years[-1] + 1))
    missing_years = sorted(set(expected) - set(years))
    check("year_coverage", "Continuous year coverage", not missing_years,
          f"{crop_year_label(years[0])} to {crop_year_label(years[-1])}; missing: {missing_years or 'none'}")

    gaps = []
    sy = out.groupby(["crop", "state"]).year.agg(["min", "max", "nunique"]).reset_index()
    for r in sy.itertuples():
        span = r.max - r.min + 1
        if r.nunique < span:
            gaps.append({"crop": r.crop, "state": r.state, "first": int(r.min), "last": int(r.max), "years_missing": int(span - r.nunique)})
    report["state_series_with_gaps"] = gaps
    check("state_gaps", "State series without internal gaps", not gaps,
          f"{len(gaps)} crop-state series have missing years inside their span (not interpolated)", warn_only=True)

    report.update(rows_out=int(len(out)), years=[int(years[0]), int(years[-1])],
                  rows_by_crop={c: int(n) for c, n in out.crop.value_counts().items()},
                  states=int(out.state.nunique()), districts=int(out.groupby(["state", "district_code"]).ngroups))
    return out, report


def aggregate(df: pd.DataFrame, keys: list[str]) -> pd.DataFrame:
    """Shared aggregation rule (mirrored in src/data/aggregate.ts).

    area_hectares                  = sum of area over all records
    production_tonnes              = sum of production over records where it is known
                                     (blank when no record has a known value)
    area_with_production_hectares  = sum of area over records with known production
    production_flagged_tonnes      = production of records with a yield_* quality_flag (kept in totals)
    yield_tonnes_per_hectare       = production_tonnes / area_with_production_hectares
    """
    known = df.production_tonnes.notna()
    flagged = df.quality_flag.fillna("").str.startswith("yield_")
    tmp = df.assign(
        _area_known=df.area_hectares.where(known, 0.0),
        _missing=(~known).astype(int),
        _flagged=df.production_tonnes.where(flagged, 0.0),
    )
    g = tmp.groupby(keys, dropna=False, sort=True)
    res = g.agg(
        area_hectares=("area_hectares", "sum"),
        production_tonnes=("production_tonnes", lambda s: s.sum(min_count=1)),
        area_with_production_hectares=("_area_known", "sum"),
        n_records=("area_hectares", "size"),
        n_records_missing_production=("_missing", "sum"),
        production_flagged_tonnes=("_flagged", "sum"),
    ).reset_index()
    res["yield_tonnes_per_hectare"] = np.where(
        res.area_with_production_hectares > 0, res.production_tonnes / res.area_with_production_hectares, np.nan)
    for c, d in [("area_hectares", 3), ("production_tonnes", 3), ("area_with_production_hectares", 3), ("production_flagged_tonnes", 3), ("yield_tonnes_per_hectare", 4)]:
        res[c] = res[c].round(d)
    return res


def coverage_table(state: pd.DataFrame) -> pd.DataFrame:
    """Per crop-year completeness (mirrored in src/data/store.ts, buildProductionStore).

    A state is *absent* from a crop-year when it has no production there but reports production
    in every adjacent crop year that exists (year-1, year+1). absent_share_of_total is what the
    absent states produced in the adjacent years (their mean) as a share of
    (that amount + national production of the crop-year): an indication of how much the total is
    understated, not an estimate of the missing figures.
    """
    rows = []
    for crop, g in state.groupby("crop"):
        piv = g.pivot_table(index="state", columns="year", values="production_tonnes", aggfunc="sum")
        flagged = g.groupby("year")["production_flagged_tonnes"].sum()
        for y in sorted(piv.columns):
            cur = piv[y].fillna(0)
            neigh = [n for n in (y - 1, y + 1) if n in piv.columns]
            expected = pd.Series(True, index=piv.index)
            for n in neigh:
                expected &= piv[n].fillna(0) > 0
            absent = piv.index[(cur <= 0) & expected] if neigh else piv.index[:0]
            lost = float(np.mean([piv.loc[absent, n].sum() for n in neigh])) if len(absent) else 0.0
            total = float(cur.sum())
            absent_share = lost / (lost + total) if (lost + total) > 0 else 0.0
            flagged_share = float(flagged.get(y, 0.0)) / total if total > 0 else 0.0
            rows.append({
                "crop": crop, "year": int(y), "crop_year": crop_year_label(int(y)),
                "n_states_reporting": int((cur > 0).sum()),
                "absent_states": ";".join(sorted(absent)),
                "absent_share_of_total": round(absent_share, 5),
                "flagged_production_share": round(flagged_share, 5),
                "reference_quality": bool(absent_share < COVERAGE_MAX_ABSENT and flagged_share < COVERAGE_MAX_FLAGGED),
            })
    out = pd.DataFrame(rows)
    out["crop"] = pd.Categorical(out.crop, CROPS)
    return out.sort_values(["crop", "year"]).assign(crop=lambda d: d.crop.astype(str)).reset_index(drop=True)


def upag_crosscheck(prod: pd.DataFrame) -> dict:
    path = RAW / "upag_apy_district_2013_2025.csv"
    if not path.exists():
        check("upag_crosscheck", "Cross-check with UPAg district extract", False, "UPAg file not present; skipped", warn_only=True)
        return {"status": "skipped"}
    u = pd.read_csv(path, dtype={"state_code": "Int64", "district_code": "Int64", "crop_code": "string"}, low_memory=False)
    u = u[u.crop_name.isin(["Rice", "Wheat", "Maize"])].copy()
    u["year"] = u.year.str.slice(0, 4).astype(int)
    # The UPAg extract reports area in hectares and production in tonnes (yield in kg/ha).
    u = u.groupby(["year", "state_code", "district_code", "crop_name"], as_index=False)[["area", "production"]].sum(min_count=1)
    d = prod[prod.crop.isin(["Rice", "Wheat", "Maize"])].groupby(
        ["year", "state_code", "district_code", "crop"], as_index=False)[["area_hectares", "production_tonnes"]].sum(min_count=1)
    j = d.merge(u, left_on=["year", "state_code", "district_code", "crop"], right_on=["year", "state_code", "district_code", "crop_name"])
    j = j[j.area_hectares > 0]
    within = ((j.area - j.area_hectares).abs() <= 0.005 * j.area_hectares + 10)
    share = float(within.mean()) if len(j) else 0.0
    years = sorted(j.year.unique().tolist())
    detail = (f"{len(j):,} overlapping district-crop-years ({crop_year_label(years[0])} to {crop_year_label(years[-1])}); "
              f"{share:.1%} agree on area within 0.5% (UPAg seasons are relabelled, so seasons are summed before comparing)")
    check("upag_crosscheck", "DES records agree with the UPAg district extract", share >= 0.95, detail, warn_only=True)
    return {"status": "ok", "overlap_rows": int(len(j)), "area_agreement_share": round(share, 4),
            "years": [int(years[0]), int(years[-1])]}


# --------------------------------------------------------------------------- #
# B. National crop balance (FAOSTAT FBS)
# --------------------------------------------------------------------------- #
def prepare_balance(mapping: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    path = RAW / "FoodBalanceSheets_E_All_Data_(Normalized).zip"
    m = mapping[mapping.source == "FAOSTAT_FBS"].copy()
    m["code"] = m.source_item_code.astype(int)
    with zipfile.ZipFile(path) as z:
        main = next(n for n in z.namelist() if n.endswith("(Normalized).csv"))
        flags = pd.read_csv(z.open(next(n for n in z.namelist() if n.endswith("Flags.csv"))), encoding="latin-1")
        # The normalized file holds every country (~4.8M rows); keep only India's rows for the
        # mapped items while streaming it, so memory use stays small.
        parts = []
        for chunk in pd.read_csv(z.open(main), encoding="latin-1", chunksize=250_000, low_memory=False):
            parts.append(chunk[(chunk["Area Code"] == FAO_INDIA_AREA_CODE) & chunk["Item Code"].isin(m.code)])
    flag_desc = dict(zip(flags.iloc[:, 0].str.strip(), flags.iloc[:, 1].str.strip()))
    ind = pd.concat(parts, ignore_index=True)
    ind = ind.merge(m[["code", "crop", "measurement_basis"]], left_on="Item Code", right_on="code")
    unknown_elements = sorted(set(ind.Element) - set(FBS_ROLES))
    check("fbs_elements", "All FAOSTAT elements are recognised", not unknown_elements, f"unrecognised: {unknown_elements or 'none'}")

    out = pd.DataFrame({
        "year": ind.Year.astype(int),
        "country": "India",
        "crop": ind.crop,
        "crop_or_commodity": ind.Item,
        "item_code": ind["Item Code"].astype(int),
        "element": ind.Element,
        "element_code": ind["Element Code"].astype(int),
        "element_role": ind.Element.map(FBS_ROLES).fillna("other"),
        "value": pd.to_numeric(ind.Value, errors="coerce"),
        "unit": ind.Unit,
        "commodity_basis": ind.measurement_basis,
        "source": "FAOSTAT Food Balances (2010-)",
        "data_status": ind.Flag.fillna(""),
        "data_status_description": ind.Flag.map(flag_desc).fillna(""),
    })
    out["crop"] = pd.Categorical(out.crop, CROPS)
    out = out.sort_values(["crop", "year", "element_code"]).reset_index(drop=True)
    out["crop"] = out.crop.astype(str)

    dups = int(out.duplicated(["year", "crop", "element"]).sum())
    check("fbs_duplicates", "No duplicate FAOSTAT crop-year-element rows", dups == 0, f"{dups} duplicates")
    nonnum = int(out.value.isna().sum())
    check("fbs_numeric", "FAOSTAT values are numeric", nonnum == 0, f"{nonnum} non-numeric values")
    years = sorted(out.year.unique().tolist())

    q = out[out.unit == "1000 t"].pivot_table(index=["crop", "year"], columns="element", values="value", aggfunc="first")
    get = lambda e: q[e] if e in q else pd.Series(np.nan, index=q.index)  # noqa: E731
    P, I, E, SV, DS = (get(e).fillna(0) for e in ["Production", "Import quantity", "Export quantity", "Stock Variation", "Domestic supply quantity"])
    uses = sum(get(e).fillna(0) for e in USE_ELEMENTS)
    minus_gap = (P + I - E - SV - DS).abs()
    plus_gap = (P + I - E + SV - DS).abs()
    tol = np.maximum(2.0, 0.002 * DS.abs())
    minus_ok = float((minus_gap <= tol).mean())
    plus_ok = float((plus_gap <= tol).mean())
    sign = "positive_is_stock_build_up" if minus_ok >= plus_ok else "positive_is_stock_drawdown"
    check("fbs_supply_identity", "Domestic supply = production + imports - exports - stock variation",
          minus_ok >= 0.95, f"holds for {minus_ok:.0%} of crop-years (alternative sign convention: {plus_ok:.0%}); "
          "a positive stock variation therefore means stocks were built up")
    use_gap = (uses - DS).abs()
    use_ok = float((use_gap <= tol).mean())
    check("fbs_use_identity", "Domestic supply = sum of uses (food, feed, seed, processing, losses, other, residuals)",
          use_ok >= 0.95, f"holds for {use_ok:.0%} of crop-years; max gap {use_gap.max():.0f} thousand t")

    flows = build_flows(q)
    rec = flows.drop_duplicates(["crop", "year"])
    n_bad = int((~rec.reconciled).sum())
    check("flows_reconciled", "Every crop-year flow diagram balances (sources = destinations)", n_bad == 0,
          f"{len(rec) - n_bad} of {len(rec)} crop-years reconcile within 0.5%; unreconciled years fall back to a bar chart")
    report = {"rows": int(len(out)), "years": [int(years[0]), int(years[-1])], "stock_variation_sign": sign,
              "supply_identity_share": round(minus_ok, 4), "use_identity_share": round(use_ok, 4),
              "flags": {k: int(v) for k, v in out.data_status.value_counts().items()}}
    return out, flows, report


def build_flows(q: pd.DataFrame) -> pd.DataFrame:
    """Sankey decomposition of each crop-year balance (mirrored in src/data/balance.ts).

    Sources:      Production, Imports, Stock drawdown (= -stock variation when negative),
                  Negative residual (= -residuals when negative)
    Destinations: Exports, Stock build-up (= stock variation when positive), Food, Feed,
                  Seed, Processing, Losses, Other uses (non-food), Tourist consumption,
                  Residual (when positive)
    Because domestic supply = P + I - E - SV and domestic supply = sum of uses,
    sources and destinations balance exactly; shares use total sources as denominator.
    Elements FAOSTAT does not report for a crop-year are omitted (not set to zero).
    """
    rows = []
    for (crop, year), r in q.iterrows():
        val = lambda e: r.get(e, np.nan)  # noqa: E731
        sv, res = val("Stock Variation"), val("Residuals")
        sources = [("Production", val("Production")), ("Imports", val("Import quantity")),
                   ("Stock drawdown", -sv if pd.notna(sv) and sv < 0 else np.nan),
                   ("Negative residual", -res if pd.notna(res) and res < 0 else np.nan)]
        dests = [("Exports", val("Export quantity")), ("Stock build-up", sv if pd.notna(sv) and sv > 0 else np.nan)]
        for e in USE_ELEMENTS:
            v = val(e)
            if e == "Residuals":
                v = v if pd.notna(v) and v > 0 else np.nan
            dests.append((FLOW_LABEL.get(e, e), v))
        sources = [(n, v) for n, v in sources if pd.notna(v) and v > 0]
        dests = [(n, v) for n, v in dests if pd.notna(v) and v > 0]
        ts, td = sum(v for _, v in sources), sum(v for _, v in dests)
        gap = ts - td
        ok = abs(gap) <= max(1.0, 0.005 * ts)
        for side, items in [("source", sources), ("destination", dests)]:
            for n, v in items:
                rows.append({"year": int(year), "crop": crop, "side": side, "flow": n, "value_1000t": v,
                             "share_of_total_supply": round(v / ts, 6) if ts else np.nan,
                             "total_supply_1000t": ts, "domestic_supply_1000t": val("Domestic supply quantity"),
                             "balance_gap_1000t": round(gap, 3), "reconciled": ok})
    flows = pd.DataFrame(rows)
    flows["crop"] = pd.Categorical(flows.crop, CROPS)
    return flows.sort_values(["crop", "year", "side"], ascending=[True, True, False]).assign(crop=lambda d: d.crop.astype(str))


# --------------------------------------------------------------------------- #
def main() -> int:
    manifest_path = RAW / "SOURCES.json"
    if not manifest_path.exists():
        print("data/raw/SOURCES.json not found. Run scripts/fetch_sources.py first.", file=sys.stderr)
        return 1
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    missing = [s["file"] for s in manifest["sources"] if s.get("status") != "ok" or not (RAW / s["file"]).exists()]
    needed = {"des_apy_district_1997_2023.csv", "FoodBalanceSheets_E_All_Data_(Normalized).zip"}
    if needed & set(missing):
        print(f"Required raw files are missing: {sorted(needed & set(missing))}. See data/README.md.", file=sys.stderr)
        return 1

    OUT.mkdir(parents=True, exist_ok=True)
    mapping = pd.read_csv(REF / "crop_mapping.csv", dtype=str)
    st = pd.read_csv(REF / "state_names.csv", dtype=str)
    states = dict(zip(st[st.source == "DES_APY"].source_name, st[st.source == "DES_APY"].state))

    prod, prod_report = prepare_production(mapping, states)
    prod_report["upag_crosscheck"] = upag_crosscheck(prod)
    write_csv(prod, "crop_production.csv")

    district = aggregate(prod, ["year", "crop_year", "state", "district_code", "district", "crop"])
    write_csv(district, "crop_production_district_year.csv")
    state = aggregate(prod, ["year", "crop_year", "state", "crop"])
    write_csv(state, "crop_production_state_year.csv")
    national = aggregate(prod, ["year", "crop_year", "crop", "season"])
    write_csv(national, "crop_production_national_season_year.csv")
    coverage = coverage_table(state)
    write_csv(coverage, "crop_year_coverage.csv")
    ref = coverage[coverage.reference_quality]
    check("coverage", "Completeness of each crop-year assessed", True,
          f"{len(ref)} of {len(coverage)} crop-years are reference quality (< {COVERAGE_MAX_ABSENT:.0%} of production from absent states and "
          f"< {COVERAGE_MAX_FLAGGED:.0%} from flagged records); the rest are shown with a notice and are not used as comparison baselines",
          warn_only=len(ref) < len(coverage))

    balance, flows, bal_report = prepare_balance(mapping)
    write_csv(balance, "national_crop_balance.csv")
    write_csv(flows, "national_balance_flows.csv")
    shutil.copyfile(REF / "crop_mapping.csv", OUT / "crop_mapping.csv")

    generated = dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    meta = {
        "generated_at": generated,
        "datasets": {
            "crop_production": {"file": "crop_production.csv", "rows": prod_report["rows_out"],
                                "years": prod_report["years"],
                                "crop_years": [crop_year_label(y) for y in prod_report["years"]],
                                "states": prod_report["states"], "districts": prod_report["districts"]},
            "crop_production_district_year": {"file": "crop_production_district_year.csv", "rows": int(len(district))},
            "crop_production_state_year": {"file": "crop_production_state_year.csv", "rows": int(len(state))},
            "crop_production_national_season_year": {"file": "crop_production_national_season_year.csv", "rows": int(len(national))},
            "crop_year_coverage": {"file": "crop_year_coverage.csv", "rows": int(len(coverage))},
            "national_crop_balance": {"file": "national_crop_balance.csv", "rows": bal_report["rows"], "years": bal_report["years"]},
            "national_balance_flows": {"file": "national_balance_flows.csv", "rows": int(len(flows))},
        },
        "production_report": prod_report,
        "balance_report": bal_report,
        "checks": checks,
        "sources": [{k: s.get(k) for k in ["id", "title", "publisher", "origin", "url", "via", "retrieved_at", "status", "sha256"]}
                    for s in manifest["sources"] if not s["id"].startswith("boundaries_") or s["id"] == "boundaries_shp"],
    }
    (OUT / "metadata.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    write_markdown_report(meta)

    fails = [c for c in checks if c["status"] == "fail"]
    for c in checks:
        print(f"[{c['status'].upper():4}] {c['label']}: {c['detail']}")
    print(f"\nWrote prepared datasets to {OUT.relative_to(ROOT)}")
    return 1 if fails else 0


def write_markdown_report(meta: dict) -> None:
    lines = ["# Validation report", "", f"Generated: {meta['generated_at']}", "", "## Checks", "",
             "| Status | Check | Detail |", "|---|---|---|"]
    for c in meta["checks"]:
        lines.append(f"| {c['status'].upper()} | {c['label']} | {c['detail'].replace('|', '/')} |")
    lines += ["", "## Datasets", "", "| File | Rows |", "|---|---|"]
    for d in meta["datasets"].values():
        lines.append(f"| {d['file']} | {d['rows']:,} |")
    gaps = meta["production_report"].get("state_series_with_gaps", [])
    if gaps:
        lines += ["", "## State series with missing years (not interpolated)", "", "| Crop | State | First | Last | Years missing |", "|---|---|---|---|---|"]
        for g in gaps:
            lines.append(f"| {g['crop']} | {g['state']} | {crop_year_label(g['first'])} | {crop_year_label(g['last'])} | {g['years_missing']} |")
    lines += ["", "## Sources", ""]
    for s in meta["sources"]:
        lines.append(f"- **{s['title']}** ({s['publisher']}). Retrieved {s.get('retrieved_at')} from {s['url']}. Origin: {s['origin']}. {s.get('via') or ''}")
    (OUT / "validation_report.md").write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    sys.exit(main())
