"""Download the raw source files used by Crop Journey into data/raw/.

Writes data/raw/SOURCES.json with the URL, size, SHA-256 and retrieval time of
every file. A failed download is reported as failed (never as success), with
instructions for placing the file manually.

Usage:
    python scripts/fetch_sources.py                 # download everything
    python scripts/fetch_sources.py --skip-existing # keep files already in data/raw
"""

from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"

SOURCES = [
    {
        "id": "des_apy",
        "file": "des_apy_district_1997_2023.csv",
        "url": "https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/f980409d-49a2-42ae-9eb0-182365005c04/download/crop-wise-area-production-yield.csv",
        "title": "Crop-wise Area, Production & Yield (district-wise, 1997-98 to 2022-23)",
        "publisher": "Directorate of Economics & Statistics (DES), Ministry of Agriculture & Farmers Welfare",
        "origin": "https://www.data.gov.in/resource/district-wise-season-wise-crop-production-statistics-1997",
        "via": "India Data Portal (ISB) mirror, licence ODC-By; the data.gov.in resource points to aps.dac.gov.in/APY/apy.csv, which was unreachable at retrieval time",
        "manual": "Download the district-wise APY CSV from https://data.desagri.gov.in/website/crops-apy-report-web or the data.gov.in resource and save it as data/raw/des_apy_district_1997_2023.csv",
    },
    {
        "id": "upag_apy",
        "file": "upag_apy_district_2013_2025.csv",
        "url": "https://ckandev.indiadataportal.com/dataset/f2bbc28c-6c7c-462b-9064-ea4c4213d466/resource/6f70d961-3a4f-4caa-b08f-f72f708791e1/download/cropwise-area-production-yield-upag.csv",
        "title": "Crop-wise Area, Production & Yield (UPAg district extract, 2013-14 to 2024-25)",
        "publisher": "DES district data published via UPAg, Ministry of Agriculture & Farmers Welfare",
        "origin": "https://upag.gov.in/dash-reports/desdistrictwisecompletedatasetreport",
        "via": "India Data Portal (ISB) mirror, licence ODC-By. Used only as a cross-check",
        "manual": "Export the district-wise APY report from https://upag.gov.in and save it as data/raw/upag_apy_district_2013_2025.csv",
    },
    {
        "id": "faostat_fbs",
        "file": "FoodBalanceSheets_E_All_Data_(Normalized).zip",
        "url": "https://bulks-faostat.fao.org/production/FoodBalanceSheets_E_All_Data_(Normalized).zip",
        "title": "FAOSTAT Food Balances (2010-)",
        "publisher": "Food and Agriculture Organization of the United Nations (FAO)",
        "origin": "https://data.fao.org/catalog/dataset/e463c4cc-0ed1-4ef8-80c5-2add3a0b75ca",
        "via": "FAOSTAT bulk download (CC BY 4.0)",
        "manual": "Download the 'Food Balances (2010-)' normalized bulk file from https://www.fao.org/faostat/en/#data/FBS and save it as data/raw/FoodBalanceSheets_E_All_Data_(Normalized).zip",
    },
]

BOUNDARY_FILES = ["shp", "shx", "dbf", "prj", "cpg"]
BOUNDARY_URL = "https://raw.githubusercontent.com/datameet/maps/master/States/Admin2.{ext}"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url: str, dest: Path) -> None:
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (CropJourney data fetch)"})
    tmp = dest.with_suffix(dest.suffix + ".part")
    with urllib.request.urlopen(req, timeout=600) as resp, tmp.open("wb") as out:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status}")
        while chunk := resp.read(1 << 20):
            out.write(chunk)
    tmp.replace(dest)


def now_iso() -> str:
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()


def record(entry: dict, path: Path, retrieved_at: str, note: str = "") -> dict:
    out = {k: v for k, v in entry.items() if k != "manual"}
    out.update(
        status="ok",
        bytes=path.stat().st_size,
        sha256=sha256(path),
        retrieved_at=retrieved_at,
    )
    if note:
        out["note"] = note
    return out


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-existing", action="store_true", help="keep files already present in data/raw")
    args = parser.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    (RAW / "boundaries").mkdir(exist_ok=True)
    manifest_path = RAW / "SOURCES.json"
    previous = {}
    if manifest_path.exists():
        previous = {s["id"]: s for s in json.loads(manifest_path.read_text(encoding="utf-8")).get("sources", [])}

    results, failures = [], 0
    entries = list(SOURCES) + [
        {
            "id": f"boundaries_{ext}",
            "file": f"boundaries/Admin2.{ext}",
            "url": BOUNDARY_URL.format(ext=ext),
            "title": "India state boundaries (Admin2)",
            "publisher": "DataMeet India community",
            "origin": "https://github.com/datameet/maps/tree/master/States",
            "via": "GitHub, licence CC BY 4.0",
            "manual": f"Download {BOUNDARY_URL.format(ext=ext)} to data/raw/boundaries/",
        }
        for ext in BOUNDARY_FILES
    ]

    for entry in entries:
        dest = RAW / entry["file"]
        if args.skip_existing and dest.exists():
            prev = previous.get(entry["id"])
            if prev and prev.get("sha256") == sha256(dest):
                results.append(prev)
            else:
                mtime = dt.datetime.fromtimestamp(dest.stat().st_mtime, dt.timezone.utc).replace(microsecond=0).isoformat()
                results.append(record(entry, dest, mtime, "retrieval time taken from the file's modification time"))
            print(f"[kept]   {entry['file']}")
            continue
        try:
            print(f"[fetch]  {entry['url']}")
            download(entry["url"], dest)
            results.append(record(entry, dest, now_iso()))
            print(f"[ok]     {entry['file']} ({dest.stat().st_size:,} bytes)")
        except Exception as exc:  # noqa: BLE001 - report every failure honestly
            failures += 1
            results.append({**{k: v for k, v in entry.items() if k != "manual"}, "status": "failed", "error": str(exc)})
            print(f"[FAILED] {entry['file']}: {exc}\n         Manual step: {entry['manual']}", file=sys.stderr)

    manifest_path.write_text(json.dumps({"generated_at": now_iso(), "sources": results}, indent=2), encoding="utf-8")
    print(f"\nManifest written to {manifest_path.relative_to(ROOT)}; {failures} failure(s).")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
