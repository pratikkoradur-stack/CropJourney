import { useEffect, useRef, useState } from 'react'
import { useData, type Origin } from '../data/DataContext'
import type { ImportReport } from '../data/parse'
import type { Metadata } from '../data/types'
import { PageHeader } from '../components/PageHeader'
import { IconAlert, IconCheck, IconInfo, IconRefresh, IconUpload } from '../components/Icons'
import { Gate } from '../components/ui'
import { dateStr } from '../lib/format'

export default function DataMethods({ openImport }: { openImport: boolean }) {
  const { meta, retry } = useData()
  const importRef = useRef<HTMLElement>(null)
  useEffect(() => {
    if (openImport) importRef.current?.scrollIntoView({ block: 'start' })
  }, [openImport])
  return (
    <main className="screen">
      <PageHeader title="Data & Methods" eyebrow="Sources, definitions, limits" />
      <div className="wrap stack stack--lg methods">
        <p className="lede">
          The app and the Tableau dashboard read the same prepared CSV files produced by <code>scripts/prepare_data.py</code>. Every figure on screen comes from those files or from a CSV you import below.
        </p>
        <Gate res={meta} label="dataset metadata" onRetry={() => retry('meta')} height={200}>
          {(m) => <Meta m={m} />}
        </Gate>
        <Definitions />
        <section ref={importRef} id="import" className="card stack" aria-labelledby="import-h">
          <ImportPanel />
        </section>
      </div>
    </main>
  )
}

