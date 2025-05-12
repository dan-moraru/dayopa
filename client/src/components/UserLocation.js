import React, { useEffect, useState } from 'react';
import { useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import userIconImage from '../img/UserLocation.png';

const userIcon = new L.Icon({
  iconUrl: userIconImage,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38]
});

export default function UserLocation({ onLocationUpdate }) {
  const [position, setPosition] = useState(null);
  const map = useMap();

  useEffect(() => {
    const onLocationFound = (e) => {
      setPosition(e.latlng);
      
      // Center the map on the user's location and set a reasonable zoom level for navigation
      // Only setView if the map instance is available and not already centered recently
      map.setView(e.latlng, Math.max(map.getZoom(), 15)); 

      if (onLocationUpdate) {
        onLocationUpdate(e.latlng); // Pass LatLng object directly
      }

      // Optional: Add or update an accuracy circle
      // Could be managed with a ref to remove the old one before adding a new one
      // L.circle(e.latlng, { radius: e.accuracy, color: '#136AEC', fillColor: '#136AEC', fillOpacity: 0.15 }).addTo(map);
    };

    // Handler for location errors
    const onLocationError = (e) => {
      console.error("UserLocation Error: ", e.message);
      // Potentially alert the user that location could not be determined
      // alert("Could not determine your location: " + e.message);
    };

    // Start watching user's location
    // `setView: true` will pan the map to the new location on the first find.
    // `maxZoom` ensures that when `setView` is true, it doesn't zoom in too far.
    // `watch: true` continuously updates the location.
    map.locate({ setView: true, maxZoom: 16, watch: true, enableHighAccuracy: true });

    // Register event listeners
    map.on('locationfound', onLocationFound);
    map.on('locationerror', onLocationError);

    // Cleanup function when the component unmounts
    return () => {
      map.stopLocate(); // Stop watching location
      map.off('locationfound', onLocationFound); // Remove event listener
      map.off('locationerror', onLocationError); // Remove event listener
    };
  }, [map, onLocationUpdate]); // Dependencies for the effect

  // Render the marker for the user's location
  return position ? (
    <Marker position={position} icon={userIcon}>
      <Popup>You are here.</Popup>
    </Marker>
  ) : null; // Don't render anything if position is not yet available
}