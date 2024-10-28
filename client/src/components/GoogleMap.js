import { APIProvider, Map, AdvancedMarker } from '@vis.gl/react-google-maps';
import { useState, useEffect } from 'react';

export default function GoogleMap() {
    //{lat: 45.497766035959231000, lng: -73.575262282038665000}
    const [position, setPosition] = useState(null);
    //why default? 45.5278592 -73.5772672
    //Hec: {lat: 45.5029525, lng: -73.5647119}

    useEffect(() => {
        let watchId;
        if (navigator.geolocation) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;
                    setPosition({ lat: latitude, lng: longitude });
                    console.log("Current Position:", latitude, longitude);
                },
                (error) => {
                    if (error.code === 1) {
                        alert("Error: Access is denied!");
                    } else if (error.code !== 2) {
                        alert("Error!");
                    }
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            alert("Sorry, your browser does not support geolocation!");
        }

        // Cleanup function to remove the watch when the component unmounts
        return () => {
            if (watchId) navigator.geolocation.clearWatch(watchId);
        };
    }, []);

    return (
        <APIProvider apiKey={process.env.REACT_APP_GOOGLE_MAP_KEY}>
            <Map
                style={{width: '100vw', height: '100vh'}}
                defaultCenter={position}
                defaultZoom={12}
                gestureHandling={'greedy'}
                disableDefaultUI={true}
                mapId={process.env.REACT_APP_GOOGLE_MAP_ID}
            >
                {position && <AdvancedMarker position={position} />}
            </Map>
      </APIProvider>
    );
}