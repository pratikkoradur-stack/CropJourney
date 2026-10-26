import { combine } from './aggregate'
import { computeFlows } from './balance'
import {
  CROPS,
  type BalanceRow,
  type Coverage,
  type Crop,
  type DistrictYearRow,
  type FlowResult,
  type NationalSeasonRow,
  type NationalYear,
  type StateYearRow,
} from './types'

export const cropYearLabel = (year: number) => `${year}-${String(year + 1).slice(-2)}`

export interface ProductionStore {
  years: number[]
  yearsByCrop: Record<Crop, number[]>
  states: string[]
  /** state rows for a crop-year, sorted by production (desc, unknown last) */
  stateRows(crop: Crop, year: number): StateYearRow[]
  stateSeries(crop: Crop, state: string): StateYearRow[]
  national(crop: Crop): NationalYear[]
  nationalYear(crop: Crop, year: number): NationalYear | undefined
  cropYear(year: number): string
  coverage(crop: Crop, year: number): Coverage | undefined
  /** years in which every given crop has records and is reference quality */
  referenceYears(crops: readonly Crop[]): number[]
  /** runs of n consecutive reference years, in order (empty when there are none) */
  referenceRuns(crops: readonly Crop[], n: number): number[][]
}

export const COVERAGE_MAX_ABSENT = 0.02
export const COVERAGE_MAX_FLAGGED = 0.05

/**
 * Mirrors coverage_table() in scripts/prepare_data.py. A state is absent from a crop-year when it
 * has no production there but reports production in every adjacent crop year that exists.
 */
function computeCoverage(stateYear: StateYearRow[]): Map<string, Coverage> {
  const prod = new Map<string, number>()
  const flagged = new Map<string, number>()
  const total = new Map<string, number>()
  const yearsByCrop = new Map<Crop, Set<number>>()
  const statesByCrop = new Map<Crop, Set<string>>()
  for (const r of stateYear) {
    const p = r.production ?? 0
    prod.set(`${r.crop}|${r.state}|${r.year}`, (prod.get(`${r.crop}|${r.state}|${r.year}`) ?? 0) + p)
    total.set(`${r.crop}|${r.year}`, (total.get(`${r.crop}|${r.year}`) ?? 0) + p)
    flagged.set(`${r.crop}|${r.year}`, (flagged.get(`${r.crop}|${r.year}`) ?? 0) + r.flaggedProduction)
    ;(yearsByCrop.get(r.crop) ?? yearsByCrop.set(r.crop, new Set()).get(r.crop)!).add(r.year)
    ;(statesByCrop.get(r.crop) ?? statesByCrop.set(r.crop, new Set()).get(r.crop)!).add(r.state)
  }
  const out = new Map<string, Coverage>()
  for (const [crop, years] of yearsByCrop) {
    const states = [...(statesByCrop.get(crop) ?? [])]
    const get = (s: string, y: number) => prod.get(`${crop}|${s}|${y}`) ?? 0
    for (const y of years) {
      const neigh = [y - 1, y + 1].filter((n) => years.has(n))
      const absent = neigh.length ? states.filter((s) => get(s, y) <= 0 && neigh.every((n) => get(s, n) > 0)) : []
      const lost = absent.length ? neigh.reduce((a, n) => a + absent.reduce((b, s) => b + get(s, n), 0), 0) / neigh.length : 0
      const tot = total.get(`${crop}|${y}`) ?? 0
      const absentShare = lost + tot > 0 ? lost / (lost + tot) : 0
      const flaggedShare = tot > 0 ? (flagged.get(`${crop}|${y}`) ?? 0) / tot : 0
      out.set(`${crop}|${y}`, {
        absentStates: absent.sort(),
        absentShare,
        flaggedShare,
        reference: absentShare < COVERAGE_MAX_ABSENT && flaggedShare < COVERAGE_MAX_FLAGGED,
      })
    }
  }
  return out
}

const byProductionDesc = (a: { production: number | null }, b: { production: number | null }) =>
  (b.production ?? -Infinity) - (a.production ?? -Infinity)

