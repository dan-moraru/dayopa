import { Icon  } from 'leaflet';
import { 
  MapContainer, 
  TileLayer, 
  Marker,
  Popup
} from 'react-leaflet';

import 'leaflet/dist/leaflet.css';
import './Map.css';
import markerImage from '../img/marker-icon.png';

const customIcon = new Icon({
  iconUrl: markerImage,
  iconSize: [38, 38],
  iconAnchor: [22, 30]
});

// const limeOptions = { color: 'lime' };

// See https://www.youtube.com/watch?v=jD6813wGdBA if you want to customize the map

export default function MontrealMap() {
  // lat, long
  const points =  [ 
    [45.497766035959231000, -73.575262282038665000],
  ];
  const attribution = 
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  const tileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  
  // TODO this is a demo of react-leaflet. You will have to split the JSX below into
  // a couple of different components. Feel free to modify the CSS.
  return (
    <div className="ui-container">
      {/* See leaflet-container CSS class */}
      <MapContainer
        center={[45.5, -73.6]}
        zoom={12}
        zoomControl={true}
        updateWhenZooming={false}
        updateWhenIdle={true}
        preferCanvas={true}
        minZoom={5}
        maxZoom={16}
      >
        <TileLayer
          attribution={attribution}
          url={tileUrl}
        />    
        <Marker position={points[0]} icon={customIcon} >
          <Popup><p>C365,Sainte-Catherine</p></Popup>
        </Marker>
      </MapContainer>
      <div className="ui-controls">
        <p>controls</p>
      </div>
    </div>
  );
}