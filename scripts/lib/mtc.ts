import type { SourceRecord } from './records.ts'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import * as z from 'zod'
import { RucSchema, SourceRecordSchema } from './records.ts'

const NAMED_ENTITIES: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: '\'',
}

function decodeEntities(value: string) {
	return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
		if (entity[0] === '#') {
			const codePoint = entity[1] === 'x' || entity[1] === 'X'
				? Number.parseInt(entity.slice(2), 16)
				: Number.parseInt(entity.slice(1), 10)
			return Number.isNaN(codePoint) ? match : String.fromCodePoint(codePoint)
		}
		return NAMED_ENTITIES[entity.toLowerCase()] ?? match
	})
}

// Decode HTML entities, NFC-normalize, trim, collapse whitespace.
const CleanTextSchema = z.string()
	.transform(decodeEntities)
	.pipe(
		z.string()
			.normalize('NFC')
			.trim()
			.transform(value => value.replace(/\s+/g, ' ')),
	)

// NUM_CENTRO skips CleanTextSchema: the RUC regex already guarantees digits.
const MtcRecordSchema = z.strictObject({ // strict: an unknown upstream field fails the pull instead of being silently dropped
	RN: z.number().int().positive(),
	NOM_DEPARTAMENTO: z.string().min(1).pipe(CleanTextSchema),
	NOM_PROVINCIA: z.string().min(1).pipe(CleanTextSchema),
	NOM_DISTRITO: z.string().min(1).pipe(CleanTextSchema),
	NUM_CENTRO: RucSchema,
	NOM_CENTRO: z.string().min(1).pipe(CleanTextSchema),
	DIR_DOMICILIO: z.string().min(1).pipe(CleanTextSchema),
	ESTADO: z.literal('Con autorización'),
}).transform(record => ({
	ruc: record.NUM_CENTRO,
	name: record.NOM_CENTRO,
	department: record.NOM_DEPARTAMENTO,
	province: record.NOM_PROVINCIA,
	district: record.NOM_DISTRITO,
	address: record.DIR_DOMICILIO,
})).pipe(SourceRecordSchema)

const MtcResponseSchema = z.discriminatedUnion('orStatus', [
	z.object({
		orStatus: z.literal(true),
		orResult: z.tuple([
			z.string().transform((raw, ctx) => {
				try {
					return JSON.parse(raw) as unknown
				}
				catch (error) {
					ctx.addIssue({ code: 'custom', message: `body is not valid JSON: ${error instanceof Error ? error.message : String(error)}` })
					return z.NEVER
				}
			}).pipe(z.array(MtcRecordSchema)),
			z.coerce.number().finite(),
		]),
	}),
	z.looseObject({ orStatus: z.literal(false) }),
])

const SLEEP_MS = 150
const REQUEST_TIMEOUT_MS = 30_000
const MAX_ATTEMPTS = 3
const MAX_PAGES = 50

async function fetchPage(page: number) {
	const template = process.env['MTC_API_URL']
	if (!template?.includes('{}'))
		throw new Error('MTC_API_URL must be set and contain a {} placeholder (see .env.example)')
	const url = template.replace('{}', encodeURIComponent(`|||${page}`))

	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
			if (!res.ok)
				throw new Error(`MTC request failed with status ${res.status} (page ${page})`)

			const result = MtcResponseSchema.safeParse(await res.json())
			if (!result.success)
				throw new Error(`MTC response failed validation (page ${page}): ${z.prettifyError(result.error)}`, { cause: result.error })

			return result.data
		}
		catch (error) {
			if (error instanceof Error && error.cause instanceof z.ZodError)
				throw error // broken contract, never retry

			if (attempt >= MAX_ATTEMPTS)
				throw error

			await sleep(SLEEP_MS * attempt)
		}
	}
}

export async function fetchRecords() {
	const records: SourceRecord[] = []
	let page = 0
	let totalPages: number | undefined

	for (;;) {
		if (page >= MAX_PAGES)
			throw new Error(`MTC pagination exceeded ${MAX_PAGES} pages without finishing — aborting, this looks like a runaway loop rather than real data`)

		const data = await fetchPage(page)
		if (!data.orStatus) {
			if (page === 0)
				break // legitimate empty result
			throw new Error(`MTC returned orStatus:false on page ${page} (expected ${String(totalPages)} pages total) — treating this as an upstream error, not end-of-data`)
		}

		const [batch, pages] = data.orResult
		records.push(...batch)

		totalPages ??= pages
		page += 1
		if (page >= totalPages || batch.length === 0)
			break

		await sleep(SLEEP_MS)
	}

	return records
}
