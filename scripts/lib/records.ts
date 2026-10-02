import { createHash } from 'node:crypto'
import * as z from 'zod'
import { readJsonl, writeJsonl } from './io.ts'

export const RucSchema = z.string().regex(/^20\d{9}$/, 'expected an 11-digit RUC starting with 20')

export const SourceRecordSchema = z.object({
	ruc: RucSchema,
	name: z.string().min(1),
	department: z.string().min(1),
	province: z.string().min(1),
	district: z.string().min(1),
	address: z.string(), // MTC data legitimately has blank addresses for some branches
})

export type SourceRecord = z.infer<typeof SourceRecordSchema>

export async function readRecords(url: URL) {
	return z.array(SourceRecordSchema).parse(await readJsonl(url))
}

// Sorted so the committed file diffs cleanly between pulls.
export async function writeRecords(url: URL, records: SourceRecord[]) {
	const sorted = records.toSorted((a, b) =>
		a.department.localeCompare(b.department)
		|| a.province.localeCompare(b.province)
		|| a.district.localeCompare(b.district)
		|| a.ruc.localeCompare(b.ruc)
		|| a.name.localeCompare(b.name)
		|| a.address.localeCompare(b.address))
	await writeJsonl(url, sorted)
}

function recordIdentity(record: SourceRecord) {
	return JSON.stringify(SourceRecordSchema.keyof().options.map(field => record[field]))
}

export function keyOf(record: SourceRecord) {
	return createHash('sha256').update(recordIdentity(record)).digest('hex').slice(0, 8)
}

export function keyRecords(records: SourceRecord[]) {
	const byKey = new Map<string, SourceRecord>()
	for (const record of records) {
		const key = keyOf(record)
		const other = byKey.get(key)
		if (other && recordIdentity(other) !== recordIdentity(record))
			throw new Error(`branch key collision on ${key}: ${recordIdentity(other)} | ${recordIdentity(record)}`)
		byKey.set(key, record)
	}
	return byKey
}
