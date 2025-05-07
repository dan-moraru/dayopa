import React, { useEffect, useState } from 'react';
import { useMap, Marker, Popup } from 'react-leaflet';
import { Icon  } from 'leaflet';
import L from 'leaflet'; // Needed for L.circle
import userIconImage from '../img/UserLocation.png';

const userIcon = new Icon({
  iconUrl: userIconImage,
  iconSize: [38, 38],
  iconAnchor: [22, 30],
});

export default function UserLocation() {
  const [position, setPosition] = useState(null);
  const [bbox, setBbox] = useState([]);
  const map = useMap();

  useEffect(() => {
    map.locate({ setView: true, maxZoom: 16 });

    function onLocationFound(e) {
      setPosition(e.latlng);
      setBbox(e.bounds.toBBoxString().split(","));

      // Optional: draw accuracy circle
      const radius = e.accuracy;
      const circle = L.circle(e.latlng, { radius });
      circle.addTo(map);
    }

    map.on('locationfound', onLocationFound);

    return () => {
      map.off('locationfound', onLocationFound);
    };
  }, [map]);

  return position ? (
    <Marker position={position} icon={userIcon}>
      <Popup>
        You are here. <br />
        <b>SW lng:</b> {bbox[0]} <br />
        <b>SW lat:</b> {bbox[1]} <br />
        <b>NE lng:</b> {bbox[2]} <br />
        <b>NE lat:</b> {bbox[3]}
      </Popup>
    </Marker>
  ) : null;
}