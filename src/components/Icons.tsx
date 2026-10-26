import type { SVGProps } from 'react'
import type { Crop } from '../data/types'

type P = SVGProps<SVGSVGElement>
const base = (p: P): P => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  ...p,
})

export const IconBack = (p: P) => (
  <svg {...base(p)}>
    <path d="M15 5l-7 7 7 7" />
  </svg>
)
export const IconArrowRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
)
export const IconArrowUpRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 17L17 7M9 7h8v8" />
  </svg>
)
export const IconChevronDown = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 9l6 6 6-6" />
  </svg>
)
export const IconChevronLeft = (p: P) => (
  <svg {...base(p)}>
    <path d="M14 6l-6 6 6 6" />
  </svg>
)
export const IconChevronRight = (p: P) => (
  <svg {...base(p)}>
    <path d="M10 6l6 6-6 6" />
  </svg>
)
export const IconKebab = (p: P) => (
  <svg {...base(p)} fill="currentColor" stroke="none">
    <circle cx="12" cy="5" r="1.8" />
    <circle cx="12" cy="12" r="1.8" />
    <circle cx="12" cy="19" r="1.8" />
  </svg>
)
export const IconMenu = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
export const IconClose = (p: P) => (
  <svg {...base(p)}>
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)
export const IconInfo = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v6M12 7.5v.5" />
  </svg>
)
export const IconAlert = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3l9.5 17h-19L12 3z" />
    <path d="M12 10v4.5M12 17.5v.3" />
  </svg>
)
export const IconRefresh = (p: P) => (
  <svg {...base(p)}>
    <path d="M20 11a8 8 0 10-2.3 5.7" />
    <path d="M20 5v6h-6" />
  </svg>
)
export const IconUpload = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 16V4M7 9l5-5 5 5" />
    <path d="M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" />
  </svg>
)
export const IconSearch = (p: P) => (
  <svg {...base(p)}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="M16 16l4 4" />
  </svg>
)
export const IconDatabase = (p: P) => (
  <svg {...base(p)}>
    <ellipse cx="12" cy="6" rx="7" ry="3" />
    <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
  </svg>
)
export const IconHome = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 11l8-7 8 7M6 9.5V20h12V9.5" />
  </svg>
)
export const IconCheck = (p: P) => (
  <svg {...base(p)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

/* Section icons (used in the dial and the explore hub) */
export const IconMap = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 3c2.6 1.5 3.3 3.6 2.5 5.2-.8 1.5.6 2.4 2.1 3.2 1.9 1 1.2 3-.6 3.9-1.6.8-2 2.4-2.6 4.2-.4 1.2-1.6 1.7-2.2.2-.8-2.1-2-3.2-3.8-4-1.6-.8-2-2.6-.9-4 1.4-1.7.4-3 1.4-4.7C8.6 5.6 10.4 4.6 12 3z" />
  </svg>
)
export const IconBars = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 20h16M7 16v-4M11 16V8M15 16v-6M19 16V5" />
  </svg>
)
export const IconFlow = (p: P) => (
  <svg {...base(p)}>
    <path d="M4 5v14" strokeWidth="2.6" />
    <path d="M5 7c7 0 7-2 15-2M5 12h15M5 17c7 0 7 2 15 2" />
  </svg>
)
export const IconGlobe = (p: P) => (
  <svg {...base(p)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 3.8 5.2 3.8 8.5s-1.2 6.1-3.8 8.5c-2.6-2.4-3.8-5.2-3.8-8.5s1.2-6.1 3.8-8.5z" />
  </svg>
)
export const IconCompare = (p: P) => (
  <svg {...base(p)}>
    <path d="M7 20V9M17 20V4M3 20h18" />
    <path d="M7 9c-2-1-3-3-2.5-5C6.6 4.3 7.5 6 7 9zM7 9c2-1 3-3 2.5-5C7.4 4.3 6.5 6 7 9zM17 9c-2-1-3-2.6-2.6-4.5" />
  </svg>
)
export const IconBulb = (p: P) => (
  <svg {...base(p)}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 00-3.6 10.8c.6.5 1 1.3 1 2.2h5.2c0-.9.4-1.7 1-2.2A6 6 0 0012 3z" />
  </svg>
)
export const IconSprout = (p: P) => (
  <svg {...base(p)}>
    <path d="M12 21V11" />
    <path d="M12 11C12 7 9 5 5 5c0 4 3 6 7 6zM12 13c0-3.5 2.6-5.5 7-5.5 0 3.6-2.8 5.5-7 5.5z" />
  </svg>
)

/* Crop glyphs: small engraved-style drawings */
export function CropGlyph({ crop, ...p }: P & { crop: Crop }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.3} strokeLinecap="round" aria-hidden {...p}>
      {crop === 'Wheat' && (
        <>
          <path d="M12 22V5" />
          {[7, 10.5, 14].map((y) => (
            <g key={y}>
              <path d={`M12 ${y + 2.5}c-2.6-.4-3.6-2-3.6-3.9 2.2.2 3.4 1.6 3.6 3.9z`} fill="currentColor" fillOpacity={0.25} />
              <path d={`M12 ${y + 2.5}c2.6-.4 3.6-2 3.6-3.9-2.2.2-3.4 1.6-3.6 3.9z`} fill="currentColor" fillOpacity={0.25} />
            </g>
          ))}
          <path d="M12 6c0-1.6.4-2.8 1-3.5M12 6c0-1.6-.4-2.8-1-3.5" />
        </>
      )}
      {crop === 'Rice' && (
        <>
          <path d="M8 22c0-7 1.5-12 6-16" />
          <path d="M14 6c2.2 1.3 3.6 3.8 3.4 7" />
          {[
            [15.2, 7.6],
            [16.3, 9.6],
            [16.9, 11.8],
            [12.6, 8.4],
            [11.5, 10.6],
          ].map(([x, y]) => (
            <ellipse key={`${x}${y}`} cx={x} cy={y} rx="0.9" ry="1.6" transform={`rotate(-25 ${x} ${y})`} fill="currentColor" fillOpacity={0.3} />
          ))}
          <path d="M8.5 16c-2-1-3.5-3-4-6M9 13c2-2.5 2.5-5 2-8" />
        </>
      )}
      {crop === 'Maize' && (
        <>
          <path d="M12 22V3" />
          <path d="M12 9.5c2.2-.3 3.5 1.4 3.6 4.4.1 3.2-1.4 4.8-3.6 5.1V9.5z" fill="currentColor" fillOpacity={0.25} />
          <path d="M13 11.3h2M13 13.5h2.4M13 15.7h2.2" />
          <path d="M12 17c-3-.5-5.5-2.6-6.5-6 2.8.6 5 2.6 6.5 6zM12 8C10 6.8 8.7 4.7 8.6 2.8 10.6 3.7 11.8 5.6 12 8z" />
        </>
      )}
      {crop === 'Pulses' && (
        <>
          <path d="M12 22V9" />
          <path d="M12 13c-3.5 0-6-1.8-6.5-5 3.5 0 5.8 1.8 6.5 5zM12 11c3-.2 5.2-2 5.5-5-3.2.1-5.2 2-5.5 5z" />
          <path d="M14 15.5c1.8-.9 3.8-.6 4.8.6-1.1 1.6-3.2 2-4.8 1.6" fill="currentColor" fillOpacity={0.25} />
          <circle cx="15.6" cy="16.5" r=".5" fill="currentColor" />
          <circle cx="17" cy="16.4" r=".5" fill="currentColor" />
        </>
      )}
    </svg>
  )
}
