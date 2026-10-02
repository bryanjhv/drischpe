import type { GeoNode } from './schema'

export function leaves(nodes: GeoNode[]): string[] {
	return nodes.flatMap(node => 'u' in node ? [node.u] : leaves(node.k))
}

// District code → "DISTRICT, PROVINCE, DEPARTMENT".
export function placeNames(nodes: GeoNode[], parents = ''): Map<string, string> {
	return new Map(nodes.flatMap((node): [string, string][] =>
		'u' in node ? [[node.u, `${node.n}${parents}`]] : [...placeNames(node.k, `, ${node.n}${parents}`)],
	))
}

export function rollupState(selected: string[], districts: string[]) {
	const count = districts.filter(d => selected.includes(d)).length
	if (count === 0)
		return 'unchecked'
	return count === districts.length ? 'checked' : 'indeterminate'
}

export type RollupState = ReturnType<typeof rollupState>
