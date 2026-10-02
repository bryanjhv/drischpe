# DriSchPE

DriSchPE (Driving Schools PE) is an interactive map of Peru's licensed driving schools, built from the public registry of the Ministry of Transport and Communications (MTC). Schools can be filtered by department, province and district, and each one links out to Google Maps. The UI is in Spanish.

The site is fully static: a scheduled job pulls the registry, normalizes it into a single JSON file, and the frontend loads that file at runtime.

## Getting started

Requires Node 24 (see `.nvmrc`).

```sh
npm ci
npm start        # Vite dev server
npm run build    # typecheck + production build into dist/
```

## Data

```
MTC API ──pull-mtc.ts──▶ data/schools-next.jsonl
                              │
                    build-data.ts  (diff vs data/schools.jsonl, apply geocodes)
                              │
                              ▼
                      public/schools.json ──fetch──▶ Alpine.js app + Leaflet map
```

| File                      | Purpose                                                                    |
| ------------------------- | -------------------------------------------------------------------------- |
| `data/schools.jsonl`      | Committed snapshot of the raw MTC records. Baseline for diffs.             |
| `data/schools-next.jsonl` | Latest pull. Gitignored; deleted by the build step.                        |
| `data/geocodes.jsonl`     | Manual coordinates, append-only, keyed by branch; removed branches pruned. |
| `public/schools.json`     | What the app loads. Generated, do not edit by hand.                        |

Source: the MTC driving school registry query endpoint, paged and validated with zod. Its URL comes from the `MTC_API_URL` env var (`{}` is replaced with the encoded page query); copy `.env.example` to `.env` before `npm run pull-data`. In CI, set it as a repository variable.

### Updating the data

```sh
npm run pull-data
```

A GitHub Actions workflow (`.github/workflows/pull-data.yml`) does the same every day at 07:00 UTC and commits any changes. The timestamp in `schools.json` is when the data last changed, not when it was pulled: a run that changes nothing leaves the file untouched, so there is nothing to commit.

`build-data.ts` refuses to publish if more than 20% of branches look removed, since that usually means a bad pull rather than reality. It prints a summary (added, removed, never geocoded, pruned geocodes) and appends it to the GitHub step summary when running in CI.

### Geocoding

The MTC data has no coordinates. They are added by hand, once per branch:

```sh
npm run geocode -- <ruc> <payload> [filter]
```

- `payload` is the `fetchFields` response (base64 or raw JSON) copied from the network tab of Google's [Place ID Finder](https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder): it holds both the place ID and the coordinates. The layout is undocumented; if Google changes it, validation fails.
- Coordinates are rounded to 5 decimals (~1.1 m).
- If a RUC (Peru's tax ID) has several branches, pass a district or address fragment as `filter`.
- Entries are appended to `data/geocodes.jsonl`; the latest one per branch wins.
- Schools without a geocode still appear in the district filter but have no map marker.

A branch is identified by a short hash of all its fields (`keyOf`). Any change to any field makes it a different branch (removed + added): its geocode must be redone by hand, and geocode entries of removed branches are pruned on build.

## Frontend

Vite, Alpine.js and Leaflet, with no UI framework, in `src/`. The keys in `public/schools.json` are deliberately short to keep the payload small; see the zod schemas in `src/schema.ts`.
