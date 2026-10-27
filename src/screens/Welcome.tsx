import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useData } from '../data/DataContext'
import { CROPS, type Crop } from '../data/types'
import { CloudStrip, CoverRings } from '../illustrations/CoverArt'
import layerMeta from '../assets/cover/layers.json'
import { CropGlyph, IconArrowRight, IconChevronDown } from '../components/Icons'
import { Legend, LoadingState } from '../components/ui'
import { IndiaMap, MapLegend, niceClasses, TERRA_RAMP } from '../components/charts/IndiaMap'
import { ShareBars } from '../components/charts/Small'
import { FLOW_INFO } from '../data/balance'
import { pct, tonnes } from '../lib/format'
import { useReducedMotion } from '../lib/hooks'
import { navigate } from '../lib/router'
import { resolveYear } from '../state/filters'

const urls = import.meta.glob('../assets/cover/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const url = (name: string) => urls[`../assets/cover/${name}.webp`]
const [SW, SH] = layerMeta.stage as [number, number]
const L = layerMeta.layers as Record<string, { x: number; y: number; w: number; h: number }>

/** Scroll progress of a tall element: 0 when its top reaches the viewport top, 1 when its bottom does. */
function useScrollProgress(ref: React.RefObject<HTMLElement | null>, apply: (el: HTMLElement, p: number) => void) {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const total = el.offsetHeight - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total)) : 0
      apply(el, p)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    const io = new IntersectionObserver(([e]) => el.classList.toggle('is-offscreen', !e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [ref, apply])
}

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const range = (p: number, a: number, b: number) => clamp01((p - a) / (b - a))
const ease = (t: number) => t * t * (3 - 2 * t)

function Layer({ name, depth, delay = 0 }: { name: string; depth: string; delay?: number }) {
  const l = L[name]
  const style: CSSProperties = {
    left: `${(l.x / SW) * 100}%`,
    top: `${(l.y / SH) * 100}%`,
    width: `${(l.w / SW) * 100}%`,
    animationDelay: `${-delay}s`,
  }
  return (
    <div className={`wc-layer wc-layer--${depth}`} style={style} data-layer={name}>
      <div className="wc-move">
        <img src={url(name)} alt="" draggable={false} decoding="async" />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
export default function Welcome() {
  return (
    <>
      <Cover />
      <Story />
    </>
  )
}

function Cover() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { balance } = useData()

  const apply = useCallback((el: HTMLElement, p: number) => {
    const out = ease(range(p, 0, 0.5)) // poster one leaves
    const inn = ease(range(p, 0.16, 0.6)) // "bigger picture" state arrives
    const grow = ease(range(p, 0, 0.62)) // title swells and the rings widen
    const leave = ease(range(p, 0.66, 1)) // everything hands over to the story
    const s = el.style
    s.setProperty('--p', p.toFixed(4))
    s.setProperty('--out', out.toFixed(4))
    s.setProperty('--in', inn.toFixed(4))
    s.setProperty('--grow', grow.toFixed(4))
    s.setProperty('--leave', leave.toFixed(4))
    s.setProperty('--cue', clamp01(1 - p * 9).toFixed(3))
    s.setProperty('--says', ease(range(p, 0.42, 0.62)).toFixed(3))
  }, [])
  useScrollProgress(ref, apply)

  const next = () => {
    const el = ref.current
    if (!el) return
    const step = (el.offsetHeight - window.innerHeight) * (window.scrollY - el.offsetTop < (el.offsetHeight - window.innerHeight) * 0.3 ? 0.5 : 1)
    window.scrollTo({ top: el.offsetTop + step, behavior: reduced ? 'auto' : 'smooth' })
  }

  const years = balance.data?.years
  const range2 = years?.length ? `${years[0]} – ${years[years.length - 1]}` : '2010 – 2023'

  return (
    <section ref={ref} className={`wc ${reduced ? 'wc--static' : ''}`} aria-label="Crop Journey welcome">
      <div className="wc-sticky">
        <div className="wc-clouds" aria-hidden>
          <div className="wc-cloud wc-cloud--a">
            <CloudStrip set={0} />
          </div>
          <div className="wc-cloud wc-cloud--b">
            <CloudStrip set={1} />
          </div>
          <div className="wc-cloud wc-cloud--c">
            <CloudStrip set={2} />
          </div>
        </div>

        <div className="wc-poster">
          <div className="wc-rings" aria-hidden>
            <CoverRings />
          </div>
          <div className="wc-axis" aria-hidden>
            <span className="wc-axis__top" />
            <span className="wc-axis__bottom" />
            <span className="wc-axis__dot" />
          </div>

          {/* poster one: the illustrated cover */}
          <div className="wc-set wc-set--one" aria-hidden>
            <Layer name="p1-top" depth="top" delay={0} />
            <Layer name="p1-midl" depth="midl" delay={4} />
            <Layer name="p1-midr" depth="midr" delay={7} />
            <Layer name="p1-botl" depth="botl" delay={2} />
            <Layer name="p1-botr" depth="botr" delay={9} />
          </div>
          {/* poster two: the misty "bigger picture" */}
          <div className="wc-set wc-set--two" aria-hidden>
            <Layer name="p2-tl" depth="tl" delay={3} />
            <Layer name="p2-tr" depth="tr" delay={8} />
            <Layer name="p2-mid" depth="pmid" delay={5} />
            <Layer name="p2-bl" depth="bl" delay={1} />
            <Layer name="p2-br" depth="br" delay={6} />
          </div>

          <div className="wc-title">
            <h1 className="display wc-h">
              <span>Crop</span>
              <span>Journey</span>
            </h1>
            <p className="wc-sub">
              India&rsquo;s harvest
              <br />
              beyond the fields
            </p>
          </div>
        </div>

        <ul className="wc-meta wc-meta--tl mono" aria-hidden>
          <li>Land</li>
          <li>People</li>
          <li>Climate</li>
          <li>Markets</li>
          <li>A longer story</li>
        </ul>
        <div className="wc-meta wc-meta--tr mono">
          <span className="sr-only">Data coverage </span>
          {range2.split(' – ')[0]}
          <br />–<br />
          {range2.split(' – ')[1]}
        </div>
        <svg className="wc-sun" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="5.5" fill="currentColor" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M20 5v7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" transform={`rotate(${i * 30} 20 20)`} />
          ))}
        </svg>

        <p className="wc-says mono" aria-hidden>
          Exploring
          <br />a bigger picture
        </p>

        <button type="button" className="wc-cue" onClick={next} aria-label="Scroll to explore">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M6 6l6 6 6-6M6 12l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>Scroll to explore</span>
        </button>
        <button type="button" className="wc-orb" onClick={next} aria-label="Continue">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M7 8l5 5 5-5M7 13l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
