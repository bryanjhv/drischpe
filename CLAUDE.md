# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm start` — Vite dev server
- `npm run build` — typecheck (`tsc` for `tsconfig.app.json` and `tsconfig.node.json`) then `vite build`
- `npm run typecheck` — typecheck only
- `npm run lint` — ESLint with `--fix` (antfu config, tab indent)
- `npm run pull-data` — pull MTC data, then diff/build `public/schools.json`
- `npm run geocode -- <ruc> <payload> [filter]` — add a manual geocode (payload: Place ID Finder `fetchFields` response)
- No test suite. Node 24; scripts run `.ts` directly with `node` (no build step); deps pinned exact (`.npmrc`).

## Architecture

DriSchPE: static map of Peruvian driving schools. See README.md for the data flow, data files and geocoding workflow. Non-obvious points:

- Two halves joined by `public/schools.json`: the Node pipeline in `scripts/` (run daily by a GitHub Action that commits the data) and the static Alpine.js + Leaflet app in `src/`.
- Branch identity is `keyOf(record)` (`scripts/lib/records.ts`): a hash of every `SourceRecord` field. Any field change = a different branch (removed + added) and its geocode is lost; there is no migration.
- `src/schema.ts` zod schemas are the single source of truth for `schools.json`: the browser uses only the inferred types, `build-data.ts` parses its output with them. JSON keys are deliberately short.
- `schools.json`'s `t` is when the data last changed: `build-data.ts` reuses the previous `t` when the geo tree and schools are identical, which is what keeps the daily CI run from committing noise.
- All data file paths live in `PATHS` (`scripts/lib/io.ts`).
- The MTC endpoint URL is the `MTC_API_URL` env var (`.env`, see `.env.example`; `{}` = encoded query).
- Two tsconfigs: `tsconfig.app.json` (`src/`, browser) and `tsconfig.node.json` (`scripts/`); both extend `@tsconfig/strictest`.
