import { useMemo } from 'react'
import { useData } from '../data/DataContext'
import { pctChange } from '../data/aggregate'
import type { ProductionStore } from '../data/store'
import { CROP_COLOR } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { CoverageNotice, CropTabs, EmptyState, Gate, Metric, SelectField, SourceNote } from '../components/ui'
import { BarList } from '../components/charts/BarList'
import { LineChart } from '../components/charts/LineChart'
import { hectaresParts, tonnesParts, yieldStr } from '../lib/format'
import { useFilters } from '../state/filters'

const ALL = '__all__'
const MIN_AREA_SHARE = 0.01

export default function AreaYield() {
  const { production, retry } = useData()
  return (
    <main className="screen bg-grid">
      <PageHeader title="Area & Yield" eyebrow="Yield & productivity" />
      <div className="wrap stack">
        <Gate res={production} label="production data" onRetry={() => retry('production')} height={420}>
          {(p) => <Body p={p} />}
        </Gate>
      </div>
    </main>
  )
}

function Body({ p }: { p: ProductionStore }) {
  const { filters, setFilters } = useFilters()
  const crop = filters.crop
  const stateList = useMemo(() => p.states.filter((s) => p.stateSeries(crop, s).length > 0), [p, crop])
  const state = filters.state && stateList.includes(filters.state) ? filters.state : null

  const series = useMemo(
    () =>
      (state ? p.stateSeries(crop, state) : p.national(crop)).map((r) => ({
        year: r.year,
        area: r.area,
        production: r.production,
        yield: r.yield,
      })),
    [p, crop, state],
  )
  const years = series.map((r) => r.year)
  const start = filters.rangeStart != null && years.includes(filters.rangeStart) ? filters.rangeStart : years[0]
  let end = filters.rangeEnd != null && years.includes(filters.rangeEnd) ? filters.rangeEnd : years[years.length - 1]
  if (end != null && start != null && end <= start) end = years[years.length - 1]
  const inRange = series.filter((r) => r.year >= start && r.year <= end)
  const last = inRange[inRange.length - 1]
  const prev = inRange[inRange.length - 2]
  const base = inRange.find((r) => r.production != null && r.area > 0 && r.yield != null)

  const nat = p.nationalYear(crop, end)
  const ranking = useMemo(() => {
    if (end == null || !nat) return []
    return p
      .stateRows(crop, end)
      .filter((r) => r.yield != null && nat.area > 0 && r.area / nat.area >= MIN_AREA_SHARE)
      .sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0))
  }, [p, crop, end, nat])

  const scopeName = state ?? 'India'
  const idx = (v: number | null, b: number | null | undefined) => (v == null || b == null || b === 0 ? null : (v / b) * 100)

  return (
    <>
      <CropTabs value={crop} onChange={(c) => setFilters({ crop: c })} available={Object.fromEntries(Object.entries(p.yearsByCrop).map(([k, v]) => [k, v.length > 0]))} />
      <div className="filters filters--3">
        <SelectField
          label="State"
          value={state ?? ALL}
          options={[{ value: ALL, label: 'All India' }, ...stateList.map((s) => ({ value: s, label: s }))]}
          onChange={(v) => setFilters({ state: v === ALL ? null : v })}
        />
        <SelectField label="From" value={start} options={years.filter((y) => y < end).map((y) => ({ value: y, label: p.cropYear(y) }))} onChange={(v) => setFilters({ rangeStart: v })} />
        <SelectField label="To" value={end} options={years.filter((y) => y > start).map((y) => ({ value: y, label: p.cropYear(y) }))} onChange={(v) => setFilters({ rangeEnd: v, year: v })} />
      </div>

      <CoverageNotice p={p} crops={[crop]} years={[start, end]} />
      {!last ? (
        <EmptyState title="No records in this range" />
      ) : (
        <div className="grid-2">
          <div className="stack">
            <section className="card">
              <div className="card__head">
                <h2 className="h3">
                  {scopeName} · {p.cropYear(last.year)}
                </h2>
                <span className="mono">vs {prev ? p.cropYear(prev.year) : 'n/a'}</span>
              </div>
              <div className="metrics metrics--3">
                <Metric label="Area cultivated" value={hectaresParts(last.area).value} unit={hectaresParts(last.area).unit} delta={prev ? pctChange(prev.area, last.area) : null} />
                <Metric
                  label="Production"
                  value={tonnesParts(last.production).value}
                  unit={tonnesParts(last.production).unit}
                  delta={prev ? pctChange(prev.production, last.production) : null}
                />
                <Metric label="Yield" value={yieldStr(last.yield, false)} unit="t/ha" delta={prev ? pctChange(prev.yield, last.yield) : null} accent />
              </div>
              <p className="small muted">
                Production is total output; yield is output per hectare. A state can produce a lot because it plants a large area, a high yield, or both.
              </p>
            </section>

            <section className="card">
              <div className="card__head">
                <h2 className="h3">Production vs area</h2>
                <span className="mono">index, {base ? p.cropYear(base.year) : 'first year'} = 100</span>
              </div>
              {base ? (
                <LineChart
                  ariaLabel={`Production, area and yield of ${crop.toLowerCase()} indexed to ${p.cropYear(base.year)}`}
                  series={[
                    { id: 'prod', label: 'Production', color: CROP_COLOR[crop], points: inRange.map((r) => ({ x: r.year, y: idx(r.production, base.production) })) },
                    { id: 'area', label: 'Area', color: '#252a25', points: inRange.map((r) => ({ x: r.year, y: idx(r.area, base.area) })) },
                    { id: 'yield', label: 'Yield', color: '#b8935a', dashed: true, points: inRange.map((r) => ({ x: r.year, y: idx(r.yield, base.yield) })) },
                  ]}
                  zeroBased={false}
                  refLine={100}
                  xFormat={(x) => `'${String(x).slice(2)}`}
                  xTooltip={p.cropYear}
                  yFormat={(v) => v.toFixed(0)}
                  endLabels
                  legend
                />
              ) : (
                <EmptyState title="No base year with complete figures in this range" />
              )}
              <p className="small muted">
                Each line is divided by its own value in the first year of the range, so lines can be compared despite different units. Production index ≈ area index × yield index.
              </p>
            </section>
          </div>

          <div className="stack">
            <section className="card">
              <div className="card__head">
                <h2 className="h3">Yield trend</h2>
                <span className="mono">tonnes per hectare</span>
              </div>
              <LineChart
                ariaLabel={`${crop} yield over time for ${scopeName}`}
                series={[
                  { id: 'scope', label: scopeName, color: CROP_COLOR[crop], points: inRange.map((r) => ({ x: r.year, y: r.yield })) },
                  ...(state
                    ? [
                        {
                          id: 'india',
                          label: 'India',
                          color: '#252a25',
                          dashed: true,
                          points: p
                            .national(crop)
                            .filter((r) => r.year >= start && r.year <= end)
                            .map((r) => ({ x: r.year, y: r.yield })),
                        },
                      ]
                    : []),
                ]}
                xFormat={(x) => `'${String(x).slice(2)}`}
                xTooltip={p.cropYear}
                yFormat={(v) => v.toFixed(1)}
                yTooltip={(v) => yieldStr(v)}
              />
            </section>

            <section className="card">
              <div className="card__head">
                <h2 className="h3">State comparison · yield {p.cropYear(end)}</h2>
                <span className="mono">t/ha</span>
              </div>
              {ranking.length ? (
                <BarList
                  ariaLabel="States ranked by yield"
                  color="var(--olive)"
                  items={ranking.map((r) => ({ id: r.state, label: r.state, value: r.yield, display: yieldStr(r.yield, false) }))}
                  selected={state}
                  onSelect={(s) => setFilters({ state: s === state ? null : s })}
                />
              ) : (
                <EmptyState title="No state yields for this year" />
              )}
              <p className="small muted">
                States with less than {MIN_AREA_SHARE * 100}% of national {crop.toLowerCase()} area are left out so that very small areas do not dominate the ranking. Tap a state to focus the charts on it.
              </p>
            </section>
          </div>
        </div>
      )}

      <SourceNote source="DES district-wise crop production statistics (sum of district records)" unit="area in hectares, production in tonnes, yield in tonnes per hectare">
        Yield = production ÷ area of the records whose production is known, so area without a reported harvest never lowers the yield artificially. State and national figures add up districts across all seasons; pulses add up all pulse items. Index values divide each series by its value in the first year of the selected range.
      </SourceNote>
    </>
  )
}
