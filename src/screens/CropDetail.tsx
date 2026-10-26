import { useMemo } from 'react'
import { useData, type StatesGeo } from '../data/DataContext'
import { pctChange } from '../data/aggregate'
import { FLOW_INFO } from '../data/balance'
import type { ProductionStore } from '../data/store'
import { CROP_COLOR, isCrop, type Crop } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { IconArrowRight } from '../components/Icons'
import { CoverageNotice, EmptyState, Gate, Metric, Segmented, SourceNote, YearStepper } from '../components/ui'
import { BarList } from '../components/charts/BarList'
import { IndiaMap, MapLegend, niceClasses, OLIVE_RAMP } from '../components/charts/IndiaMap'
import { LineChart } from '../components/charts/LineChart'
import { ShareBars } from '../components/charts/Small'
import { CROP_SCENE, Scene } from '../illustrations/Scenes'
import { hectares, pct, tonnes, tonnesParts, yieldStr } from '../lib/format'
import { navigate } from '../lib/router'
import { resolveYear, useFilters } from '../state/filters'

type Tab = 'overview' | 'production' | 'yield' | 'utilization'
const TABS: Tab[] = ['overview', 'production', 'yield', 'utilization']

export default function CropDetail({ param, tab }: { param: string | null; tab: string | null }) {
  const name = param ? param.charAt(0).toUpperCase() + param.slice(1).toLowerCase() : ''
  const crop: Crop | null = isCrop(name) ? name : null
  const { production, retry } = useData()
  const active: Tab = TABS.includes(tab as Tab) ? (tab as Tab) : 'overview'
  if (!crop)
    return (
      <main className="screen">
        <PageHeader title="Crop" />
        <div className="wrap">
          <EmptyState title="Unknown crop">Crop Journey covers rice, wheat, maize and pulses.</EmptyState>
        </div>
      </main>
    )
  return (
    <main className="screen">
      <PageHeader title={crop} eyebrow="Crop profile" />
      <div className="crop-hero">
        <Scene variant={CROP_SCENE[crop]} className="crop-hero__art" />
      </div>
      <div className="wrap stack crop-body">
        <Segmented
          label="Crop profile section"
          value={active}
          onChange={(t) => navigate(`#/crop/${crop.toLowerCase()}${t === 'overview' ? '' : `?tab=${t}`}`, { replace: true })}
          options={TABS.map((t) => ({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))}
        />
        <Gate res={production} label="production data" onRetry={() => retry('production')} height={360}>
          {(p) => <Body p={p} crop={crop} tab={active} />}
        </Gate>
        <SourceNote
          source={active === 'utilization' ? 'FAOSTAT Food Balances (2010-), India' : 'DES district-wise crop production statistics (sum of district records)'}
          unit={active === 'utilization' ? 'share of total supply' : 'tonnes, hectares, tonnes per hectare'}
        >
          Production, area and yield add up all district records across seasons (and, for pulses, all pulse items). Yield divides production by the area of records with known production. Utilization shares use the reconciled FAOSTAT balance described on the National Utilization screen.
        </SourceNote>
      </div>
    </main>
  )
}

function Body({ p, crop, tab }: { p: ProductionStore; crop: Crop; tab: Tab }) {
  const { map, balance, retry } = useData()
  const { filters, setFilters } = useFilters()
  const years = p.yearsByCrop[crop]
  const year = resolveYear(filters.year, years)
  const rows = useMemo(() => (year == null ? [] : p.stateRows(crop, year).filter((r) => r.production != null)), [p, crop, year])
  const values = useMemo(() => new Map(rows.map((r) => [r.state, (r.production ?? 0) / 1e6])), [rows])
  const classes = useMemo(() => niceClasses([...values.values()], OLIVE_RAMP), [values])
  if (year == null) return <EmptyState title={`No ${crop.toLowerCase()} records are loaded`} />
  const nat = p.nationalYear(crop, year)
  const prevYear = years[years.indexOf(year) - 1]
  const prev = prevYear != null ? p.nationalYear(crop, prevYear) : undefined
  const total = nat?.production ?? 0
  const series = p.national(crop)
  const goCrop = () => setFilters({ crop })
  const coverage = <CoverageNotice p={p} crops={[crop]} years={[year]} />

  if (tab === 'overview') {
    const top = rows[0]
    const top5 = rows.slice(0, 5).reduce((a, r) => a + (r.production ?? 0), 0)
    return (
      <>
        {coverage}
        <section className="card">
          <h2 className="h2">{crop} in India</h2>
          <p className="small">
            In {p.cropYear(year)}, {crop.toLowerCase()} was recorded in {rows.length} states and union territories. {top && `${top.state} recorded the largest output (${tonnes(top.production)}, ${pct(total ? (top.production ?? 0) / total : null)} of the total)`}
            {rows.length >= 5 && `, and the top five states together accounted for ${pct(total ? top5 / total : null)}.`}
          </p>
        </section>
        <div className="grid-2">
          <section className="card">
            <div className="crop-overview">
              <Gate res={map} label="map" onRetry={() => retry('map')} height={260}>
                {(geo: StatesGeo) => (
                  <IndiaMap
                    geo={geo}
                    values={values}
                    classes={classes}
                    selected={null}
                    onSelect={(s) => {
                      setFilters({ crop, state: s, year })
                      navigate('#/production')
                    }}
                    maxHeight={340}
                    ariaLabel={`${crop} production by state, ${p.cropYear(year)}`}
                    label={(s, v) => `${s}: ${v == null ? 'no record' : tonnes(v * 1e6)}`}
                  />
                )}
              </Gate>
              <div className="crop-overview__kpi">
                <Metric
                  label={`Total production ${p.cropYear(year)}`}
                  value={tonnesParts(nat?.production).value}
                  unit={tonnesParts(nat?.production).unit}
                  delta={prev ? pctChange(prev.production, nat?.production) : null}
                  deltaLabel={prev ? `vs ${p.cropYear(prev.year)}` : undefined}
                  accent
                  note="Sum of district records"
                />
              </div>
            </div>
            <MapLegend classes={classes} unit="million tonnes" title="Production" />
            <YearStepper label="Crop year" years={years} value={year} onChange={(y) => setFilters({ year: y })} format={p.cropYear} />
          </section>
          <section className="card">
            <h2 className="h3">Top 5 producing states</h2>
            <BarList
              ariaLabel={`Top states for ${crop.toLowerCase()}`}
              color="var(--olive)"
              items={rows.slice(0, 5).map((r) => ({ id: r.state, label: r.state, value: r.production, display: tonnes(r.production) }))}
              onSelect={(s) => {
                setFilters({ crop, state: s, year })
                navigate('#/production')
              }}
            />
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={() => {
                goCrop()
                navigate('#/production')
              }}
            >
              Open production map <IconArrowRight width={16} height={16} />
            </button>
          </section>
        </div>
      </>
    )
  }

  if (tab === 'production') {
    const seasons = nat?.seasons.filter((s) => s.production != null && s.production > 0) ?? []
    const sTotal = seasons.reduce((a, s) => a + (s.production ?? 0), 0)
    return (
      <>
        {coverage}
        <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2 className="h3">National production</h2>
            <span className="mono">million tonnes</span>
          </div>
          <LineChart
            ariaLabel={`${crop} production trend`}
            series={[{ id: 'p', label: crop, color: CROP_COLOR[crop], points: series.map((n) => ({ x: n.year, y: n.production == null ? null : n.production / 1e6 })) }]}
            xFormat={(x) => `'${String(x).slice(2)}`}
            xTooltip={p.cropYear}
            yFormat={(v) => v.toFixed(0)}
            yTooltip={(v) => tonnes(v * 1e6)}
            markX={year}
            onSelectX={(x) => setFilters({ year: x })}
            legend={false}
          />
        </section>
        <section className="card">
          <div className="card__head">
            <h2 className="h3">By season · {p.cropYear(year)}</h2>
            <span className="mono">share of output</span>
          </div>
          <YearStepper label="Crop year" years={years} value={year} onChange={(y) => setFilters({ year: y })} format={p.cropYear} />
          <BarList
            ariaLabel="Production by season"
            rank={false}
            color={CROP_COLOR[crop]}
            items={seasons.map((s) => ({ id: s.season, label: s.season, value: s.production, display: `${tonnes(s.production)} · ${pct(sTotal ? (s.production ?? 0) / sTotal : null, 0)}` }))}
          />
          <p className="small muted">Season names are those reported by each state (some eastern states report autumn, winter and summer rice rather than kharif and rabi).</p>
        </section>
        </div>
      </>
    )
  }

  if (tab === 'yield') {
    const ranked = rows.filter((r) => r.yield != null && nat && r.area / nat.area >= 0.01).sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0))
    return (
      <div className="grid-2">
        <section className="card">
          <div className="card__head">
            <h2 className="h3">National yield</h2>
            <span className="mono">t/ha</span>
          </div>
          <div className="metrics">
            <Metric label={`Yield ${p.cropYear(year)}`} value={yieldStr(nat?.yield, false)} unit="t/ha" delta={prev ? pctChange(prev.yield, nat?.yield) : null} accent />
            <Metric label="Area" value={hectares(nat?.area)} delta={prev ? pctChange(prev.area, nat?.area) : null} />
          </div>
          <LineChart
            ariaLabel={`${crop} yield trend`}
            series={[{ id: 'y', label: 'Yield', color: CROP_COLOR[crop], points: series.map((n) => ({ x: n.year, y: n.yield })) }]}
            xFormat={(x) => `'${String(x).slice(2)}`}
            xTooltip={p.cropYear}
            yFormat={(v) => v.toFixed(1)}
            yTooltip={(v) => yieldStr(v)}
            markX={year}
            onSelectX={(x) => setFilters({ year: x })}
            legend={false}
          />
        </section>
        <section className="card">
          <h2 className="h3">State yields · {p.cropYear(year)}</h2>
          <BarList ariaLabel="State yields" color="var(--olive)" items={ranked.slice(0, 10).map((r) => ({ id: r.state, label: r.state, value: r.yield, display: yieldStr(r.yield, false) }))} />
          <p className="small muted">Top 10 of the states holding at least 1% of national area.</p>
          <button
            type="button"
            className="btn btn--small btn--primary"
            onClick={() => {
              setFilters({ crop, state: null, rangeEnd: year })
              navigate('#/area-yield')
            }}
          >
            Area &amp; yield explorer <IconArrowRight width={16} height={16} />
          </button>
        </section>
      </div>
    )
  }

  return (
    <Gate res={balance} label="national crop balance" onRetry={() => retry('balance')} height={240}>
      {(b) => {
        const fy = resolveYear(filters.fbsYear, b.yearsByCrop[crop])
        const flows = fy != null ? b.flows(crop, fy) : null
        if (fy == null || !flows) return <EmptyState title={`No FAOSTAT balance for ${crop.toLowerCase()}`} />
        return (
          <section className="card">
            <div className="card__head">
              <h2 className="h3">Use of national supply · {fy}</h2>
              <span className="mono">FAOSTAT</span>
            </div>
            <YearStepper label="FAO year" years={b.yearsByCrop[crop]} value={fy} onChange={(y) => setFilters({ fbsYear: y })} format={String} />
            <ShareBars
              ariaLabel="Destinations of supply"
              rows={[
                {
                  label: crop,
                  note: b.basis(crop),
                  segments: flows.destinations.map((d) => ({ name: d.name, label: FLOW_INFO[d.name]?.label ?? d.name, share: d.share, color: FLOW_INFO[d.name]?.color ?? '#999' })),
                },
              ]}
            />
            <ul className="legend">
              {flows.destinations.map((d) => (
                <li key={d.name}>
                  <span className="legend__mark" style={{ background: FLOW_INFO[d.name]?.color, borderColor: FLOW_INFO[d.name]?.color }} />
                  {FLOW_INFO[d.name]?.label ?? d.name} {pct(d.share)}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="btn btn--small btn--primary"
              onClick={() => {
                setFilters({ crop, fbsYear: fy })
                navigate('#/utilization')
              }}
            >
              Full utilization view <IconArrowRight width={16} height={16} />
            </button>
          </section>
        )
      }}
    </Gate>
  )
}
