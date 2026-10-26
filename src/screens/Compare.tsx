import { useState } from 'react'
import { useData } from '../data/DataContext'
import { pctChange } from '../data/aggregate'
import { FLOW_INFO } from '../data/balance'
import type { BalanceStore, ProductionStore } from '../data/store'
import { CROPS, CROP_COLOR, type Crop } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { CropGlyph, IconAlert, IconCheck } from '../components/Icons'
import { CoverageNotice, EmptyState, Gate, Segmented, SourceNote, YearStepper } from '../components/ui'
import { LineChart } from '../components/charts/LineChart'
import { Donut, ShareBars } from '../components/charts/Small'
import { hectares, pct, signedPct, tonnes, yieldStr } from '../lib/format'
import { resolveYear, useFilters, type Filters } from '../state/filters'

export default function Compare() {
  const { production, retry } = useData()
  return (
    <main className="screen bg-grid">
      <PageHeader title="Crop Comparison" eyebrow="Side by side" />
      <div className="wrap stack">
        <Gate res={production} label="production data" onRetry={() => retry('production')} height={420}>
          {(p) => <Body p={p} />}
        </Gate>
      </div>
    </main>
  )
}

function Body({ p }: { p: ProductionStore }) {
  const { balance, retry } = useData()
  const { filters, setFilters } = useFilters()
  const [hint, setHint] = useState(false)
  const chosen = CROPS.filter((c) => filters.compare.includes(c))
  const metric = filters.compareMetric

  const toggle = (c: Crop) => {
    if (chosen.includes(c)) {
      if (chosen.length <= 2) {
        setHint(true)
        return
      }
      setFilters({ compare: chosen.filter((x) => x !== c) })
    } else setFilters({ compare: [...chosen, c] })
    setHint(false)
  }

  return (
    <>
      <div className="chip-row" role="group" aria-label="Crops to compare">
        {CROPS.map((c) => {
          const on = chosen.includes(c)
          return (
            <button key={c} type="button" className={`chip ${on ? 'is-on' : ''}`} aria-pressed={on} aria-disabled={on && chosen.length <= 2} onClick={() => toggle(c)}>
              <span className="chip__swatch" style={{ background: on ? CROP_COLOR[c] : 'transparent', borderColor: CROP_COLOR[c] }}>
                {on && <IconCheck width={12} height={12} color="#fff" strokeWidth={2.4} />}
              </span>
              <CropGlyph crop={c} width={16} height={16} />
              {c}
            </button>
          )
        })}
      </div>
      {hint && <p className="small muted" role="status">Keep at least two crops selected to compare.</p>}

      <Segmented<Filters['compareMetric']>
        label="Measure"
        value={metric}
        onChange={(v) => setFilters({ compareMetric: v })}
        options={[
          { value: 'production', label: 'Production' },
          { value: 'yield', label: 'Yield' },
          { value: 'area', label: 'Area' },
          { value: 'utilization', label: 'Utilization' },
        ]}
      />

      {metric === 'utilization' ? (
        <Gate res={balance} label="national crop balance" onRetry={() => retry('balance')} height={300}>
          {(b) => <UtilizationCompare b={b} crops={chosen} />}
        </Gate>
      ) : (
        <ProductionCompare p={p} crops={chosen} metric={metric} />
      )}
    </>
  )
}

const METRIC = {
  production: { title: 'Production trend', unit: 'million tonnes', get: (n: { production: number | null }) => (n.production == null ? null : n.production / 1e6) },
  yield: { title: 'Yield trend', unit: 'tonnes per hectare', get: (n: { yield: number | null }) => n.yield },
  area: { title: 'Area cultivated', unit: 'million hectares', get: (n: { area: number }) => n.area / 1e6 },
} as const

