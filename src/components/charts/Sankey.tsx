import { useMemo, type KeyboardEvent } from 'react'
import { FLOW_INFO } from '../../data/balance'
import type { FlowResult } from '../../data/types'
import { ktToMt, pct } from '../../lib/format'
import { useElementSize } from '../../lib/hooks'
import { relax } from './LineChart'

/**
 * Two-column flow diagram: the left bar stacks every supply source (production,
 * imports, stock drawdown), the right column every destination. Links leave the
 * bar as one pool, so the diagram never implies that a particular source went
 * to a particular use. Only drawn when the balance reconciles.
 */
export function Sankey({
  flows,
  mode,
  selected,
  onSelect,
  ariaLabel,
}: {
  flows: FlowResult
  mode: 'share' | 'quantity'
  selected: string | null
  onSelect(name: string | null): void
  ariaLabel: string
}) {
  const [ref, { width }] = useElementSize<HTMLDivElement>()
  const H = 330
  const labelW = Math.min(150, Math.max(118, width * 0.36))
  const barW = Math.min(120, Math.max(80, width * 0.23))
  const nodeW = 9
  const x1 = barW
  const x2 = width - labelW - nodeW
  const pad = 8

  const layout = useMemo(() => {
    const dests = flows.destinations
    const n = dests.length
    const k = (H - pad * Math.max(0, n - 1)) / Math.max(1, flows.totalSupply)
    let y = 0
    const nodes = dests.map((d) => {
      const h = Math.max(2, d.value * k)
      const node = { ...d, y, h }
      y += h + pad
      return node
    })
    const total = y - pad
    const scaleFix = total > H ? H / total : 1
    nodes.forEach((nd) => {
      nd.y *= scaleFix
      nd.h *= scaleFix
    })
    const barH = flows.totalSupply * k * scaleFix
    const barY = (H - barH) / 2
    let s = barY
    const sources = flows.sources.map((src) => {
      const h = src.value * k * scaleFix
      const seg = { ...src, y: s, h }
      s += h
      return seg
    })
    let cy = barY
    const links = nodes.map((nd) => {
      const h = nd.value * k * scaleFix
      const link = { name: nd.name, sy0: cy, sy1: cy + h, ty0: nd.y, ty1: nd.y + Math.max(h, nd.h) }
      cy += h
      return link
    })
    const labels = relax(
      nodes.map((nd) => ({ name: nd.name, y: nd.y + nd.h / 2, node: nd })),
      30,
      H - 6,
    )
    return { nodes, sources, links, barY, barH, labels }
  }, [flows])

  const mx = (x1 + x2) / 2
  const key = (name: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(selected === name ? null : name)
    }
  }
  const valueText = (v: number, share: number) => (mode === 'share' ? pct(share) : ktToMt(v))
  const subText = (v: number, share: number) => (mode === 'share' ? ktToMt(v) : pct(share))

  return (
    <div className="sankey" ref={ref}>
      {width > 0 && x2 > x1 + 30 && (
        <svg width={width} height={H + 8} role="img" aria-label={ariaLabel}>
          <g transform="translate(0 4)">
            {layout.links.map((l) => {
              const info = FLOW_INFO[l.name]
              const dim = selected != null && selected !== l.name
              return (
                <path
                  key={l.name}
                  d={`M${x1} ${l.sy0}C${mx} ${l.sy0} ${mx} ${l.ty0} ${x2} ${l.ty0}L${x2} ${l.ty1}C${mx} ${l.ty1} ${mx} ${l.sy1} ${x1} ${l.sy1}Z`}
                  fill={info?.color ?? '#b9b2a2'}
                  opacity={dim ? 0.16 : selected === l.name ? 0.85 : 0.5}
                  className="sankey__link"
                  onClick={() => onSelect(selected === l.name ? null : l.name)}
                />
              )
            })}
            {/* supply bar */}
            <g>
              {layout.sources.map((s) => (
                <g key={s.name}>
                  <rect x={0} y={s.y} width={barW} height={Math.max(s.h, 0.5)} fill={FLOW_INFO[s.name]?.color ?? '#93a68b'} />
                  {s.h >= 34 && (
                    <>
                      <text x={8} y={s.y + 16} className="sankey__in-label">
                        {FLOW_INFO[s.name]?.label ?? s.name}
                      </text>
                      <text x={8} y={s.y + 30} className="sankey__in-value num">
                        {ktToMt(s.value)}
                      </text>
                    </>
                  )}
                </g>
              ))}
              <rect x={0} y={layout.barY} width={barW} height={layout.barH} fill="none" stroke="var(--ink)" strokeWidth={1} />
              <line x1={barW} x2={barW} y1={layout.barY} y2={layout.barY + layout.barH} stroke="var(--ink)" strokeWidth={2} />
            </g>
            {layout.nodes.map((nd) => (
              <rect
                key={nd.name}
                x={x2}
                y={nd.y}
                width={nodeW}
                height={nd.h}
                fill={FLOW_INFO[nd.name]?.color ?? '#b9b2a2'}
                stroke={selected === nd.name ? 'var(--ink)' : 'none'}
              />
            ))}
            {layout.labels.map((lb) => {
              const nd = lb.node
              const info = FLOW_INFO[nd.name]
              const lx = x2 + nodeW + 8
              const dim = selected != null && selected !== nd.name
              return (
                <g
                  key={nd.name}
                  className="sankey__label"
                  role="button"
                  tabIndex={0}
                  aria-pressed={selected === nd.name}
                  aria-label={`${info?.label ?? nd.name}: ${ktToMt(nd.value)}, ${pct(nd.share)} of total supply`}
                  onClick={() => onSelect(selected === nd.name ? null : nd.name)}
                  onKeyDown={key(nd.name)}
                  opacity={dim ? 0.45 : 1}
                >
                  {Math.abs(lb.y - lb.y0) > 3 && <path d={`M${x2 + nodeW + 1} ${lb.y0}L${lx - 2} ${lb.y}`} stroke="var(--ink-3)" strokeWidth={0.7} />}
                  <rect x={lx - 4} y={lb.y - 15} width={labelW - 2} height={30} fill="transparent" />
                  <text x={lx} y={lb.y - 3} className="sankey__name">
                    {info?.label ?? nd.name}
                  </text>
                  <text x={lx} y={lb.y + 11} className="sankey__value num">
                    <tspan className="sankey__value-strong">{valueText(nd.value, nd.share)}</tspan>
                    <tspan dx={5}>({subText(nd.value, nd.share)})</tspan>
                  </text>
                </g>
              )
            })}
          </g>
        </svg>
      )}
      <ul className="sankey__sources">
        {flows.sources.map((s) => (
          <li key={s.name}>
            <span className="swatch" style={{ background: FLOW_INFO[s.name]?.color, borderRadius: 2 }} />
            {FLOW_INFO[s.name]?.label ?? s.name}
            <b className="num">{valueText(s.value, s.share)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}
