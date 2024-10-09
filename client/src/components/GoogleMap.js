import {APIProvider, Map, Marker} from '@vis.gl/react-google-maps';

export default function GoogleMap() {
    const position = {lat: 45.497766035959231000, lng: -73.575262282038665000};

    return (
        <APIProvider apiKey={process.env.REACT_APP_GOOGLE_MAP_KEY}>
            <Map
                style={{width: '100vw', height: '100vh'}}
                defaultCenter={{lat: 45.5, lng: -73.6}}
                defaultZoom={12}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
            />
            <Marker position={position} />
      </APIProvider>
    );
}