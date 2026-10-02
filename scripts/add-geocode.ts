import { Buffer } from 'node:buffer'
import process from 'node:process'
import * as z from 'zod'
import { appendGeocode, GeocodeSchema } from './lib/geocodes.ts'
import { PATHS } from './lib/io.ts'
import { keyOf, readRecords } from './lib/records.ts'

// Place ID Finder's fetchFields response (network tab): base64 of a positional JSON array,
// placeId at [1] and [lat, lng] at [11]. Undocumented layout, so a shift fails validation.
const PayloadSchema = z.string()
	.transform((s, ctx) => {
		try {
			return JSON.parse(s.startsWith('[') ? s : Buffer.from(s, 'base64').toString('latin1')) as unknown
		}
		catch {
			ctx.issues.push({ code: 'custom', message: 'payload is neither JSON nor base64 JSON', input: s })
			return z.NEVER
		}
	})
	.pipe(z.array(z.unknown()))
	.transform(a => [a[1], a[11]])
	.pipe(z.tuple([GeocodeSchema.shape.placeId, z.tuple([GeocodeSchema.shape.lat, GeocodeSchema.shape.lng])]))

const ArgsSchema = z.tuple([GeocodeSchema.shape.ruc, PayloadSchema, z.string().optional()])

const args = ArgsSchema.safeParse(process.argv.slice(2))
if (!args.success) {
	console.error(z.prettifyError(args.error))
	console.error('Usage: npm run geocode -- <ruc> <payload> [filter]')
	console.error('  payload is the fetchFields response from Place ID Finder (base64 or raw JSON).')
	console.error('  filter narrows branches by district or address when the RUC has more than one.')
	process.exit(1)
}
const [ruc, [placeId, [lat, lng]], filter] = args.data

const raw = await readRecords(PATHS.schools)

const candidates = raw.filter(r => r.ruc === ruc)
if (candidates.length === 0) {
	console.error(`RUC ${ruc} not found in data/schools.jsonl — run \`npm run pull-data\` first`)
	process.exit(1)
}

const matches = filter
	? candidates.filter(r => `${r.district} ${r.address}`.toUpperCase().includes(filter.toUpperCase()))
	: candidates

if (matches.length !== 1) {
	console.error(matches.length === 0
		? `No branch of RUC ${ruc} matches "${filter}". All branches:`
		: `RUC ${ruc} has ${matches.length} matching branches — pass a more specific filter (district or address fragment) as \`filter\`:`)
	for (const { district, address } of matches.length === 0 ? candidates : matches)
		console.error(`  ${district}: ${address}`)
	process.exit(1)
}

const record = matches[0]!

await appendGeocode(GeocodeSchema.parse({
	key: keyOf(record),
	ruc: record.ruc,
	address: record.address,
	lat,
	lng,
	placeId,
	updatedAt: new Date().toISOString(),
}))

console.log(`Saved geocode for ${ruc} (${record.name}, ${record.district})`)
