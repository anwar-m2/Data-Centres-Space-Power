const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'facilities.json');
let facilities = null;

function loadData(){
  const raw = fs.readFileSync(dataPath, 'utf8');
  facilities = JSON.parse(raw);
}

loadData();

// Helper: check if point is inside bbox [minLng,minLat,maxLng,maxLat]
function inBbox(coord, bbox){
  const [lng, lat] = coord;
  const [minLng, minLat, maxLng, maxLat] = bbox;
  return lng >= minLng && lng <= maxLng && lat >= minLat && lat <= maxLat;
}

app.get('/api/facilities', (req, res) => {
  // optional bbox query: bbox=minLng,minLat,maxLng,maxLat
  const { bbox } = req.query;
  if(!facilities){
    return res.status(500).json({ error: 'data not loaded' });
  }
  if(!bbox){
    return res.json(facilities);
  }
  const parts = bbox.split(',').map(Number);
  if(parts.length !== 4 || parts.some(isNaN)){
    return res.status(400).json({ error: 'bbox must be minLng,minLat,maxLng,maxLat' });
  }
  const features = facilities.features.filter(f => inBbox(f.geometry.coordinates, parts));
  return res.json({ type: 'FeatureCollection', features });
});

app.get('/api/facility/:id', (req, res) => {
  const id = req.params.id;
  const f = facilities.features.find(ff => String(ff.properties.id) === String(id));
  if(!f) return res.status(404).json({ error: 'not found' });
  res.json(f);
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
