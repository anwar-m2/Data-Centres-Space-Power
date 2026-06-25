# Data Centres Space Power

Scaffold for MVP: interactive map of data centre locations.

This branch (scaffold/mvp-map) contains a minimal Express backend and a lightweight React frontend (Vite + Leaflet) that displays sample data‑centre locations.

Run locally
1. Clone and checkout the scaffold branch:
   git clone git@github.com:anwar-m2/Data-Centres-Space-Power.git
   cd Data-Centres-Space-Power
   git checkout scaffold/mvp-map

2. Server (API):
   cd server
   npm install
   npm run dev
   # server listens on http://localhost:3000

3. Client (frontend):
   cd client
   npm install
   npm run dev
   # open http://localhost:5173

Notes
- The server exposes /api/facilities and /api/facility/:id returning GeoJSON sample data (server/data/facilities.json).
- The frontend uses Leaflet and marker clustering. It requests the facilities from the API and displays clustered markers with popups.
- This scaffold is intentionally minimal — next steps: add PeeringDB importer, PostGIS storage, vector tiles, CI, and a deploy pipeline.
