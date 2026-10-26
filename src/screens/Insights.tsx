import { useMemo } from 'react'
import { useData } from '../data/DataContext'
import { computeInsights } from '../data/insights'
import type { ProductionStore } from '../data/store'
import { PageHeader } from '../components/PageHeader'
import { IconArrowRight, IconInfo } from '../components/Icons'
import { Gate, LoadingState } from '../components/ui'
import { Sparkline } from '../components/charts/Small'
import { navigate } from '../lib/router'
import { useFilters } from '../state/filters'

export default function Insights() {
  const { production, retry } = useData()
  return (
    <main className="screen bg-grid">
      <PageHeader title="Key Insights" eyebrow="Takeaways" />
      <div className="wrap stack">
        <p className="lede">Each finding below is calculated when the page loads, from the same prepared files the Tableau dashboard uses. Periods, metrics and sources are listed under each one.</p>
        <Gate res={production} label="production data" onRetry={() => retry('production')} height={420}>
          {(p) => <List p={p} />}
        </Gate>
      </div>
    </main>
  )
}

function List({ p }: { p: ProductionStore }) {
  const { balance } = useData()
  const { setFilters } = useFilters()
  const pendingBalance = balance.status === 'loading' || balance.status === 'idle'
  const result = useMemo(() => computeInsights(p, balance.data), [p, balance.data])

  return (
    <>
      <ol className="insights">
        {result.insights.map((ins, i) => (
          <li key={ins.id} className="insight card">
            <div className="insight__num display">{String(i + 1).padStart(2, '0')}</div>
            <div className="insight__body">
              <div className="row row--between">
                <span className="eyebrow">{ins.kicker}</span>
                {ins.spark && <Sparkline values={ins.spark} color={ins.sparkColor} />}
              </div>
              <p className="insight__figure display num">{ins.figure}</p>
              <p className="insight__text">{ins.text}</p>
              <dl className="insight__meta">
                <div>
                  <dt>Period</dt>
                  <dd>{ins.period}</dd>
                </div>
                <div>
                  <dt>Metric</dt>
                  <dd>{ins.metric}</dd>
                </div>
                <div>
                  <dt>Source</dt>
                  <dd>{ins.source}</dd>
                </div>
              </dl>
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  if (ins.link.filters) setFilters(ins.link.filters)
                  navigate(ins.link.to)
                }}
              >
                {ins.link.label} <IconArrowRight width={14} height={14} />
              </button>
            </div>
          </li>
        ))}
      </ol>
      {pendingBalance && <LoadingState label="Loading utilization findings" height={120} />}
      {balance.status === 'error' && (
        <div className="notice">
          <IconInfo />
          <span>Utilization findings are omitted because the national crop balance could not be loaded: {balance.error}</span>
        </div>
      )}
      {result.unavailable.filter((u) => u.id !== 'utilization' || balance.status === 'ready').length > 0 && (
        <div className="notice notice--neutral">
          <IconInfo />
          <span>
            Not shown:{' '}
            {result.unavailable
              .filter((u) => u.id !== 'utilization' || balance.status === 'ready')
              .map((u) => u.reason)
              .join(' ')}
          </span>
        </div>
      )}
      <p className="small muted">These are descriptive comparisons. They show what changed and by how much; they do not establish why.</p>
    </>
  )
}
