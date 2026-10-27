import { memo } from 'react'
import { Bird, House, RiceStalk, Tractor, Tree, WheatStalk } from './plants'

const C = {
  paper: '#f0e9d8',
  hi: '#f7f2e6',
  ink: '#252a25',
  olive: '#65785a',
  oliveDeep: '#4d5e44',
  sage: '#93a68b',
  sageSoft: '#c3ccb6',
  terra: '#c86d67',
  terraSoft: '#e4b3a9',
  wheat: '#d0bda0',
  ochre: '#b8935a',
}

function Furrows({ id, angle = -10, color = C.ink, opacity = 0.16 }: { id: string; angle?: number; color?: string; opacity?: number }) {
  return (
    <pattern id={id} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform={`rotate(${angle})`}>
      <path d="M0 2.5h5" stroke={color} strokeOpacity={opacity} strokeWidth="0.8" />
    </pattern>
  )
}

function Band({ y0, i, fill, pattern, w = 240, bow = -26, tilt = 30, h = 24 }: { y0: number; i: number; fill: string; pattern?: string; w?: number; bow?: number; tilt?: number; h?: number }) {
  const y = y0 + i * h
  const d = `M0 ${y}Q${w / 2} ${y + bow} ${w} ${y + tilt}L${w} ${y + tilt + h}Q${w / 2} ${y + bow + h} 0 ${y + h}Z`
  return (
    <g>
      <path d={d} fill={fill} />
      {pattern && <path d={d} fill={`url(#${pattern})`} />}
      <path d={`M0 ${y}Q${w / 2} ${y + bow} ${w} ${y + tilt}`} fill="none" stroke={C.ink} strokeOpacity="0.35" strokeWidth="0.7" />
    </g>
  )
}

/** Left cover panel: wheat and rice stalks over red contour rings, terraced fields and a tractor. */
export const CoverLeft = memo(function CoverLeft() {
  return (
    <svg viewBox="0 0 240 844" preserveAspectRatio="xMinYMax slice" aria-hidden>
      <defs>
        <Furrows id="cl-f1" angle={-14} />
        <Furrows id="cl-f2" angle={8} color={C.hi} opacity={0.35} />
        <linearGradient id="cl-fade" x1="0" x2="1">
          <stop offset="0" stopColor={C.sage} />
          <stop offset="1" stopColor={C.sageSoft} />
        </linearGradient>
        <linearGradient id="cl-edge" x1="0" x2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0.45" stopColor="#fff" />
          <stop offset="0.8" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <mask id="cl-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="844">
          <rect width="240" height="844" fill="url(#cl-edge)" />
        </mask>
      </defs>
      {/* contour rings, top left */}
      <g fill="none">
        <circle cx="-20" cy="150" r="158" stroke={C.terra} strokeWidth="24" />
        <circle cx="-20" cy="150" r="134" stroke={C.hi} strokeWidth="12" />
        <circle cx="-20" cy="150" r="118" stroke={C.terra} strokeWidth="8" />
        <circle cx="-20" cy="150" r="100" stroke={C.sage} strokeWidth="14" opacity="0.85" />
        <circle cx="-20" cy="150" r="182" stroke={C.ink} strokeWidth="0.6" strokeDasharray="2 4" opacity="0.5" />
      </g>
      <g mask="url(#cl-mask)">
      {/* distant hill with trees */}
      <path d="M0 560C40 540 90 548 130 566C170 584 200 600 240 600V680H0Z" fill="url(#cl-fade)" opacity="0.9" />
      <Tree x={36} y={566} s={0.8} />
      <Tree x={54} y={562} s={0.6} fill={C.olive} />
      <Tree x={150} y={588} s={0.7} />
      {/* terraced fields */}
      <path d="M0 626C70 600 150 612 240 650V844H0Z" fill={C.oliveDeep} />
      {[
        [C.terra, 'cl-f1'],
        [C.wheat, 'cl-f1'],
        [C.olive, 'cl-f2'],
        [C.terraSoft, 'cl-f1'],
        [C.sage, 'cl-f2'],
        [C.terra, 'cl-f1'],
        [C.wheat, 'cl-f1'],
        [C.olive, 'cl-f2'],
      ].map(([fill, pat], i) => (
        <Band key={i} y0={640} i={i} fill={fill} pattern={pat} />
      ))}
      <Tractor x={62} y={716} s={0.95} />
      <path d="M58 724c-10 2-26 4-50 4" stroke={C.ink} strokeOpacity="0.4" strokeDasharray="3 3" fill="none" />
      </g>
      {/* stalks rising along the edge, leaning over the rings */}
      <g>
        <WheatStalk x={-12} y={844} h={650} lean={0.1} scale={1.15} />
        <WheatStalk x={-4} y={844} h={610} lean={0.08} scale={1.05} color={C.wheat} />
        <WheatStalk x={-18} y={844} h={590} lean={0.13} scale={1} />
        <WheatStalk x={0} y={844} h={690} lean={0.05} scale={1.2} color="#c8a76a" />
        <RiceStalk x={6} y={844} h={300} lean={0.2} scale={1} color={C.hi} />
        <RiceStalk x={-4} y={844} h={260} lean={0.24} scale={0.95} />
      </g>
      {/* survey marks */}
      <g stroke={C.ink} strokeWidth="0.7" opacity="0.6">
        <path d="M200 420h14M207 413v14" />
        <circle cx="207" cy="420" r="3.5" fill="none" />
      </g>
    </svg>
  )
})

