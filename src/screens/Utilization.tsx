import { useState } from 'react'
import { useData } from '../data/DataContext'
import { FLOW_INFO, flowStory } from '../data/balance'
import type { BalanceStore } from '../data/store'
import { CROP_COLOR, type BalanceRow } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { IconAlert, IconInfo } from '../components/Icons'
import { CropTabs, EmptyState, Gate, Metric, Segmented, SourceNote, YearStepper } from '../components/ui'
import { Sankey } from '../components/charts/Sankey'
import { DivergingBars, ShareBars } from '../components/charts/Small'
import { LineChart } from '../components/charts/LineChart'
import { ktToMt, pct } from '../lib/format'
import { navigate } from '../lib/router'
import { resolveYear, useFilters } from '../state/filters'

const TABLE_ORDER = [
  'Production',
  'Import quantity',
  'Export quantity',
  'Stock Variation',
  'Domestic supply quantity',
  'Food',
  'Feed',
  'Seed',
  'Processing',
  'Losses',
  'Other uses (non-food)',
  'Tourist consumption',
  'Residuals',
]

export default function Utilization({ tab }: { tab: 'use' | 'trade' }) {
  const { balance, retry } = useData()
  return (
    <main className="screen bg-grid">
      <PageHeader title={tab === 'trade' ? 'Trade & Stocks' : 'National Utilization'} eyebrow="National supply · FAOSTAT" />
      <div className="wrap stack">
        <Segmented
          label="View"
          variant="block"
          value={tab}
          onChange={(v) => navigate(v === 'trade' ? '#/utilization?tab=trade' : '#/utilization', { replace: true })}
          options={[
            { value: 'use', label: 'Utilization' },
            { value: 'trade', label: 'Trade & stocks' },
          ]}
        />
        <Gate res={balance} label="national crop balance" onRetry={() => retry('balance')} height={420}>
          {(b) => (tab === 'trade' ? <Trade b={b} /> : <Use b={b} />)}
        </Gate>
      </div>
    </main>
  )
}

function basisNote(basis: string, crop: string) {
  if (basis.includes('paddy'))
    return `FAOSTAT records ${crop.toLowerCase()} in paddy (unmilled) equivalent, so these tonnages are about 1.5 times the milled-rice figures used on the production screens. Shares are unaffected.`
  return null
}

function Use({ b }: { b: BalanceStore }) {
  const { filters, setFilters } = useFilters()
  const [picked, setPicked] = useState<string | null>(null)
  const crop = filters.crop
  const years = b.yearsByCrop[crop]
  const year = resolveYear(filters.fbsYear, years)
  if (year == null) return <EmptyState title={`No FAOSTAT balance for ${crop.toLowerCase()}`} />
  const el = b.elements(crop, year)
  const flows = b.flows(crop, year)
  const mode = filters.shareMode
  const perCap = el.get('Food supply quantity (kg/capita/yr)')
  const kcal = el.get('Food supply (kcal/capita/day)')
  const info = picked ? FLOW_INFO[picked] : null
  const pickedFlow = flows ? [...flows.sources, ...flows.destinations].find((f) => f.name === picked) : undefined
  const note = basisNote(b.basis(crop), crop)

  return (
    <>
      <CropTabs value={crop} onChange={(c) => setFilters({ crop: c })} available={Object.fromEntries(Object.entries(b.yearsByCrop).map(([k, v]) => [k, v.length > 0]))} />
      <div className="grid-2">
        <div className="stack">
          <section className="card">
            <div className="card__head">
              <h2 className="h2">
                Where does India&rsquo;s {crop.toLowerCase()} go? <span className="muted">({year})</span>
              </h2>
            </div>
            <div className="row row--between wrap-row">
              <YearStepper label="FAO year" years={years} value={year} onChange={(y) => setFilters({ fbsYear: y })} format={String} />
              <Segmented
                label="Values"
                size="small"
                value={mode}
                onChange={(v) => setFilters({ shareMode: v })}
                options={[
                  { value: 'share', label: '% share' },
                  { value: 'quantity', label: 'Quantity (Mt)' },
                ]}
              />
            </div>
            {!flows ? (
              <EmptyState title="Production is not reported for this year, so the balance cannot be drawn" />
            ) : flows.reconciled ? (
              <Sankey
                flows={flows}
                mode={mode}
                selected={picked}
                onSelect={setPicked}
                ariaLabel={`Flow diagram of ${crop.toLowerCase()} supply and use in ${year}`}
              />
            ) : (
              <>
                <div className="notice">
                  <IconAlert />
                  <span>
                    Sources and uses differ by {ktToMt(flows.gap)} in the source data, so a flow diagram would be misleading. The breakdown is shown as proportional bars instead.
                  </span>
                </div>
                <ShareBars
                  ariaLabel="Breakdown of supply and use"
                  rows={[
                    { label: 'Supply', segments: flows.sources.map((s) => ({ name: s.name, label: FLOW_INFO[s.name]?.label ?? s.name, share: s.share, color: FLOW_INFO[s.name]?.color ?? '#999' })) },
                    { label: 'Use', segments: flows.destinations.map((s) => ({ name: s.name, label: FLOW_INFO[s.name]?.label ?? s.name, share: s.share, color: FLOW_INFO[s.name]?.color ?? '#999' })) },
                  ]}
                />
              </>
            )}
            {info && pickedFlow && flows ? (
              <div className="notice notice--neutral" aria-live="polite">
                <IconInfo />
                <span>
                  <b>{info.label}</b>: {ktToMt(pickedFlow.value)}, {pct(pickedFlow.share)} of total supply.{' '}
                  {flowStory(crop, year, pickedFlow.name, flows, { year: years[0], flows: b.flows(crop, years[0]) })}{' '}
                  <span className="muted">{info.definition}</span>
                </span>
              </div>
            ) : (
              flows && <p className="small muted">Tap a destination to read its definition. Shares are of total supply (production + imports + stock drawdown).</p>
            )}
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <div className="metrics metrics--3">
              <Metric label="Domestic supply" value={ktToMt(el.get('Domestic supply quantity')?.value)} />
              <Metric label="Food supply / person" value={perCap ? perCap.value.toFixed(1) : '—'} unit="kg per year" />
              <Metric label="Energy / person" value={kcal ? kcal.value.toFixed(0) : '—'} unit="kcal per day" />
            </div>
            <p className="small muted">
              Food supply is the quantity available for human consumption. It is an estimate, not a measurement of what people actually eat; actual intake can be lower because of waste in households.
            </p>
          </section>
          {note && (
            <div className="notice">
              <IconAlert />
              <span>{note}</span>
            </div>
          )}
          <BalanceTable el={el} />
        </div>
      </div>
      <SourceNote source={`FAOSTAT Food Balances (2010-), India, item "${[...el.values()][0]?.item ?? crop}"`} unit="thousand tonnes, shown as million tonnes (Mt)">
        Domestic supply = production + imports − exports − stock variation (a positive stock variation means stocks were built up); domestic supply also equals the sum of food, feed, seed, processing, losses, other uses and the residual. The diagram uses exactly these reported elements, so both sides balance. FAOSTAT years are calendar reference years and do not line up one-to-one with Indian July–June crop years. Elements FAOSTAT does not report for a year are left out, not set to zero.
      </SourceNote>
    </>
  )
}

