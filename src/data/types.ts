export const CROPS = ['Rice', 'Wheat', 'Maize', 'Pulses'] as const
export type Crop = (typeof CROPS)[number]

export const isCrop = (v: unknown): v is Crop => typeof v === 'string' && (CROPS as readonly string[]).includes(v)

export const CROP_COLOR: Record<Crop, string> = {
  Rice: '#c86d67',
  Wheat: '#b8935a',
  Maize: '#65785a',
  Pulses: '#6e4f3c',
}

/** One row of crop_production.csv (district x season x crop item). */
export interface ProductionRecord {
  year: number
  cropYear: string
  state: string
  district: string
  districtCode: string
  season: string
  crop: Crop
  cropItem: string
  area: number | null
  production: number | null
  /** quality_flag from crop_production.csv ('' when none) */
  flag: string
}

/** Totals produced by the shared aggregation rule (see aggregate.ts). */
export interface Totals {
  area: number
  production: number | null
  areaWithProduction: number
  /** production of records with a yield_* quality flag (included in production) */
  flaggedProduction: number
  yield: number | null
  nRecords: number
  nMissing: number
}

export interface AggRow extends Totals {
  year: number
  cropYear: string
  crop: Crop
}

export interface StateYearRow extends AggRow {
  state: string
}

export interface DistrictYearRow extends AggRow {
  state: string
  district: string
  districtCode: string
}

export interface NationalSeasonRow extends AggRow {
  season: string
}

export interface NationalYear extends Totals {
  year: number
  cropYear: string
  seasons: { season: string; area: number; production: number | null }[]
}

/** One row of national_crop_balance.csv (FAOSTAT FBS, India). */
export interface BalanceRow {
  year: number
  crop: Crop
  item: string
  element: string
  elementCode: number
  role: string
  value: number
  unit: string
  basis: string
  flag: string
  flagDescription: string
}

/** Completeness of one crop-year; mirrors crop_year_coverage.csv. */
export interface Coverage {
  absentStates: string[]
  /** share of the (understated) total that absent states produced in adjacent years */
  absentShare: number
  /** share of the year's production that comes from yield-flagged records */
  flaggedShare: number
  /** absentShare < 2% and flaggedShare < 5%: usable as a comparison baseline */
  reference: boolean
}

export interface Flow {
  name: string
  side: 'source' | 'destination'
  /** thousand tonnes */
  value: number
  share: number
}

export interface FlowResult {
  sources: Flow[]
  destinations: Flow[]
  totalSupply: number
  domesticSupply: number | null
  gap: number
  reconciled: boolean
}

export interface SourceInfo {
  id: string
  title: string
  publisher: string
  origin: string
  url: string
  via?: string
  retrieved_at?: string
  status: string
}

export interface CheckInfo {
  id: string
  label: string
  status: 'pass' | 'warn' | 'fail'
  detail: string
}

export interface Metadata {
  generated_at: string
  datasets: Record<string, { file: string; rows: number; years?: number[]; crop_years?: string[]; states?: number; districts?: number }>
  production_report: Record<string, unknown> & {
    state_series_with_gaps?: { crop: string; state: string; first: number; last: number; years_missing: number }[]
  }
  balance_report: Record<string, unknown>
  checks: CheckInfo[]
  sources: SourceInfo[]
}
