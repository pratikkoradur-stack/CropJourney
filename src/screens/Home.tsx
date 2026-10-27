import { useMemo } from 'react'
import { useData } from '../data/DataContext'
import { shareOfDomesticSupply } from '../data/balance'
import { computeInsights } from '../data/insights'
import { CROPS, type Crop } from '../data/types'
import { CropGlyph, IconDatabase } from '../components/Icons'
import { CropTabs } from '../components/ui'
import TimeLapse from '../components/TimeLapse'
import { pct, tonnes, yieldStr } from '../lib/format'
import { navigate } from '../lib/router'
import { resolveYear, useFilters } from '../state/filters'
import { SectionDial } from './Menu'
import Welcome from './Welcome'

export default function Home() {
  return (
    <main className="home">
      <Welcome />
      <ExploreHub />
    </main>
  )
}

function ExploreHub() {
  const { production, balance } = useData()
  const { filters, setFilters } = useFilters()
  const crop = filters.crop
  const p = production.data
  const b = balance.data

  const previews = useMemo(() => {
    const out: Record<string, string> = {}
    if (p) {
      const year = resolveYear(filters.year, p.yearsByCrop[crop])
      if (year != null) {
        const nat = p.nationalYear(crop, year)
        const top = p.stateRows(crop, year)[0]
        if (nat?.production != null) out.production = `${crop} ${p.cropYear(year)}: ${tonnes(nat.production)}${top ? `, led by ${top.state}` : ''}`
        if (nat?.yield != null) out['area-yield'] = `${crop} ${p.cropYear(year)}: ${yieldStr(nat.yield)} nationally`
      }
      out.compare = `${CROPS.length} crops, ${p.cropYear(p.years[0])} to ${p.cropYear(p.years[p.years.length - 1])}`
      const n = computeInsights(p, b).insights.length
      if (n) out.insights = `${n} findings computed from the data`
    }
    if (b) {
      const fy = resolveYear(filters.year != null && b.yearsByCrop[crop].includes(filters.year) ? filters.year : filters.fbsYear, b.yearsByCrop[crop])
      if (fy != null) {
        const el = b.elements(crop, fy)
        const food = shareOfDomesticSupply(el, 'Food')
        if (food != null) out.utilization = `${fy}: food is ${pct(food, 0)} of ${crop.toLowerCase()} supply`
        const prod = el.get('Production')?.value
        const exp = el.get('Export quantity')?.value
        if (prod && exp != null) out.trade = `${fy}: exports equal ${pct(exp / prod, 1)} of ${crop.toLowerCase()} production`
      }
    }
    return out
  }, [p, b, crop, filters.year, filters.fbsYear])

  return (
    <section className="hub" id="explore" aria-label="Explore India's harvest">
      <header className="hub__bar wrap">
        <div className="brand">
          <CropGlyph crop="Wheat" width={22} height={22} />
          <span className="display">Crop Journey</span>
        </div>
      </header>
      <div className="wrap hub__body">
        <div className="hub__intro">
          <h2 className="display hub__title">
            Explore India&rsquo;s harvest
            <br />
            through data
          </h2>
          <p className="lede">From fields to food, feed, industry and beyond. Pick a crop, then spin the dial to choose where to look.</p>
          <CropTabs value={crop} onChange={(c: Crop) => setFilters({ crop: c, year: null, fbsYear: null, state: null })} />
        </div>
      </div>

      <div className="wrap hub__body">
        <TimeLapse crop={crop} />
      </div>

      <SectionDial previews={previews} crop={crop} />

      <div className="wrap hub__body">
        <section className="hub__crops" aria-labelledby="crops-h">
          <div className="row row--between">
            <h3 id="crops-h" className="h3">
              Or follow one crop
            </h3>
            <span className="mono">{p ? `latest: ${p.cropYear(p.years[p.years.length - 1])}` : ''}</span>
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
                  <span className="crop-chip__val num">{n?.production != null ? tonnes(n.production) : production.status === 'ready' ? '—' : '…'}</span>
                </button>
              )
            })}
          </div>
        </section>

        <div className="hub__footer">
          <button type="button" className="btn" onClick={() => navigate('#/data')}>
            <IconDatabase width={18} height={18} /> Data &amp; methods
          </button>
          <p className="small muted hub__credit">
            Production: Directorate of Economics &amp; Statistics (DES), district-wise APY. Utilization: FAOSTAT Food Balances. Boundaries: DataMeet (CC BY 4.0). Figures are as reported; see Data &amp;
            methods for definitions and limits.
          </p>
        </div>
      </div>
    </section>
  )
}
