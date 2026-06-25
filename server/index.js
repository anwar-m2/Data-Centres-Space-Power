const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Client } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'facilities.json');
let facilities = null;

function loadData(){
  if(fs.existsSync(dataPath)){
    const raw = fs.readFileSync(dataPath, 'utf8');
    facilities = JSON.parse(raw);
  }
}

loadData();

// Create a PG client factory so we connect only when needed
function makePgClient(){
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'example',
    database: process.env.PGDATABASE || 'dcsp'
  });
  return client;
}

// Helper: parse bbox string minLng,minLat,maxLng,maxLat
function parseBbox(bbox){
  if(!bbox) return null;
  const parts = bbox.split(',').map(Number);
  if(parts.length !== 4 || parts.some(isNaN)) return null;
  return parts; // [minLng,minLat,maxLng,maxLat]
}

// API: GET /api/facilities?bbox=minLng,minLat,maxLng,maxLat&limit=1000&page=1
app.get('/api/facilities', async (req, res) => {
  const bbox = parseBbox(req.query.bbox);
  const limit = Math.min(Number(req.query.limit) || 1000, 5000);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const offset = (page - 1) * limit;

  // Try to serve from Postgres if available
  const client = makePgClient();
  try{
    await client.connect();
  }catch(e){
    // no postgres available, fallback to static JSON
    if(!facilities) return res.status(500).json({ error: 'no data available' });
    if(!bbox) return res.json(facilities);
    const [minLng,minLat,maxLng,maxLat] = bbox;
    const features = facilities.features.filter(f => {
      const [lng,lat] = f.geometry.coordinates;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
    return res.json({ type: 'FeatureCollection', features });
  }

  try{
    // ensure PostGIS extension/table exists is expected from docker init; simple query
    let rows;
    if(bbox){
      const [minLng,minLat,maxLng,maxLat] = bbox;
      const sql = `SELECT pdb_id as id, name, operator, country, source, raw, last_updated, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
                   FROM facilities
                   WHERE geom && ST_MakeEnvelope($1,$2,$3,$4,4326)
                   LIMIT $5 OFFSET $6`;
      const resp = await client.query(sql, [minLng, minLat, maxLng, maxLat, limit, offset]);
      rows = resp.rows;
    }else{
      const sql = `SELECT pdb_id as id, name, operator, country, source, raw, last_updated, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat
                   FROM facilities
                   LIMIT $1 OFFSET $2`;
      const resp = await client.query(sql, [limit, offset]);
      rows = resp.rows;
    }

    const features = rows.map(r => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(r.lon), Number(r.lat)] },
      properties: {
        id: r.id,
        name: r.name,
        operator: r.operator,
        country: r.country,
        source: r.source,
        raw: r.raw,
        last_updated: r.last_updated
      }
    }));

    return res.json({ type: 'FeatureCollection', features });
  }catch(err){
    console.error('DB query error', err.message || err);
    // fallback to static JSON
    if(!facilities) return res.status(500).json({ error: 'no data available' });
    if(!bbox) return res.json(facilities);
    const [minLng,minLat,maxLng,maxLat] = bbox;
    const features = facilities.features.filter(f => {
      const [lng,lat] = f.geometry.coordinates;
      return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
    });
    return res.json({ type: 'FeatureCollection', features });
  }finally{
    try{ await client.end(); }catch(e){}
  }
});

app.get('/api/facility/:id', async (req, res) => {
  const id = req.params.id;
  // try DB first
  const client = makePgClient();
  try{
    await client.connect();
  }catch(e){
    // fallback to static
    const f = facilities && facilities.features.find(ff => String(ff.properties.id) === String(id));
    if(!f) return res.status(404).json({ error: 'not found' });
    return res.json(f);
  }

  try{
    const sql = `SELECT pdb_id as id, name, operator, country, source, raw, last_updated, ST_X(geom::geometry) as lon, ST_Y(geom::geometry) as lat FROM facilities WHERE pdb_id = $1 LIMIT 1`;
    const resp = await client.query(sql, [id]);
    if(!resp.rows.length){
      const f = facilities && facilities.features.find(ff => String(ff.properties.id) === String(id));
      if(!f) return res.status(404).json({ error: 'not found' });
      return res.json(f);
    }
    const r = resp.rows[0];
    const feature = { type: 'Feature', geometry: { type: 'Point', coordinates: [Number(r.lon), Number(r.lat)] }, properties: { id: r.id, name: r.name, operator: r.operator, country: r.country, source: r.source, raw: r.raw, last_updated: r.last_updated } };
    return res.json(feature);
  }catch(err){
    console.error('DB lookup error', err.message || err);
    const f = facilities && facilities.features.find(ff => String(ff.properties.id) === String(id));
    if(!f) return res.status(404).json({ error: 'not found' });
    return res.json(f);
  }finally{
    try{ await client.end(); }catch(e){}
  }
});

// Serve client build if exists
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if(fs.existsSync(clientDist)){
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
