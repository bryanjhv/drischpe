import type { School } from './schema'

export function mapsUrl(school: School) {
	return `https://www.google.com/maps/${school.p
		? `place/?q=place_id:${encodeURIComponent(school.p)}`
		: `search/${encodeURIComponent(`${school.n} ${school.a}`)}`}`
}