function Meta({ m }: { m: Metadata }) {
  const prod = m.datasets.crop_production
  const bal = m.datasets.national_crop_balance
  const fails = m.checks.filter((c) => c.status === 'fail').length
  const warns = m.checks.filter((c) => c.status === 'warn').length
  return (
    <>
      <section className="grid-2">
        <div className="card">
          <span className="eyebrow">Production</span>
          <h2 className="h2">DES district-wise crop statistics</h2>
          <p className="small">
            {prod.crop_years?.[0]} to {prod.crop_years?.[1]} · {prod.rows.toLocaleString('en-IN')} district-season records · {prod.states} states and UTs · {prod.districts} districts. Area in hectares, production in tonnes.
          </p>
        </div>
        <div className="card">
          <span className="eyebrow">Utilization</span>
          <h2 className="h2">FAOSTAT Food Balances (2010-)</h2>
          <p className="small">
            India, {bal.years?.[0]} to {bal.years?.[1]} · {bal.rows.toLocaleString('en-IN')} crop-year-element values · quantities in thousand tonnes, per-capita supply in kg/year and kcal/day.
          </p>
        </div>
      </section>

      <section className="card">
        <h2 className="h3">Sources</h2>
        <ul className="sources">
          {m.sources.map((s) => (
            <li key={s.id}>
              <b>{s.title}</b>
              <span className="small">{s.publisher}</span>
              <span className="small muted">
                Retrieved {dateStr(s.retrieved_at)} ·{' '}
                <a href={s.origin} target="_blank" rel="noreferrer">
                  official page
                </a>{' '}
                ·{' '}
                <a href={s.url} target="_blank" rel="noreferrer">
                  file used
                </a>
              </span>
              {s.via && <span className="small muted">{s.via}</span>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card__head">
          <h2 className="h3">Validation checks</h2>
          <span className={`tag ${fails ? 'tag--warn' : 'tag--ok'}`}>
            {m.checks.length - fails - warns} passed · {warns} warnings · {fails} failed
          </span>
        </div>
        <ul className="checks">
          {m.checks.map((c) => (
            <li key={c.id} className={`checks__item checks__item--${c.status}`}>
              {c.status === 'pass' ? <IconCheck width={16} height={16} /> : <IconAlert width={16} height={16} />}
              <div>
                <b>{c.label}</b>
                <span className="small muted">{c.detail}</span>
              </div>
            </li>
          ))}
        </ul>
        <p className="small muted">Prepared {dateStr(m.generated_at)}. Full report: data/prepared/validation_report.md.</p>
        {!!m.production_report.state_series_with_gaps?.length && (
          <details className="small">
            <summary>State series with missing years ({m.production_report.state_series_with_gaps.length})</summary>
            <p className="muted">These years are absent in the source and are shown as gaps, never interpolated.</p>
            <ul>
              {m.production_report.state_series_with_gaps.map((g) => (
                <li key={g.crop + g.state}>
                  {g.crop}, {g.state}: {g.years_missing} year(s) missing between {g.first} and {g.last}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  )
}

function Definitions() {
  return (
    <section className="card stack">
      <h2 className="h3">Definitions</h2>
      <dl className="defs">
        <dt>Crop year</dt>
        <dd>Indian agricultural year, July to June. &ldquo;2022-23&rdquo; is stored as year 2022.</dd>
        <dt>Production, area</dt>
        <dd>Sums of district records across all seasons. &lsquo;Total&rsquo; season rows in the source duplicate the seasonal rows and are removed. Pulses = sum of all pulse items (tur, gram, urad, moong, masoor, horse-gram, moth, peas and beans, others).</dd>
        <dt>Unknown values</dt>
        <dd>Records with no production figure stay unknown. They count toward area but are left out of production totals and out of the yield denominator.</dd>
        <dt>Yield</dt>
        <dd>Production ÷ area of the records with known production (t/ha). The same formula is used in Tableau: SUM([production_tonnes]) / SUM([area_with_production_hectares]).</dd>
        <dt>Domestic supply</dt>
        <dd>FAOSTAT: production + imports − exports − stock variation. A positive stock variation means stocks were built up. It also equals food + feed + seed + processing + losses + other uses + residual.</dd>
        <dt>Flow shares</dt>
        <dd>Each destination (exports, stock build-up, food, feed, seed, processing, losses, other uses, positive residual) ÷ total supply (production + imports + stock drawdown + negative residual).</dd>
        <dt>Food supply</dt>
        <dd>Estimated quantity available for human consumption. It is not a measurement of what people eat.</dd>
      </dl>
      <h2 className="h3">Known limitations</h2>
      <ul className="small limits">
        <li>
          District sums can differ from the all-India estimates DES publishes separately. For rice in 2022-23 the district records add up to about 155 Mt, while FAOSTAT&rsquo;s 2022 production of 203.6 Mt paddy corresponds to roughly 136 Mt of milled rice at the usual 2:3 milling ratio. The app shows the district records as published and labels them as such.
        </li>
        <li>FAOSTAT records rice in paddy equivalent; DES records rice as milled rice. The two are never plotted on one axis.</li>
        <li>FAOSTAT reference years are calendar years and do not map one-to-one onto Indian crop years, so production and utilization are shown in separate views.</li>
        <li>District boundaries change over time, so districts are listed in tables rather than mapped. The source maps records to present-day states.</li>
        <li>The analysis is descriptive. It says nothing about causes, farm incomes or what happens to individual harvests.</li>
      </ul>
      <h2 className="h3">Tableau handoff</h2>
      <p className="small">
        Connect Tableau to <code>data/prepared/</code>: crop_production.csv (district × season detail), crop_production_state_year.csv, crop_production_district_year.csv, crop_production_national_season_year.csv, national_crop_balance.csv and national_balance_flows.csv. Field definitions and the refresh procedure are in <code>data/README.md</code>.
      </p>
    </section>
  )
}

function originText(o: Origin) {
  return o.kind === 'bundled' ? 'bundled prepared file' : `imported ${o.fileName} at ${new Date(o.importedAt).toLocaleTimeString()}`
}

function ImportPanel() {
  const { importFile, resetImports, origin } = useData()
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setBusy(true)
    setError(null)
    setReport(null)
    try {
      setReport(await importFile(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  const imported = origin.production.kind === 'imported' || origin.balance.kind === 'imported'

  return (
    <>
      <h2 id="import-h" className="h3">
        Import or refresh data
      </h2>
      <p className="small">
        Load a newer <code>crop_production.csv</code> or <code>national_crop_balance.csv</code> produced by the preparation script. The file is checked for the expected columns, years, crops and duplicates, then every screen uses it for this session. Nothing is uploaded; the file stays in your browser.
      </p>
      <ul className="small origin">
        <li>
          Production: <b>{originText(origin.production)}</b>
        </li>
        <li>
          Utilization: <b>{originText(origin.balance)}</b>
        </li>
      </ul>
      <div className="row wrap-row">
        <label className={`btn btn--primary ${busy ? 'is-busy' : ''}`}>
          {busy ? <span className="spin" aria-hidden /> : <IconUpload width={18} height={18} />}
          {busy ? 'Checking file…' : 'Choose CSV file'}
          <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
        </label>
        <button type="button" className="btn" disabled={!imported || busy} onClick={resetImports}>
          <IconRefresh width={18} height={18} /> Reset to bundled data
        </button>
      </div>
      {error && (
        <div className="notice" role="alert">
          <IconAlert />
          <span>{error}</span>
        </div>
      )}
      {report && (
        <div className="notice notice--neutral" role="status">
          <IconInfo />
          <div>
            <b>
              {report.fileName} loaded as {report.kind === 'production' ? 'crop production' : 'national crop balance'}
            </b>
            <div className="small">
              {report.rowsUsed.toLocaleString('en-IN')} of {report.rowsRead.toLocaleString('en-IN')} rows used · years {report.years ? `${report.years[0]}–${report.years[1]}` : 'n/a'} · crops {report.crops.join(', ') || 'none'}
            </div>
            {report.issues.length > 0 ? (
              <ul className="small">
                {report.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <div className="small">No problems found.</div>
            )}
          </div>
        </div>
      )}
      <p className="small muted">
        To refresh from the official sources instead, run <code>npm run data:fetch</code> and <code>npm run data:prepare</code>; if a download fails the script says which file to place in <code>data/raw/</code> by hand.
      </p>
    </>
  )
}
