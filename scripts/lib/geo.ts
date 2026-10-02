import type { GeoNode } from '../../src/schema.ts'
import type { SourceRecord } from './records.ts'

const GEO_LEVELS = ['department', 'province', 'district'] as const satisfies readonly (keyof SourceRecord)[]
type GeoLevel = (typeof GEO_LEVELS)[number]

// A level's code is its 1-based alphabetical position (2 digits) appended to its parent's.
export function buildGeo(records: SourceRecord[]) {
	const located: [SourceRecord, string][] = []

	function build(group: SourceRecord[], field: GeoLevel, deeper: readonly GeoLevel[], prefix: string): GeoNode[] {
		const names = [...new Set(group.map(record => record[field]))].sort((a, b) => a.localeCompare(b))
		if (names.length > 99)
			throw new Error(`geo level has ${names.length} entries, more than the 2-digit code scheme supports`)

		return names.map((n, i) => {
			const code = prefix + String(i + 1).padStart(2, '0')
			const members = group.filter(record => record[field] === n)
			const [nextField, ...rest] = deeper
			if (nextField)
				return { n, k: build(members, nextField, rest, code) }
			for (const record of members)
				located.push([record, code])
			return { n, u: code }
		})
	}

	const [topField, ...deeper] = GEO_LEVELS
	return { tree: build(records, topField, deeper, ''), located }
}
