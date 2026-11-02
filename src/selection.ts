import type { GeoNode } from './schema'
import { leaves, rollupState } from './tree'

const KEY = 'd'
const encoder = new TextEncoder()

// Names, not codes: codes shift when MTC data changes. 18-bit FNV-1a as 3 base64url chars.
// shortcut: no collisions today, a collision only over-selects; widen to 4 chars if a pull ever produces one.
function pathHash(path: string) {
	let hash = 0x811C9DC5
	for (const byte of encoder.encode(path))
		hash = Math.imul(hash ^ byte, 0x01000193)
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'
	return [12, 6, 0].map(shift => alphabet[(hash >>> shift) & 63]).join('')
}

// Highest fully selected nodes only: unselected ones are never listed, so places MTC adds later stay unselected.
function encode(nodes: GeoNode[], selected: string[], parents = ''): string {
	return nodes.map((node) => {
		const path = parents + node.n
		const state = rollupState(selected, leaves([node]))
		if (state === 'checked')
			return pathHash(path)
		return state === 'indeterminate' && 'k' in node ? encode(node.k, selected, `${path}/`) : ''
	}).join('')
}

function match(nodes: GeoNode[], wanted: Set<string>, parents = ''): string[] {
	return nodes.flatMap((node) => {
		const path = parents + node.n
		if (wanted.has(pathHash(path)))
			return leaves([node])
		return 'k' in node ? match(node.k, wanted, `${path}/`) : []
	})
}

// Last loaded or saved text: only user changes save, so a shared link can't overwrite this browser's selection.
let baseline: string | undefined

export function restoreSelection(tree: GeoNode[]) {
	let saved = new URLSearchParams(location.search).get(KEY)
	try {
		saved ??= localStorage.getItem(KEY)
	}
	catch {}
	const matched = match(tree, new Set(saved?.match(/.{3}/g)))
	const selected = matched.length || saved === '' ? matched : leaves(tree)
	baseline = encode(tree, selected)
	return selected
}

export function saveSelection(tree: GeoNode[], selected: string[]) {
	const text = encode(tree, selected)
	if (baseline === undefined || text === baseline)
		return
	baseline = text
	// All selected is the default: leave no trace so new places show up.
	const all = selected.length === leaves(tree).length
	const url = new URL(location.href)
	// Storage first: replaceState throws in Safari after ~100 calls in 30s.
	try {
		if (all) {
			url.searchParams.delete(KEY)
			localStorage.removeItem(KEY)
		}
		else {
			url.searchParams.set(KEY, text)
			localStorage.setItem(KEY, text)
		}
		history.replaceState(null, '', url)
	}
	catch {}
}
