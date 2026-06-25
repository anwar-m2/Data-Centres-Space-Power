-- Initialize PostGIS and facilities table

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS facilities (
  id serial PRIMARY KEY,
  pdb_id integer UNIQUE,
  name text,
  operator text,
  country text,
  geom geometry(POINT,4326),
  source text,
  raw jsonb,
  last_updated timestamptz
);

CREATE INDEX IF NOT EXISTS idx_facilities_geom ON facilities USING GIST(geom);