/** Right cover panel: mountains with birds, a village ridge, rice terraces and red arcs. */
export const CoverRight = memo(function CoverRight() {
  return (
    <svg viewBox="0 0 240 844" preserveAspectRatio="xMaxYMax slice" aria-hidden>
      <defs>
        <Furrows id="cr-f1" angle={12} />
        <Furrows id="cr-f2" angle={-6} color={C.hi} opacity={0.35} />
        <linearGradient id="cr-edge" x1="0" x2="240" gradientUnits="userSpaceOnUse">
          <stop offset="0.2" stopColor="#fff" stopOpacity="0" />
          <stop offset="0.55" stopColor="#fff" />
        </linearGradient>
        <mask id="cr-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="844">
          <rect width="240" height="844" fill="url(#cr-edge)" />
        </mask>
        <linearGradient id="cr-mist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={C.paper} stopOpacity="0" />
          <stop offset="1" stopColor={C.paper} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      {/* mountains */}
      <g transform="translate(0 -44)">
      <path d="M0 230L34 196L58 208L98 150L128 178L170 120L204 150L240 128V290H0Z" fill={C.sageSoft} />
      <path d="M98 150l-8 18 10-6 6 12M170 120l-9 20 11-8 7 14" fill="none" stroke={C.hi} strokeWidth="1.2" opacity="0.8" />
      <path d="M20 262L66 220L96 240L140 196L178 228L214 200L240 214V300H20Z" fill={C.sage} />
      <rect x="0" y="230" width="240" height="70" fill="url(#cr-mist)" />
      <path d="M60 292C120 266 180 268 240 280V300H60Z" fill={C.olive} />
      <Tree x={150} y={280} s={0.55} fill={C.oliveDeep} />
      <Tree x={168} y={278} s={0.7} fill={C.oliveDeep} />
      <Bird x={70} y={96} s={1.1} />
      <Bird x={96} y={78} s={0.8} />
      <Bird x={120} y={104} s={0.9} />
      <Bird x={190} y={70} s={0.7} />
      </g>
      {/* village ridge */}
      <path d="M120 612C160 590 200 588 240 596V640H120Z" fill={C.sage} />
      <House x={170} y={600} s={1} />
      <House x={186} y={597} s={0.8} />
      <House x={200} y={598} s={1.1} fill={C.oliveDeep} />
      <Tree x={152} y={606} s={0.8} />
      <Tree x={226} y={598} s={0.9} />
      {/* red arcs, bottom right */}
      <g fill="none">
        <circle cx="260" cy="800" r="150" stroke={C.terra} strokeWidth="22" />
        <circle cx="260" cy="800" r="126" stroke={C.hi} strokeWidth="10" />
        <circle cx="260" cy="800" r="110" stroke={C.terra} strokeWidth="8" />
        <circle cx="260" cy="800" r="174" stroke={C.ink} strokeWidth="0.6" strokeDasharray="2 4" opacity="0.5" />
      </g>
      {/* rice terraces */}
      <g mask="url(#cr-mask)">
      <g transform="translate(240 0) scale(-1 1)">
        {[C.olive, C.sage, C.wheat, C.olive, C.sageSoft, C.oliveDeep, C.sage].map((fill, i) => (
          <Band key={i} y0={668} i={i} fill={fill} pattern={i % 2 ? 'cr-f2' : 'cr-f1'} w={200} bow={-18} tilt={22} h={26} />
        ))}
      </g>
      </g>
      <g>
        <RiceStalk x={232} y={844} h={300} lean={-0.32} scale={1.1} />
        <RiceStalk x={244} y={844} h={260} lean={-0.38} scale={1} color={C.hi} />
        <RiceStalk x={222} y={844} h={230} lean={-0.3} scale={0.9} />
      </g>
      <g stroke={C.ink} strokeWidth="0.7" opacity="0.6">
        <path d="M24 470h14M31 463v14" />
        <circle cx="31" cy="470" r="3.5" fill="none" />
      </g>
    </svg>
  )
})

