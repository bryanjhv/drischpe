import type { GeoNode, School, SchoolsData } from './schema'
import type { RollupState } from './tree'
import Alpine from 'alpinejs'
import { leaves, placeNames, rollupState } from './tree'
import { mapsUrl } from './url'

interface App {
	schools: School[]
	tree: GeoNode[]
	places: Map<string, string>
	selectedDists: string[]
	updatedAt: string
	init: () => void
	nodeState: (districts: string[]) => RollupState
	toggleNode: (districts: string[]) => void
	leaves: (nodes: GeoNode[]) => string[]
	filteredSchools: () => School[]
	mapsUrl: (school: School) => string
}

Alpine.data<App, never>('app', () => ({
	schools: [],
	tree: [],
	places: new Map(),
	selectedDists: [],
	updatedAt: '',
	init() {
		const container = this.$refs['map'] as HTMLElement
		const updateMarkers = import('./map').then(m => m.initMap(container))
		// Validated in build-data.ts
		void fetch('/schools.json').then(async res => res.json() as Promise<SchoolsData>).then(({ t, g, s }) => {
			this.tree = g
			this.places = placeNames(g)
			this.schools = s
			this.selectedDists = leaves(g)
			this.updatedAt = new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Lima' }).format(new Date(t))
		})
		this.$watch('selectedDists', () => void updateMarkers.then(update => update(this.filteredSchools())))
	},
	nodeState(districts) {
		return rollupState(this.selectedDists, districts)
	},
	toggleNode(districts) {
		this.selectedDists = this.nodeState(districts) === 'checked'
			? this.selectedDists.filter(d => !districts.includes(d))
			: [...new Set([...this.selectedDists, ...districts])]
	},
	leaves,
	filteredSchools() {
		return this.schools.filter(school => this.selectedDists.includes(school.u))
	},
	mapsUrl,
}))

Alpine.start()
