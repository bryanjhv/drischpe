import type { School } from './schema'
import L from 'leaflet'
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png'
import iconUrl from 'leaflet/dist/images/marker-icon.png'
import shadowUrl from 'leaflet/dist/images/marker-shadow.png'
import { mapsUrl } from './url'
import 'leaflet/dist/leaflet.css'

// In dev, Leaflet's auto-detected imagePath is already absolute and would be prefixed twice onto these urls.
if (import.meta.env.DEV)
	L.Icon.Default.imagePath = ''
L.Icon.Default.mergeOptions({ iconRetinaUrl, iconUrl, shadowUrl })

const PERU_CENTER: L.LatLngTuple = [-9.19, -75.02]

type Located = School & { g: NonNullable<School['g']> }

export function initMap(container: HTMLElement) {
	const map = L.map(container).setView(PERU_CENTER, 6)
	L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
		attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
		maxZoom: 19,
	}).addTo(map)
	const markers = L.layerGroup().addTo(map)

	return (schools: School[]) => {
		markers.clearLayers()
		const located = schools.filter((school): school is Located => school.g !== undefined)
		for (const school of located)
			markers.addLayer(L.marker(school.g).bindPopup(popupHtml(school)))

		if (located.length > 0)
			map.fitBounds(L.latLngBounds(located.map(school => school.g)), { maxZoom: 15 })
		else
			map.setView(PERU_CENTER, 6)
	}
}

function popupHtml(school: School) {
	return [
		`<strong>${escapeHtml(school.n)}</strong>`,
		escapeHtml(school.a),
		`<a href="${mapsUrl(school)}" target="_blank" rel="noopener">Ver en Google Maps</a>`,
	].join('<br>')
}

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
}
