import type { School } from './lib/schema.ts'
import { unlink, writeFile } from 'node:fs/promises'
import process from 'node:process'
import { assertSaneDiff, diffRecords } from './lib/diff.ts'
import { buildGeo } from './lib/geo.ts'
import { readGeocodes, writeGeocodes } from './lib/geocodes.ts'
import { PATHS, readJsonl } from './lib/io.ts'
import { keyOf, keyRecords, readRecords, writeRecords } from './lib/records.ts'
import { SchoolsDataSchema } from './lib/schema.ts'

const previousRaw = await readRecords(PATHS.schools)
const raw = await readRecords(PATHS.next)
if (raw.length === 0)
	throw new Error('data/schools-next.jsonl missing or empty — run `npm run pull-data`')

const { added, removed } = diffRecords(previousRaw, raw)

assertSaneDiff(previousRaw.length, removed.length)

// Prune geocodes of removed branches (an edited branch is a new key, so it needs a new geocode).
const allGeocodes = await readGeocodes()
const currentKeys = new Set(keyRecords(raw).keys())
const geocodes = allGeocodes.filter(geocode => currentKeys.has(geocode.key))
const pruned = allGeocodes.length - geocodes.length
const latestGeocode = new Map(geocodes.map(geocode => [geocode.key, geocode]))

const geo = buildGeo(raw)

const schools: School[] = geo.located.map(([record, u]) => {
	const geocode = latestGeocode.get(keyOf(record))
	return {
		r: record.ruc,
		n: record.name,
		a: record.address,
		u,
		...(geocode && { g: [geocode.lat, geocode.lng], p: geocode.placeId }),
	}
})

schools.sort((a, b) =>
	a.u.localeCompare(b.u)
	|| a.n.localeCompare(b.n))

const [previous] = SchoolsDataSchema.array().parse(await readJsonl(PATHS.output))
const unchanged = previous && JSON.stringify({ g: previous.g, s: previous.s }) === JSON.stringify({ g: geo.tree, s: schools })

const data = SchoolsDataSchema.parse({ t: unchanged ? previous.t : new Date().toISOString(), g: geo.tree, s: schools })

await writeFile(PATHS.output, `${JSON.stringify(data)}\n`)

if (pruned > 0)
	await writeGeocodes(geocodes)

await writeRecords(PATHS.schools, raw)
await unlink(PATHS.next)

const summary = [
	`## MTC pull summary`,
	``,
	`- total branches: ${schools.length}`,
	`- added: ${added.length}${added.length > 0 ? ` (${added.map(r => r.ruc).join(', ')})` : ''}`,
	`- removed: ${removed.length}${removed.length > 0 ? ` (${removed.map(r => r.ruc).join(', ')})` : ''}`,
	`- never geocoded: ${schools.filter(school => !school.p).length}`,
	`- geocode entries pruned: ${pruned}`,
].join('\n')

console.log(summary)

const stepSummaryPath = process.env['GITHUB_STEP_SUMMARY']
if (stepSummaryPath)
	await writeFile(stepSummaryPath, `${summary}\n`, { flag: 'a' })
