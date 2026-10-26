import { useEffect, useRef, useState } from 'react'
import { useData } from '../data/DataContext'
import { shareOfDomesticSupply } from '../data/balance'
import { CROPS, type Crop } from '../data/types'
import { CloudStrip, CoverLeft, CoverRight, CoverRings } from '../illustrations/CoverArt'
import { Scene, type SceneVariant } from '../illustrations/Scenes'
import { CropGlyph, IconArrowRight, IconChevronDown, IconDatabase, IconMenu } from '../components/Icons'
import { pct, tonnes, yieldStr } from '../lib/format'
import { useReducedMotion } from '../lib/hooks'
import { navigate } from '../lib/router'
import { resolveYear, useFilters } from '../state/filters'

export default function Home() {
  return (
    <main className="home">
      <Cover />
      <ExploreHub />
    </main>
  )
}

/* ------------------------------------------------------------------ */
function Cover() {
  const ref = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { production, balance } = useData()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const update = () => {
      raf = 0
      const total = el.offsetHeight - window.innerHeight
      const p = total > 0 ? Math.min(1, Math.max(0, -el.getBoundingClientRect().top / total)) : 0
      el.style.setProperty('--p', p.toFixed(4))
      el.style.setProperty('--mid', Math.max(0, 1 - Math.abs(p - 0.42) * 3.2).toFixed(3))
      el.classList.toggle('is-moving', p > 0.002)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    // Pause the cloud drift whenever the cover is off screen.
    const io = new IntersectionObserver(([entry]) => el.classList.toggle('is-offscreen', !entry.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      cancelAnimationFrame(raf)
      io.disconnect()
    }
  }, [reduced])

  const toHub = () => {
    const hub = document.getElementById('explore')
    if (hub) window.scrollTo({ top: hub.getBoundingClientRect().top + window.scrollY, behavior: reduced ? 'auto' : 'smooth' })
  }

  const y0 = production.data?.years[0]
  const y1 = Math.max(production.data?.years.at(-1) ?? 0, balance.data?.years.at(-1) ?? 0)

  return (
    <section ref={ref} className={`cover ${reduced ? 'cover--static' : ''}`} aria-label="Crop Journey">
      <div className="cover__sticky">
        <div className="cover__clouds" aria-hidden>
          <div className="cloud-layer cloud-layer--a">
            <CloudStrip set={0} />
          </div>
          <div className="cloud-layer cloud-layer--b">
            <CloudStrip set={1} />
          </div>
          <div className="cloud-layer cloud-layer--c">
            <CloudStrip set={2} />
          </div>
        </div>
        <div className="cover__rings">
          <CoverRings />
        </div>
        <div className="cover__art cover__art--left">
          <CoverLeft />
        </div>
        <div className="cover__art cover__art--right">
          <CoverRight />
        </div>
        <div className="cover__meta cover__meta--tl mono" aria-hidden>
          Land
          <br />
          People
          <br />
          Seasons
          <br />
          Markets
          <br />A longer story
        </div>
        {y0 != null && y1 > 0 && (
          <div className="cover__meta cover__meta--tr mono">
            <span className="sr-only">Data coverage </span>
            {y0}
            <br />
            {y1}
          </div>
        )}
        <svg className="cover__sun" viewBox="0 0 40 40" aria-hidden>
          <circle cx="20" cy="20" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M20 4v6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" transform={`rotate(${i * 30} 20 20)`} />
          ))}
        </svg>
        <div className="cover__title">
          <h1 className="display cover__h">
            <span>Crop</span>
            <span>Journey</span>
          </h1>
          <p className="cover__sub">
            India&rsquo;s harvest
            <br />
            beyond the fields
          </p>
        </div>
        <p className="cover__between mono" aria-hidden>
          Exploring
          <br />a bigger picture
        </p>
        <button type="button" className="cover__scroll" onClick={toHub}>
          <IconChevronDown width={18} height={18} />
          <span className="mono">Scroll to explore</span>
        </button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ */
interface Story {
  id: string
  title: string
  to: string
  scene: SceneVariant
  preview: string | null
}

