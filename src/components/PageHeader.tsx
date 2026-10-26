import { useCallback, useRef, useState, type ReactNode } from 'react'
import { useDismiss } from '../lib/hooks'
import { goBack, navigate } from '../lib/router'
import { IconBack, IconDatabase, IconHome, IconKebab, IconMenu, IconUpload } from './Icons'

export function PageHeader({ title, eyebrow, back = '#/', right }: { title: string; eyebrow?: string; back?: string; right?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="page-header__inner wrap">
        <button type="button" className="icon-btn" aria-label="Back" onClick={() => goBack(back)}>
          <IconBack />
        </button>
        <div className="page-header__title">
          {eyebrow && <span className="eyebrow">{eyebrow}</span>}
          <h1 className="display page-header__h">{title}</h1>
        </div>
        {right}
        <OverflowMenu />
      </div>
    </header>
  )
}

export function OverflowMenu() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const close = useCallback(() => setOpen(false), [])
  useDismiss(open, close, ref)
  const go = (to: string) => {
    setOpen(false)
    navigate(to)
  }
  return (
    <div className="menu" ref={ref}>
      <button type="button" className="icon-btn" aria-label="More options" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <IconKebab />
      </button>
      {open && (
        <div className="menu__pop" role="menu">
          <button type="button" role="menuitem" onClick={() => go('#/menu')}>
            <IconMenu width={18} height={18} /> Section navigator
          </button>
          <button type="button" role="menuitem" onClick={() => go('#/data')}>
            <IconDatabase width={18} height={18} /> Data sources &amp; methods
          </button>
          <button type="button" role="menuitem" onClick={() => go('#/data?import=1')}>
            <IconUpload width={18} height={18} /> Import or refresh CSV
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              navigate('#/', { replace: false })
              requestAnimationFrame(() => window.scrollTo({ top: 0 }))
            }}
          >
            <IconHome width={18} height={18} /> Back to the cover
          </button>
        </div>
      )}
    </div>
  )
}
