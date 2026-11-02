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

function setUrl(text: string | null) {
	const url = new URL(location.href)
	if (text === null)
		url.searchParams.delete(KEY)
	else
		url.searchParams.set(KEY, text)
	history.replaceState(null, '', url)
}

export function restoreSelection(tree: GeoNode[]) {
	const fromUrl = new URLSearchParams(location.search).get(KEY)
	let saved = fromUrl
	try {
		saved ??= localStorage.getItem(KEY)
	}
	catch {}
	const all = leaves(tree)
	const matched = match(tree, new Set(saved?.match(/.{3}/g)))
	const selected = matched.length || saved === '' ? matched : all
	baseline = encode(tree, selected)
	// Storage to URL only, so the address bar matches what is shown.
	if (fromUrl === null && selected.length < all.length)
		setUrl(baseline)
	return selected
}

export function saveSelection(tree: GeoNode[], selected: string[]) {
	const text = encode(tree, selected)
	if (baseline === undefined || text === baseline)
		return
	baseline = text
	// All selected is the default: leave no trace so new places show up.
	const all = selected.length === leaves(tree).length
	// Storage first: replaceState throws in Safari after ~100 calls in 30s.
	try {
		if (all)
			localStorage.removeItem(KEY)
		else
			localStorage.setItem(KEY, text)
		setUrl(all ? null : text)
	}
	catch {}
}
