import React from 'react'
import MapView from './components/MapView'

export default function App(){
  return (
    <div style={{height: '100vh', position: 'relative'}}>
      <div className="controls">
        <h3>Data Centres (MVP)</h3>
        <p>Sample data. Use the map to pan/zoom.</p>
      </div>
      <MapView />
    </div>
  )
}
