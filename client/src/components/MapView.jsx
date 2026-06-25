import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet.markercluster'

const markerIcon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconSize: [25,41],
  iconAnchor: [12,41],
  popupAnchor: [1,-34]
})

export default function MapView(){
  const mapRef = useRef(null)
  const markersRef = useRef(null)

  useEffect(()=>{
    mapRef.current = L.map('map').setView([20,0], 2)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current)

    markersRef.current = L.markerClusterGroup()
    mapRef.current.addLayer(markersRef.current)

    let currentFetch = 0

    async function loadVisible(){
      const bounds = mapRef.current.getBounds()
      const southWest = bounds.getSouthWest()
      const northEast = bounds.getNorthEast()
      const bbox = [southWest.lng, southWest.lat, northEast.lng, northEast.lat].join(',')
      const limit = 2000
      const fetchId = ++currentFetch
      try{
        const resp = await fetch(`/api/facilities?bbox=${bbox}&limit=${limit}`)
        const data = await resp.json()
        if(fetchId !== currentFetch) return // stale
        markersRef.current.clearLayers()
        if(!data || !data.features) return
        data.features.forEach(f => {
          const [lng,lat] = f.geometry.coordinates
          const m = L.marker([lat,lng], { icon: markerIcon })
          const props = f.properties || {}
          const popup = `<strong>${props.name}</strong><br/>${props.operator || ''}<br/>${props.country || ''}<br/><small>source: ${props.source}</small>`
          m.bindPopup(popup)
          markersRef.current.addLayer(m)
        })
      }catch(err){
        console.error('failed to load facilities', err)
      }
    }

    mapRef.current.on('moveend', () => {
      loadVisible()
    })

    // initial load
    loadVisible()

    return ()=>{
      mapRef.current.remove()
    }
  }, [])

  return (
    <div id="map"></div>
  )
}
