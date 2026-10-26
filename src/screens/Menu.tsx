import { useCallback, useEffect, useRef, useState, type ComponentType, type KeyboardEvent, type PointerEvent, type SVGProps } from 'react'
import { CropGlyph, IconArrowRight, IconBars, IconBulb, IconClose, IconCompare, IconFlow, IconGlobe, IconMap } from '../components/Icons'
import { useReducedMotion } from '../lib/hooks'
import { goBack, navigate } from '../lib/router'

interface Section {
  id: string
  title: [string, string]
  to: string
  icon: ComponentType<SVGProps<SVGSVGElement>>
  desc: string
}

const SECTIONS: Section[] = [
  {
    id: 'production',
    title: ['Production', 'Map'],
    to: '#/production',
    icon: IconMap,
    desc: 'Where each crop is grown: a state choropleth, ranked producers, district tables and the long-run trend.',
  },
  {
    id: 'area-yield',
    title: ['Area &', 'Yield'],
    to: '#/area-yield',
    icon: IconBars,
    desc: 'Separate how much land is cultivated from how much each hectare produces, nationally or for one state.',
  },
  {
    id: 'utilization',
    title: ['National', 'Utilization'],
    to: '#/utilization',
    icon: IconFlow,
    desc: 'How national supply is accounted for: food, animal feed, seed, processing, losses, exports and stocks.',
  },
  {
    id: 'trade',
    title: ['Trade &', 'Stocks'],
    to: '#/utilization?tab=trade',
    icon: IconGlobe,
    desc: 'Imports, exports and changes in stocks recorded in the national food balance since 2010.',
  },
  {
    id: 'compare',
    title: ['Crop', 'Comparison'],
    to: '#/compare',
    icon: IconCompare,
    desc: 'Set rice, wheat, maize and pulses side by side on production, area, yield and national use.',
  },
  {
    id: 'insights',
    title: ['Key', 'Insights'],
    to: '#/insights',
    icon: IconBulb,
    desc: 'Findings computed directly from the prepared datasets, each with its period, metric and source.',
  },
]

const N = SECTIONS.length
const STEP = 30
const CX = 0
const CY = 280
const R_IN = 100
const R_OUT = 214
const HALF = 13.2
const FILLS = ['#65785a', '#e1d7bf', '#252a25', '#93a68b', '#d0bda0', '#4d5e44']
const KEY = 'crop-journey:dial'

