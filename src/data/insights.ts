import { combine, pctChange } from './aggregate'
import { shareOfDomesticSupply } from './balance'
import type { BalanceStore, ProductionStore } from './store'
import { CROPS, CROP_COLOR, type Crop } from './types'
import { pct, signedPct, yieldStr } from '../lib/format'
import type { Filters } from '../state/filters'

export interface Insight {
  id: string
  kicker: string
  figure: string
  text: string
  metric: string
  period: string
  source: string
  link: { to: string; filters?: Partial<Filters>; label: string }
  spark?: (number | null)[]
  sparkColor?: string
}

export interface InsightResult {
  insights: Insight[]
  unavailable: { id: string; reason: string }[]
}

const DES = 'DES district-wise APY (sum of district records)'
const FBS = 'FAOSTAT Food Balances (2010-), India'
const WINDOW = 3

/** All findings are computed from the loaded datasets; none are hard-coded. */
export function computeInsights(prod: ProductionStore, bal?: BalanceStore): InsightResult {
  const insights: Insight[] = []
  const unavailable: InsightResult['unavailable'] = []
  const cy = prod.cropYear

  // Latest year in which all four crops have known national production and complete coverage.
  const common = prod.referenceYears(CROPS).filter((y) => CROPS.every((c) => prod.nationalYear(c, y)?.production != null))
  const L = common[common.length - 1]

  // 1. Rice + wheat share of the four crops
  if (L != null) {
    const shareIn = (y: number) => {
      const v = CROPS.map((c) => prod.nationalYear(c, y)?.production ?? 0)
      const total = v.reduce((a, b) => a + b, 0)
      return total > 0 ? (v[0] + v[1]) / total : null
    }
    const s = shareIn(L)
    insights.push({
      id: 'rice-wheat-share',
      kicker: 'Production share',
      figure: pct(s, 0),
      text: `Rice and wheat made up ${pct(s)} of the combined recorded production of the four crops covered here in ${cy(L)}.`,
      metric: '(rice + wheat) ÷ (rice + wheat + maize + pulses) production, tonnes',
      period: cy(L),
      source: DES,
      link: { to: '#/compare', filters: { compareMetric: 'production', year: L }, label: 'Compare crops' },
      spark: common.map(shareIn),
      sparkColor: CROP_COLOR.Rice,
    })
  } else unavailable.push({ id: 'rice-wheat-share', reason: 'No year has production for all four crops.' })

  // 2. Concentration in the top five states
  if (L != null) {
    const conc = CROPS.map((c) => {
      const rows = prod.stateRows(c, L).filter((r) => r.production != null)
      const total = rows.reduce((a, r) => a + (r.production ?? 0), 0)
      const top5 = rows.slice(0, 5).reduce((a, r) => a + (r.production ?? 0), 0)
      return { c, share: total ? top5 / total : 0, top: rows[0], topShare: total && rows[0] ? (rows[0].production ?? 0) / total : 0 }
    }).sort((a, b) => b.share - a.share)[0]
    if (conc.top) {
      insights.push({
        id: 'concentration',
        kicker: 'Geographic concentration',
        figure: pct(conc.share, 0),
        text: `Five states accounted for ${pct(conc.share)} of recorded ${conc.c.toLowerCase()} production in ${cy(L)}, the highest concentration of the four crops; ${conc.top.state} alone contributed ${pct(conc.topShare)}.`,
        metric: 'Top-5 state production ÷ total of district records, same crop and year',
        period: cy(L),
        source: DES,
        link: { to: '#/production', filters: { crop: conc.c, year: L, state: conc.top.state }, label: 'Open production map' },
      })
    }
  }

  // 3 & 4. Long-run change: first vs last window of three consecutive reference-quality years
  // (averages reduce single-season noise; incomplete years are never used as a baseline)
  const runs = prod.referenceRuns(CROPS, WINDOW)
  const first = runs[0] ?? []
  const last = runs[runs.length - 1] ?? []
  const label = (ys: number[]) => `${cy(ys[0])} to ${cy(ys[ys.length - 1])}`
  if (runs.length >= 2 && first[0] !== last[0] && first[WINDOW - 1] < last[0]) {
    const change = CROPS.map((c) => {
      const pick = (ys: number[]) => {
        const rows = ys.map((y) => prod.nationalYear(c, y)).filter((r) => r != null)
        return rows.length === ys.length ? combine(rows) : null
      }
      const a = pick(first)
      const b = pick(last)
      return {
        c,
        ok: a != null && b != null,
        prod: pctChange(a?.production, b?.production),
        area: pctChange(a?.area, b?.area),
        yld: pctChange(a?.yield, b?.yield),
      }
    }).filter((x) => x.ok && x.prod != null)
    if (change.length) {
      const lead = [...change].sort((a, b) => (b.prod ?? 0) - (a.prod ?? 0))[0]
      insights.push({
        id: 'growth-leader',
        kicker: 'Long-run change',
        figure: signedPct(lead.prod, 0),
        text: `${lead.c} production grew the most of the four crops: average annual output in ${label(last)} was ${signedPct(lead.prod)} compared with ${label(first)}. Over the same windows its cultivated area changed by ${signedPct(lead.area)} and its yield by ${signedPct(lead.yld)}.`,
        metric: 'Change in 3-year total production (and area, yield) between the first and last windows of the series',
        period: `${label(first)} vs ${label(last)}`,
        source: DES,
        link: { to: '#/area-yield', filters: { crop: lead.c, state: null, rangeStart: null, rangeEnd: null }, label: 'See area & yield' },
        spark: prod.national(lead.c).map((n) => n.production),
        sparkColor: CROP_COLOR[lead.c],
      })
      const rest = change.filter((x) => x.c !== lead.c && x.area != null && x.yld != null)
      const gap = rest.sort((a, b) => (b.prod ?? 0) - (b.area ?? 0) - ((a.prod ?? 0) - (a.area ?? 0)))[0]
      if (gap) {
        insights.push({
          id: 'area-vs-production',
          kicker: 'Area versus output',
          figure: signedPct(gap.yld, 0),
          text: `For ${gap.c.toLowerCase()}, production changed by ${signedPct(gap.prod)} between ${label(first)} and ${label(last)} while cultivated area changed by ${signedPct(gap.area)}; output per hectare was ${signedPct(gap.yld)} different. This describes the pattern only; the data do not identify its causes.`,
          metric: 'Yield = production ÷ area with known production, pooled over each 3-year window',
          period: `${label(first)} vs ${label(last)}`,
          source: DES,
          link: { to: '#/area-yield', filters: { crop: gap.c, state: null }, label: 'See area & yield' },
          spark: prod.national(gap.c).map((n) => n.yield),
          sparkColor: CROP_COLOR[gap.c],
        })
      }
    }
  } else
    unavailable.push({
      id: 'growth-leader',
      reason: `Long-run comparisons need two separate windows of ${WINDOW} consecutive years with complete records for all four crops, and the loaded data do not have them.`,
    })

  // 5. Yield gap between major producing states
  if (L != null) {
    const gaps = CROPS.map((c) => {
      const nat = prod.nationalYear(c, L)
      const rows = prod
        .stateRows(c, L)
        .filter((r) => r.yield != null && nat && nat.area > 0 && r.area / nat.area >= 0.02)
        .sort((a, b) => (b.yield ?? 0) - (a.yield ?? 0))
      if (rows.length < 3) return null
      const hi = rows[0]
      const lo = rows[rows.length - 1]
      return { c, hi, lo, ratio: (hi.yield ?? 0) / (lo.yield ?? 1), n: rows.length }
    }).filter((g) => g != null)
    const g = gaps.sort((a, b) => b.ratio - a.ratio)[0]
    if (g) {
      insights.push({
        id: 'yield-gap',
        kicker: 'Yield gap',
        figure: `${g.ratio.toFixed(1)}×`,
        text: `Among the ${g.n} states holding at least 2% of national ${g.c.toLowerCase()} area in ${cy(L)}, yield ranged from ${yieldStr(g.lo.yield)} in ${g.lo.state} to ${yieldStr(g.hi.yield)} in ${g.hi.state}.`,
        metric: 'State yield = production ÷ area with known production; states below 2% of national area excluded',
        period: cy(L),
        source: DES,
        link: { to: '#/area-yield', filters: { crop: g.c, rangeEnd: L, state: null }, label: 'Compare state yields' },
      })
    }
  }

  // 6-8. National utilization (FAOSTAT)
  if (bal) {
    const latest = (c: Crop) => bal.yearsByCrop[c][bal.yearsByCrop[c].length - 1]
    const earliest = (c: Crop) => bal.yearsByCrop[c][0]
    const feed = CROPS.map((c) => ({ c, y: latest(c), y0: earliest(c) }))
      .filter((x) => x.y != null)
      .map((x) => ({ ...x, s: shareOfDomesticSupply(bal.elements(x.c, x.y), 'Feed'), s0: shareOfDomesticSupply(bal.elements(x.c, x.y0), 'Feed') }))
      .filter((x) => x.s != null)
      .sort((a, b) => (b.s ?? 0) - (a.s ?? 0))[0]
    if (feed) {
      insights.push({
        id: 'feed-share',
        kicker: 'Animal feed',
        figure: pct(feed.s, 0),
        text: `Feed accounted for ${pct(feed.s)} of ${feed.c.toLowerCase()} domestic supply in ${feed.y}, compared with ${pct(feed.s0)} in ${feed.y0}; it is the largest feed share among the four crops. These are FAOSTAT estimates of use, not measured flows.`,
        metric: 'Feed ÷ domestic supply quantity, FAOSTAT food balance',
        period: `${feed.y0} and ${feed.y}`,
        source: FBS,
        link: { to: '#/utilization', filters: { crop: feed.c, fbsYear: feed.y }, label: 'Open utilization' },
        spark: bal.yearsByCrop[feed.c].map((y) => shareOfDomesticSupply(bal.elements(feed.c, y), 'Feed')),
        sparkColor: CROP_COLOR[feed.c],
      })
    }
    const food = CROPS.map((c) => ({ c, y: latest(c), s: latest(c) != null ? shareOfDomesticSupply(bal.elements(c, latest(c)), 'Food') : null }))
      .filter((x) => x.s != null)
      .sort((a, b) => (b.s ?? 0) - (a.s ?? 0))
    if (food.length >= 2 && food[0].y === food[food.length - 1].y) {
      const hi = food[0]
      const lo = food[food.length - 1]
      insights.push({
        id: 'food-share',
        kicker: 'Food supply',
        figure: pct(hi.s, 0),
        text: `Food made up ${pct(hi.s)} of ${hi.c.toLowerCase()} domestic supply but ${pct(lo.s)} of ${lo.c.toLowerCase()} in ${hi.y}. Food supply estimates quantity available for people to eat, not actual consumption.`,
        metric: 'Food ÷ domestic supply quantity, FAOSTAT food balance',
        period: String(hi.y),
        source: FBS,
        link: { to: '#/compare', filters: { compareMetric: 'utilization', fbsYear: hi.y }, label: 'Compare utilization' },
      })
    }
    const exp = CROPS.map((c) => {
      const y = latest(c)
      const y0 = earliest(c)
      const ratio = (yr: number) => {
        const e = bal.elements(c, yr)
        const p = e.get('Production')?.value
        const x = e.get('Export quantity')?.value
        return p && x != null ? x / p : null
      }
      return { c, y, y0, r: y != null ? ratio(y) : null, r0: y0 != null ? ratio(y0) : null, series: bal.yearsByCrop[c].map(ratio) }
    })
      .filter((x) => x.r != null)
      .sort((a, b) => (b.r ?? 0) - (a.r ?? 0))[0]
    if (exp) {
      insights.push({
        id: 'export-ratio',
        kicker: 'Trade',
        figure: pct(exp.r, 0),
        text: `${exp.c} exports were equivalent to ${pct(exp.r)} of its production in ${exp.y}, against ${pct(exp.r0)} in ${exp.y0}. Both quantities share FAOSTAT's ${bal.basis(exp.c) || 'commodity'} basis.`,
        metric: 'Export quantity ÷ production, FAOSTAT food balance (same commodity basis)',
        period: `${exp.y0} and ${exp.y}`,
        source: FBS,
        link: { to: '#/utilization?tab=trade', filters: { crop: exp.c }, label: 'Open trade & stocks' },
        spark: exp.series,
        sparkColor: CROP_COLOR[exp.c],
      })
    }
  } else unavailable.push({ id: 'utilization', reason: 'The national crop balance is not loaded, so utilization findings are omitted.' })

  return { insights, unavailable }
}
