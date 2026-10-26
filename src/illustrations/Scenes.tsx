import { memo } from 'react'
import { Bird, House, MaizePlant, Palm, PulsePlant, RiceStalk, Tree, WheatStalk } from './plants'

export type SceneVariant = 'valley' | 'sacks' | 'terraces' | 'palms' | 'wheatfield' | 'rice' | 'wheat' | 'maize' | 'pulses'

const C = {
  paper: '#f0e9d8',
  hi: '#f7f2e6',
  ink: '#252a25',
  olive: '#65785a',
  oliveDeep: '#4d5e44',
  forest: '#3b4a35',
  sage: '#93a68b',
  sageSoft: '#c3ccb6',
  terra: '#c86d67',
  terraSoft: '#e4b3a9',
  wheat: '#d0bda0',
  ochre: '#b8935a',
}

function Sky({ id, top = C.hi, bottom = C.wheat }: { id: string; top?: string; bottom?: string }) {
  return (
    <>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={top} />
          <stop offset="1" stopColor={bottom} />
        </linearGradient>
      </defs>
      <rect width="320" height="200" fill={`url(#${id})`} />
    </>
  )
}

function Ridges({ base, color, amp = 14, seed = 1 }: { base: number; color: string; amp?: number; seed?: number }) {
  const pts: string[] = []
  for (let x = 0; x <= 320; x += 20) {
    const y = base - Math.abs(Math.sin((x + seed * 37) / 47)) * amp - Math.sin((x + seed * 11) / 23) * amp * 0.25
    pts.push(`${x} ${y.toFixed(1)}`)
  }
  return <path d={`M0 200L${pts.join('L')}L320 200Z`} fill={color} />
}

/** Curved terrace stripes filling the lower part of a scene. */
function Terraces({ top, rows, colors, bow = -18, lines = C.ink }: { top: number; rows: number; colors: string[]; bow?: number; lines?: string }) {
  const h = (200 - top) / rows
  return (
    <g>
      {Array.from({ length: rows }, (_, i) => {
        const y = top + i * h
        const d = `M-10 ${y + 8}Q160 ${y + bow} 330 ${y + 6}L330 ${y + 6 + h + 1}Q160 ${y + bow + h + 1} -10 ${y + 8 + h + 1}Z`
        return (
          <g key={i}>
            <path d={d} fill={colors[i % colors.length]} />
            <path d={`M-10 ${y + 8}Q160 ${y + bow} 330 ${y + 6}`} fill="none" stroke={lines} strokeOpacity="0.25" strokeWidth="0.8" />
          </g>
        )
      })}
    </g>
  )
}

function Sack({ x, y, s = 1, fill = C.wheat }: { x: number; y: number; s?: number; fill?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M-26 0C-32-22-26-48-14-58L-10-66C-4-70 4-70 10-66L14-58C26-48 32-22 26 0Z" fill={fill} stroke="#5b4a33" strokeWidth="1" />
      <path d="M-12-60C-4-56 4-56 12-60" fill="none" stroke="#5b4a33" strokeWidth="1.6" />
      <path d="M-10-66c-4-6-2-12 2-14M10-66c4-6 2-12-2-14" fill="none" stroke="#5b4a33" strokeWidth="1" />
      <path d="M-18-30h36M-20-20h40" stroke="#5b4a33" strokeOpacity="0.35" strokeDasharray="2 3" />
      <path d="M-12-40l6 12M10-42l-4 14" stroke="#5b4a33" strokeOpacity="0.25" />
    </g>
  )
}

function Grain({ x, y, w, h, color = C.ochre }: { x: number; y: number; w: number; h: number; color?: string }) {
  const dots = []
  for (let i = 0; i < 70; i++) {
    const t = (i * 0.618) % 1
    const u = ((i * 0.377) % 1) * 2 - 1
    const dx = u * w
    const dy = -Math.max(0, h * (1 - Math.abs(u)) * (0.3 + t * 0.7))
    dots.push(<ellipse key={i} cx={x + dx} cy={y + dy} rx="1.6" ry="1" fill={i % 3 ? color : C.wheat} transform={`rotate(${i * 37} ${x + dx} ${y + dy})`} />)
  }
  return (
    <g>
      <path d={`M${x - w} ${y}Q${x} ${y - h * 1.6} ${x + w} ${y}Z`} fill={color} opacity="0.75" />
      {dots}
    </g>
  )
}

