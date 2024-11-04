import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import { useState, useEffect } from 'react';

export default function GoogleMap() {
    //{lat: 45.497766035959231000, lng: -73.575262282038665000}
    const [position, setPosition] = useState(null);
    //why default? 45.5278592 -73.5772672

    //Hec: {lat: 45.5029525, lng: -73.5647119}
    const bornes = [
        {lat: 45.497766035959231000, lng: -73.575262282038665000}, 
        {lat: 45.497370795000144000, lng: -73.575377468633391000},
        {lat: 45.476133819301850000, lng: -73.622012721872295000},
        {lat: 45.477022702578182000, lng: -73.621425182451617000},
        {lat: 45.513282874609885000, lng: -73.557018446590376000}
    ]

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

    function handleMarkerClick(borne, id) {
        console.log("Marker clicked:", borne, "ID:", id);
        // Perform any additional actions here, such as updating state or navigating
    }    

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
                {bornes.map((borne, id) => (
                    <AdvancedMarker key={id} position={borne} onClick={() => handleMarkerClick(borne, id)}>
                        <Pin
                            background={'RoyalBlue'}
                            borderColor={'#000000'}
                            glyphColor={'#ffffff'}
                        />
                    </AdvancedMarker>
                ))}
            </Map>
      </APIProvider>
    );
}