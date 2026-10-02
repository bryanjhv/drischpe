import * as z from 'zod'
import { appendJsonl, PATHS, readJsonl, writeJsonl } from './io.ts'
import { RucSchema } from './records.ts'

const KeySchema = z.string().regex(/^[0-9a-f]{8}$/, 'expected an 8-char hex branch key')

// 5 decimals ≈ 1.1 m, plenty for a building.
const round5 = (n: number) => Math.round(n * 1e5) / 1e5

export const GeocodeSchema = z.object({
	key: KeySchema,
	ruc: RucSchema,
	address: z.string(),
	lat: z.number().min(-90).max(90).transform(round5),
	lng: z.number().min(-180).max(180).transform(round5),
	placeId: z.string().min(1),
	updatedAt: z.iso.datetime(),
})

type Geocode = z.infer<typeof GeocodeSchema>

// Append-only history, oldest first: the latest line per key wins.
export async function readGeocodes() {
	return z.array(GeocodeSchema).parse(await readJsonl(PATHS.geocodes))
}

export async function appendGeocode(geocode: Geocode) {
	await appendJsonl(PATHS.geocodes, geocode)
}

export async function writeGeocodes(geocodes: Geocode[]) {
	await writeJsonl(PATHS.geocodes, geocodes)
}
