const axios = require('axios');
const { Client } = require('pg');

// Simple PeeringDB importer: fetches /api/facility and upserts into PostGIS
// Usage: set PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT as needed, then run:
// NODE_ENV=production node importers/peeringdb.js

const PEERINGDB_URL = 'https://peeringdb.com/api/facility?limit=1000';

async function run(){
  const client = new Client({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'example',
    database: process.env.PGDATABASE || 'dcsp'
  });

  await client.connect();
  console.log('Connected to Postgres');

  try{
    console.log('Fetching PeeringDB facilities...');
    const resp = await axios.get(PEERINGDB_URL, { timeout: 30000 });
    const items = (resp.data && resp.data.data) || [];
    console.log(`Fetched ${items.length} facilities`);

    const q = `INSERT INTO facilities (pdb_id, name, operator, country, geom, source, raw, last_updated)
                VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326), $7, $8, now())
                ON CONFLICT (pdb_id) DO UPDATE SET
                  name = EXCLUDED.name,
                  operator = EXCLUDED.operator,
                  country = EXCLUDED.country,
                  geom = EXCLUDED.geom,
                  source = EXCLUDED.source,
                  raw = EXCLUDED.raw,
                  last_updated = now();`;

    let count = 0;
    for(const it of items){
      const pdb_id = it.id;
      const name = it.name || null;
      const operator = it.org_id || null; // org_id references PeeringDB org; you may want to join later
      const country = it.country || null;
      const lat = it.latitude;
      const lon = it.longitude;
      const source = 'peeringdb';
      const raw = it;

      if(typeof lat !== 'number' || typeof lon !== 'number'){
        // skip entries without coords
        continue;
      }

      await client.query(q, [pdb_id, name, operator, country, lon, lat, source, raw]);
      count++;
    }

    console.log(`Imported/updated ${count} facilities`);
  }catch(err){
    console.error('Importer error', err.message || err);
  }finally{
    await client.end();
    console.log('Done');
  }
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