function ProductionCompare({ p, crops, metric }: { p: ProductionStore; crops: Crop[]; metric: 'production' | 'yield' | 'area' }) {
  const { filters, setFilters } = useFilters()
  const m = METRIC[metric]
  const years = p.years.filter((y) => crops.every((c) => p.nationalYear(c, y)))
  const year = resolveYear(filters.year, years)
  if (year == null) return <EmptyState title="The selected crops share no common years" />
  // Change since a baseline only uses a year whose records are complete for every selected crop.
  const first = p.referenceYears(crops).find((y) => years.includes(y)) ?? years[0]
  const rows = crops.map((c) => {
    const n = p.nationalYear(c, year)!
    const n0 = p.nationalYear(c, first)!
    const top = p.stateRows(c, year).slice(0, 3)
    return { c, n, n0, top }
  })
  const total = rows.reduce((a, r) => a + (r.n.production ?? 0), 0)

  return (
    <div className="grid-2">
      <div className="grid-2__full">
        <CoverageNotice p={p} crops={crops} years={[year]} />
      </div>
      <section className="card">
        <div className="card__head">
          <h2 className="h3">{m.title}</h2>
          <span className="mono">{m.unit}</span>
        </div>
        <LineChart
          ariaLabel={`${m.title} for ${crops.join(', ')}`}
          series={crops.map((c) => ({
            id: c,
            label: c,
            color: CROP_COLOR[c],
            points: p.national(c).filter((n) => years.includes(n.year)).map((n) => ({ x: n.year, y: m.get(n) })),
          }))}
          xFormat={(x) => `'${String(x).slice(2)}`}
          xTooltip={p.cropYear}
          yFormat={(v) => (metric === 'yield' ? v.toFixed(1) : v >= 10 ? v.toFixed(0) : v.toFixed(1))}
          yTooltip={(v) => (metric === 'yield' ? yieldStr(v) : metric === 'area' ? hectares(v * 1e6) : tonnes(v * 1e6))}
          markX={year}
          onSelectX={(x) => setFilters({ year: x })}
          endLabels
        />
        <p className="small muted">
          All series come from the same district records and definitions ({p.cropYear(years[0])} to {p.cropYear(years.at(-1)!)}). Tap the chart to choose a year. Changes are measured from {p.cropYear(first)}, the first year with complete records for every selected crop.
        </p>
      </section>

      <div className="stack">
        <section className="card">
          <YearStepper label="Crop year" years={years} value={year} onChange={(y) => setFilters({ year: y })} format={p.cropYear} />
          {metric === 'production' && total > 0 && (
            <div className="donut-row">
              <Donut
                ariaLabel={`Share of production among selected crops, ${p.cropYear(year)}`}
                data={rows.map((r) => ({ label: r.c, value: r.n.production ?? 0, color: CROP_COLOR[r.c] }))}
                center={(total / 1e6).toFixed(1)}
                centerSub="Mt combined"
              />
              <ul className="donut-legend">
                {rows.map((r) => (
                  <li key={r.c}>
                    <span className="swatch" style={{ background: CROP_COLOR[r.c] }} />
                    {r.c}
                    <b className="num">{pct((r.n.production ?? 0) / total)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Crop</th>
                <th scope="col" className="num">
                  {p.cropYear(year)}
                </th>
                <th scope="col" className="num">
                  vs {p.cropYear(first)}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const v = m.get(r.n)
                const v0 = m.get(r.n0)
                return (
                  <tr key={r.c}>
                    <td>
                      <span className="swatch" style={{ background: CROP_COLOR[r.c] }} /> {r.c}
                    </td>
                    <td className="num">{metric === 'yield' ? yieldStr(v) : metric === 'area' ? hectares(r.n.area) : tonnes(r.n.production)}</td>
                    <td className="num">{signedPct(pctChange(v0, v))}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {metric === 'production' && <p className="small muted">Shares are of the combined production of the selected crops only, not of all food grains.</p>}
        </section>

        <section className="card">
          <h2 className="h3">Leading producing states · {p.cropYear(year)}</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Crop</th>
                <th scope="col">1st</th>
                <th scope="col">2nd</th>
                <th scope="col">3rd</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.c}>
                  <td>{r.c}</td>
                  {[0, 1, 2].map((i) => (
                    <td key={i} className="small">
                      {r.top[i]?.state ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <SourceNote source="DES district-wise crop production statistics (sum of district records)" unit="tonnes, hectares, tonnes per hectare">
        Each crop&rsquo;s national figure is the sum of its district records across seasons; pulses add up every pulse item. Only years in which every selected crop has records are shown, so the time period is the same for all series.
      </SourceNote>
    </div>
  )
}

function UtilizationCompare({ b, crops }: { b: BalanceStore; crops: Crop[] }) {
  const { filters, setFilters } = useFilters()
  const years = b.years.filter((y) => crops.every((c) => b.yearsByCrop[c].includes(y)))
  const year = resolveYear(filters.fbsYear, years)
  if (year == null) return <EmptyState title="The selected crops share no FAOSTAT years" />
  const rows = crops
    .map((c) => ({ c, f: b.flows(c, year) }))
    .filter((r) => r.f && r.f.reconciled)
    .map((r) => ({
      label: r.c,
      note: `${b.basis(r.c)}`,
      segments: r.f!.destinations.map((d) => ({ name: d.name, label: FLOW_INFO[d.name]?.label ?? d.name, share: d.share, color: FLOW_INFO[d.name]?.color ?? '#999' })),
    }))
  const names = [...new Set(rows.flatMap((r) => r.segments.map((s) => s.name)))]
  return (
    <div className="grid-2">
      <section className="card">
        <div className="card__head">
          <h2 className="h3">Where supply goes · {year}</h2>
          <span className="mono">% of total supply</span>
        </div>
        <YearStepper label="FAO year" years={years} value={year} onChange={(y) => setFilters({ fbsYear: y })} format={String} />
        <ShareBars rows={rows} ariaLabel={`Utilization shares by crop, ${year}`} />
        <ul className="legend">
          {names.map((n) => (
            <li key={n}>
              <span className="legend__mark" style={{ background: FLOW_INFO[n]?.color, borderColor: FLOW_INFO[n]?.color }} />
              {FLOW_INFO[n]?.label ?? n}
            </li>
          ))}
        </ul>
      </section>
      <div className="stack">
        <div className="notice">
          <IconAlert />
          <span>
            Quantity comparison is turned off here: FAOSTAT records rice in paddy equivalent and the other crops in grain equivalent, so their tonnages are not on the same basis. Percentage shares within each crop&rsquo;s own balance are comparable.
          </span>
        </div>
        <section className="card">
          <h2 className="h3">Food and feed shares of domestic supply</h2>
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Crop</th>
                <th scope="col" className="num">
                  Food
                </th>
                <th scope="col" className="num">
                  Feed
                </th>
                <th scope="col" className="num">
                  Other
                </th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => {
                const el = b.elements(c, year)
                const ds = el.get('Domestic supply quantity')?.value
                const food = el.get('Food')?.value
                const feed = el.get('Feed')?.value
                return (
                  <tr key={c}>
                    <td>{c}</td>
                    <td className="num">{ds && food != null ? pct(food / ds) : '—'}</td>
                    <td className="num">{ds && feed != null ? pct(feed / ds) : '—'}</td>
                    <td className="num">{ds && food != null ? pct((ds - food - (feed ?? 0)) / ds) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="small muted">Other = seed, processing, losses, non-food uses and the statistical residual.</p>
        </section>
      </div>
      <SourceNote source="FAOSTAT Food Balances (2010-), India" unit="percentage shares">
        Bars use the same decomposition as the utilization flow diagram: every destination (exports, stock build-up, food, feed, seed, processing, losses, other uses, residual) divided by total supply. The table divides food and feed by domestic supply instead, as stated in its heading.
      </SourceNote>
    </div>
  )
}
