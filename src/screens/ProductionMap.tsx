import { useEffect, useMemo, useState } from 'react'
import { useData, type StatesGeo } from '../data/DataContext'
import type { DistrictStore, ProductionStore } from '../data/store'
import { CROPS, CROP_COLOR, type Crop } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { CropGlyph, IconArrowRight, IconSearch } from '../components/Icons'
import { CoverageNotice, EmptyState, Gate, Metric, Segmented, SelectField, SourceNote, YearStepper } from '../components/ui'
import { BarList } from '../components/charts/BarList'
import { IndiaMap, MapLegend, niceClasses, TERRA_RAMP } from '../components/charts/IndiaMap'
import { LineChart } from '../components/charts/LineChart'
import { hectares, pct, tonnes, tonnesParts, yieldStr } from '../lib/format'
import { navigate } from '../lib/router'
import { resolveYear, useFilters } from '../state/filters'

export default function ProductionMap() {
  const { production, retry } = useData()
  const { filters, setFilters } = useFilters()
  return (
    <main className="screen bg-grid">
      <PageHeader title="Production Map" eyebrow="Production landscape" />
      <div className="wrap stack">
        <Segmented
          label="Map level"
          variant="block"
          value={filters.mapView}
          onChange={(v) => setFilters({ mapView: v })}
          options={[
            { value: 'state', label: 'State view' },
            { value: 'district', label: 'District view' },
          ]}
        />
        <Gate res={production} label="production data" onRetry={() => retry('production')} height={420}>
          {(p) => <Body p={p} />}
        </Gate>
      </div>
    </main>
  )
}

function Body({ p }: { p: ProductionStore }) {
  const { map, districts, ensureDistricts, retry } = useData()
  const { filters, setFilters } = useFilters()
  const crop = filters.crop
  const years = p.yearsByCrop[crop]
  const year = resolveYear(filters.year, years)
  const [showAll, setShowAll] = useState(false)

  const rows = useMemo(() => (year == null ? [] : p.stateRows(crop, year)), [p, crop, year])
  const known = rows.filter((r) => r.production != null)
  const total = known.reduce((a, r) => a + (r.production ?? 0), 0)
  const values = useMemo(() => new Map(rows.map((r) => [r.state, r.production == null ? null : r.production / 1e6])), [rows])
  const classes = useMemo(() => niceClasses([...values.values()].filter((v): v is number => v != null), TERRA_RAMP), [values])
  const selected = filters.state
  const selRow = rows.find((r) => r.state === selected)
  const district = filters.mapView === 'district'

  useEffect(() => {
    if (district) ensureDistricts()
  }, [district, ensureDistricts])

  if (year == null) return <EmptyState title={`No ${crop.toLowerCase()} records are loaded`} />

  const select = (state: string) => setFilters({ state: state === selected ? null : state })
  const nat = p.national(crop)
  const stateSeries = selected ? p.stateSeries(crop, selected) : []

  return (
    <div className="grid-2 grid-2--wide-left">
      <section className="card map-card" aria-label="Production map">
        <div className="map-card__body">
          <div className="map-card__map">
            <Gate res={map} label="map" onRetry={() => retry('map')} height={300}>
              {(geo: StatesGeo) => (
                <IndiaMap
                  geo={geo}
                  values={values}
                  classes={classes}
                  selected={selected}
                  focus={district ? selected : null}
                  onSelect={select}
                  ariaLabel={`Choropleth of ${crop.toLowerCase()} production by state, ${p.cropYear(year)}`}
                  label={(s, v) => `${s}: ${v == null ? 'no record' : `${tonnesParts(v * 1e6).value} ${tonnesParts(v * 1e6).unit}`}`}
                />
              )}
            </Gate>
          </div>
          <div className="crop-radio" role="radiogroup" aria-label="Crop">
            {CROPS.map((c: Crop) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={c === crop}
                className="crop-radio__btn"
                disabled={!p.yearsByCrop[c].length}
                onClick={() => setFilters({ crop: c })}
              >
                <CropGlyph crop={c} width={20} height={20} />
                <span>{c}</span>
                <span className="crop-radio__dot" style={{ background: c === crop ? 'var(--terracotta)' : 'transparent' }} />
              </button>
            ))}
          </div>
        </div>
        <MapLegend classes={classes} unit="million tonnes" title="Production" />
        <YearStepper label="Crop year" years={years} value={year} onChange={(y) => setFilters({ year: y })} format={p.cropYear} />
        <CoverageNotice p={p} crops={[crop]} years={[year]} />
      </section>

      <div className="stack">
        {!district && (
          <>
            {selected ? (
              selRow ? (
                <section className="card state-card" aria-live="polite">
                  <div className="card__head">
                    <div>
                      <span className="eyebrow">
                        Rank {rows.indexOf(selRow) + 1} of {known.length} · {p.cropYear(year)}
                      </span>
                      <h2 className="h2">{selRow.state}</h2>
                    </div>
                    <button type="button" className="link-btn" onClick={() => setFilters({ state: null })}>
                      Clear
                    </button>
                  </div>
                  <div className="metrics">
                    <Metric label="Production" value={tonnesParts(selRow.production).value} unit={tonnesParts(selRow.production).unit} accent />
                    <Metric label="Share of total" value={pct(total ? (selRow.production ?? 0) / total : null)} />
                    <Metric label="Area" value={hectares(selRow.area)} />
                    <Metric label="Yield" value={yieldStr(selRow.yield)} />
                  </div>
                  {selRow.nMissing > 0 && (
                    <p className="small muted">
                      {selRow.nMissing} district record(s) have no production figure; their area is excluded from the yield.
                    </p>
                  )}
                  <div className="row">
                    <button type="button" className="btn btn--small" onClick={() => setFilters({ mapView: 'district' })}>
                      District table
                    </button>
                    <button type="button" className="btn btn--small btn--primary" onClick={() => navigate('#/area-yield')}>
                      Area &amp; yield <IconArrowRight width={16} height={16} />
                    </button>
                  </div>
                </section>
              ) : (
                <EmptyState title={`No ${crop.toLowerCase()} record for ${selected} in ${p.cropYear(year)}`}>
                  The source has no district records for this state, crop and year. Nothing has been estimated.{' '}
                  <button type="button" className="link-btn" onClick={() => setFilters({ state: null })}>
                    Clear selection
                  </button>
                </EmptyState>
              )
            ) : (
              <p className="notice notice--neutral small">Tap a state on the map or in the list to see its figures.</p>
            )}

            <section className="card">
              <div className="card__head">
                <h2 className="h3">
                  Top states · {crop} ({p.cropYear(year)})
                </h2>
                <span className="mono">{tonnes(total)} total</span>
              </div>
              <BarList
                ariaLabel={`States ranked by ${crop.toLowerCase()} production`}
                items={(showAll ? known : known.slice(0, 5)).map((r) => ({
                  id: r.state,
                  label: r.state,
                  value: r.production,
                  display: tonnesParts(r.production).value + ' ' + tonnesParts(r.production).unit.replace('thousand t', 'kt'),
                }))}
                selected={selected}
                onSelect={select}
              />
              {known.length > 5 && (
                <button type="button" className="link-btn" onClick={() => setShowAll((s) => !s)}>
                  {showAll ? 'Show top 5' : `Show all ${known.length} states`}
                </button>
              )}
            </section>
          </>
        )}

        {district && <DistrictPanel p={p} crop={crop} year={year} rows={rows.map((r) => r.state)} districts={districts} onRetry={() => retry('districts')} />}

        <section className="card">
          <div className="card__head">
            <h2 className="h3">Historical production</h2>
            <span className="mono">tap a year to select it</span>
          </div>
          <LineChart
            ariaLabel={`${crop} production over time`}
            unitLabel="million tonnes"
            series={[
              { id: 'india', label: 'India (all districts)', color: '#252a25', points: nat.map((n) => ({ x: n.year, y: n.production == null ? null : n.production / 1e6 })) },
              ...(selected && stateSeries.length
                ? [{ id: 'state', label: selected, color: CROP_COLOR[crop], points: stateSeries.map((r) => ({ x: r.year, y: r.production == null ? null : r.production / 1e6 })) }]
                : []),
            ]}
            xFormat={(x) => `'${String(x).slice(2)}`}
            xTooltip={p.cropYear}
            yFormat={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
            yTooltip={(v) => tonnes(v * 1e6)}
            markX={year}
            onSelectX={(x) => setFilters({ year: x })}
          />
        </section>

        <SourceNote source="DES district-wise crop production statistics (Area, Production & Yield), via India Data Portal mirror" unit="tonnes; shown as million tonnes (Mt) or thousand tonnes">
          State figures are the sum of all district records for the crop across seasons; pulses add up every pulse item (tur, gram, urad, moong, masoor and others). Records with unknown production are left out of production totals, not counted as zero. District sums can differ from DES&rsquo;s separately published all-India estimates. Crop years run July to June.
        </SourceNote>
      </div>
    </div>
  )
}

