// === MapboxLandmarkPicker.jsx ===

// Import Mapbox CSS for proper styling
import "mapbox-gl/dist/mapbox-gl.css";

import { useRef, useEffect, useState } from "react";
import mapboxgl from "mapbox-gl";
import "./MapboxLandmarkPicker.css";

// Set your Mapbox public access token below:
mapboxgl.accessToken = "pk.eyJ1IjoibWFya2xhbWJlcnQ3NSIsImEiOiJjbWRzcTlobXAwdHdpMnNxM3JvcmF2eWI5In0.3ekI0aU9MJYpj_KI6CoQOQ";

function MapboxLandmarkPicker({ onSelect, onClose }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const userMarkerRef = useRef(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    // Default center (fallback if GPS fails)
    const defaultCenter = [-116.1939, 43.5844];

    // Initialize the map (center will be updated if geolocation works)
    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/satellite-v9",
      center: defaultCenter,
      zoom: 15,
    });

    // Try to center map and place user marker at current location
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current.setCenter([longitude, latitude]);
        mapRef.current.setZoom(17);
        // Place a marker at the user's location
        const userMarker = new mapboxgl.Marker({ color: '#007cbf' })
          .setLngLat([longitude, latitude])
          .addTo(mapRef.current);
        userMarkerRef.current = userMarker;
      },
      (err) => {
        console.warn("Geolocation failed:", err);
      },
      { enableHighAccuracy: true }
    );

    // Listen for clicks to select landmark coords
    mapRef.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      setSelectedCoords({ lat, lon: lng });
    });

    return () => {
      // Clean up map and marker
      if (mapRef.current) mapRef.current.remove();
      if (userMarkerRef.current) userMarkerRef.current.remove();
    };
  }, []);

  // Draw or update marker for selected landmark
  useEffect(() => {
    if (!mapRef.current || !selectedCoords) return;
    new mapboxgl.Marker({ color: '#e74c3c' })
      .setLngLat([selectedCoords.lon, selectedCoords.lat])
      .addTo(mapRef.current);
  }, [selectedCoords]);

  return (
    <div className="mapbox-modal-overlay">
      <div className="mapbox-modal">
        <div ref={mapContainer} className="mapbox-map" />
        <div className="mapbox-controls">
          <button onClick={onClose}>Cancel</button>
          <button
            onClick={() => selectedCoords && onSelect(selectedCoords)}
            disabled={!selectedCoords}
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}

export default MapboxLandmarkPicker;
