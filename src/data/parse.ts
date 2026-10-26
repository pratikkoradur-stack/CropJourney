import { csvParse, type DSVRowString } from 'd3-dsv'
import { isCrop, type BalanceRow, type DistrictYearRow, type NationalSeasonRow, type ProductionRecord, type StateYearRow } from './types'

export const num = (s: string | undefined): number | null => {
  if (s == null) return null
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export class SchemaError extends Error {}

function table(text: string, required: string[], label: string) {
  const rows = csvParse(text.replace(/^﻿/, ''))
  const cols = new Set(rows.columns.map((c) => c.trim()))
  const missing = required.filter((c) => !cols.has(c))
  if (missing.length) throw new SchemaError(`${label} is missing column(s): ${missing.join(', ')}`)
  return rows
}

export const AGG_COLUMNS = ['year', 'crop_year', 'crop', 'area_hectares', 'production_tonnes', 'area_with_production_hectares', 'n_records', 'n_records_missing_production']
export const DETAIL_COLUMNS = ['year', 'crop_year', 'state', 'district', 'district_code', 'season', 'crop', 'crop_item', 'area_hectares', 'production_tonnes']
export const BALANCE_COLUMNS = ['year', 'crop', 'crop_or_commodity', 'element', 'element_code', 'value', 'unit']

function agg(r: DSVRowString) {
  const production = num(r.production_tonnes)
  const areaWithProduction = num(r.area_with_production_hectares) ?? 0
  return {
    year: num(r.year) ?? NaN,
    cropYear: r.crop_year ?? '',
    crop: r.crop as StateYearRow['crop'],
    area: num(r.area_hectares) ?? 0,
    production,
    areaWithProduction,
    flaggedProduction: num(r.production_flagged_tonnes) ?? 0,
    yield: production != null && areaWithProduction > 0 ? production / areaWithProduction : null,
    nRecords: num(r.n_records) ?? 0,
    nMissing: num(r.n_records_missing_production) ?? 0,
  }
}

const validAgg = (r: { year: number; crop: string }) => Number.isInteger(r.year) && isCrop(r.crop)

export function parseStateYear(text: string): StateYearRow[] {
  return table(text, [...AGG_COLUMNS, 'state'], 'crop_production_state_year.csv')
    .map((r) => ({ ...agg(r), state: r.state ?? '' }))
    .filter(validAgg)
}

export function parseDistrictYear(text: string): DistrictYearRow[] {
  return table(text, [...AGG_COLUMNS, 'state', 'district', 'district_code'], 'crop_production_district_year.csv')
    .map((r) => ({ ...agg(r), state: r.state ?? '', district: r.district ?? '', districtCode: r.district_code ?? '' }))
    .filter(validAgg)
}

export function parseNationalSeason(text: string): NationalSeasonRow[] {
  return table(text, [...AGG_COLUMNS, 'season'], 'crop_production_national_season_year.csv')
    .map((r) => ({ ...agg(r), season: r.season ?? '' }))
    .filter(validAgg)
}

export function parseBalance(text: string): BalanceRow[] {
  return table(text, BALANCE_COLUMNS, 'national_crop_balance.csv')
    .map((r) => ({
      year: num(r.year) ?? NaN,
      crop: r.crop as BalanceRow['crop'],
      item: r.crop_or_commodity ?? '',
      element: (r.element ?? '').trim(),
      elementCode: num(r.element_code) ?? 0,
      role: r.element_role ?? '',
      value: num(r.value) ?? NaN,
      unit: (r.unit ?? '').trim(),
      basis: r.commodity_basis ?? '',
      flag: r.data_status ?? '',
      flagDescription: r.data_status_description ?? '',
    }))
    .filter((r) => Number.isInteger(r.year) && isCrop(r.crop) && Number.isFinite(r.value))
}

// --------------------------------------------------------------------------
// CSV import (user-supplied replacement files) with a validation report
// --------------------------------------------------------------------------
export interface ImportReport {
  kind: 'production' | 'balance'
  fileName: string
  rowsRead: number
  rowsUsed: number
  issues: string[]
  years: [number, number] | null
  crops: string[]
}

export function detectKind(text: string): 'production' | 'balance' | null {
  const header = text.replace(/^﻿/, '').split(/\r?\n/, 1)[0] ?? ''
  const cols = new Set(header.split(',').map((c) => c.trim().replace(/^"|"$/g, '')))
  if (DETAIL_COLUMNS.every((c) => cols.has(c))) return 'production'
  if (BALANCE_COLUMNS.every((c) => cols.has(c))) return 'balance'
  return null
}

export function parseProductionImport(text: string, fileName: string): { records: ProductionRecord[]; report: ImportReport } {
  const rows = table(text, DETAIL_COLUMNS, fileName)
  const issues: string[] = []
  let badYear = 0
  let otherCrop = 0
  let badArea = 0
  let negative = 0
  const seen = new Set<string>()
  let dups = 0
  const records: ProductionRecord[] = []
  for (const r of rows) {
    const year = num(r.year)
    if (year == null || !Number.isInteger(year) || year < 1900 || year > 2100) {
      badYear++
      continue
    }
    if (!isCrop(r.crop)) {
      otherCrop++
      continue
    }
    const area = num(r.area_hectares)
    let production = num(r.production_tonnes)
    if (area == null || area <= 0) badArea++
    if (production != null && production < 0) {
      negative++
      production = null
    }
    const key = `${year}|${r.state}|${r.district_code}|${r.season}|${r.crop_item}`
    if (seen.has(key)) {
      dups++
      continue
    }
    seen.add(key)
    records.push({
      year,
      cropYear: r.crop_year || `${year}-${String(year + 1).slice(-2)}`,
      state: (r.state ?? '').trim(),
      district: (r.district ?? '').trim(),
      districtCode: (r.district_code ?? '').trim(),
      season: (r.season ?? '').trim(),
      crop: r.crop,
      cropItem: (r.crop_item ?? '').trim(),
      area: area != null && area > 0 ? area : null,
      production,
      flag: (r.quality_flag ?? '').trim(),
    })
  }
  if (badYear) issues.push(`${badYear} row(s) skipped: year is not a valid integer`)
  if (otherCrop) issues.push(`${otherCrop} row(s) skipped: crop is not one of Rice, Wheat, Maize, Pulses`)
  if (dups) issues.push(`${dups} duplicate row(s) skipped (same year, state, district, season and crop item)`)
  if (badArea) issues.push(`${badArea} row(s) have missing or non-positive area (kept as unknown)`)
  if (negative) issues.push(`${negative} negative production value(s) treated as unknown`)
  return { records, report: summarise('production', fileName, rows.length, records, issues) }
}

export function parseBalanceImport(text: string, fileName: string): { rows: BalanceRow[]; report: ImportReport } {
  const raw = table(text, BALANCE_COLUMNS, fileName)
  const rows = parseBalance(text)
  const issues: string[] = []
  if (rows.length < raw.length) issues.push(`${raw.length - rows.length} row(s) skipped: invalid year, unsupported crop or non-numeric value`)
  const keys = new Set<string>()
  const unique: BalanceRow[] = []
  for (const r of rows) {
    const k = `${r.year}|${r.crop}|${r.element}`
    if (keys.has(k)) continue
    keys.add(k)
    unique.push(r)
  }
  if (unique.length < rows.length) issues.push(`${rows.length - unique.length} duplicate crop-year-element row(s) skipped`)
  if (!unique.some((r) => r.element === 'Production' && r.unit === '1000 t'))
    issues.push('No "Production" rows in 1000 t were found; utilization flows cannot be drawn')
  return { rows: unique, report: summarise('balance', fileName, raw.length, unique, issues) }
}

function summarise(kind: ImportReport['kind'], fileName: string, rowsRead: number, rows: { year: number; crop: string }[], issues: string[]): ImportReport {
  let lo = Infinity
  let hi = -Infinity
  const crops = new Set<string>()
  for (const r of rows) {
    lo = Math.min(lo, r.year)
    hi = Math.max(hi, r.year)
    crops.add(r.crop)
  }
  return { kind, fileName, rowsRead, rowsUsed: rows.length, issues, years: rows.length ? [lo, hi] : null, crops: [...crops] }
}
