import { useId, useState, type ReactNode } from 'react'
import type { ProductionStore } from '../data/store'
import { CROPS, type Crop } from '../data/types'
import { pct } from '../lib/format'
import { CropGlyph, IconAlert, IconChevronDown, IconChevronLeft, IconChevronRight, IconInfo, IconRefresh } from './Icons'

/* ---------------------------------------------------------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  variant,
  size,
}: {
  options: { value: T; label: ReactNode; disabled?: boolean; title?: string }[]
  value: T
  onChange(v: T): void
  label: string
  variant?: 'block'
  size?: 'small'
}) {
  return (
    <div className={`seg ${variant === 'block' ? 'seg--block' : ''} ${size === 'small' ? 'seg--small' : ''}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="seg__btn"
          aria-pressed={o.value === value}
          disabled={o.disabled}
          title={o.title}
          onClick={() => o.value !== value && onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function CropTabs({
  value,
  onChange,
  available,
  label = 'Crop',
}: {
  value: Crop
  onChange(c: Crop): void
  available?: Partial<Record<Crop, boolean>>
  label?: string
}) {
  return (
    <Segmented
      label={label}
      value={value}
      onChange={onChange}
      options={CROPS.map((c) => ({
        value: c,
        disabled: available ? available[c] === false : false,
        title: available && available[c] === false ? `No ${c.toLowerCase()} records for this selection` : undefined,
        label: (
          <>
            <CropGlyph crop={c} width={16} height={16} />
            {c}
          </>
        ),
      }))}
    />
  )
}

/* ---------------------------------------------------------------- */
export function SelectField<T extends string | number>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange(v: T): void
  disabled?: boolean
}) {
  const id = useId()
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <div className="field__control">
        <select
          id={id}
          value={String(value)}
          disabled={disabled || options.length === 0}
          onChange={(e) => {
            const o = options.find((x) => String(x.value) === e.target.value)
            if (o) onChange(o.value)
          }}
        >
          {options.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
        <IconChevronDown className="field__chevron" />
      </div>
    </div>
  )
}

export function YearStepper({
  label = 'Year',
  years,
  value,
  onChange,
  format,
}: {
  label?: string
  years: number[]
  value: number | null
  onChange(y: number): void
  format(y: number): string
}) {
  const i = value == null ? -1 : years.indexOf(value)
  return (
    <div className="stepper">
      <button type="button" className="icon-btn" aria-label="Previous year" disabled={i <= 0} onClick={() => onChange(years[i - 1])}>
        <IconChevronLeft />
      </button>
      <SelectField
        label={label}
        value={value ?? ''}
        options={years.map((y) => ({ value: y, label: format(y) }))}
        onChange={(v) => onChange(Number(v))}
      />
      <button
        type="button"
        className="icon-btn"
        aria-label="Next year"
        disabled={i < 0 || i >= years.length - 1}
        onClick={() => onChange(years[i + 1])}
      >
        <IconChevronRight />
      </button>
    </div>
  )
}

/* ---------------------------------------------------------------- */
export function Metric({
  label,
  value,
  unit,
  delta,
  deltaLabel,
  icon,
  accent,
  note,
}: {
  label: string
  value: string
  unit?: string
  delta?: number | null
  deltaLabel?: string
  icon?: ReactNode
  accent?: boolean
  note?: string
}) {
  const dir = delta == null ? '' : delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat'
  return (
    <div className={`metric ${accent ? 'metric--accent' : ''}`}>
      <div className="metric__label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="metric__value num">
        {value}
        {unit && <span className="metric__unit">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={`metric__delta metric__delta--${dir || 'none'}`}>
          {delta == null ? (
            <span>no comparison available</span>
          ) : (
            <>
              <span aria-hidden>{delta > 0 ? '▲' : delta < 0 ? '▼' : '■'}</span>
              <span className="num">
                {delta > 0 ? '+' : delta < 0 ? '−' : '±'}
                {Math.abs(delta * 100).toFixed(1)}%
              </span>
              {deltaLabel && <span className="muted">{deltaLabel}</span>}
            </>
          )}
        </div>
      )}
      {note && <div className="metric__note">{note}</div>}
    </div>
  )
}

