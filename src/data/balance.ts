import type { BalanceRow, Flow, FlowResult } from './types'

/** Utilization elements in display order (FAOSTAT element names). */
export const USE_ELEMENTS = [
  'Food',
  'Feed',
  'Seed',
  'Processing',
  'Losses',
  'Other uses (non-food)',
  'Tourist consumption',
  'Residuals',
] as const

export const FLOW_INFO: Record<string, { label: string; color: string; definition: string }> = {
  Production: { label: 'Production', color: '#65785a', definition: 'Domestic production in the FAO reference year.' },
  Imports: { label: 'Imports', color: '#93a68b', definition: 'Quantity imported into India.' },
  'Stock drawdown': {
    label: 'Stock drawdown',
    color: '#d0bda0',
    definition: 'Stocks released during the year (FAOSTAT stock variation below zero).',
  },
  'Negative residual': {
    label: 'Balancing residual',
    color: '#b9b2a2',
    definition: 'FAOSTAT balancing item when recorded uses exceed supply; it is a statistical adjustment, not a physical flow.',
  },
  Exports: { label: 'Exports', color: '#252a25', definition: 'Quantity exported from India.' },
  'Stock build-up': {
    label: 'Stock build-up',
    color: '#b8935a',
    definition: 'Stocks added during the year (FAOSTAT stock variation above zero).',
  },
  Food: {
    label: 'Food',
    color: '#65785a',
    definition: 'Quantity available for human consumption. An estimate of food supply, not measured intake.',
  },
  Feed: { label: 'Animal feed', color: '#93a68b', definition: 'Quantity fed to livestock and poultry.' },
  Seed: { label: 'Seed', color: '#d0bda0', definition: 'Quantity set aside for sowing.' },
  Processing: {
    label: 'Processing',
    color: '#e4b3a9',
    definition: 'Quantity processed into products accounted for elsewhere in the food balance (for example oil or beverages).',
  },
  Losses: { label: 'Losses', color: '#c86d67', definition: 'Post-harvest losses during storage and transport up to the retail level.' },
  'Other uses (non-food)': { label: 'Other uses', color: '#8a8478', definition: 'Non-food industrial uses such as biofuel or starch.' },
  'Tourist consumption': { label: 'Tourist consumption', color: '#a99d86', definition: 'Food consumed by non-resident visitors.' },
  Residual: {
    label: 'Residual',
    color: '#b9b2a2',
    definition: 'FAOSTAT balancing item absorbing statistical discrepancies; not a physical use.',
  },
}

/**
 * Sankey decomposition of a crop-year balance. Mirrors build_flows() in
 * scripts/prepare_data.py:
 *   sources       Production, Imports, Stock drawdown (-SV if SV<0), Negative residual (-R if R<0)
 *   destinations  Exports, Stock build-up (SV if SV>0), each reported use, Residual (R if R>0)
 * FAOSTAT's identity domestic supply = P + I - E - SV = sum(uses) makes both sides equal.
 * Elements that FAOSTAT does not report are omitted, never set to zero.
 */
export function computeFlows(elements: Map<string, BalanceRow>): FlowResult | null {
  const v = (e: string): number | null => {
    const r = elements.get(e)
    return r && r.unit === '1000 t' && Number.isFinite(r.value) ? r.value : null
  }
  const production = v('Production')
  if (production == null) return null
  const sv = v('Stock Variation')
  const res = v('Residuals')
  const rawSources: [string, number | null][] = [
    ['Production', production],
    ['Imports', v('Import quantity')],
    ['Stock drawdown', sv != null && sv < 0 ? -sv : null],
    ['Negative residual', res != null && res < 0 ? -res : null],
  ]
  const rawDest: [string, number | null][] = [
    ['Exports', v('Export quantity')],
    ['Stock build-up', sv != null && sv > 0 ? sv : null],
    ...USE_ELEMENTS.map((e): [string, number | null] => {
      if (e === 'Residuals') return ['Residual', res != null && res > 0 ? res : null]
      return [e, v(e)]
    }),
  ]
  const keep = (list: [string, number | null][]) => list.filter((x): x is [string, number] => x[1] != null && x[1] > 0)
  const s = keep(rawSources)
  const d = keep(rawDest)
  const totalSupply = s.reduce((a, [, x]) => a + x, 0)
  const totalDest = d.reduce((a, [, x]) => a + x, 0)
  const gap = totalSupply - totalDest
  const mk = (side: Flow['side']) => ([name, value]: [string, number]): Flow => ({
    name,
    side,
    value,
    share: totalSupply > 0 ? value / totalSupply : 0,
  })
  return {
    sources: s.map(mk('source')),
    destinations: d.map(mk('destination')),
    totalSupply,
    domesticSupply: v('Domestic supply quantity'),
    gap,
    reconciled: Math.abs(gap) <= Math.max(1, 0.005 * totalSupply),
  }
}

/** Share of FAOSTAT domestic supply taken by one utilization element (used by insights). */
export function shareOfDomesticSupply(elements: Map<string, BalanceRow>, element: string): number | null {
  const ds = elements.get('Domestic supply quantity')?.value
  const x = elements.get(element)?.value
  if (ds == null || x == null || ds <= 0) return null
  return x / ds
}
