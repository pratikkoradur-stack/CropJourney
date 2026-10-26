import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { CROPS, isCrop, type Crop } from '../data/types'

/** Selections shared by every screen, preserved across navigation for the session. */
export interface Filters {
  crop: Crop
  /** production crop-year (start year); null = latest available */
  year: number | null
  /** null = All India */
  state: string | null
  rangeStart: number | null
  rangeEnd: number | null
  /** FAOSTAT year; null = latest available */
  fbsYear: number | null
  compare: Crop[]
  compareMetric: 'production' | 'yield' | 'area' | 'utilization'
  shareMode: 'share' | 'quantity'
  mapView: 'state' | 'district'
}

const DEFAULTS: Filters = {
  crop: 'Rice',
  year: null,
  state: null,
  rangeStart: null,
  rangeEnd: null,
  fbsYear: null,
  compare: [...CROPS],
  compareMetric: 'production',
  shareMode: 'share',
  mapView: 'state',
}

const KEY = 'crop-journey:filters'

function load(): Filters {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return DEFAULTS
    const f = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Filters>) }
    if (!isCrop(f.crop)) f.crop = DEFAULTS.crop
    f.compare = Array.isArray(f.compare) ? f.compare.filter(isCrop) : DEFAULTS.compare
    if (f.compare.length < 2) f.compare = DEFAULTS.compare
    return f
  } catch {
    return DEFAULTS
  }
}

interface FiltersValue {
  filters: Filters
  setFilters(patch: Partial<Filters>): void
}

const Ctx = createContext<FiltersValue | null>(null)

export function FiltersProvider({ children }: { children: ReactNode }) {
  const [filters, setState] = useState<Filters>(load)
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify(filters))
    } catch {
      /* storage unavailable (private mode): selections still work for this page view */
    }
  }, [filters])
  const setFilters = useCallback((patch: Partial<Filters>) => setState((f) => ({ ...f, ...patch })), [])
  const value = useMemo(() => ({ filters, setFilters }), [filters, setFilters])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useFilters(): FiltersValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useFilters must be used inside <FiltersProvider>')
  return ctx
}

/** Clamp a requested year to the available list (fallback: latest). */
export function resolveYear(requested: number | null, available: number[]): number | null {
  if (!available.length) return null
  if (requested != null && available.includes(requested)) return requested
  return available[available.length - 1]
}