const rad = (d: number) => (d * Math.PI) / 180
const polar = (r: number, a: number): [number, number] => [CX + r * Math.cos(rad(a)), CY + r * Math.sin(rad(a))]
function wedge(r0: number, r1: number, a0: number, a1: number) {
  const [x0, y0] = polar(r1, a0)
  const [x1, y1] = polar(r1, a1)
  const [x2, y2] = polar(r0, a1)
  const [x3, y3] = polar(r0, a0)
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`
}
const isDark = (fill: string) => fill === '#252a25' || fill === '#4d5e44' || fill === '#65785a' || fill === '#c86d67'

const mod = (n: number, m: number) => ((n % m) + m) % m

function loadFocus(): number {
  try {
    const raw = sessionStorage.getItem(KEY)
    const v = raw == null ? NaN : Number(raw)
    return Number.isInteger(v) && v >= 0 && v < N ? v : 0
  } catch {
    return 0
  }
}

export default function Menu() {
  const reduced = useReducedMotion()
  const [f, setF] = useState<number>(loadFocus)
  const fRef = useRef(f)
  const anim = useRef(0)
  const drag = useRef<{ id: number; a0: number; f0: number; moved: boolean; tap: number | null; slot: number | null } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const opening = useRef(false)

  // The wheel is continuous: sections repeat around the full circle, so it never runs out.
  const focus = mod(Math.round(f), N)
  const section = SECTIONS[focus]

  const set = useCallback((v: number) => {
    fRef.current = v
    setF(v)
  }, [])

  const animateTo = useCallback(
    (target: number) => {
      cancelAnimationFrame(anim.current)
      const from = fRef.current
      if (reduced || Math.abs(target - from) < 0.001) {
        set(target)
        return
      }
      const t0 = performance.now()
      const dur = 340
      const tick = (now: number) => {
        const t = Math.min(1, (now - t0) / dur)
        const e = 1 - Math.pow(1 - t, 3)
        set(from + (target - from) * e)
        if (t < 1) anim.current = requestAnimationFrame(tick)
      }
      anim.current = requestAnimationFrame(tick)
    },
    [reduced, set],
  )

  /** Rotate to section i along the shorter way round. */
  const goTo = useCallback(
    (i: number) => {
      const cur = fRef.current
      let d = mod(i - cur, N)
      if (d > N / 2) d -= N
      animateTo(Math.round(cur + d))
    },
    [animateTo],
  )

  useEffect(() => () => cancelAnimationFrame(anim.current), [])
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, String(focus))
    } catch {
      /* ignore */
    }
  }, [focus])

  const open = useCallback((i: number) => {
    if (opening.current) return
    opening.current = true
    navigate(SECTIONS[i].to)
  }, [])

  const angleAt = (e: PointerEvent) => {
    const svg = svgRef.current!
    const ctm = svg.getScreenCTM()
    if (!ctm) return 0
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return (Math.atan2(pt.y - CY, pt.x - CX) * 180) / Math.PI
  }

  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return
    cancelAnimationFrame(anim.current)
    const seg = (e.target as Element).closest('[data-seg]')
    drag.current = {
      id: e.pointerId,
      a0: angleAt(e),
      f0: fRef.current,
      moved: false,
      tap: seg ? Number(seg.getAttribute('data-seg')) : null,
      slot: seg ? Number(seg.getAttribute('data-slot')) : null,
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch {
      /* capture is an enhancement; dragging still works without it */
    }
  }
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    let delta = angleAt(e) - d.a0
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    if (Math.abs(delta) > 3) d.moved = true
    if (!d.moved) return
    set(d.f0 - delta / STEP)
  }
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.moved && d.tap != null) {
      if (d.tap === mod(Math.round(fRef.current), N)) open(d.tap)
      else if (d.slot != null) animateTo(d.slot)
      else goTo(d.tap)
      return
    }
    animateTo(Math.round(fRef.current))
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault()
      animateTo(Math.round(fRef.current) + 1)
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault()
      animateTo(Math.round(fRef.current) - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open(focus)
    }
  }

  return (
    <main className="screen dial-screen">
      <header className="hub__bar wrap">
        <div className="brand">
          <CropGlyph crop="Wheat" width={22} height={22} />
          <span className="display">Crop Journey</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Close navigator" onClick={() => goBack('#/')}>
          <IconClose />
        </button>
      </header>

      <div className="dial-layout wrap">
        <div className="dial-wrap">
          <svg className="dial-contours" viewBox="0 0 200 200" aria-hidden>
            {[30, 46, 62, 78, 94].map((r, i) => (
              <path key={r} d={`M${200 - r * 1.6} 200C${200 - r * 1.4} ${200 - r * 0.9} ${200 - r * 0.4} ${200 - r * 1.3} 200 ${200 - r * 1.25 - i * 2}`} fill="none" stroke="#c3ccb6" strokeWidth="1" />
            ))}
          </svg>
          <svg
            ref={svgRef}
            className="dial"
            viewBox="0 0 400 560"
            role="group"
            aria-label="Section dial. Drag along the arc to rotate, tap a segment to focus it and tap again to open. Arrow keys rotate, Enter opens."
            tabIndex={0}
            onKeyDown={onKey}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <g fill="none" stroke="#d8d0be">
              <circle cx={CX} cy={CY} r={R_OUT + 58} strokeDasharray="2 5" />
              <circle cx={CX} cy={CY} r={R_IN - 18} />
              <circle cx={CX} cy={CY} r={R_IN - 40} strokeDasharray="3 4" />
            </g>
            <g stroke="#b9ae94" strokeWidth="0.8">
              {Array.from({ length: 37 }, (_, i) => -90 + i * 5).map((a) => {
                const [x0, y0] = polar(R_OUT + 44, a)
                const [x1, y1] = polar(R_OUT + (a % 30 === 0 ? 54 : 49), a)
                return <path key={a} d={`M${x0} ${y0}L${x1} ${y1}`} />
              })}
            </g>
            <circle cx={CX} cy={CY} r={R_IN - 58} fill="#c86d67" />
            <circle cx={CX} cy={CY} r={R_IN - 70} fill="none" stroke="#f7f2e6" strokeWidth="2" />
            <circle cx={CX + R_IN - 66} cy={CY} r={5} fill="#f7f2e6" />

            {SECTIONS.flatMap((s, i) => [-1, 0, 1, 2].map((k) => ({ s, i, slot: i + k * N }))).map(({ s, i, slot }) => {
              const a = (slot - f) * STEP
              if (Math.abs(a) >= 84) return null
              const prom = Math.max(0, 1 - Math.abs(slot - f))
              const isFocus = Math.abs(slot - f) < 0.5
              const r1 = R_OUT + 16 * prom
              const fill = isFocus ? '#c86d67' : FILLS[i % FILLS.length]
              const [ix, iy] = polar((R_IN + r1) / 2, a)
              const [lx, ly] = polar(R_OUT + 30 + 10 * prom, a)
              const [d0x, d0y] = polar(r1 + 4, a)
              const [d1x, d1y] = polar(R_OUT + 24 + 10 * prom, a)
              const Icon = s.icon
              const fade = Math.max(0, Math.min(1, (84 - Math.abs(a)) / 18))
              return (
                <g key={`${s.id}-${slot}`} data-seg={i} data-slot={slot} className={`dial__seg ${isFocus ? 'is-focus' : ''}`} opacity={fade} aria-hidden>
                  <path d={wedge(R_IN, r1, a - HALF, a + HALF)} fill={fill} stroke="#f0e9d8" strokeWidth="2" />
                  <Icon x={ix - 13} y={iy - 13} width={26} height={26} color={isDark(fill) ? '#f7f2e6' : '#252a25'} strokeWidth={1.7} />
                  <path d={`M${d0x} ${d0y}L${d1x} ${d1y}`} stroke={isFocus ? '#c86d67' : '#252a25'} strokeWidth="1" strokeDasharray="2 2" />
                  <text x={lx} y={ly - 20} className="dial__num">
                    0{i + 1}
                  </text>
                  <text x={lx} y={ly - 2} className={`dial__label ${isFocus ? 'is-focus' : ''}`}>
                    {s.title[0]}
                  </text>
                  <text x={lx} y={ly + 17} className={`dial__label ${isFocus ? 'is-focus' : ''}`}>
                    {s.title[1]}
                  </text>
                  <rect x={lx - 8} y={ly - 34} width={150} height={58} fill="transparent" />
                </g>
              )
            })}
          </svg>
          <p className="dial__hint mono" aria-hidden>
            Drag the arc · tap to focus · tap again to open
          </p>
        </div>

        <div className="dial-panel">
          <div className="dial-card" aria-live="polite">
            <span className="mono">
              Section {String(focus + 1).padStart(2, '0')} / {String(N).padStart(2, '0')}
            </span>
            <h2 className="display dial-card__title">
              {section.title[0]} {section.title[1]}
            </h2>
            <p className="small">{section.desc}</p>
            <button type="button" className="btn btn--accent" onClick={() => open(focus)}>
              Open {section.title.join(' ').replace('& ', '& ')}
              <IconArrowRight width={18} height={18} />
            </button>
          </div>
          <nav className="dial-list" aria-label="All sections">
            {SECTIONS.map((s, i) => (
              <button
                key={s.id}
                type="button"
                className={`dial-list__item ${i === focus ? 'is-focus' : ''}`}
                aria-current={i === focus ? 'true' : undefined}
                onClick={() => (i === focus ? open(i) : goTo(i))}
              >
                <span className="mono">0{i + 1}</span>
                <span>{s.title.join(' ')}</span>
              </button>
            ))}
          </nav>
        </div>
      </div>
    </main>
  )
}
