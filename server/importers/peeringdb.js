const axios = require('axios');
const { Client } = require('pg');

// PeeringDB importer with pagination, retries, basic deduplication by proximity, and confidence scoring
// Usage: set PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT as needed, then run:
// NODE_ENV=production node importers/peeringdb.js

const PEERINGDB_BASE = 'https://peeringdb.com/api/facility';
const PAGE_LIMIT = 1000;
const MAX_RETRIES = 3;

function makePgClient(){
  return new Client({
    host: process.env.PGHOST || 'localhost',
    port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'example',
    database: process.env.PGDATABASE || 'dcsp'
  });
}

async function fetchPage(limit, offset){
  const url = `${PEERINGDB_BASE}?limit=${limit}&offset=${offset}`;
  for(let attempt=1; attempt<=MAX_RETRIES; attempt++){
    try{
      const resp = await axios.get(url, { timeout: 30000 });
      return resp.data && resp.data.data ? resp.data.data : [];
    }catch(err){
      console.warn(`Fetch attempt ${attempt} failed: ${err.message || err}`);
      if(attempt === MAX_RETRIES) throw err;
      await new Promise(r => setTimeout(r, 1000 * attempt));
    }
  }
}

async function ensureColumns(client){
  // add confidence numeric column if missing
  await client.query(`ALTER TABLE facilities ADD COLUMN IF NOT EXISTS confidence numeric;`);
}

async function upsertFacility(client, it){
  const pdb_id = it.id;
  const name = it.name || null;
  const operator = it.org_id || null;
  const country = it.country || null;
  const lat = it.latitude;
  const lon = it.longitude;
  const source = 'peeringdb';
  const raw = it;

  if(typeof lat !== 'number' || typeof lon !== 'number'){
    // skip entries without coords
    return { skipped: true, reason: 'no-coords' };
  }

  // simple confidence heuristic
  const confidence = (name && lat && lon) ? 0.9 : 0.5;

  // dedupe: look for existing facility within 200 meters
  const dupRes = await client.query(`SELECT id, pdb_id FROM facilities WHERE ST_DWithin(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, 200) LIMIT 1`, [lon, lat]);
  if(dupRes.rows.length){
    const existing = dupRes.rows[0];
    // update existing record with any missing fields and bump confidence
    await client.query(`UPDATE facilities SET pdb_id = COALESCE(pdb_id, $1), name = COALESCE(name, $2), operator = COALESCE(operator, $3), country = COALESCE(country, $4), source = COALESCE(source, $5), raw = COALESCE(raw, $6), confidence = GREATEST(COALESCE(confidence,0), $7), last_updated = now(), geom = COALESCE(geom, ST_SetSRID(ST_MakePoint($8,$9),4326)) WHERE id = $10`, [pdb_id, name, operator, country, source, raw, confidence, lon, lat, existing.id]);
    return { skipped: false, upserted: true, existingId: existing.id };
  }

  const q = `INSERT INTO facilities (pdb_id, name, operator, country, geom, source, raw, confidence, last_updated)
              VALUES ($1,$2,$3,$4, ST_SetSRID(ST_MakePoint($5,$6),4326), $7, $8, $9, now())
              ON CONFLICT (pdb_id) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, facilities.name),
                operator = COALESCE(EXCLUDED.operator, facilities.operator),
                country = COALESCE(EXCLUDED.country, facilities.country),
                geom = COALESCE(EXCLUDED.geom, facilities.geom),
                source = COALESCE(EXCLUDED.source, facilities.source),
                raw = COALESCE(EXCLUDED.raw, facilities.raw),
                confidence = GREATEST(COALESCE(EXCLUDED.confidence,0), COALESCE(facilities.confidence,0)),
                last_updated = now();`;

  await client.query(q, [pdb_id, name, operator, country, lon, lat, source, raw, confidence]);
  return { skipped: false, upserted: true };
}

async function run(){
  const client = makePgClient();
  await client.connect();
  console.log('Connected to Postgres');

  try{
    await ensureColumns(client);

    let offset = 0;
    let totalImported = 0;
    while(true){
      console.log(`Fetching offset ${offset} limit ${PAGE_LIMIT}`);
      const items = await fetchPage(PAGE_LIMIT, offset);
      if(!items || !items.length) break;
      for(const it of items){
        try{
          const r = await upsertFacility(client, it);
          if(r.upserted) totalImported++;
        }catch(e){
          console.warn('Failed to upsert item', e.message || e);
        }
      }
      offset += PAGE_LIMIT;
    }

    console.log(`Imported/updated ${totalImported} facilities`);
  }catch(err){
    console.error('Importer error', err.message || err);
  }finally{
    await client.end();
    console.log('Done');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
