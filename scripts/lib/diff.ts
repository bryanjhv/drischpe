import type { SourceRecord } from './records.ts'
import { keyRecords } from './records.ts'

const REMOVED_RATIO_LIMIT = 0.2

export function diffRecords(previous: SourceRecord[], next: SourceRecord[]) {
	const previousByKey = keyRecords(previous)
	const nextByKey = keyRecords(next)

	return {
		added: [...nextByKey].filter(([key]) => !previousByKey.has(key)).map(([, r]) => r),
		removed: [...previousByKey].filter(([key]) => !nextByKey.has(key)).map(([, r]) => r),
	}
}

export function assertSaneDiff(previousCount: number, removedCount: number) {
	if (previousCount === 0)
		return

	const removedRatio = removedCount / previousCount
	if (removedRatio > REMOVED_RATIO_LIMIT) {
		throw new Error(
			`refusing to publish: ${removedCount} of ${previousCount} branches (${(removedRatio * 100).toFixed(1)}%) look removed — `
			+ `this smells like a bad pull, not reality. Investigate data/schools-next.jsonl before retrying.`,
		)
	}
}
