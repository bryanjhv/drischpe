import { appendFile, readFile, writeFile } from 'node:fs/promises'

export const PATHS = {
	schools: new URL('../../data/schools.jsonl', import.meta.url),
	next: new URL('../../data/schools-next.jsonl', import.meta.url),
	geocodes: new URL('../../data/geocodes.jsonl', import.meta.url),
	output: new URL('../../public/schools.json', import.meta.url),
}

async function readIfExists(url: URL) {
	try {
		return await readFile(url, 'utf8')
	}
	catch (error) {
		if (error instanceof Error && 'code' in error && error.code === 'ENOENT')
			return undefined
		throw error
	}
}

export async function readJsonl(url: URL) {
	const text = await readIfExists(url)
	return (text ?? '').split('\n').filter(line => line.length > 0).map(line => JSON.parse(line) as unknown)
}

const toJsonl = (items: unknown[]) => items.map(item => `${JSON.stringify(item)}\n`).join('')

export async function writeJsonl(url: URL, items: unknown[]) {
	await writeFile(url, toJsonl(items))
}

export async function appendJsonl(url: URL, item: unknown) {
	await appendFile(url, toJsonl([item]))
}
