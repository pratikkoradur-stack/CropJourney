import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { feature } from 'topojson-client'
import type { FeatureCollection, Geometry } from 'geojson'
import type { Topology } from 'topojson-specification'
import stateYearUrl from '../../data/prepared/crop_production_state_year.csv?url'
import nationalSeasonUrl from '../../data/prepared/crop_production_national_season_year.csv?url'
import districtYearUrl from '../../data/prepared/crop_production_district_year.csv?url'
import balanceUrl from '../../data/prepared/national_crop_balance.csv?url'
import metadataUrl from '../../data/prepared/metadata.json?url'
import mapUrl from '../../data/reference/india_states.topo.json?url'
import { aggregateProduction } from './aggregate'
import {
  detectKind,
  parseBalance,
  parseBalanceImport,
  parseDistrictYear,
  parseNationalSeason,
  parseProductionImport,
  parseStateYear,
  SchemaError,
  type ImportReport,
} from './parse'
import {
  buildBalanceStore,
  buildDistrictStore,
  buildProductionStore,
  type BalanceStore,
  type DistrictStore,
  type ProductionStore,
} from './store'
import type { Metadata } from './types'

export type Status = 'idle' | 'loading' | 'ready' | 'error'
export interface Resource<T> {
  status: Status
  data?: T
  error?: string
}
export type StatesGeo = FeatureCollection<Geometry, { state: string }>
export type Origin = { kind: 'bundled' } | { kind: 'imported'; fileName: string; importedAt: string }

interface DataValue {
  production: Resource<ProductionStore>
  balance: Resource<BalanceStore>
  districts: Resource<DistrictStore>
  meta: Resource<Metadata>
  map: Resource<StatesGeo>
  origin: { production: Origin; balance: Origin }
  retry(key: 'production' | 'balance' | 'districts' | 'meta' | 'map'): void
  ensureDistricts(): void
  importFile(file: File): Promise<ImportReport>
  resetImports(): void
}

const DataContext = createContext<DataValue | null>(null)

async function fetchText(url: string, label: string): Promise<string> {
  let res: Response
  try {
    res = await fetch(url)
  } catch {
    throw new Error(`Could not load ${label}: the network request failed. Check your connection and retry.`)
  }
  if (!res.ok) throw new Error(`Could not load ${label}: the server answered ${res.status} ${res.statusText}.`)
  return res.text()
}

const message = (e: unknown) => (e instanceof SchemaError || e instanceof Error ? e.message : String(e))

