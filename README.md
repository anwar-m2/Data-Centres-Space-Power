### PeeringDB importer & PostGIS (scaffold)

I added a basic importer that fetches PeeringDB facility records and upserts them into a Postgres/PostGIS database.

Files added
- docker-compose.yml — runs a PostGIS-enabled Postgres (db:5432) with an init SQL script
- server/db/init.sql — creates the facilities table and PostGIS extension
- server/importers/peeringdb.js — Node script to fetch PeeringDB /api/facility and insert into DB
- server/package.json — updated to include axios and pg and an npm script import:peeringdb

Run locally (recommended)
1. Start the DB container:
   docker compose up -d
   # waits a few seconds for DB to init

2. Run the importer (from repo root):
   cd server
   npm install
   npm run import:peeringdb

   By default the importer connects to PGHOST=localhost, PGUSER=postgres, PGPASSWORD=example, PGDATABASE=dcsp, PGPORT=5432 — the docker-compose uses these values by default.

Notes & next steps
- The importer is intentionally simple: it fetches up to 1000 facility records from PeeringDB and inserts those with coordinates.
- For production you should add pagination, retries, rate-limit handling, and better operator/org resolution.
- Consider converting org_id to a join to an organizations table, normalizing sources, and adding provenance/confidence scoring.

If you want, I can now:
- Add pagination to the importer to fetch all records reliably.
- Add a simple API endpoint to serve facilities from PostGIS (instead of static JSON).
- Add a database migration tool (like node-pg-migrate) and docker-compose override for dev.
