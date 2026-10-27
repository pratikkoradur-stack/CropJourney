import { useEffect, useMemo, useRef, useState } from 'react'
import { useData } from '../data/DataContext'
import type { ProductionStore } from '../data/store'
import { CROP_COLOR, type Crop } from '../data/types'
import { pctChange } from '../data/aggregate'
import { CoverageNotice, ErrorState, LoadingState } from './ui'
import { IndiaMap, MapLegend, niceClasses, TERRA_RAMP } from './charts/IndiaMap'
import { LineChart } from './charts/LineChart'
import { IconRefresh } from './Icons'
import { signedPct, tonnes } from '../lib/format'
import { resolveYear, useFilters } from '../state/filters'

const STEP_MS = 650

/**
 * "Watch the harvest change": a year slider with play that repaints the map and numbers.
 * It writes filters.year, so every other screen opens on the year you stopped at.
 */
export default function TimeLapse({ crop }: { crop: Crop }) {
  const { production, map, retry } = useData()
  if (production.status === 'error') return <ErrorState message={production.error ?? 'Could not load production data.'} onRetry={() => retry('production')} />
  if (production.status !== 'ready' || !production.data) return <LoadingState label="Loading production data" height={260} />
  return <Body p={production.data} crop={crop} geo={map.data} />
}

function Body({ p, crop, geo }: { p: ProductionStore; crop: Crop; geo?: ReturnType<typeof useData>['map']['data'] }) {
  const { filters, setFilters } = useFilters()
  const years = p.yearsByCrop[crop]
  const year = resolveYear(filters.year, years) ?? years[years.length - 1]
  const [playing, setPlaying] = useState(false)
  const yearRef = useRef(year)
  yearRef.current = year

  // One legend for every year, so colours mean the same thing while the years change.
  const classes = useMemo(() => {
    const all: number[] = []
    for (const y of years) for (const r of p.stateRows(crop, y)) if (r.production != null) all.push(r.production / 1e6)
    return niceClasses(all, TERRA_RAMP)
  }, [p, crop, years])
  const values = useMemo(() => new Map(p.stateRows(crop, year).map((r) => [r.state, r.production == null ? null : r.production / 1e6])), [p, crop, year])
  const nat = p.nationalYear(crop, year)
  const prev = p.nationalYear(crop, year - 1)
  const series = p.national(crop)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      const i = years.indexOf(yearRef.current)
      if (i < 0 || i >= years.length - 1) {
        setPlaying(false)
        return
      }
      setFilters({ year: years[i + 1] })
    }, STEP_MS)
    return () => window.clearInterval(id)
  }, [playing, years, setFilters])

  const togglePlay = () => {
    if (!playing && year === years[years.length - 1]) setFilters({ year: years[0] })
    setPlaying((v) => !v)
  }

  return (
    <section className="card timelapse" aria-label="Harvest through time">
      <div className="card__head">
        <h3 className="h3">Watch the harvest change</h3>
        <span className="mono">drag or press play</span>
      </div>
      <div className="timelapse__body">
        <div className="timelapse__map">
          {geo ? (
            <IndiaMap
              geo={geo}
              values={values}
              classes={classes}
              selected={filters.state}
              onSelect={(s) => setFilters({ state: filters.state === s ? null : s })}
              maxHeight={260}
              ariaLabel={`${crop} production by state, ${p.cropYear(year)}`}
              label={(s, v) => `${s}: ${v == null ? 'no record' : tonnes(v * 1e6)}`}
            />
          ) : (
            <LoadingState label="Loading map" height={200} />
          )}
        </div>
        <div className="timelapse__read" aria-live="polite">
          <span className="eyebrow">{crop}</span>
          <p className="display timelapse__year num">{p.cropYear(year)}</p>
          <p className="timelapse__total num">{tonnes(nat?.production)}</p>
          <p className="small muted">{prev?.production != null && nat?.production != null ? `${signedPct(pctChange(prev.production, nat.production))} on the year before` : 'first year of the series'}</p>
        </div>
      </div>

      <div className="timelapse__controls">
        <button type="button" className="btn btn--accent btn--small" onClick={togglePlay} aria-pressed={playing}>
          {playing ? (
            'Pause'
          ) : year === years[years.length - 1] ? (
            <>
              <IconRefresh width={15} height={15} /> Replay
            </>
          ) : (
            'Play'
          )}
        </button>
        <label className="timelapse__slider">
          <span className="sr-only">Crop year</span>
          <input
            type="range"
            min={years[0]}
            max={years[years.length - 1]}
            step={1}
            value={year}
            onChange={(e) => {
              setPlaying(false)
              const v = Number(e.target.value)
              setFilters({ year: years.includes(v) ? v : resolveYear(v, years) })
            }}
            aria-valuetext={p.cropYear(year)}
          />
          <span className="timelapse__ticks mono" aria-hidden>
            <span>{p.cropYear(years[0])}</span>
            <span>{p.cropYear(years[years.length - 1])}</span>
          </span>
        </label>
      </div>

      <LineChart
        ariaLabel={`${crop} national production over time`}
        series={[{ id: 'p', label: crop, color: CROP_COLOR[crop], points: series.map((n) => ({ x: n.year, y: n.production == null ? null : n.production / 1e6 })) }]}
        height={120}
        xFormat={(x) => `'${String(x).slice(2)}`}
        xTooltip={p.cropYear}
        yFormat={(v) => v.toFixed(0)}
        yTooltip={(v) => tonnes(v * 1e6)}
        markX={year}
        onSelectX={(x) => {
          setPlaying(false)
          setFilters({ year: x })
        }}
        legend={false}
        unitLabel="million tonnes, tap the chart to jump"
      />
      <MapLegend classes={classes} unit="million tonnes, same scale every year" title="Production" />
      <CoverageNotice p={p} crops={[crop]} years={[year]} />
    </section>
  )
}