export function buildProductionStore(stateYear: StateYearRow[], nationalSeason: NationalSeasonRow[]): ProductionStore {
  const byCropYear = new Map<string, StateYearRow[]>()
  const byCropState = new Map<string, StateYearRow[]>()
  const labels = new Map<number, string>()
  const states = new Set<string>()
  const yearSets = Object.fromEntries(CROPS.map((c) => [c, new Set<number>()])) as Record<Crop, Set<number>>

  for (const r of stateYear) {
    labels.set(r.year, r.cropYear || cropYearLabel(r.year))
    states.add(r.state)
    yearSets[r.crop].add(r.year)
    const k1 = `${r.crop}|${r.year}`
    const k2 = `${r.crop}|${r.state}`
    ;(byCropYear.get(k1) ?? byCropYear.set(k1, []).get(k1)!).push(r)
    ;(byCropState.get(k2) ?? byCropState.set(k2, []).get(k2)!).push(r)
  }
  for (const list of byCropYear.values()) list.sort(byProductionDesc)
  for (const list of byCropState.values()) list.sort((a, b) => a.year - b.year)

  const nationalByCrop = new Map<Crop, NationalYear[]>()
  for (const crop of CROPS) {
    const seasonRows = nationalSeason.filter((r) => r.crop === crop)
    const years = [...new Set(seasonRows.map((r) => r.year))].sort((a, b) => a - b)
    nationalByCrop.set(
      crop,
      years.map((year) => {
        const rows = seasonRows.filter((r) => r.year === year)
        return {
          year,
          cropYear: labels.get(year) ?? cropYearLabel(year),
          ...combine(rows),
          seasons: rows
            .map((r) => ({ season: r.season, area: r.area, production: r.production }))
            .sort((a, b) => (b.production ?? 0) - (a.production ?? 0)),
        }
      }),
    )
  }

  const coverage = computeCoverage(stateYear)
  const referenceYears = (crops: readonly Crop[]) =>
    [...labels.keys()].sort((a, b) => a - b).filter((y) => crops.every((c) => coverage.get(`${c}|${y}`)?.reference))

  const allYears = [...labels.keys()].sort((a, b) => a - b)
  return {
    coverage: (crop, year) => coverage.get(`${crop}|${year}`),
    referenceYears,
    referenceRuns(crops, n) {
      const ys = referenceYears(crops)
      const runs: number[][] = []
      let run: number[] = []
      for (const y of ys) {
        if (run.length && y !== run[run.length - 1] + 1) run = []
        run.push(y)
        if (run.length >= n) runs.push(run.slice(-n))
      }
      return runs
    },
    years: allYears,
    yearsByCrop: Object.fromEntries(CROPS.map((c) => [c, [...yearSets[c]].sort((a, b) => a - b)])) as Record<Crop, number[]>,
    states: [...states].sort(),
    stateRows: (crop, year) => byCropYear.get(`${crop}|${year}`) ?? [],
    stateSeries: (crop, state) => byCropState.get(`${crop}|${state}`) ?? [],
    national: (crop) => nationalByCrop.get(crop) ?? [],
    nationalYear: (crop, year) => nationalByCrop.get(crop)?.find((n) => n.year === year),
    cropYear: (year) => labels.get(year) ?? cropYearLabel(year),
  }
}

export interface DistrictStore {
  rows(crop: Crop, year: number, state: string): DistrictYearRow[]
}

export function buildDistrictStore(rows: DistrictYearRow[]): DistrictStore {
  const map = new Map<string, DistrictYearRow[]>()
  for (const r of rows) {
    const k = `${r.crop}|${r.year}|${r.state}`
    ;(map.get(k) ?? map.set(k, []).get(k)!).push(r)
  }
  for (const list of map.values()) list.sort(byProductionDesc)
  return { rows: (crop, year, state) => map.get(`${crop}|${year}|${state}`) ?? [] }
}

export interface BalanceStore {
  years: number[]
  yearsByCrop: Record<Crop, number[]>
  elements(crop: Crop, year: number): Map<string, BalanceRow>
  flows(crop: Crop, year: number): FlowResult | null
  series(crop: Crop, element: string): { year: number; value: number }[]
  basis(crop: Crop): string
}

export function buildBalanceStore(rows: BalanceRow[]): BalanceStore {
  const map = new Map<string, Map<string, BalanceRow>>()
  const yearSets = Object.fromEntries(CROPS.map((c) => [c, new Set<number>()])) as Record<Crop, Set<number>>
  const basis = new Map<Crop, string>()
  for (const r of rows) {
    const k = `${r.crop}|${r.year}`
    ;(map.get(k) ?? map.set(k, new Map()).get(k)!).set(r.element, r)
    if (r.element === 'Production') yearSets[r.crop].add(r.year)
    if (r.basis && !basis.has(r.crop)) basis.set(r.crop, r.basis)
  }
  const flowCache = new Map<string, FlowResult | null>()
  const yearsByCrop = Object.fromEntries(CROPS.map((c) => [c, [...yearSets[c]].sort((a, b) => a - b)])) as Record<Crop, number[]>
  return {
    years: [...new Set(rows.map((r) => r.year))].sort((a, b) => a - b),
    yearsByCrop,
    elements: (crop, year) => map.get(`${crop}|${year}`) ?? new Map(),
    flows(crop, year) {
      const k = `${crop}|${year}`
      if (!flowCache.has(k)) flowCache.set(k, computeFlows(map.get(k) ?? new Map()))
      return flowCache.get(k) ?? null
    },
    series(crop, element) {
      return yearsByCrop[crop]
        .map((year) => ({ year, value: map.get(`${crop}|${year}`)?.get(element)?.value }))
        .filter((p): p is { year: number; value: number } => p.value != null && Number.isFinite(p.value))
    },
    basis: (crop) => basis.get(crop) ?? '',
  }
}
