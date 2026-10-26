import { useMemo, useState } from 'react'
import { arc, line, pie } from 'd3-shape'
import { scaleLinear } from 'd3-scale'
import { useElementSize } from '../../lib/hooks'

/* ---------------------------------------------------------------- */
export function Donut({
  data,
  center,
  centerSub,
  size = 168,
  ariaLabel,
}: {
  data: { label: string; value: number; color: string }[]
  center: string
  centerSub: string
  size?: number
  ariaLabel: string
}) {
  const [active, setActive] = useState<string | null>(null)
  const r = size / 2
  const arcs = useMemo(
    () =>
      pie<{ label: string; value: number; color: string }>()
        .value((d) => d.value)
        .sort(null)
        .padAngle(0.012)(data),
    [data],
  )
  const gen = arc<(typeof arcs)[number]>()
    .innerRadius(r * 0.62)
    .outerRadius((d) => (d.data.label === active ? r : r - 5))
    .cornerRadius(2)
  return (
    <svg width={size} height={size} viewBox={`${-r} ${-r} ${size} ${size}`} role="img" aria-label={ariaLabel} className="donut">
      {arcs.map((a) => (
        <path
          key={a.data.label}
          d={gen(a) ?? ''}
          fill={a.data.color}
          onPointerEnter={() => setActive(a.data.label)}
          onPointerLeave={() => setActive(null)}
          opacity={active && active !== a.data.label ? 0.5 : 1}
        >
          <title>{a.data.label}</title>
        </path>
      ))}
      <circle r={r * 0.56} fill="none" stroke="var(--grid)" strokeDasharray="2 3" />
      <text textAnchor="middle" y={-2} className="donut__center num">
        {center}
      </text>
      <text textAnchor="middle" y={16} className="donut__sub">
        {centerSub}
      </text>
    </svg>
  )
}

/* ---------------------------------------------------------------- */
export interface ShareRow {
  label: string
  note?: string
  segments: { name: string; label: string; share: number; color: string }[]
}

/** 100% stacked horizontal bars with labelled segments. */
export function ShareBars({ rows, ariaLabel }: { rows: ShareRow[]; ariaLabel: string }) {
  return (
    <div className="sharebars" role="img" aria-label={ariaLabel}>
      {rows.map((r) => (
        <div key={r.label} className="sharebars__row">
          <div className="sharebars__head">
            <span className="h3">{r.label}</span>
            {r.note && <span className="mono">{r.note}</span>}
          </div>
          <div className="sharebars__bar">
            {r.segments.map((s) => (
              <span
                key={s.name}
                className="sharebars__seg"
                style={{ width: `${Math.max(0, s.share * 100)}%`, background: s.color }}
                title={`${s.label}: ${(s.share * 100).toFixed(1)}%`}
              >
                {s.share >= 0.09 && <span className="sharebars__txt num">{Math.round(s.share * 100)}%</span>}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/** Bars above / below zero (stock build-up vs drawdown). */
export function DivergingBars({
  points,
  ariaLabel,
  format,
  xFormat,
  posColor,
  negColor,
  unit,
  height = 170,
}: {
  points: { x: number; y: number }[]
  ariaLabel: string
  format(v: number): string
  xFormat(x: number): string
  posColor: string
  negColor: string
  unit: string
  height?: number
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const m = { t: 10, r: 8, b: 22, l: 44 }
  const iw = Math.max(10, width - m.l - m.r)
  const ih = height - m.t - m.b
  const ext = Math.max(1, ...points.map((p) => Math.abs(p.y)))
  const y = scaleLinear().domain([-ext, ext]).range([ih, 0]).nice(4)
  const bw = points.length ? iw / points.length : 0
  const hp = points.find((p) => p.x === hover)
  const step = Math.max(1, Math.ceil(points.length / 6))
  const showTick = (i: number) => i % step === 0 || (i === points.length - 1 && (points.length - 1) % step >= step * 0.6)
  return (
    <div className="chart" ref={ref}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label={ariaLabel}>
          <g transform={`translate(${m.l} ${m.t})`}>
            {y.ticks(4).map((t) => (
              <g key={t} transform={`translate(0 ${y(t)})`}>
                <line x2={iw} className={t === 0 ? 'chart__ref' : 'chart__grid'} />
                <text x={-8} dy="0.32em" textAnchor="end" className="chart__tick">
                  {format(t)}
                </text>
              </g>
            ))}
            {points.map((p, i) => (
              <g key={p.x}>
                <rect
                  x={i * bw + bw * 0.18}
                  width={bw * 0.64}
                  y={p.y >= 0 ? y(p.y) : y(0)}
                  height={Math.max(1, Math.abs(y(p.y) - y(0)))}
                  fill={p.y >= 0 ? posColor : negColor}
                  opacity={hover == null || hover === p.x ? 1 : 0.45}
                />
                {showTick(i) && (
                  <text x={i * bw + bw / 2} y={ih + 16} textAnchor="middle" className="chart__tick">
                    {xFormat(p.x)}
                  </text>
                )}
                <rect
                  x={i * bw}
                  width={bw}
                  height={ih}
                  fill="transparent"
                  onPointerEnter={() => setHover(p.x)}
                  onPointerDown={() => setHover(p.x)}
                  onPointerLeave={() => setHover(null)}
                />
              </g>
            ))}
          </g>
        </svg>
      )}
      {hp && (
        <div className="tooltip" style={{ left: Math.min(Math.max(m.l + points.indexOf(hp) * bw + bw / 2, 70), width - 70), top: 0 }}>
          <div className="tooltip__title">{xFormat(hp.x)}</div>
          <div className="tooltip__row">
            <span className="swatch" style={{ background: hp.y >= 0 ? posColor : negColor }} />
            <span>{hp.y >= 0 ? 'Stock build-up' : 'Stock drawdown'}</span>
            <b className="num">
              {format(Math.abs(hp.y))} {unit}
            </b>
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
export function Sparkline({ values, color = 'var(--terracotta)', width = 96, height = 32 }: { values: (number | null)[]; color?: string; width?: number; height?: number }) {
  const v = values.map((x, i) => ({ i, x })).filter((p): p is { i: number; x: number } => p.x != null)
  if (v.length < 2) return null
  const lo = Math.min(...v.map((p) => p.x))
  const hi = Math.max(...v.map((p) => p.x))
  const xs = scaleLinear().domain([0, values.length - 1]).range([2, width - 4])
  const ys = scaleLinear().domain([lo, hi === lo ? lo + 1 : hi]).range([height - 3, 3])
  const d = line<{ i: number; x: number }>()
    .x((p) => xs(p.i))
    .y((p) => ys(p.x))(v)
  const last = v[v.length - 1]
  return (
    <svg width={width} height={height} aria-hidden className="sparkline">
      <path d={d ?? ''} fill="none" stroke={color} strokeWidth={1.6} />
      <circle cx={xs(last.i)} cy={ys(last.x)} r={2.6} fill={color} />
    </svg>
  )
}