function BalanceTable({ el }: { el: Map<string, BalanceRow> }) {
  const rows = TABLE_ORDER.map((e) => el.get(e)).filter((r): r is BalanceRow => r != null)
  return (
    <section className="card">
      <h2 className="h3">Balance sheet</h2>
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Element</th>
            <th scope="col" className="num">
              Mt
            </th>
            <th scope="col">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.element} className={r.element === 'Domestic supply quantity' ? 'is-total' : ''}>
              <td>{r.element === 'Stock Variation' ? 'Stock variation (+ build-up)' : r.element.replace(' quantity', '')}</td>
              <td className="num">{ktToMt(r.value).replace(' Mt', '')}</td>
              <td>
                <span className="tag" title={r.flagDescription}>
                  {r.flag || '—'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="small muted">Status flags from FAOSTAT: E = estimated value, I = imputed by a receiving agency, X = figure from an external organisation.</p>
    </section>
  )
}

function Trade({ b }: { b: BalanceStore }) {
  const { filters, setFilters } = useFilters()
  const crop = filters.crop
  const exp = b.series(crop, 'Export quantity')
  const imp = b.series(crop, 'Import quantity')
  const prod = b.series(crop, 'Production')
  const sv = b.series(crop, 'Stock Variation')
  const ratio = exp.map((e) => {
    const p = prod.find((x) => x.year === e.year)?.value
    return { x: e.year, y: p ? (e.value / p) * 100 : null }
  })
  const note = basisNote(b.basis(crop), crop)
  return (
    <>
      <CropTabs value={crop} onChange={(c) => setFilters({ crop: c })} />
      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2 className="h3">Exports and imports</h2>
            <span className="mono">million tonnes</span>
          </div>
          {exp.length || imp.length ? (
            <LineChart
              ariaLabel={`${crop} exports and imports by year`}
              series={[
                { id: 'exp', label: 'Exports', color: '#252a25', points: exp.map((d) => ({ x: d.year, y: d.value / 1000 })) },
                { id: 'imp', label: 'Imports', color: CROP_COLOR[crop], points: imp.map((d) => ({ x: d.year, y: d.value / 1000 })) },
              ]}
              xFormat={String}
              yFormat={(v) => (v >= 10 ? v.toFixed(0) : v.toFixed(1))}
              yTooltip={(v) => ktToMt(v * 1000)}
              endLabels
            />
          ) : (
            <EmptyState title="No trade quantities reported" />
          )}
        </section>
        <section className="card">
          <div className="card__head">
            <h2 className="h3">Stock variation</h2>
            <span className="mono">million tonnes</span>
          </div>
          {sv.length ? (
            <DivergingBars
              ariaLabel={`${crop} stock variation by year`}
              points={sv.map((d) => ({ x: d.year, y: d.value / 1000 }))}
              format={(v) => v.toFixed(1)}
              xFormat={String}
              posColor="#b8935a"
              negColor="#93a68b"
              unit="Mt"
            />
          ) : (
            <EmptyState title="No stock variation reported" />
          )}
          <p className="small muted">Above zero: stocks built up during the year. Below zero: stocks drawn down.</p>
        </section>
        <section className="card">
          <div className="card__head">
            <h2 className="h3">Exports relative to production</h2>
            <span className="mono">% of production</span>
          </div>
          <LineChart
            ariaLabel={`${crop} exports as a percentage of production`}
            series={[{ id: 'r', label: 'Exports ÷ production', color: CROP_COLOR[crop], points: ratio }]}
            xFormat={String}
            yFormat={(v) => `${v.toFixed(0)}%`}
            yTooltip={(v) => `${v.toFixed(1)}%`}
            legend={false}
          />
        </section>
        {note && (
          <div className="notice">
            <IconAlert />
            <span>{note}</span>
          </div>
        )}
      </div>
      <SourceNote source="FAOSTAT Food Balances (2010-), India" unit="thousand tonnes, shown as million tonnes">
        Exports and imports cover the commodity and its products converted to the primary equivalent. Stock variation is reported by FAOSTAT; a positive value means stocks increased. Ratios use production and exports from the same balance, so they share one commodity basis.
      </SourceNote>
    </>
  )
}