/** Measurement rings behind the title; they expand during the scroll transition. */
export const CoverRings = memo(function CoverRings() {
  const ticks = Array.from({ length: 72 }, (_, i) => i * 5)
  return (
    <svg viewBox="-300 -300 600 600" aria-hidden>
      <g fill="none" stroke="#d8d0be">
        <circle r="120" strokeWidth="1" />
        <circle r="168" strokeWidth="1" />
        <circle r="216" strokeWidth="1.2" />
        <circle r="262" strokeWidth="1" />
        <circle r="195" stroke={C.terra} strokeWidth="0.9" strokeDasharray="3 6" opacity="0.7" />
        <circle r="290" strokeWidth="0.8" strokeDasharray="1 5" />
      </g>
      <g stroke="#b9ae94" strokeWidth="0.9">
        {ticks.map((a) => (
          <path key={a} d={`M0 -262V${a % 30 === 0 ? -276 : -268}`} transform={`rotate(${a})`} />
        ))}
      </g>
      <g fill={C.terra}>
        <circle cx="0" cy="-216" r="3" />
        <circle cx="216" cy="0" r="2.4" opacity="0.7" />
        <circle cx="-168" cy="0" r="2" opacity="0.6" />
      </g>
    </svg>
  )
})

function Cloud({ x, y, w }: { x: number; y: number; w: number }) {
  const s = w / 100
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx="50" cy="34" rx="50" ry="8" fill="#e2d9c3" opacity="0.6" />
      <path
        d="M4 30c-2-8 6-14 14-12 2-10 14-16 24-10 6-10 22-12 30 0 10-4 22 4 20 14 6 2 8 10 2 12H6c-2 0-3-2-2-4z"
        fill="#fbf7ee"
      />
      <path d="M18 18c4-2 9-1 12 3M44 8c5-1 10 2 12 6" fill="none" stroke="#d8d0be" strokeWidth="1" />
    </g>
  )
}

const CLOUD_SETS: { x: number; y: number; w: number }[][] = [
  [
    { x: 40, y: 30, w: 150 },
    { x: 330, y: 70, w: 110 },
    { x: 610, y: 24, w: 170 },
    { x: 860, y: 60, w: 120 },
  ],
  [
    { x: 120, y: 40, w: 120 },
    { x: 470, y: 20, w: 90 },
    { x: 720, y: 50, w: 140 },
  ],
  [
    { x: 60, y: 30, w: 90 },
    { x: 380, y: 50, w: 130 },
    { x: 800, y: 26, w: 100 },
  ],
]

/** A seamless horizontally repeating cloud strip (two identical halves). */
export const CloudStrip = memo(function CloudStrip({ set }: { set: 0 | 1 | 2 }) {
  const clouds = CLOUD_SETS[set]
  return (
    <svg viewBox="0 0 2000 110" preserveAspectRatio="xMinYMid slice" aria-hidden>
      {[0, 1000].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          {clouds.map((c, i) => (
            <Cloud key={i} {...c} />
          ))}
        </g>
      ))}
    </svg>
  )
})
