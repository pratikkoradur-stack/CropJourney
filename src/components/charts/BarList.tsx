export interface BarItem {
  id: string
  label: string
  value: number | null
  display: string
  sub?: string
  color?: string
}

/** Ranked horizontal bars; each row is a real button when onSelect is given. */
export function BarList({
  items,
  selected,
  onSelect,
  max,
  rank = true,
  color = 'var(--terracotta)',
  ariaLabel,
}: {
  items: BarItem[]
  selected?: string | null
  onSelect?(id: string): void
  max?: number
  rank?: boolean
  color?: string
  ariaLabel: string
}) {
  const top = max ?? Math.max(0, ...items.map((i) => i.value ?? 0))
  return (
    <ol className={`barlist ${rank ? '' : 'barlist--norank'}`} aria-label={ariaLabel}>
      {items.map((it, i) => {
        const w = it.value != null && top > 0 ? Math.max(1.5, (it.value / top) * 100) : 0
        const body = (
          <>
            {rank && <span className="barlist__rank num">{i + 1}</span>}
            <span className="barlist__label">
              {it.label}
              {it.sub && <span className="barlist__sub">{it.sub}</span>}
            </span>
            <span className="barlist__track" aria-hidden>
              <span className="barlist__fill" style={{ width: `${w}%`, background: it.color ?? color }} />
            </span>
            <span className="barlist__value num">{it.display}</span>
          </>
        )
        return (
          <li key={it.id}>
            {onSelect ? (
              <button
                type="button"
                className={`barlist__row ${selected === it.id ? 'is-selected' : ''}`}
                aria-pressed={selected === it.id}
                onClick={() => onSelect(it.id)}
              >
                {body}
              </button>
            ) : (
              <div className="barlist__row">{body}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
