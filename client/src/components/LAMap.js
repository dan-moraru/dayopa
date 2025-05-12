import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';

import markerImage from '../img/marker-icon.png';
import vacantMarker from '../img/emptySpotMarker.png';
import occupiedMarker from '../img/occupiedSpotMarker.png';

import UserLocation from './UserLocation';

const defaultIcon = new L.Icon({
    iconUrl: markerImage,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});

const vacantIcon = new L.Icon({
    iconUrl: vacantMarker,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});

const occupiedIcon = new L.Icon({
    iconUrl: occupiedMarker,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38]
});


const RENDER_RADIUS_METERS = 500;
const API_POLL_INTERVAL_MS = 1000;

export default function LAMap() {
    const initialCenter = [34.0522, -118.2437]; // LA coordinates (initial, will be overridden by user location)
    const [allMarkersData, setAllMarkersData] = useState([]); // Stores all merged data from API + CSV
    const [filteredMarkers, setFilteredMarkers] = useState([]); // Markers to be displayed on map
    const [userPosition, setUserPosition] = useState(null); // User's current lat/lng

    const lastModifiedRef = useRef(null);
    const coordMapRef = useRef({}); // Cache for parsed CSV data

    // Memoized function to fetch API data
    const fetchAPIData = useCallback(async (isInitialFetch = false) => {
        const headers = {
            'X-App-Token': process.env.REACT_APP_LA_TOKEN || process.env.LA_TOKEN
        };
        if (!isInitialFetch && lastModifiedRef.current) {
            headers['If-Modified-Since'] = lastModifiedRef.current;
        }

        try {
            const response = await fetch('/api/data', { headers });

            if (response.status === 304) {
                console.log("API data not modified.");
                return { data: null, lastModified: lastModifiedRef.current };
            }
            if (!response.ok) {
                throw new Error(`API fetch failed with status: ${response.status}`);
            }

            const newLastModified = response.headers.get('Last-Modified');
            const data = await response.json();
            return { data, lastModified: newLastModified };

        } catch (error) {
            console.error('Error fetching API data:', error);
            throw error; // Re-throw to be caught by caller
        }
    }, []);

    // Memoized function to parse CSV data
    const parseParkingSpotsCSV = useCallback(async () => {
        if (Object.keys(coordMapRef.current).length > 0) {
            return coordMapRef.current;
        }
        try {
            const res = await fetch('./LADOT_Metered_Parking_Inventory___Policies_20250508.csv');
            if (!res.ok) {
                throw new Error(`Failed to fetch CSV: ${res.status}`);
            }
            const text = await res.text();
            const csvData = Papa.parse(text, { header: true, skipEmptyLines: true }).data;

            const newCoordMap = {};
            csvData.forEach((row) => {
                if (row && row.LatLng && row.SpaceID) { // Added check for row existence
                    const match = row.LatLng.match(/\(([^,]+),\s*([^)]+)\)/);
                    if (match) {
                        const lat = parseFloat(match[1]);
                        const lng = parseFloat(match[2]);
                        if (!isNaN(lat) && !isNaN(lng)) {
                            newCoordMap[row.SpaceID.trim()] = { lat, lng };
                        }
                    }
                }
            });
            coordMapRef.current = newCoordMap;
            return newCoordMap;
        } catch (error) {
            console.error('Error parsing CSV:', error);
            return {}; // Return empty object on error
        }
    }, []);

    // Effect for initial data load (API and CSV)
    useEffect(() => {
        const loadInitialData = async () => {
            try {
                // Fetch CSV and API data in parallel
                const [coordMapResult, apiResult] = await Promise.all([
                    parseParkingSpotsCSV(),
                    fetchAPIData(true) // true for initial fetch
                ]);

                if (apiResult.data && Object.keys(coordMapResult).length > 0) {
                    const merged = apiResult.data
                        .map((item) => {
                            const spaceId = item.spaceid ? item.spaceid.trim() : null;
                            const coords = coordMapResult[spaceId];
                            if (coords) {
                                return {
                                    id: spaceId,
                                    status: item.occupancystate,
                                    lat: coords.lat,
                                    lng: coords.lng,
                                };
                            }
                            return null;
                        })
                        .filter(Boolean); // Remove null entries

                    setAllMarkersData(merged);
                    if (apiResult.lastModified) {
                        lastModifiedRef.current = apiResult.lastModified;
                    }
                }
            } catch (error) {
                console.error("Error during initial data load:", error);
            }
        };
        loadInitialData();
    }, [fetchAPIData, parseParkingSpotsCSV]);


    // Effect for polling API data at intervals
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const coordMap = await parseParkingSpotsCSV(); // Ensure coordMap is loaded
                if (Object.keys(coordMap).length === 0) {
                    console.log("Coordinate map not yet available for polling update.");
                    return;
                }

                const { data: newData, lastModified: newLastModified } = await fetchAPIData();

                if (newData) {
                    const merged = newData
                        .map((item) => {
                            const spaceId = item.spaceid ? item.spaceid.trim() : null;
                            const coords = coordMap[spaceId];
                            if (coords) {
                                return {
                                    id: spaceId,
                                    status: item.occupancystate,
                                    lat: coords.lat,
                                    lng: coords.lng,
                                };
                            }
                            return null;
                        })
                        .filter(Boolean);
                    
                    setAllMarkersData(merged); // Update with fresh data
                    if (newLastModified) {
                        lastModifiedRef.current = newLastModified;
                    }
                    console.log("Parking data updated at:", newLastModified || new Date().toISOString());
                }
            } catch (error) {
                console.error("Error during polling API data:", error);
            }
        }, API_POLL_INTERVAL_MS);

        return () => clearInterval(intervalId); // Cleanup interval on unmount
    }, [fetchAPIData, parseParkingSpotsCSV]);


    // Effect to filter markers based on userPosition and allMarkersData changes
    useEffect(() => {
        if (!userPosition || allMarkersData.length === 0) {
            setFilteredMarkers([]); // Clear markers if no user location or no data
            return;
        }

        const userLatLng = L.latLng(userPosition.lat, userPosition.lng);
        const nearbyMarkers = allMarkersData.filter(marker => {
            if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number') {
                return false; // Skip markers with invalid coordinates
            }
            const markerLatLng = L.latLng(marker.lat, marker.lng);
            return userLatLng.distanceTo(markerLatLng) <= RENDER_RADIUS_METERS;
        });

        setFilteredMarkers(nearbyMarkers);
        // console.log(`Displaying ${nearbyMarkers.length} markers within ${RENDER_RADIUS_METERS / 1000}km.`);
    }, [userPosition, allMarkersData]); // RERENDER_RADIUS_METERS is constant, no need to list

    // Callback for UserLocation component to update user's position
    const handleLocationUpdate = useCallback((latLng) => {
        setUserPosition(latLng);
    }, []);

    return (
        <MapContainer center={initialCenter} zoom={13} style={{ height: '100vh', width: '100%' }} whenCreated={mapInstance => {
            // You can store mapInstance if needed, e.g., mapRef.current = mapInstance
        }}>
            <TileLayer
                url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />
            
            {filteredMarkers.map((marker) => {
                let iconToUse;
                if (marker.status === 'OCCUPIED') {
                    iconToUse = occupiedIcon;
                } else if (marker.status === 'VACANT') {
                    iconToUse = vacantIcon;
                } else {
                    iconToUse = defaultIcon;
                }
                return (
                    <Marker 
                        key={marker.id} 
                        position={[marker.lat, marker.lng]} 
                        icon={iconToUse}
                    >
                        <Popup>
                            <b>Space ID:</b> {marker.id}
                            <br />
                            <b>Status:</b> {marker.status}
                        </Popup>
                    </Marker>
                );
            })}

            <UserLocation onLocationUpdate={handleLocationUpdate} />
            
        </MapContainer>
    );
}