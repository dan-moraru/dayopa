import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Papa from 'papaparse';

import markerImage from '../img/marker-icon.png';
import vacantMarker from '../img/emptySpotMarker.png';
import occupiedMarker from '../img/occupiedSpotMarker.png';

import UserLocation from './UserLocation';
import RoutingMachine from './RoutingLeaflet';

const defaultIcon = new L.Icon({
    iconUrl: markerImage,
    iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38]
});
const vacantIcon = new L.Icon({
    iconUrl: vacantMarker,
    iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38]
});
const occupiedIcon = new L.Icon({
    iconUrl: occupiedMarker,
    iconSize: [38, 38], iconAnchor: [19, 38], popupAnchor: [0, -38]
});

const targetVacantIcon = new L.Icon({
    iconUrl: vacantMarker,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
    className: 'blinking-target-icon' 
});

const RENDER_RADIUS_METERS = 2000; // 750
const API_POLL_INTERVAL_MS = 1000;

export default function LAMap() {
    const initialCenter = [34.0522, -118.2437]; // LA coordinates
    const mapRef = useRef(null); // To store the map instance

    const [allMarkersData, setAllMarkersData] = useState([]);
    const [filteredMarkers, setFilteredMarkers] = useState([]);
    const [userPosition, setUserPosition] = useState(null);
    
    const [isRoutingActive, setIsRoutingActive] = useState(false);
    const [routingTarget, setRoutingTarget] = useState(null); // { id, lat, lng, status }
    const [routingMessage, setRoutingMessage] = useState("");

    const lastModifiedRef = useRef(null);
    const coordMapRef = useRef({});
    const autoRouteTimerRef = useRef(null); // To manage the auto-route timeout, might be redundant
    const hasAutoRoutedOnceRef = useRef(false); // Ensure auto-route only triggers once initially, might be redundant

    // memoized data fetching
    const fetchAPIData = useCallback(async (isInitialFetch = false) => {
        const headers = {
            'X-App-Token': process.env.REACT_APP_LA_TOKEN || process.env.LA_TOKEN
        };

        if (!isInitialFetch && lastModifiedRef.current) {
            headers['If-Modified-Since'] = lastModifiedRef.current;
        }

        try {
            const response = await fetch('/api/data', { headers });
            if (response.status === 304) return { data: null, lastModified: lastModifiedRef.current };
            if (!response.ok) throw new Error(`API fetch failed: ${response.status}`);
            const newLastModified = response.headers.get('Last-Modified');
            const data = await response.json();
            return { data, lastModified: newLastModified };
        } catch (error) {
            console.error('Error fetching API data:', error); throw error;
        }
    }, []);

    const parseParkingSpotsCSV = useCallback(async () => {
        if (Object.keys(coordMapRef.current).length > 0) return coordMapRef.current;
        try {
            const res = await fetch('./LADOT_Metered_Parking_Inventory___Policies_20250502.csv'); // pc
            //const res = await fetch('./LADOT_Metered_Parking_Inventory___Policies_20250508.csv'); // laptop
            if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
            const text = await res.text();
            const csvData = Papa.parse(text, { header: true, skipEmptyLines: true }).data;
            const newCoordMap = {};
            csvData.forEach((row) => {
                if (row && row.LatLng && row.SpaceID) {
                    const match = row.LatLng.match(/\(([^,]+),\s*([^)]+)\)/);
                    if (match) {
                        const lat = parseFloat(match[1]);
                        const lng = parseFloat(match[2]);
                        if (!isNaN(lat) && !isNaN(lng)) newCoordMap[row.SpaceID.trim()] = { lat, lng };
                    }
                }
            });
            coordMapRef.current = newCoordMap; return newCoordMap;
        } catch (error) {
            console.error('Error parsing CSV:', error); return {};
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [coordMapResult, apiResult] = await Promise.all([
                    parseParkingSpotsCSV(), fetchAPIData(true)
                ]);
                if (apiResult.data && Object.keys(coordMapResult).length > 0) {
                    const merged = apiResult.data.map(item => {
                        const spaceId = item.spaceid ? item.spaceid.trim() : null;
                        const coords = coordMapResult[spaceId];
                        return coords ? { id: spaceId, status: item.occupancystate, ...coords } : null;
                    }).filter(Boolean);
                    setAllMarkersData(merged);
                    if (apiResult.lastModified) lastModifiedRef.current = apiResult.lastModified;
                }
            } catch (error) { console.error("Error initial data load:", error); }
        };
        loadInitialData();
    }, [fetchAPIData, parseParkingSpotsCSV]);

    // api polling
    useEffect(() => {
        const intervalId = setInterval(async () => {
            try {
                const coordMap = await parseParkingSpotsCSV();
                if (Object.keys(coordMap).length === 0) return;
                const { data: newData, lastModified: newLastModified } = await fetchAPIData();
                if (newData) {
                    const merged = newData.map(item => {
                        const spaceId = item.spaceid ? item.spaceid.trim() : null;
                        const coords = coordMap[spaceId];
                        return coords ? { id: spaceId, status: item.occupancystate, ...coords } : null;
                    }).filter(Boolean);
                    setAllMarkersData(prevData => {
                        // More sophisticated merge if needed, for now, just replace
                        return merged;
                    });
                    if (newLastModified) lastModifiedRef.current = newLastModified;
                    // console.log("Parking data updated via poll");
                }
            } catch (error) { console.error("Error polling API:", error); }
        }, API_POLL_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [fetchAPIData, parseParkingSpotsCSV]);

    // filter markers
    useEffect(() => {
        if (!userPosition || allMarkersData.length === 0) {
            setFilteredMarkers([]); return;
        }
        const userLatLng = L.latLng(userPosition.lat, userPosition.lng);
        const nearbyMarkers = allMarkersData.filter(marker => {
            if (typeof marker.lat !== 'number' || typeof marker.lng !== 'number') return false;
            const markerLatLng = L.latLng(marker.lat, marker.lng);
            return userLatLng.distanceTo(markerLatLng) <= RENDER_RADIUS_METERS;
        });
        setFilteredMarkers(nearbyMarkers);
    }, [userPosition, allMarkersData]);


    // routing
    const findAndInitiateRouting = useCallback((excludeSpotId = null) => {
        if (!userPosition || allMarkersData.length === 0) {
            setRoutingMessage("Waiting for your location or parking data...");
            setIsRoutingActive(false);
            setRoutingTarget(null);
            return false;
        }

        const userLatLng = L.latLng(userPosition.lat, userPosition.lng);
        let closestVacantSpot = null;
        let minDistance = Infinity;

        allMarkersData.forEach(spot => {
            if (spot.status === 'VACANT' && spot.id !== excludeSpotId) {
                if (typeof spot.lat !== 'number' || typeof spot.lng !== 'number') return;
                const spotLatLng = L.latLng(spot.lat, spot.lng);
                const distance = userLatLng.distanceTo(spotLatLng);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestVacantSpot = spot;
                }
            }
        });

        if (closestVacantSpot) {
            setRoutingTarget(closestVacantSpot);
            setIsRoutingActive(true);
            setRoutingMessage(`Routing to spot ${closestVacantSpot.id} (${(minDistance / 1000).toFixed(2)} km away).`);
            if (mapRef.current) { // Ensure map is zoomed/panned appropriately for routing
                mapRef.current.fitBounds(L.latLngBounds(userLatLng, L.latLng(closestVacantSpot.lat, closestVacantSpot.lng)), {padding: [50, 50]});
            }
            return true;
        } else {
            setRoutingMessage(excludeSpotId ? "Previous spot taken. No other vacant spots found nearby." : "No vacant spots found nearby.");
            setIsRoutingActive(false);
            setRoutingTarget(null);
            return false;
        }
    }, [userPosition, allMarkersData]);

    // re-routing
    useEffect(() => {
        if (isRoutingActive && routingTarget && allMarkersData.length > 0) {
            const currentTargetInAllData = allMarkersData.find(spot => spot.id === routingTarget.id);
            
            if (!currentTargetInAllData || currentTargetInAllData.status !== 'VACANT') {
                setRoutingMessage(`Spot ${routingTarget.id} is no longer vacant. Finding new route...`);
                // Target spot became occupied or disappeared, find a new one, excluding the current one
                findAndInitiateRouting(routingTarget.id); 
            } else if (currentTargetInAllData && currentTargetInAllData.status === 'VACANT' && routingTarget.status !== 'VACANT') {
                // This case is unlikely if routingTarget is set correctly, but as a safeguard:
                // Update routingTarget's status if it was somehow stale
                setRoutingTarget(currentTargetInAllData);
            }
        }
    }, [isRoutingActive, routingTarget, allMarkersData, findAndInitiateRouting]);

    // --- Event Handlers ---
    const handleLocationUpdate = useCallback((latLng) => {
        setUserPosition(latLng);
    }, []);

    const handleManualRouteButtonClick = () => {
        setRoutingMessage("Searching for nearest vacant spot...");
        hasAutoRoutedOnceRef.current = true; // User took action, prevent auto-route if it hasn't fired
        if (autoRouteTimerRef.current) clearTimeout(autoRouteTimerRef.current);
        findAndInitiateRouting();
    };
    
    const handleStopRoutingButtonClick = () => {
        setIsRoutingActive(false);
        setRoutingTarget(null);
        setRoutingMessage("Routing stopped.");
    };

    const handleRouteFound = (route) => {
        // console.log("Route details:", route.summary);
        setRoutingMessage(`Route found to ${routingTarget?.id}. Distance: ${(route.summary.totalDistance / 1000).toFixed(2)} km, Time: ${Math.round(route.summary.totalTime / 60)} min.`);
    };

    const handleRoutingError = (error) => {
        setRoutingMessage(`Routing error. Could not calculate route to ${routingTarget?.id}.`);
        // Potentially try to find a new spot or alert user
        // For now, just stop routing to this target
        setIsRoutingActive(false); 
        // Consider finding next best spot after a delay or user action
    };

    return (
        <div style={{ position: 'relative', height: '100vh', width: '100%' }}>
            <MapContainer 
                center={initialCenter} 
                zoom={13} 
                style={{ height: '100%', width: '100%' }}
                whenCreated={(mapInstance) => { mapRef.current = mapInstance; }}
            >
                <TileLayer
                    url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                    attribution='&copy; <a href="[https://www.openstreetmap.org/copyright](https://www.openstreetmap.org/copyright)">OpenStreetMap</a> contributors'
                />
                
                {filteredMarkers.map((marker) => {
                    let iconToUse;
                    // If this marker is the current routing target, use the special target icon
                    if (isRoutingActive && routingTarget && marker.id === routingTarget.id) {
                        iconToUse = targetVacantIcon;
                    } else if (marker.status === 'OCCUPIED') {
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
                            zIndexOffset={isRoutingActive && routingTarget && marker.id === routingTarget.id ? 1000 : 0} // Bring target marker to front
                        >
                            <Popup>
                                <b>Space ID:</b> {marker.id} <br />
                                <b>Status:</b> {marker.status} <br />
                                {marker.status === 'VACANT' && !isRoutingActive && (
                                    <button onClick={() => {
                                        setRoutingTarget(marker);
                                        setIsRoutingActive(true);
                                        setRoutingMessage(`Routing to spot ${marker.id}.`);
                                        if (mapRef.current && userPosition) {
                                            mapRef.current.fitBounds(L.latLngBounds(L.latLng(userPosition.lat, userPosition.lng), L.latLng(marker.lat, marker.lng)), {padding: [50, 50]});
                                        }
                                    }}>Route to this spot</button>
                                )}
                            </Popup>
                        </Marker>
                    );
                })}

                <UserLocation onLocationUpdate={handleLocationUpdate} />

                {isRoutingActive && userPosition && routingTarget && (
                    <RoutingMachine
                        userPosition={userPosition}
                        targetPosition={routingTarget} // Pass lat/lng of the target
                        onRouteFound={handleRouteFound}
                        onRoutingError={handleRoutingError}
                    />
                )}
            </MapContainer>

            <div style={{
                position: 'absolute',
                bottom: '0px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 500, // Ensure it's above the map
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '10px 15px',
                borderTopLeftRadius: '50px',
                borderTopRightRadius: '50px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                maxWidth: '100%',
                maxHeight: '15%',
                height: '100vh',
                width: '100vh',
                textAlign: 'center'
            }}>
            </div>

            {/* UI for Routing Control and Messages */}
            <div style={{
                position: 'absolute',
                bottom: '60px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 1000, // Ensure it's above the map
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '10px 15px',
                borderRadius: '8px',
                boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '10px',
                maxWidth: '90%',
                textAlign: 'center'
            }}>
                {!isRoutingActive ? (
                    <button 
                        onClick={handleManualRouteButtonClick} 
                        style={{padding: '10px 15px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px'}}
                    >
                        GO!
                    </button>
                ) : (
                    <button 
                        onClick={handleStopRoutingButtonClick}
                        style={{padding: '10px 15px', fontSize: '16px', cursor: 'pointer', backgroundColor: '#f44336', color: 'white', border: 'none', borderRadius: '5px'}}
                    >
                        Stop
                    </button>
                )}
                {routingMessage && <p style={{margin: 0, fontSize: '14px', color: '#333'}}>{routingMessage}</p>}
            </div>
        </div>
    );
}