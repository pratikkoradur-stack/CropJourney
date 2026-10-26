import type {
  AggRow,
  Crop,
  DistrictYearRow,
  NationalSeasonRow,
  ProductionRecord,
  StateYearRow,
  Totals,
} from './types'

/**
 * The single aggregation rule shared with scripts/prepare_data.py (aggregate()):
 *   area                 = sum of area over all records
 *   production           = sum of production over records where it is known (null if none known)
 *   areaWithProduction   = sum of area over records with known production
 *   yield                = production / areaWithProduction
 * Unknown production is never treated as zero, and yield never mixes denominators.
 */
export function combine(
  rows: Iterable<Pick<Totals, 'area' | 'production' | 'areaWithProduction' | 'flaggedProduction' | 'nRecords' | 'nMissing'>>,
): Totals {
  let area = 0
  let production = 0
  let anyProduction = false
  let areaWithProduction = 0
  let flaggedProduction = 0
  let nRecords = 0
  let nMissing = 0
  for (const r of rows) {
    area += r.area
    areaWithProduction += r.areaWithProduction
    flaggedProduction += r.flaggedProduction
    nRecords += r.nRecords
    nMissing += r.nMissing
    if (r.production != null) {
      production += r.production
      anyProduction = true
    }
  }
  const prod = anyProduction ? production : null
  return {
    area,
    production: prod,
    areaWithProduction,
    flaggedProduction,
    yield: prod != null && areaWithProduction > 0 ? prod / areaWithProduction : null,
    nRecords,
    nMissing,
  }
}

function recordTotals(r: ProductionRecord): Totals {
  const area = r.area ?? 0
  const known = r.production != null
  return {
    area,
    production: r.production,
    areaWithProduction: known ? area : 0,
    flaggedProduction: known && r.flag.startsWith('yield_') ? (r.production as number) : 0,
    yield: null,
    nRecords: 1,
    nMissing: known ? 0 : 1,
  }
}

function groupBy<R>(records: ProductionRecord[], key: (r: ProductionRecord) => string, build: (first: ProductionRecord, t: Totals) => R): R[] {
  const groups = new Map<string, ProductionRecord[]>()
  for (const r of records) {
    const k = key(r)
    const g = groups.get(k)
    if (g) g.push(r)
    else groups.set(k, [r])
  }
  const out: R[] = []
  for (const g of groups.values()) out.push(build(g[0], combine(g.map(recordTotals))))
  return out
}

const base = (r: ProductionRecord, t: Totals): AggRow => ({ year: r.year, cropYear: r.cropYear, crop: r.crop as Crop, ...t })

/** Re-derive the prepared aggregate tables from a detailed crop_production.csv import. */
export function aggregateProduction(records: ProductionRecord[]) {
  const stateYear: StateYearRow[] = groupBy(
    records,
    (r) => `${r.year}|${r.state}|${r.crop}`,
    (r, t) => ({ ...base(r, t), state: r.state }),
  )
  const districtYear: DistrictYearRow[] = groupBy(
    records,
    (r) => `${r.year}|${r.state}|${r.districtCode}|${r.district}|${r.crop}`,
    (r, t) => ({ ...base(r, t), state: r.state, district: r.district, districtCode: r.districtCode }),
  )
  const nationalSeason: NationalSeasonRow[] = groupBy(
    records,
    (r) => `${r.year}|${r.crop}|${r.season}`,
    (r, t) => ({ ...base(r, t), season: r.season }),
  )
  return { stateYear, districtYear, nationalSeason }
}

/** Percentage change, or null when either value is unknown or the base is zero. */
export function pctChange(from: number | null | undefined, to: number | null | undefined): number | null {
  if (from == null || to == null || from === 0) return null
  return (to - from) / Math.abs(from)
}
