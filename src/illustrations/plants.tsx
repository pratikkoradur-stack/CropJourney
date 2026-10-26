/* Parametric, engraving-style plant drawings shared by every illustration. */
type Pt = [number, number]

const quad = (p0: Pt, c: Pt, p1: Pt, t: number): Pt => {
  const u = 1 - t
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]
}
const quadAngle = (p0: Pt, c: Pt, p1: Pt, t: number) => {
  const dx = 2 * (1 - t) * (c[0] - p0[0]) + 2 * t * (p1[0] - c[0])
  const dy = 2 * (1 - t) * (c[1] - p0[1]) + 2 * t * (p1[1] - c[1])
  return (Math.atan2(dy, dx) * 180) / Math.PI
}
const r1 = (n: number) => Math.round(n * 10) / 10

interface StalkProps {
  x: number
  y: number
  h: number
  /** horizontal lean of the tip as a fraction of height */
  lean?: number
  color?: string
  stem?: string
  scale?: number
  awns?: boolean
}

export function WheatStalk({ x, y, h, lean = 0.12, color = '#b8935a', stem = '#7f6c47', scale = 1, awns = true }: StalkProps) {
  const p0: Pt = [x, y]
  const p1: Pt = [x + lean * h, y - h]
  const c: Pt = [x + lean * h * 0.08, y - h * 0.55]
  const grains = 9
  const items = []
  for (let i = 0; i < grains; i++) {
    const t = 0.72 + (i / (grains - 1)) * 0.27
    const [gx, gy] = quad(p0, c, p1, t)
    const a = quadAngle(p0, c, p1, t) + 90
    const s = scale * (1 - i * 0.04)
    for (const side of [-1, 1]) {
      const rot = a + side * 32
      items.push(
        <g key={`${i}${side}`} transform={`translate(${r1(gx)} ${r1(gy)}) rotate(${r1(rot - 90)})`}>
          <ellipse cx={0} cy={-5.5 * s} rx={2.5 * s} ry={5.6 * s} fill={color} stroke={stem} strokeWidth={0.5} />
          {awns && <path d={`M0 ${-10.5 * s}L0 ${-22 * s}`} stroke={stem} strokeWidth={0.45} />}
        </g>,
      )
    }
  }
  const [tx, ty] = p1
  return (
    <g>
      <path d={`M${p0}Q${c} ${p1}`} fill="none" stroke={stem} strokeWidth={1.3 * scale} strokeLinecap="round" />
      <path
        d={`M${r1(x + lean * h * 0.05)} ${r1(y - h * 0.35)}q${-14 * scale} ${-18 * scale} ${-12 * scale} ${-44 * scale}`}
        fill="none"
        stroke={stem}
        strokeWidth={0.9}
      />
      {items}
      <ellipse cx={tx} cy={ty - 4 * scale} rx={2.2 * scale} ry={5 * scale} fill={color} stroke={stem} strokeWidth={0.5} />
      {awns && <path d={`M${tx} ${ty - 9 * scale}l0 ${-16 * scale}`} stroke={stem} strokeWidth={0.45} />}
    </g>
  )
}

export function RiceStalk({ x, y, h, lean = 0.2, color = '#d0bda0', stem = '#5f6f52', scale = 1 }: StalkProps) {
  const p0: Pt = [x, y]
  const top: Pt = [x + lean * h * 0.6, y - h]
  const c: Pt = [x + lean * h * 0.05, y - h * 0.6]
  const droop: Pt = [top[0] + lean * h * 0.9 + 6, top[1] + h * 0.32]
  const dc: Pt = [top[0] + lean * h * 0.7, top[1] - 4]
  const grains = []
  for (let i = 0; i < 12; i++) {
    const t = 0.08 + (i / 11) * 0.9
    const [gx, gy] = quad(top, dc, droop, t)
    const a = quadAngle(top, dc, droop, t)
    const side = i % 2 ? 1 : -1
    grains.push(
      <ellipse
        key={i}
        cx={r1(gx + side * 2.2 * scale)}
        cy={r1(gy + 1.2 * scale)}
        rx={1.5 * scale}
        ry={3.1 * scale}
        transform={`rotate(${r1(a + 90 + side * 25)} ${r1(gx + side * 2.2 * scale)} ${r1(gy + 1.2 * scale)})`}
        fill={color}
        stroke={stem}
        strokeWidth={0.45}
      />,
    )
  }
  return (
    <g>
      <path d={`M${p0}Q${c} ${top}`} fill="none" stroke={stem} strokeWidth={1.2 * scale} strokeLinecap="round" />
      <path d={`M${top}Q${dc} ${droop}`} fill="none" stroke={stem} strokeWidth={0.8 * scale} />
      <path
        d={`M${r1(x + 1)} ${r1(y - h * 0.25)}c${-10 * scale} ${-20 * scale} ${-26 * scale} ${-36 * scale} ${-30 * scale} ${-70 * scale}`}
        fill="none"
        stroke={stem}
        strokeWidth={0.9}
      />
      <path
        d={`M${r1(x + 2)} ${r1(y - h * 0.4)}c${10 * scale} ${-22 * scale} ${12 * scale} ${-40 * scale} ${6 * scale} ${-62 * scale}`}
        fill="none"
        stroke={stem}
        strokeWidth={0.8}
      />
      {grains}
    </g>
  )
}