function SceneBody({ variant }: { variant: SceneVariant }) {
  switch (variant) {
    case 'valley':
      return (
        <>
          <Sky id="sk-valley" />
          <circle cx="250" cy="58" r="20" fill={C.terraSoft} opacity="0.85" />
          <Ridges base={92} color={C.sageSoft} amp={26} seed={2} />
          <Ridges base={112} color={C.sage} amp={18} seed={5} />
          <Terraces top={118} rows={7} colors={[C.olive, '#7c8f6d', C.oliveDeep, '#869a76', C.olive, '#a4b38f', C.oliveDeep]} bow={-14} />
          <path d="M210 200C200 176 168 160 190 140C204 128 236 128 250 118" fill="none" stroke={C.wheat} strokeWidth="6" strokeLinecap="round" />
          <path d="M-10 200V150C30 128 70 132 96 150C110 160 104 186 120 200Z" fill={C.forest} />
          <Tree x={26} y={142} s={1} fill={C.forest} />
          <Tree x={60} y={138} s={1.2} fill="#33402e" />
          <Tree x={290} y={124} s={0.8} fill={C.oliveDeep} />
          <House x={262} y={124} s={0.9} />
          <Bird x={140} y={44} s={0.8} />
          <Bird x={160} y={36} s={0.6} />
        </>
      )
    case 'sacks':
      return (
        <>
          <Sky id="sk-sacks" top="#4a4436" bottom="#2b2a22" />
          <rect y="150" width="320" height="50" fill="#3a3528" />
          <path d="M0 150h320" stroke="#d0bda0" strokeOpacity="0.25" />
          <Sack x={78} y={168} s={1.15} />
          <Sack x={142} y={176} s={1.3} fill="#c9b38c" />
          <Sack x={212} y={170} s={1.05} fill="#d8c7a6" />
          <Grain x={262} y={184} w={36} h={22} />
          <Grain x={40} y={190} w={28} h={14} color="#a88a52" />
          <path d="M270 158l24-20 8 6-22 20z" fill="#7f6c47" />
        </>
      )
    case 'terraces':
      return (
        <>
          <Sky id="sk-terr" top={C.hi} bottom={C.sageSoft} />
          <Ridges base={70} color={C.sageSoft} amp={24} seed={7} />
          <Ridges base={86} color={C.sage} amp={14} seed={3} />
          <Terraces top={84} rows={9} colors={['#7c8f6d', C.olive, '#9aab87', C.oliveDeep, '#869a76', C.olive, '#b3bf9d', C.oliveDeep, C.olive]} bow={-26} />
          <Tree x={250} y={96} s={0.8} fill={C.forest} />
          <Tree x={266} y={94} s={0.6} fill={C.forest} />
        </>
      )
    case 'palms':
      return (
        <>
          <Sky id="sk-palm" top="#f3e6cc" bottom="#d9c3a0" />
          <Ridges base={110} color={C.sageSoft} amp={16} seed={9} />
          <rect y="118" width="320" height="82" fill={C.olive} />
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d={`M${160 + (i - 6) * 8} 118L${160 + (i - 6) * 60} 200`} stroke={C.oliveDeep} strokeWidth="2" />
          ))}
          <path d="M0 118h320" stroke={C.forest} strokeWidth="2" />
          <Palm x={60} y={132} h={92} s={1.1} fill={C.forest} />
          <Palm x={94} y={128} h={70} s={0.85} fill="#33402e" />
          <Palm x={262} y={130} h={80} s={1} fill={C.forest} />
        </>
      )
    case 'wheatfield':
      return (
        <>
          <Sky id="sk-wf" top="#56664a" bottom="#2f3a2b" />
          {Array.from({ length: 13 }, (_, i) => (
            <WheatStalk key={i} x={i * 26 + (i % 2) * 8} y={230} h={150 + ((i * 37) % 50)} lean={0.08 + ((i * 13) % 10) / 100} color={i % 3 ? C.ochre : C.wheat} stem="#cdb88f" scale={0.95} />
          ))}
        </>
      )
    case 'rice':
      return (
        <>
          <Sky id="sk-rice" top={C.hi} bottom="#e7dcc4" />
          <Ridges base={74} color={C.sageSoft} amp={30} seed={4} />
          <Ridges base={92} color={C.sage} amp={16} seed={8} />
          <Terraces top={96} rows={6} colors={['#8fa47e', C.olive, '#a8b894', C.oliveDeep, '#8fa47e', C.olive]} bow={-10} />
          {Array.from({ length: 9 }, (_, i) => (
            <RiceStalk key={i} x={200 + i * 14} y={214} h={110 + ((i * 29) % 40)} lean={0.25 + (i % 3) * 0.05} scale={1} color={i % 2 ? C.wheat : '#e8d9b5'} stem="#4d5e44" />
          ))}
        </>
      )
    case 'wheat':
      return (
        <>
          <Sky id="sk-wheat" top={C.hi} bottom="#ecdcb9" />
          <Ridges base={84} color={C.sageSoft} amp={18} seed={6} />
          <Terraces top={98} rows={5} colors={['#d9c08a', C.ochre, '#cfb57d', '#c2a46a', '#d9c08a']} bow={-8} />
          {Array.from({ length: 10 }, (_, i) => (
            <WheatStalk key={i} x={170 + i * 16} y={220} h={120 + ((i * 31) % 40)} lean={0.06 + (i % 4) * 0.03} scale={0.95} />
          ))}
        </>
      )
    case 'maize':
      return (
        <>
          <Sky id="sk-maize" top={C.hi} bottom={C.sageSoft} />
          <Ridges base={90} color={C.sage} amp={18} seed={10} />
          <rect y="120" width="320" height="80" fill="#7c8f6d" />
          {Array.from({ length: 8 }, (_, i) => (
            <MaizePlant key={i} x={30 + i * 40} y={210} h={110 + ((i * 17) % 30)} scale={0.9} />
          ))}
        </>
      )
    case 'pulses':
      return (
        <>
          <Sky id="sk-pulses" top={C.hi} bottom="#e3d6bb" />
          <Ridges base={86} color={C.sageSoft} amp={20} seed={12} />
          <Terraces top={104} rows={5} colors={['#a4b38f', '#8fa47e', '#b8c3a2', C.olive, '#a4b38f']} bow={-6} />
          {Array.from({ length: 10 }, (_, i) => (
            <PulsePlant key={i} x={150 + i * 17} y={214} h={70 + ((i * 23) % 26)} scale={1.1} />
          ))}
        </>
      )
  }
}

export const Scene = memo(function Scene({ variant, className }: { variant: SceneVariant; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <SceneBody variant={variant} />
    </svg>
  )
})

export const CROP_SCENE = { Rice: 'rice', Wheat: 'wheat', Maize: 'maize', Pulses: 'pulses' } as const