function DistrictPanel({
  p,
  crop,
  year,
  rows,
  districts,
  onRetry,
}: {
  p: ProductionStore
  crop: Crop
  year: number
  rows: string[]
  districts: ReturnType<typeof useData>['districts']
  onRetry(): void
}) {
  const { filters, setFilters } = useFilters()
  const [q, setQ] = useState('')
  const state = filters.state && rows.includes(filters.state) ? filters.state : rows[0]
  return (
    <section className="card" aria-label="District table">
      <div className="stack">
        <SelectField label="State" value={state ?? ''} options={rows.map((s) => ({ value: s, label: s }))} onChange={(s) => setFilters({ state: s })} />
        <Gate res={districts} label="district records" onRetry={onRetry} height={240}>
          {(d: DistrictStore) => {
            const list = state ? d.rows(crop, year, state) : []
            const shown = list.filter((r) => r.district.toLowerCase().includes(q.trim().toLowerCase()))
            const total = list.reduce((a, r) => a + (r.production ?? 0), 0)
            if (!list.length) return <EmptyState title={`No district records for ${state} in ${p.cropYear(year)}`} />
            return (
              <>
                <div className="field">
                  <label className="field__label" htmlFor="district-search">
                    Search {list.length} districts
                  </label>
                  <div className="field__control">
                    <input id="district-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="District name" autoComplete="off" />
                    <IconSearch className="field__chevron" />
                  </div>
                </div>
                {shown.length ? (
                  <BarList
                    ariaLabel={`Districts of ${state} ranked by ${crop.toLowerCase()} production`}
                    color="var(--olive)"
                    items={shown.map((r) => ({
                      id: r.districtCode + r.district,
                      label: r.district,
                      sub: `${hectares(r.area)} · ${yieldStr(r.yield)}${r.nMissing ? ' · incomplete' : ''}`,
                      value: r.production,
                      display: r.production == null ? 'unknown' : `${pct(total ? r.production / total : null)}`,
                    }))}
                  />
                ) : (
                  <p className="small muted">No district matches &ldquo;{q}&rdquo;.</p>
                )}
                <p className="small muted">
                  Bars show each district&rsquo;s production; the figure is its share of the state total ({tonnes(total)}). District boundaries change over time, so districts are listed rather than mapped.
                </p>
              </>
            )
          }}
        </Gate>
      </div>
    </section>
  )
}