export function MaizePlant({ x, y, h, color = '#d9b45f', stem = '#4d5e44', scale = 1 }: StalkProps) {
  const leaf = (sy: number, dir: number, len: number, droop: number) => {
    const sx = x
    const ex = sx + dir * len
    const ey = sy + droop
    return (
      <path
        d={`M${sx} ${sy}C${sx + dir * len * 0.3} ${sy - len * 0.35} ${ex - dir * len * 0.2} ${ey - len * 0.25} ${ex} ${ey}C${ex - dir * len * 0.3} ${ey - len * 0.12} ${sx + dir * len * 0.3} ${sy - len * 0.18} ${sx} ${sy + 5 * scale}Z`}
        fill={stem}
        fillOpacity={0.85}
      />
    )
  }
  const top = y - h
  return (
    <g>
      <path d={`M${x} ${y}L${x} ${top}`} stroke={stem} strokeWidth={2.2 * scale} />
      {leaf(y - h * 0.22, -1, h * 0.42, h * 0.1)}
      {leaf(y - h * 0.36, 1, h * 0.45, h * 0.06)}
      {leaf(y - h * 0.52, -1, h * 0.36, -h * 0.02)}
      {leaf(y - h * 0.66, 1, h * 0.3, -h * 0.05)}
      <g transform={`translate(${x + 3 * scale} ${y - h * 0.5}) rotate(18)`}>
        <ellipse cx={0} cy={0} rx={5.5 * scale} ry={14 * scale} fill={color} stroke="#8a6d3a" strokeWidth={0.6} />
        {[-8, -4, 0, 4, 8].map((d) => (
          <path key={d} d={`M${-5 * scale} ${d * scale}h${10 * scale}`} stroke="#8a6d3a" strokeWidth={0.4} />
        ))}
        <path d={`M${-6 * scale} ${12 * scale}c${-2 * scale} ${-10 * scale} 0 ${-22 * scale} ${4 * scale} ${-28 * scale}`} fill="none" stroke={stem} strokeWidth={1.4} />
      </g>
      {[-10, -4, 3, 9].map((d) => (
        <path key={d} d={`M${x} ${top}l${d * scale} ${-14 * scale}`} stroke="#8a6d3a" strokeWidth={0.8} />
      ))}
    </g>
  )
}

export function PulsePlant({ x, y, h, color = '#c9a76c', stem = '#5f6f52', scale = 1 }: StalkProps) {
  const leaves = []
  for (let i = 0; i < 5; i++) {
    const ly = y - h * (0.2 + i * 0.16)
    const d = i % 2 ? 1 : -1
    leaves.push(
      <g key={i} transform={`translate(${x} ${ly}) rotate(${d * 40})`}>
        <ellipse cx={0} cy={-9 * scale} rx={4 * scale} ry={8 * scale} fill={stem} fillOpacity={0.8} />
        <ellipse cx={d * 7 * scale} cy={-5 * scale} rx={3 * scale} ry={6 * scale} fill={stem} fillOpacity={0.6} />
      </g>,
    )
  }
  return (
    <g>
      <path d={`M${x} ${y}q${4 * scale} ${-h * 0.5} 0 ${-h}`} fill="none" stroke={stem} strokeWidth={1.2 * scale} />
      {leaves}
      {[0.45, 0.62].map((t) => (
        <g key={t} transform={`translate(${x + 6 * scale} ${y - h * t}) rotate(30)`}>
          <path d={`M0 0c${4 * scale} ${-2 * scale} ${14 * scale} ${-2 * scale} ${18 * scale} ${3 * scale}c${-5 * scale} ${4 * scale} ${-14 * scale} ${3 * scale} ${-18 * scale} ${-3 * scale}z`} fill={color} stroke="#8a6d3a" strokeWidth={0.5} />
          {[4, 9, 14].map((cx) => (
            <circle key={cx} cx={cx * scale} cy={0.6 * scale} r={1.4 * scale} fill="#8a6d3a" fillOpacity={0.5} />
          ))}
        </g>
      ))}
    </g>
  )
}

