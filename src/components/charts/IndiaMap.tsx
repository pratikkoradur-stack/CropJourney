import { memo, useMemo, useState } from 'react'
import { geoMercator, geoPath } from 'd3-geo'
import type { StatesGeo } from '../../data/DataContext'
import { useElementSize } from '../../lib/hooks'

export interface Classes {
  breaks: number[]
  colors: string[]
  noData: string
}

export const TERRA_RAMP = ['#f1ddd2', '#e4b3a9', '#d58c84', '#c86d67', '#9c4843']
export const OLIVE_RAMP = ['#e3e6d4', '#c3ccb6', '#93a68b', '#65785a', '#3f4e37']
const NICE = [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]

/** Quantile-based class breaks snapped to round numbers (values in the unit of the legend). */
export function niceClasses(values: number[], ramp: string[]): Classes {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b)
  const breaks: number[] = []
  if (v.length) {
    for (let i = 1; i < ramp.length; i++) {
      const q = v[Math.min(v.length - 1, Math.floor((i / ramp.length) * v.length))]
      const snapped = NICE.reduce((best, n) => (Math.abs(Math.log(n / q)) < Math.abs(Math.log(best / q)) ? n : best), NICE[0])
      if (!breaks.includes(snapped) && (breaks.length === 0 || snapped > breaks[breaks.length - 1])) breaks.push(snapped)
    }
  }
  return { breaks, colors: ramp.slice(ramp.length - breaks.length - 1), noData: 'url(#map-nodata)' }
}

export function classColor(c: Classes, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return c.noData
  let i = 0
  while (i < c.breaks.length && v >= c.breaks[i]) i++
  return c.colors[i]
}

interface Props {
  geo: StatesGeo
  values: Map<string, number | null>
  classes: Classes
  selected: string | null
  onSelect?(state: string): void
  focus?: string | null
  label(state: string, v: number | null | undefined): string
  ariaLabel: string
  maxHeight?: number
}

export const IndiaMap = memo(function IndiaMap({ geo, values, classes, selected, onSelect, focus, label, ariaLabel, maxHeight = 460 }: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<string | null>(null)
  const height = Math.min(maxHeight, Math.round(width * 1.08))

  const paths = useMemo(() => {
    if (!width) return []
    const proj = geoMercator().fitExtent(
      [
        [6, 6],
        [width - 6, height - 6],
      ],
      geo,
    )
    const gp = geoPath(proj)
    return geo.features.map((f) => ({ state: f.properties.state, d: gp(f) ?? '', c: gp.centroid(f) }))
  }, [geo, width, height])

  const active = hover ?? selected
  const activePath = paths.find((p) => p.state === active)

  return (
    <div className="map" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <defs>
            <pattern id="map-nodata" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" fill="#ece5d4" />
              <path d="M0 0v5" stroke="#cfc5ad" strokeWidth="1.4" />
            </pattern>
          </defs>
          {paths.map((p) => {
            const v = values.get(p.state)
            const dim = focus != null && p.state !== focus
            return (
              <path
                key={p.state}
                d={p.d}
                fill={classColor(classes, v)}
                className={`map__state ${p.state === selected ? 'is-selected' : ''}`}
                opacity={dim ? 0.35 : 1}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(p.state)}
                onPointerLeave={() => setHover(null)}
                onClick={() => onSelect?.(p.state)}
                style={{ cursor: onSelect ? 'pointer' : 'default' }}
              >
                <title>{label(p.state, v)}</title>
              </path>
            )
          })}
          {activePath && <path d={activePath.d} className="map__outline" />}
        </svg>
      )}
      {active && activePath && (
        <div className="map__label" style={{ left: Math.min(Math.max(activePath.c[0], 80), width - 80), top: Math.max(activePath.c[1] - 46, 0) }}>
          {label(active, values.get(active))}
        </div>
      )}
    </div>
  )
})

export function MapLegend({ classes, unit, title }: { classes: Classes; unit: string; title: string }) {
  const labels = classes.colors.map((_, i) => {
    const lo = classes.breaks[i - 1]
    const hi = classes.breaks[i]
    if (lo == null && hi == null) return 'all'
    if (lo == null) return `< ${hi}`
    if (hi == null) return `≥ ${lo}`
    return `${lo}–${hi}`
  })
  return (
    <div className="map-legend">
      <div className="mono">
        {title} ({unit})
      </div>
      <ul>
        {classes.colors.map((c, i) => (
          <li key={c}>
            <span style={{ background: c }} />
            {labels[i]}
          </li>
        ))}
        <li>
          <span className="map-legend__nodata" />
          no record
        </li>
      </ul>
    </div>
  )
}
