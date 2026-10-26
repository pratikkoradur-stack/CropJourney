const fixed = (v: number, d: number) =>
  v.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

export interface Parts {
  value: string
  unit: string
}

/** Tonnes to an adaptive unit (Mt, thousand t, t). */
export function tonnesParts(t: number | null | undefined): Parts {
  if (t == null || !Number.isFinite(t)) return { value: '—', unit: '' }
  const a = Math.abs(t)
  if (a >= 1e6) return { value: fixed(t / 1e6, a >= 1e7 ? 1 : 2), unit: 'Mt' }
  if (a >= 1e3) return { value: fixed(t / 1e3, a >= 1e5 ? 0 : 1), unit: 'thousand t' }
  return { value: fixed(t, 0), unit: 't' }
}

export function hectaresParts(ha: number | null | undefined): Parts {
  if (ha == null || !Number.isFinite(ha)) return { value: '—', unit: '' }
  const a = Math.abs(ha)
  if (a >= 1e6) return { value: fixed(ha / 1e6, 2), unit: 'M ha' }
  if (a >= 1e3) return { value: fixed(ha / 1e3, a >= 1e5 ? 0 : 1), unit: 'thousand ha' }
  return { value: fixed(ha, 0), unit: 'ha' }
}

export const joinParts = (p: Parts) => (p.unit ? `${p.value} ${p.unit}` : p.value)
export const tonnes = (t: number | null | undefined) => joinParts(tonnesParts(t))
export const hectares = (ha: number | null | undefined) => joinParts(hectaresParts(ha))

export function yieldStr(y: number | null | undefined, unit = true): string {
  if (y == null || !Number.isFinite(y)) return '—'
  return unit ? `${fixed(y, 2)} t/ha` : fixed(y, 2)
}

export function pct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return '—'
  return `${fixed(x * 100, digits)}%`
}

export function signedPct(x: number | null | undefined, digits = 1): string {
  if (x == null || !Number.isFinite(x)) return '—'
  const s = fixed(Math.abs(x) * 100, digits)
  return `${x > 0 ? '+' : x < 0 ? '−' : '±'}${s}%`
}

/** FAOSTAT quantities arrive in thousand tonnes. */
export function ktToMt(v: number | null | undefined, digits?: number): string {
  if (v == null || !Number.isFinite(v)) return '—'
  const mt = v / 1000
  const d = digits ?? (Math.abs(mt) >= 10 ? 1 : Math.abs(mt) >= 1 ? 2 : 3)
  return `${fixed(mt, d)} Mt`
}

export const mt = (t: number) => t / 1e6
export const mha = (ha: number) => ha / 1e6

export function compactNumber(v: number, digits = 1): string {
  return v.toLocaleString('en-IN', { maximumFractionDigits: digits })
}

export function dateStr(iso: string | undefined): string {
  if (!iso) return 'unknown date'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