export function Tractor({ x, y, s = 1, body = '#c86d67', ink = '#252a25' }: { x: number; y: number; s?: number; body?: string; ink?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path d="M6 -22h22l4 12h10l3 -6h8v18H2l2 -14z" fill={body} stroke={ink} strokeWidth={1} />
      <path d="M10 -22v-14h14l4 14" fill="none" stroke={ink} strokeWidth={1.4} />
      <path d="M12 -34h10v9H12z" fill="#e9e1cd" stroke={ink} strokeWidth={0.6} />
      <path d="M40 -10v-12" stroke={ink} strokeWidth={1.6} />
      <circle cx={16} cy={0} r={11} fill={ink} />
      <circle cx={16} cy={0} r={5} fill="#d0bda0" />
      <circle cx={46} cy={3} r={7} fill={ink} />
      <circle cx={46} cy={3} r={3} fill="#d0bda0" />
      {Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2
        return <path key={i} d={`M${16 + Math.cos(a) * 7} ${Math.sin(a) * 7}L${16 + Math.cos(a) * 10.5} ${Math.sin(a) * 10.5}`} stroke="#d0bda0" strokeWidth={1} />
      })}
    </g>
  )
}

export function Bird({ x, y, s = 1, color = '#252a25' }: { x: number; y: number; s?: number; color?: string }) {
  return (
    <path
      d={`M${x - 9 * s} ${y - 2 * s}q${5 * s} ${-4 * s} ${9 * s} ${2 * s}q${4 * s} ${-6 * s} ${9 * s} ${-2 * s}`}
      fill="none"
      stroke={color}
      strokeWidth={1.4}
      strokeLinecap="round"
    />
  )
}

export function Tree({ x, y, s = 1, fill = '#4d5e44', trunk = '#3a3d34' }: { x: number; y: number; s?: number; fill?: string; trunk?: string }) {
  return (
    <g>
      <path d={`M${x} ${y}v${-12 * s}`} stroke={trunk} strokeWidth={1.6 * s} />
      <ellipse cx={x} cy={y - 18 * s} rx={9 * s} ry={11 * s} fill={fill} />
      <ellipse cx={x - 5 * s} cy={y - 14 * s} rx={6 * s} ry={7 * s} fill={fill} />
      <ellipse cx={x + 5 * s} cy={y - 13 * s} rx={6 * s} ry={6.5 * s} fill={fill} opacity={0.9} />
    </g>
  )
}

export function Palm({ x, y, h, s = 1, fill = '#4d5e44' }: { x: number; y: number; h: number; s?: number; fill?: string }) {
  const tx = x + 8 * s
  const ty = y - h
  const fronds = [-150, -120, -95, -65, -35, -10, 20]
  return (
    <g>
      <path d={`M${x} ${y}Q${x - 6 * s} ${y - h * 0.5} ${tx} ${ty}`} fill="none" stroke="#3a3d34" strokeWidth={2.6 * s} />
      {fronds.map((a) => {
        const rad = (a * Math.PI) / 180
        const ex = tx + Math.cos(rad) * 30 * s
        const ey = ty + Math.sin(rad) * 30 * s + 10 * s
        return (
          <path
            key={a}
            d={`M${tx} ${ty}Q${(tx + ex) / 2} ${Math.min(ty, ey) - 10 * s} ${ex} ${ey}`}
            fill="none"
            stroke={fill}
            strokeWidth={4.5 * s}
            strokeLinecap="round"
          />
        )
      })}
    </g>
  )
}

export function House({ x, y, s = 1, fill = '#252a25' }: { x: number; y: number; s?: number; fill?: string }) {
  return <path d={`M${x} ${y}v${-8 * s}l${6 * s} ${-6 * s}l${6 * s} ${6 * s}v${8 * s}z`} fill={fill} />
}
