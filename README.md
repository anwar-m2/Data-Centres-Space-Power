### PostGIS-backed API, importer improvements, dev proxy, and client bbox loading

I implemented the changes you requested (A–E) on the scaffold/mvp-map branch.

Summary of changes
- server/index.js
  - Now attempts to connect to Postgres/PostGIS and serve /api/facilities and /api/facility/:id from the facilities table if available.
  - Supports bbox (minLng,minLat,maxLng,maxLat), limit and page parameters. Falls back to the static JSON file when Postgres isn't available.
- server/importers/peeringdb.js
  - Upgraded importer: pagination via limit/offset, retry logic, basic deduplication by proximity (200 m), and a simple confidence score.
  - Ensures the `confidence` column exists (ALTER TABLE IF NOT EXISTS) so it's safe to run against existing DBs.
- client/vite.config.js
  - Dev proxy so Vite will forward /api requests to http://localhost:3000 in development.
- client MapView
  - Now requests bbox-filtered facilities from the API when the map moves (moveend) and only loads visible features, reducing payloads.
- README updated with instructions for running the DB, importer, and the dev proxy + dev servers.

Next suggested steps
- Add pagination metadata (total count) and server-side tile endpoints for true vector tiles when you need to scale to very large datasets.
- Harden importer: add rate-limit handling, backoff, and logging; create an organizations importer to resolve org_id to names.
- Add database migrations and tests for the importer.

Run instructions (quick)
1. Start DB: docker compose up -d
2. Install server deps: cd server && npm install
3. Run importer: npm run import:peeringdb
4. Start dev servers: from repo root npm run dev (or run server/client separately)

If you want, I can now:
- Implement server-side pagination metadata (total count) and a cursor-based API.
- Add a vector-tiles endpoint (tegola or ST_AsMVT) and update the frontend to use MapLibre for tile rendering.
- Add an organizations importer and normalize operator names.

Which of those would you like next, or shall I proceed to add server-side count metadata and a small organizations importer now?