function ExploreHub() {
  const { production, balance } = useData()
  const { filters } = useFilters()
  const [active, setActive] = useState<string | null>(null)
  const reduced = useReducedMotion()
  const crop = filters.crop
  const p = production.data
  const b = balance.data

  const year = p ? resolveYear(filters.year, p.yearsByCrop[crop]) : null
  const nat = p && year != null ? p.nationalYear(crop, year) : undefined
  const top = p && year != null ? p.stateRows(crop, year)[0] : undefined
  const fy = b ? resolveYear(filters.fbsYear, b.yearsByCrop[crop]) : null
  const food = b && fy != null ? shareOfDomesticSupply(b.elements(crop, fy), 'Food') : null
  const loading = production.status === 'loading' || production.status === 'idle'

  const open = (id: string, to: string) => {
    if (active) return
    setActive(id)
    window.setTimeout(() => navigate(to), reduced ? 0 : 170)
  }

  const stories: Story[] = [
    {
      id: 'utilization',
      title: 'National Utilization',
      to: '#/utilization',
      scene: 'sacks',
      preview: food != null ? `Food: ${pct(food, 0)} of ${crop.toLowerCase()} supply, ${fy}` : null,
    },
    {
      id: 'yield',
      title: 'Yield & Productivity',
      to: '#/area-yield',
      scene: 'terraces',
      preview: nat?.yield != null && year != null ? `${crop} ${p?.cropYear(year)}: ${yieldStr(nat.yield)}` : null,
    },
    {
      id: 'compare',
      title: 'Crop Comparison',
      to: '#/compare',
      scene: 'palms',
      preview: p ? `${CROPS.length} crops · ${p.cropYear(p.years[0])} to ${p.cropYear(p.years.at(-1)!)}` : null,
    },
    { id: 'insights', title: 'Key Insights', to: '#/insights', scene: 'wheatfield', preview: p ? 'Findings computed from the data' : null },
  ]

  useEffect(() => {
    const reset = () => setActive(null)
    window.addEventListener('pageshow', reset)
    return () => window.removeEventListener('pageshow', reset)
  }, [])

  return (
    <section className="hub" id="explore" aria-label="Explore India's harvest">
      <header className="hub__bar wrap">
        <div className="brand">
          <CropGlyph crop="Wheat" width={22} height={22} />
          <span className="display">Crop Journey</span>
        </div>
        <button type="button" className="icon-btn" aria-label="Open section navigator" onClick={() => navigate('#/menu')}>
          <IconMenu />
        </button>
      </header>
      <div className="wrap hub__body">
        <div className="hub__intro">
          <h2 className="display hub__title">
            Explore India&rsquo;s harvest
            <br />
            through data
          </h2>
          <p className="lede">From fields to food, feed, industry and beyond.</p>
          {p && (
            <p className="hub__coverage mono">
              Production {p.cropYear(p.years[0])} → {p.cropYear(p.years.at(-1)!)}
              {b && ` · Utilization ${b.years[0]} → ${b.years.at(-1)}`}
            </p>
          )}
        </div>

        <div className="hub__layout">
          <button
            type="button"
            className={`story story--hero ${active === 'production' ? 'is-active' : ''}`}
            onClick={() => open('production', '#/production')}
          >
            <Scene variant="valley" className="story__art" />
            <span className="story__shade" />
            <span className="story__content">
              <span className="story__kicker mono">01 · Where crops grow</span>
              <span className="display story__title">
                Production
                <br />
                Landscape
              </span>
              <span className="story__preview">
                {loading ? (
                  <span className="story__loading">Loading figures…</span>
                ) : nat?.production != null && top && year != null ? (
                  <>
                    {crop} {p?.cropYear(year)}: <b>{tonnes(nat.production)}</b> · top state {top.state}
                  </>
                ) : production.status === 'error' ? (
                  'Data unavailable, open to retry'
                ) : (
                  'No figures for this selection'
                )}
              </span>
            </span>
            <span className="story__go" aria-hidden>
              <IconArrowRight />
            </span>
          </button>

          <div className="hub__grid">
            {stories.map((s, i) => (
              <button key={s.id} type="button" className={`story story--tile ${active === s.id ? 'is-active' : ''}`} onClick={() => open(s.id, s.to)}>
                <Scene variant={s.scene} className="story__art" />
                <span className="story__shade" />
                <span className="story__content">
                  <span className="story__kicker mono">0{i + 2}</span>
                  <span className="display story__title">{s.title}</span>
                  {s.preview && <span className="story__preview story__preview--small">{s.preview}</span>}
                </span>
                <span className="story__go" aria-hidden>
                  <IconArrowRight />
                </span>
              </button>
            ))}
          </div>
        </div>

        <section className="hub__crops" aria-labelledby="crops-h">
          <div className="row row--between">
            <h3 id="crops-h" className="h3">
              Follow one crop
            </h3>
            <span className="mono">{p && year != null ? `latest: ${p.cropYear(year)}` : ''}</span>
          </div>
          <div className="crop-strip">
            {CROPS.map((c: Crop) => {
              const y = p ? resolveYear(null, p.yearsByCrop[c]) : null
              const n = p && y != null ? p.nationalYear(c, y) : undefined
              return (
                <button key={c} type="button" className="crop-chip" onClick={() => navigate(`#/crop/${c.toLowerCase()}`)}>
                  <span className={`crop-chip__glyph crop-chip__glyph--${c.toLowerCase()}`}>
                    <CropGlyph crop={c} width={26} height={26} />
                  </span>
                  <span className="crop-chip__name">{c}</span>
                  <span className="crop-chip__val num">{n?.production != null ? tonnes(n.production) : loading ? '…' : '—'}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="hub__footer">
          <button type="button" className="btn btn--primary" onClick={() => navigate('#/menu')}>
            <IconMenu width={18} height={18} /> Section navigator
          </button>
          <button type="button" className="btn" onClick={() => navigate('#/data')}>
            <IconDatabase width={18} height={18} /> Data &amp; methods
          </button>
          <p className="small muted hub__credit">
            Production: Directorate of Economics &amp; Statistics (DES), district-wise APY. Utilization: FAOSTAT Food Balances. Boundaries: DataMeet (CC BY 4.0). Figures are as reported; see
            Data &amp; methods for definitions and limits.
          </p>
        </div>
      </div>
    </section>
  )
}