const BEATS = [
  { id: 'what', label: 'What this is' },
  { id: 'grows', label: 'Where it grows' },
  { id: 'goes', label: 'Where it goes' },
] as const

function Story() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const [beat, setBeat] = useState(0)
  const [crop, setCrop] = useState<Crop>('Rice')
  const { production, balance, map, meta } = useData()

  const apply = useCallback((el: HTMLElement, p: number) => {
    el.style.setProperty('--s', p.toFixed(4))
    const i = Math.min(BEATS.length - 1, Math.floor(p * BEATS.length * 0.999))
    el.dataset.beat = String(i)
    setBeat((b) => (b === i ? b : i))
  }, [])
  useScrollProgress(ref, apply)

  const goBeat = (i: number) => {
    const el = ref.current
    if (!el) return
    const total = el.offsetHeight - window.innerHeight
    window.scrollTo({ top: el.offsetTop + ((i + 0.5) / BEATS.length) * total, behavior: reduced ? 'auto' : 'smooth' })
  }

  const p = production.data
  const b = balance.data
  const ds = meta.data?.datasets.crop_production
  const year = p ? resolveYear(null, p.yearsByCrop[crop]) : null
  const rows = useMemo(() => (p && year != null ? p.stateRows(crop, year) : []), [p, crop, year])
  const values = useMemo(() => new Map(rows.map((r) => [r.state, r.production == null ? null : r.production / 1e6])), [rows])
  const classes = useMemo(() => niceClasses([...values.values()].filter((v): v is number => v != null), TERRA_RAMP), [values])
  const nat = p && year != null ? p.nationalYear(crop, year) : undefined
  const fy = b ? resolveYear(null, b.yearsByCrop[crop]) : null
  const flows = b && fy != null ? b.flows(crop, fy) : null

  const cropPicker = (
    <div className="wc-crops" role="group" aria-label="Choose a crop to preview">
      {CROPS.map((c) => (
        <button key={c} type="button" className="wc-crop" aria-pressed={c === crop} onClick={() => setCrop(c)}>
          <CropGlyph crop={c} width={18} height={18} />
          {c}
        </button>
      ))}
    </div>
  )

  return (
    <section ref={ref} className={`ws ${reduced ? 'ws--static' : ''}`} data-beat={beat} aria-label="What Crop Journey shows">
      <div className="ws-sticky">
        <div className="ws-art" aria-hidden>
          <img className="ws-art__a" src={url('p2-tl')} alt="" draggable={false} />
          <img className="ws-art__b" src={url('p2-tr')} alt="" draggable={false} />
          <img className="ws-art__c" src={url('p2-br')} alt="" draggable={false} />
          <img className="ws-art__d" src={url('p2-bl')} alt="" draggable={false} />
        </div>

        <ol className="ws-dots" aria-label="Story steps">
          {BEATS.map((bt, i) => (
            <li key={bt.id}>
              <button type="button" aria-label={`${bt.label} (step ${i + 1} of ${BEATS.length})`} aria-current={beat === i} onClick={() => goBeat(i)}>
                <span className="ws-dots__n mono">0{i + 1}</span>
                <span className="ws-dots__l">{bt.label}</span>
              </button>
            </li>
          ))}
        </ol>

        <div className="ws-stage">
          <article className="ws-beat" aria-hidden={beat !== 0 && !reduced}>
            <span className="eyebrow">01 · What this is</span>
            <h2 className="display ws-h">
              Four crops.
              <br />
              One journey.
            </h2>
            <p className="ws-p">
              Crop Journey is an interactive atlas of <b>rice, wheat, maize and pulses</b>, India&rsquo;s staple crops. It starts in the districts where they are grown, then follows
              national supply to food, animal feed, seed, losses and trade.
            </p>
            <p className="ws-p ws-p--small">Built on official Government of India crop statistics and FAO food balances. Keep scrolling, or tap a crop to see what is inside.</p>
            {cropPicker}
          </article>

          <article className="ws-beat" aria-hidden={beat !== 1 && !reduced}>
            <span className="eyebrow">02 · Where it grows</span>
            <h2 className="display ws-h">
              {ds ? (
                <>
                  {ds.districts} districts, {ds.states} states
                </>
              ) : (
                <>Every district, every state</>
              )}
            </h2>
            <p className="ws-p">
              {nat?.production != null && year != null && p ? (
                <>
                  In {p.cropYear(year)}, India&rsquo;s districts recorded <b>{tonnes(nat.production)}</b> of {crop.toLowerCase()}. Darker states grew more.
                </>
              ) : (
                <>Darker states grow more. Pick a crop to repaint the map.</>
              )}
            </p>
            {cropPicker}
            <div className="ws-map">
              {production.status === 'ready' && map.status === 'ready' && map.data ? (
                <>
                  <IndiaMap
                    geo={map.data}
                    values={values}
                    classes={classes}
                    selected={null}
                    maxHeight={250}
                    ariaLabel={`${crop} production by state`}
                    label={(s, v) => `${s}: ${v == null ? 'no record' : tonnes(v * 1e6)}`}
                  />
                  <MapLegend classes={classes} unit="million tonnes" title="Production" />
                </>
              ) : (
                <LoadingState label="Loading map" height={200} />
              )}
            </div>
          </article>

          <article className="ws-beat" aria-hidden={beat !== 2 && !reduced}>
            <span className="eyebrow">03 · Where it goes</span>
            <h2 className="display ws-h">
              Then follow
              <br />
              the supply
            </h2>
            <p className="ws-p">
              {flows && fy != null ? (
                <>
                  Of India&rsquo;s {crop.toLowerCase()} supply in {fy}, <b>{pct(flows.destinations.find((d) => d.name === 'Food')?.share, 0)}</b> was available as food. The rest went to feed, seed, losses, trade and stocks.
                </>
              ) : (
                <>See how supply splits into food, animal feed, seed, losses and trade.</>
              )}
            </p>
            {cropPicker}
            {flows && fy != null ? (
              <>
                <ShareBars
                  ariaLabel={`Where ${crop.toLowerCase()} supply went in ${fy}`}
                  rows={[
                    {
                      label: `${crop} · ${fy}`,
                      segments: flows.destinations.map((d) => ({ name: d.name, label: FLOW_INFO[d.name]?.label ?? d.name, share: d.share, color: FLOW_INFO[d.name]?.color ?? '#999' })),
                    },
                  ]}
                />
                <Legend items={flows.destinations.map((d) => ({ label: `${FLOW_INFO[d.name]?.label ?? d.name} ${pct(d.share, 0)}`, color: FLOW_INFO[d.name]?.color ?? '#999' }))} />
              </>
            ) : (
              <LoadingState label="Loading balance" height={90} />
            )}
            <p className="ws-p ws-p--small">Food supply is an estimate of what is available to eat, not what people actually eat.</p>
            <div className="ws-cta">
              <button
                type="button"
                className="btn btn--accent"
                onClick={() => document.getElementById('explore')?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })}
              >
                Start exploring <IconChevronDown width={18} height={18} />
              </button>
              <button type="button" className="btn" onClick={() => navigate('#/menu')}>
                Jump to a section <IconArrowRight width={18} height={18} />
              </button>
            </div>
          </article>
        </div>
      </div>
    </section>
  )
}