export function DataProvider({ children }: { children: ReactNode }) {
  const [production, setProduction] = useState<Resource<ProductionStore>>({ status: 'idle' })
  const [balance, setBalance] = useState<Resource<BalanceStore>>({ status: 'idle' })
  const [districts, setDistricts] = useState<Resource<DistrictStore>>({ status: 'idle' })
  const [meta, setMeta] = useState<Resource<Metadata>>({ status: 'idle' })
  const [map, setMap] = useState<Resource<StatesGeo>>({ status: 'idle' })
  const [origin, setOrigin] = useState<DataValue['origin']>({ production: { kind: 'bundled' }, balance: { kind: 'bundled' } })
  const districtsRequested = useRef(false)

  const loadProduction = useCallback(async () => {
    setProduction({ status: 'loading' })
    try {
      const [a, b] = await Promise.all([
        fetchText(stateYearUrl, 'state production data'),
        fetchText(nationalSeasonUrl, 'national production data'),
      ])
      const store = buildProductionStore(parseStateYear(a), parseNationalSeason(b))
      if (!store.years.length) throw new Error('The production dataset contains no usable rows.')
      setProduction({ status: 'ready', data: store })
    } catch (e) {
      setProduction({ status: 'error', error: message(e) })
    }
  }, [])

  const loadBalance = useCallback(async () => {
    setBalance({ status: 'loading' })
    try {
      const store = buildBalanceStore(parseBalance(await fetchText(balanceUrl, 'the national crop balance')))
      if (!store.years.length) throw new Error('The national crop balance contains no usable rows.')
      setBalance({ status: 'ready', data: store })
    } catch (e) {
      setBalance({ status: 'error', error: message(e) })
    }
  }, [])

  const loadDistricts = useCallback(async () => {
    setDistricts({ status: 'loading' })
    try {
      const rows = parseDistrictYear(await fetchText(districtYearUrl, 'district production data'))
      setDistricts({ status: 'ready', data: buildDistrictStore(rows) })
    } catch (e) {
      setDistricts({ status: 'error', error: message(e) })
    }
  }, [])

  const loadMeta = useCallback(async () => {
    setMeta({ status: 'loading' })
    try {
      setMeta({ status: 'ready', data: JSON.parse(await fetchText(metadataUrl, 'dataset metadata')) as Metadata })
    } catch (e) {
      setMeta({ status: 'error', error: message(e) })
    }
  }, [])

  const loadMap = useCallback(async () => {
    setMap({ status: 'loading' })
    try {
      const topo = JSON.parse(await fetchText(mapUrl, 'the India state boundaries')) as Topology
      const fc = feature(topo, topo.objects.states) as unknown as StatesGeo
      setMap({ status: 'ready', data: fc })
    } catch (e) {
      setMap({ status: 'error', error: message(e) })
    }
  }, [])

  useEffect(() => {
    void loadProduction()
    void loadBalance()
    void loadMeta()
    void loadMap()
  }, [loadProduction, loadBalance, loadMeta, loadMap])

  const ensureDistricts = useCallback(() => {
    if (districtsRequested.current) return
    districtsRequested.current = true
    void loadDistricts()
  }, [loadDistricts])

  const retry = useCallback<DataValue['retry']>(
    (key) => {
      if (key === 'production') void loadProduction()
      if (key === 'balance') void loadBalance()
      if (key === 'districts') void loadDistricts()
      if (key === 'meta') void loadMeta()
      if (key === 'map') void loadMap()
    },
    [loadProduction, loadBalance, loadDistricts, loadMeta, loadMap],
  )

  const importFile = useCallback(async (file: File): Promise<ImportReport> => {
    const text = await file.text()
    const kind = detectKind(text)
    if (!kind)
      throw new SchemaError(
        'Unrecognised file. Import either crop_production.csv (district-level production) or national_crop_balance.csv (FAOSTAT balance) as prepared by scripts/prepare_data.py.',
      )
    const stamp = new Date().toISOString()
    if (kind === 'production') {
      const { records, report } = parseProductionImport(text, file.name)
      if (!records.length) throw new SchemaError(`${file.name} has the right columns but no usable rows. Nothing was replaced.`)
      const { stateYear, districtYear, nationalSeason } = aggregateProduction(records)
      setProduction({ status: 'ready', data: buildProductionStore(stateYear, nationalSeason) })
      setDistricts({ status: 'ready', data: buildDistrictStore(districtYear) })
      districtsRequested.current = true
      setOrigin((o) => ({ ...o, production: { kind: 'imported', fileName: file.name, importedAt: stamp } }))
      return report
    }
    const { rows, report } = parseBalanceImport(text, file.name)
    if (!rows.length) throw new SchemaError(`${file.name} has the right columns but no usable rows. Nothing was replaced.`)
    setBalance({ status: 'ready', data: buildBalanceStore(rows) })
    setOrigin((o) => ({ ...o, balance: { kind: 'imported', fileName: file.name, importedAt: stamp } }))
    return report
  }, [])

  const resetImports = useCallback(() => {
    setOrigin({ production: { kind: 'bundled' }, balance: { kind: 'bundled' } })
    districtsRequested.current = false
    setDistricts({ status: 'idle' })
    void loadProduction()
    void loadBalance()
  }, [loadProduction, loadBalance])

  const value = useMemo<DataValue>(
    () => ({ production, balance, districts, meta, map, origin, retry, ensureDistricts, importFile, resetImports }),
    [production, balance, districts, meta, map, origin, retry, ensureDistricts, importFile, resetImports],
  )
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used inside <DataProvider>')
  return ctx
}
