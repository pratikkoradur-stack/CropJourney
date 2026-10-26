import { useSyncExternalStore } from 'react'

/**
 * Minimal hash router: real browser history (so the device back gesture works),
 * an in-app depth counter (so "back" never leaves the app), a double-tap guard,
 * and per-route scroll restoration.
 */
export type RouteName = 'home' | 'menu' | 'production' | 'area-yield' | 'utilization' | 'compare' | 'insights' | 'crop' | 'data'

export interface Route {
  name: RouteName
  param: string | null
  query: URLSearchParams
  hash: string
}

const NAMES: RouteName[] = ['menu', 'production', 'area-yield', 'utilization', 'compare', 'insights', 'crop', 'data']

function parse(hash: string): Route {
  const clean = hash.replace(/^#\/?/, '')
  const [path, qs = ''] = clean.split('?')
  const [head, param] = path.split('/')
  const name = (NAMES as string[]).includes(head) ? (head as RouteName) : 'home'
  return { name, param: param ? decodeURIComponent(param) : null, query: new URLSearchParams(qs), hash: hash || '#/' }
}

const listeners = new Set<() => void>()
const scrollMemory = new Map<string, number>()
let current = parse(window.location.hash)
let depth = 0
let lastNav = { to: '', at: 0 }

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
if (history.state && typeof history.state.cjDepth === 'number') depth = history.state.cjDepth
else history.replaceState({ cjDepth: 0 }, '')

function emit() {
  current = parse(window.location.hash)
  listeners.forEach((l) => l())
}

window.addEventListener('popstate', (e) => {
  scrollMemory.set(current.hash, window.scrollY)
  depth = typeof e.state?.cjDepth === 'number' ? e.state.cjDepth : 0
  emit()
})

// Typed URLs and plain links change the hash without a popstate in some browsers.
window.addEventListener('hashchange', () => {
  if (parse(window.location.hash).hash === current.hash) return
  scrollMemory.set(current.hash, window.scrollY)
  if (!history.state || typeof history.state.cjDepth !== 'number') history.replaceState({ cjDepth: ++depth }, '')
  emit()
})

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const now = performance.now()
  if (to === lastNav.to && now - lastNav.at < 600) return
  lastNav = { to, at: now }
  if (to === window.location.hash && !opts.replace) return
  scrollMemory.set(current.hash, window.scrollY)
  if (opts.replace) {
    history.replaceState({ cjDepth: depth }, '', to)
  } else {
    depth += 1
    history.pushState({ cjDepth: depth }, '', to)
    scrollMemory.delete(to)
  }
  emit()
}

export function goBack(fallback = '#/') {
  if (depth > 0) history.back()
  else navigate(fallback, { replace: true })
}

export function savedScroll(hash: string): number {
  return scrollMemory.get(hash) ?? 0
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => current,
  )
}
