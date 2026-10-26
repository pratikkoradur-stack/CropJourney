import { useMemo, useState, type PointerEvent } from 'react'
import { scaleLinear } from 'd3-scale'
import { curveMonotoneX, line } from 'd3-shape'
import { useElementSize } from '../../lib/hooks'

export interface LineSeries {
  id: string
  label: string
  color: string
  points: { x: number; y: number | null }[]
  dashed?: boolean
}

interface Props {
  series: LineSeries[]
  ariaLabel: string
  height?: number
  xFormat(x: number): string
  xTooltip?(x: number): string
  yFormat(y: number): string
  yTooltip?(y: number, s: LineSeries): string
  yDomain?: [number, number]
  zeroBased?: boolean
  refLine?: number
  markX?: number | null
  onSelectX?(x: number): void
  legend?: boolean
  endLabels?: boolean
  unitLabel?: string
}

export function LineChart({
  series,
  ariaLabel,
  height = 220,
  xFormat,
  xTooltip,
  yFormat,
  yTooltip,
  yDomain,
  zeroBased = true,
  refLine,
  markX,
  onSelectX,
  legend = series.length > 1,
  endLabels = false,
  unitLabel,
}: Props) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const [hoverX, setHoverX] = useState<number | null>(null)
  const visible = series.filter((s) => !hidden.has(s.id))

  const m = { t: 14, r: endLabels ? 70 : 14, b: 26, l: 44 }
  const w = Math.max(0, width)
  const iw = Math.max(10, w - m.l - m.r)
  const ih = height - m.t - m.b

  const { x, y, xs } = useMemo(() => {
    const all = series.flatMap((s) => s.points)
    const xsSet = [...new Set(all.map((p) => p.x))].sort((a, b) => a - b)
    const ys = visible.flatMap((s) => s.points.map((p) => p.y)).filter((v): v is number => v != null)
    let lo = ys.length ? Math.min(...ys) : 0
    let hi = ys.length ? Math.max(...ys) : 1
    if (zeroBased) lo = Math.min(0, lo)
    if (refLine != null) {
      lo = Math.min(lo, refLine)
      hi = Math.max(hi, refLine)
    }
    if (lo === hi) hi = lo + 1
    const yScale = scaleLinear()
      .domain(yDomain ?? [lo, hi])
      .range([ih, 0])
      .nice(4)
    const xScale = scaleLinear()
      .domain([xsSet[0] ?? 0, xsSet[xsSet.length - 1] ?? 1])
      .range([0, iw])
    return { x: xScale, y: yScale, xs: xsSet }
  }, [series, visible, zeroBased, refLine, yDomain, ih, iw])

  const path = line<{ x: number; y: number | null }>()
    .defined((p) => p.y != null)
    .x((p) => x(p.x))
    .y((p) => y(p.y as number))
    .curve(curveMonotoneX)

  const xTicks = useMemo(() => {
    if (xs.length <= 1) return xs
    const target = Math.max(2, Math.min(6, Math.floor(iw / 64)))
    const step = Math.max(1, Math.ceil((xs.length - 1) / (target - 1)))
    const ticks = xs.filter((_, i) => i % step === 0)
    if (ticks[ticks.length - 1] !== xs[xs.length - 1] && xs.length - 1 - xs.indexOf(ticks[ticks.length - 1]) > step / 2) ticks.push(xs[xs.length - 1])
    return ticks
  }, [xs, iw])

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left - m.l
    let best = xs[0]
    let bd = Infinity
    for (const v of xs) {
      const d = Math.abs(x(v) - px)
      if (d < bd) {
        bd = d
        best = v
      }
    }
    return best
  }
  const onMove = (e: PointerEvent<SVGRectElement>) => setHoverX(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()))

  const hoverRows =
    hoverX == null
      ? []
      : visible
          .map((s) => ({ s, p: s.points.find((p) => p.x === hoverX) }))
          .filter((r) => r.p && r.p.y != null)
          .sort((a, b) => (b.p!.y as number) - (a.p!.y as number))

  const ends = endLabels
    ? relax(
        visible
          .map((s) => {
            const last = [...s.points].reverse().find((p) => p.y != null)
            return last ? { s, y: y(last.y as number), x: x(last.x) } : null
          })
          .filter((v): v is { s: LineSeries; y: number; x: number } => v != null),
        14,
        ih,
      )
    : []

  return (
    <div className="chart" ref={ref}>
      {unitLabel && <div className="chart__unit mono">{unitLabel}</div>}
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${m.l} ${m.t})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0 ${y(t)})`}>
                <line x2={iw} className="chart__grid" />
                <text x={-8} dy="0.32em" textAnchor="end" className="chart__tick">
                  {yFormat(t)}
                </text>
              </g>
            ))}
            {refLine != null && <line x2={iw} y1={y(refLine)} y2={y(refLine)} className="chart__ref" />}
            {xTicks.map((t) => (
              <text key={t} x={x(t)} y={ih + 18} textAnchor="middle" className="chart__tick">
                {xFormat(t)}
              </text>
            ))}
            {markX != null && xs.includes(markX) && <line x1={x(markX)} x2={x(markX)} y2={ih} className="chart__mark" />}
            {visible.map((s) => (
              <path
                key={s.id}
                d={path(s.points) ?? ''}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeDasharray={s.dashed ? '5 4' : undefined}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            ))}
            {visible.map((s) => {
              const single = s.points.filter((p) => p.y != null)
              return single.length === 1 ? <circle key={s.id} cx={x(single[0].x)} cy={y(single[0].y as number)} r={3.5} fill={s.color} /> : null
            })}
            {hoverX != null && (
              <g>
                <line x1={x(hoverX)} x2={x(hoverX)} y2={ih} className="chart__hover" />
                {hoverRows.map(({ s, p }) => (
                  <circle key={s.id} cx={x(hoverX)} cy={y(p!.y as number)} r={4} fill="var(--paper-hi)" stroke={s.color} strokeWidth={2} />
                ))}
              </g>
            )}
            {ends.map(({ s, y: ly, x: lx, y0 }) => (
              <g key={s.id}>
                {Math.abs(ly - y0) > 2 && <path d={`M${lx + 3} ${y0}L${iw + 4} ${ly}`} stroke={s.color} strokeWidth={0.8} />}
                <text x={iw + 8} y={ly} dy="0.32em" className="chart__end" fill={s.color}>
                  {s.label}
                </text>
              </g>
            ))}
            <rect
              width={iw}
              height={ih}
              fill="transparent"
              style={{ touchAction: 'pan-y', cursor: onSelectX ? 'pointer' : 'crosshair' }}
              onPointerMove={onMove}
              onPointerDown={onMove}
              onPointerLeave={() => setHoverX(null)}
              onClick={(e) => onSelectX?.(nearest(e.clientX, e.currentTarget.ownerSVGElement!.getBoundingClientRect()))}
            />
          </g>
        </svg>
      )}
      {hoverX != null && hoverRows.length > 0 && (
        <div
          className="tooltip"
          style={{
            left: Math.min(Math.max(m.l + x(hoverX), 70), w - 70),
            top: 0,
          }}
          role="status"
        >
          <div className="tooltip__title">{(xTooltip ?? xFormat)(hoverX)}</div>
          {hoverRows.map(({ s, p }) => (
            <div key={s.id} className="tooltip__row">
              <span className="swatch" style={{ background: s.color }} />
              <span>{s.label}</span>
              <b className="num">{yTooltip ? yTooltip(p!.y as number, s) : yFormat(p!.y as number)}</b>
            </div>
          ))}
        </div>
      )}
      {legend && (
        <div className="chart__legend" role="group" aria-label="Toggle series">
          {series.map((s) => {
            const off = hidden.has(s.id)
            return (
              <button
                key={s.id}
                type="button"
                className={`legend-btn ${off ? 'legend-btn--off' : ''}`}
                aria-pressed={!off}
                onClick={() =>
                  setHidden((h) => {
                    const n = new Set(h)
                    if (n.has(s.id)) n.delete(s.id)
                    else if (series.length - n.size > 1) n.add(s.id)
                    return n
                  })
                }
              >
                <span className={`legend__mark ${s.dashed ? 'legend__mark--dashed' : ''}`} style={{ background: s.dashed ? undefined : s.color, borderColor: s.color }} />
                {s.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** Push labels apart so they do not overlap (keeps original y as y0). */
export function relax<T extends { y: number }>(items: T[], gap: number, max: number): (T & { y0: number })[] {
  const out = items.map((i) => ({ ...i, y0: i.y })).sort((a, b) => a.y - b.y)
  for (let i = 1; i < out.length; i++) if (out[i].y - out[i - 1].y < gap) out[i].y = out[i - 1].y + gap
  const overflow = out.length ? out[out.length - 1].y - max : 0
  if (overflow > 0) {
    out[out.length - 1].y -= overflow
    for (let i = out.length - 2; i >= 0; i--) if (out[i + 1].y - out[i].y < gap) out[i].y = out[i + 1].y - gap
  }
  return out
}
