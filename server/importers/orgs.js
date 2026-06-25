const axios = require('axios');
const { Client } = require('pg');

// PeeringDB organizations importer with pagination and retries
// Usage: set PGHOST, PGUSER, PGPASSWORD, PGDATABASE, PGPORT as needed, then run:
// node importers/orgs.js

const PEERINGDB_BASE = 'https://peeringdb.com/api/org';
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

async function upsertOrg(client, it){
  const org_id = it.id;
  const name = it.name || null;
  const aka = it.aka ? JSON.stringify(it.aka) : null;
  const website = it.website || null;
  const raw = it;

  const q = `INSERT INTO organizations (org_id, name, aka, website, raw, last_updated)
              VALUES ($1,$2,$3,$4,$5,now())
              ON CONFLICT (org_id) DO UPDATE SET
                name = COALESCE(EXCLUDED.name, organizations.name),
                aka = COALESCE(EXCLUDED.aka, organizations.aka),
                website = COALESCE(EXCLUDED.website, organizations.website),
                raw = COALESCE(EXCLUDED.raw, organizations.raw),
                last_updated = now();`;

  await client.query(q, [org_id, name, aka ? JSON.parse(aka) : null, website, raw]);
}

async function run(){
  const client = makePgClient();
  await client.connect();
  console.log('Connected to Postgres');

  try{
    let offset = 0;
    let totalImported = 0;
    while(true){
      console.log(`Fetching orgs offset ${offset} limit ${PAGE_LIMIT}`);
      const items = await fetchPage(PAGE_LIMIT, offset);
      if(!items || !items.length) break;
      for(const it of items){
        try{
          await upsertOrg(client, it);
          totalImported++;
        }catch(e){
          console.warn('Failed to upsert org', e.message || e);
        }
      }
      offset += PAGE_LIMIT;
    }

    console.log(`Imported/updated ${totalImported} organizations`);
  }catch(err){
    console.error('Orgs importer error', err.message || err);
  }finally{
    await client.end();
    console.log('Done');
  }
}

run().catch(e => { console.error(e); process.exit(1); });
