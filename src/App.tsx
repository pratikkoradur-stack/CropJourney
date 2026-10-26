import { lazy, Suspense, useLayoutEffect, type ReactNode } from 'react'
import { DataProvider } from './data/DataContext'
import { FiltersProvider } from './state/filters'
import { savedScroll, useRoute, type Route } from './lib/router'
import { LoadingState } from './components/ui'
import Home from './screens/Home'

const Menu = lazy(() => import('./screens/Menu'))
const ProductionMap = lazy(() => import('./screens/ProductionMap'))
const AreaYield = lazy(() => import('./screens/AreaYield'))
const Utilization = lazy(() => import('./screens/Utilization'))
const Compare = lazy(() => import('./screens/Compare'))
const Insights = lazy(() => import('./screens/Insights'))
const CropDetail = lazy(() => import('./screens/CropDetail'))
const DataMethods = lazy(() => import('./screens/DataMethods'))

function screenFor(route: Route): ReactNode {
  switch (route.name) {
    case 'menu':
      return <Menu />
    case 'production':
      return <ProductionMap />
    case 'area-yield':
      return <AreaYield />
    case 'utilization':
      return <Utilization tab={route.query.get('tab') === 'trade' ? 'trade' : 'use'} />
    case 'compare':
      return <Compare />
    case 'insights':
      return <Insights />
    case 'crop':
      return <CropDetail param={route.param} tab={route.query.get('tab')} />
    case 'data':
      return <DataMethods openImport={route.query.get('import') === '1'} />
    default:
      return <Home />
  }
}

/** Restore the scroll position saved for this route (or start at the top). */
function useScrollRestore(hash: string) {
  useLayoutEffect(() => {
    const target = savedScroll(hash)
    let tries = 0
    let raf = 0
    const apply = () => {
      window.scrollTo(0, target)
      const reachable = document.documentElement.scrollHeight - window.innerHeight >= target - 2
      if (!reachable && tries++ < 40) raf = requestAnimationFrame(apply)
    }
    apply()
    return () => cancelAnimationFrame(raf)
  }, [hash])
}

function Screens() {
  const route = useRoute()
  useScrollRestore(route.hash)
  const key = route.name === 'utilization' || route.name === 'crop' ? `${route.name}/${route.param ?? ''}` : route.name
  return (
    <Suspense
      fallback={
        <div className="wrap" style={{ paddingTop: 96 }}>
          <LoadingState label="Opening section" height={240} />
        </div>
      }
    >
      <div key={key}>{screenFor(route)}</div>
    </Suspense>
  )
}

export default function App() {
  return (
    <DataProvider>
      <FiltersProvider>
        <Screens />
      </FiltersProvider>
    </DataProvider>
  )
}
