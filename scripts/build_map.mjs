// Builds data/reference/india_states.topo.json from the DataMeet state boundaries
// (CC BY 4.0), simplified for mobile and renamed to the canonical state names
// used in the prepared datasets (data/reference/state_names.csv).
//
//   npm run data:map
import { readFileSync, statSync } from 'node:fs'
import mapshaper from 'mapshaper'

const rows = readFileSync('data/reference/state_names.csv', 'utf8').trim().split(/\r?\n/).slice(1)
const rename = Object.fromEntries(
  rows.map((r) => r.split(',')).filter(([source]) => source === 'MAP_DATAMEET').map(([, from, to]) => [from, to]),
)
const out = 'data/reference/india_states.topo.json'

await mapshaper.runCommands(
  [
    '-i data/raw/boundaries/Admin2.shp',
    '-simplify 1.2% weighted keep-shapes',
    `-each "state = (${JSON.stringify(rename).replace(/"/g, "'")})[ST_NM] || ST_NM"`,
    '-filter-fields state',
    '-rename-layers states',
    `-o format=topojson quantization=10000 precision=0.001 ${out}`,
  ].join(' '),
)
console.log(`${out}: ${statSync(out).size.toLocaleString()} bytes`)
