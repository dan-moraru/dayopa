import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Icon  } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';

import markerImage from '../img/marker-icon.png';
import vacantMarker from '../img/emptySpotMarker.png';
import occupiedMarker from '../img/occupiedSpotMarker.png';

import UserLocation from './UserLocation';
//import RoutingLeaflet from './RoutingLeaflet';

const defaultIcon = new Icon({
    iconUrl: markerImage,
    iconSize: [38, 38],
    iconAnchor: [22, 30]
});

const vacantIcon = new Icon({
    iconUrl: vacantMarker,
    iconSize: [38, 38],
    iconAnchor: [22, 30]
});

const occupiedIcon = new Icon({
    iconUrl: occupiedMarker,
    iconSize: [38, 38],
    iconAnchor: [22, 30]
});

export default function LAMap() {
    const center = [34.0522, -118.2437]; // LA coordinates
    const [markers, setMarkers] = useState([]);
    const lastModifiedRef = useRef(null); // Holds the last modified timestamp across re-renders
    const coordMapRef = useRef({}); // Store parsed CSV once to avoid reloading it every time

    async function fetchAPI() {
        const response = await fetch('/api/data');
        if (!response.ok) throw new Error('API fetch failed');
        return response.json();
    }

    async function parseCSV() {
        if (Object.keys(coordMapRef.current).length > 0) return coordMapRef.current;

        //const res = await fetch('./LADOT_Metered_Parking_Inventory___Policies_20250502.csv'); // desktop
        const res = await fetch('./LADOT_Metered_Parking_Inventory___Policies_20250508.csv'); // laptop
        const text = await res.text();
        const csvData = Papa.parse(text, { header: true }).data;

        const coordMap = {};
        csvData.forEach((row) => {
            if (!row.LatLng || !row.SpaceID) return;
            const match = row.LatLng.match(/\(([^,]+),\s*([^)]+)\)/);
            if (match) {
                const lat = parseFloat(match[1]);
                const lng = parseFloat(match[2]);
                coordMap[row.SpaceID] = { lat, lng };
            }
        });

        coordMapRef.current = coordMap;
        return coordMap;
    }

    async function loadAndMergeData(apiData, coordMap) {
        const merged = apiData
            .map((item) => {
                const coords = coordMap[item.spaceid];
                if (coords) {
                    return {
                        id: item.spaceid,
                        status: item.occupancystate,
                        ...coords,
                    };
                }
                return null;
            })
            .filter(Boolean);

        setMarkers(merged);
    }

    useEffect(() => {
        let coordMapCache = null;
    
        (async () => {
            const [apiData, coordMap] = await Promise.all([fetchAPI(), parseCSV()]);
            coordMapCache = coordMap;
            await loadAndMergeData(apiData, coordMap);
        })();
    
        const interval = setInterval(async () => {
            const headers = {};
            if (lastModifiedRef.current) {
                headers['If-Modified-Since'] = lastModifiedRef.current;
            }
    
            const response = await fetch('/api/data', { headers });
            if (response.status === 304) {
                console.log("No update: data unchanged.");
                return;
            }
    
            const newLastModified = response.headers.get('Last-Modified');
            const newData = await response.json();
            lastModifiedRef.current = newLastModified;
    
            await loadAndMergeData(newData, coordMapCache); // Use the cache
            console.log("Updated at:", newLastModified);
        }, 1000);
    
        return () => clearInterval(interval);
    }, []);

    return (
        <MapContainer center={center} zoom={13} style={{ height: '100vh', width: '100%' }}>
            <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; OpenStreetMap contributors'
            />
            {markers.map((marker) => {
                let icon;
                if (marker.status === 'OCCUPIED') {
                    icon = occupiedIcon;
                } else if (marker.status === 'VACANT') {
                    icon = vacantIcon;
                } else {
                    icon = defaultIcon; // For "UNKNOWN" status or any other
                }
                return (
                    <Marker key={marker.id} position={[marker.lat, marker.lng]} icon={icon}>
                        <Popup>
                            ID: {marker.id}
                            <br />
                            Status: {marker.status}
                        </Popup>
                    </Marker>
                );
            })}
            <UserLocation />
        </MapContainer>
    );
}

// <RoutingLeaflet
//      origin={{ lat: 34.0522, lng: -118.2437 }}
//      destination={{ lat: 34.0622, lng: -118.2537 }}
// />