/* ---------------------------------------------------------------- */
export function SourceNote({ source, unit, children }: { source: string; unit?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="source-note">
      <div className="source-note__row">
        <span className="mono">Source</span>
        <span className="source-note__text">{source}</span>
      </div>
      {unit && (
        <div className="source-note__row">
          <span className="mono">Unit</span>
          <span className="source-note__text">{unit}</span>
        </div>
      )}
      {children && (
        <>
          <button type="button" className="link-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            <IconInfo width={14} height={14} />
            {open ? 'Hide method' : 'How this is calculated'}
          </button>
          {open && <div className="source-note__body small">{children}</div>}
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
export function LoadingState({ label = 'Loading data', height = 180 }: { label?: string; height?: number }) {
  return (
    <div className="state-box skeleton" style={{ minHeight: height }} role="status" aria-live="polite">
      <div className="state-box__inner">
        <span className="spin" aria-hidden />
        <span className="mono">{label}…</span>
      </div>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-box state-box--error" role="alert">
      <IconAlert width={22} height={22} />
      <p className="small">{message}</p>
      {onRetry && (
        <button type="button" className="btn btn--small" onClick={onRetry}>
          <IconRefresh width={16} height={16} /> Retry
        </button>
      )}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state-box state-box--empty">
      <IconInfo width={22} height={22} />
      <p className="h3">{title}</p>
      {children && <div className="small muted">{children}</div>}
    </div>
  )
}

/** Shows loading / error for a resource, otherwise renders children with its data. */
export function Gate<T>({
  res,
  label,
  onRetry,
  height,
  children,
}: {
  res: { status: string; data?: T; error?: string }
  label: string
  onRetry(): void
  height?: number
  children(data: T): ReactNode
}) {
  if (res.status === 'error') return <ErrorState message={res.error ?? `Could not load ${label}.`} onRetry={onRetry} />
  if (res.status !== 'ready' || res.data === undefined) return <LoadingState label={`Loading ${label}`} height={height} />
  return <>{children(res.data)}</>
}

export function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <ul className="legend">
      {items.map((i) => (
        <li key={i.label}>
          <span className={`legend__mark ${i.dashed ? 'legend__mark--dashed' : ''}`} style={{ background: i.dashed ? undefined : i.color, borderColor: i.color }} />
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/* ---------------------------------------------------------------- */
function stateList(states: string[]) {
  return states.length <= 4 ? states.join(', ') : `${states.slice(0, 4).join(', ')} and ${states.length - 4} more`
}

/**
 * Discloses crop-years whose totals are understated (states absent from the source that report in
 * neighbouring years) or dominated by implausible-yield records. Nothing is estimated or filled in.
 */
export function CoverageNotice({ p, crops, years }: { p: ProductionStore; crops: readonly Crop[]; years?: (number | null | undefined)[] }) {
  const selected = [...new Set((years ?? []).filter((y): y is number => y != null))]
  const messages: string[] = []
  for (const y of selected) {
    for (const c of crops) {
      const cov = p.coverage(c, y)
      if (!cov) continue
      if (cov.absentShare >= 0.02 && cov.absentStates.length)
        messages.push(
          `${c}, ${p.cropYear(y)}: the source has no records for ${stateList(cov.absentStates)}, although they report in neighbouring years. They account for about ${pct(cov.absentShare, 0)} of the total, so this year is understated.`,
        )
      if (cov.flaggedShare >= 0.05)
        messages.push(`${c}, ${p.cropYear(y)}: ${pct(cov.flaggedShare, 0)} of production comes from records with implausibly high yields. They are included as reported.`)
    }
  }
  const all = crops.flatMap((c) =>
    p.yearsByCrop[c].filter((y) => p.coverage(c, y) && !p.coverage(c, y)!.reference).map((y) => ({ c, y, cov: p.coverage(c, y)! })),
  )
  if (!messages.length && !all.length) return null
  return (
    <div className="stack">
      {messages.map((m) => (
        <div key={m} className="notice" role="note">
          <IconAlert />
          <span>{m}</span>
        </div>
      ))}
      {all.length > 0 && (
        <details className="small coverage-details">
          <summary>
            {all.length} crop-year{all.length > 1 ? 's' : ''} with incomplete coverage
          </summary>
          <p className="muted">
            Not used as comparison baselines. Absent states report in adjacent years but not in these; nothing is filled in.
          </p>
          <ul>
            {all.map(({ c, y, cov }) => (
              <li key={`${c}${y}`}>
                {c} {p.cropYear(y)}:{' '}
                {cov.absentStates.length ? `no records for ${stateList(cov.absentStates)} (about ${pct(cov.absentShare, 1)} of the total)` : ''}
                {cov.flaggedShare >= 0.05 ? `${pct(cov.flaggedShare, 0)} of production from yield-flagged records` : ''}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
