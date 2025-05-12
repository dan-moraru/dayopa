import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine/dist/leaflet-routing-machine.css';
import 'leaflet-routing-machine'; // Imports the plugin

// Helper to create a custom icon for waypoints (optional, but nice for UX)
const createWaypointIcon = (color) => {
    return L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });
};

export default function RoutingLeaflet({ userPosition, targetPosition, onRouteFound, onRoutingError }) {
    const map = useMap();
    const routingControlRef = useRef(null);

    useEffect(() => {
        // Clean up previous route if it exists
        if (routingControlRef.current) {
            console.log("RoutingMachine: Removing previous route control.");
            map.removeControl(routingControlRef.current);
            routingControlRef.current = null;
        }

        if (!userPosition || !targetPosition || !map) {
            console.log("RoutingMachine: Missing userPosition, targetPosition, or map. Skipping route creation.");
            return; 
        }

        console.log("RoutingMachine: Attempting to create route.");
        console.log("RoutingMachine: User Position:", userPosition);
        console.log("RoutingMachine: Target Position:", targetPosition);

        // Ensure targetPosition has lat and lng
        if (typeof targetPosition.lat !== 'number' || typeof targetPosition.lng !== 'number') {
            console.error("RoutingMachine: Invalid targetPosition coordinates.", targetPosition);
            if (onRoutingError) {
                onRoutingError(new Error("Invalid target coordinates provided."));
            }
            return;
        }

        // Create waypoints: user's location and target parking spot
        const waypoints = [
            L.latLng(userPosition.lat, userPosition.lng),
            L.latLng(targetPosition.lat, targetPosition.lng)
        ];
        console.log("RoutingMachine: Waypoints created:", waypoints);

        // Create the routing control
        const instance = L.Routing.control({
            waypoints: waypoints,
            routeWhileDragging: true, 
            show: true, 
            addWaypoints: false, 
            draggableWaypoints: false, 
            fitSelectedRoutes: true, 
            lineOptions: {
                styles: [{ color: '#2563EB', opacity: 0.8, weight: 6 }] 
            },
            createMarker: function(i, waypoint, n) {
                let markerIcon;
                if (i === 0) {
                    return null; 
                } else if (i === n - 1) {
                    markerIcon = createWaypointIcon('green'); 
                }
                if (markerIcon) {
                    return L.marker(waypoint.latLng, {
                        icon: markerIcon,
                        draggable: false, 
                    });
                }
                return null;
            },
            // If you have issues with the default OSRM server, you might need to configure your own:
            // router: new L.Routing.OSRMv1({
            //     serviceUrl: 'http://router.project-osrm.org/route/v1' // Default, or your own instance
            // })
        })
        .on('routesfound', function(e) {
            console.log('RoutingMachine: Event routesfound:', e); 
            if (onRouteFound) {
                const routes = e.routes;
                console.log('RoutingMachine: Actual routes array:', routes); 
                if (routes && routes.length > 0) {
                    console.log('RoutingMachine: First route summary:', routes[0].summary);
                    console.log('RoutingMachine: First route coordinates count:', routes[0].coordinates?.length); 
                } else {
                    console.warn('RoutingMachine: Routesfound event fired, but no routes in array.');
                }
                onRouteFound(routes[0]); // Pass the first route, or undefined if empty
            }
        })
        .on('routingerror', function(e) {
            console.error("RoutingMachine: Event routingerror:", e);
            if (onRoutingError) {
                onRoutingError(e.error || new Error("Unknown routing error"));
            }
        })
        .addTo(map);
        
        console.log("RoutingMachine: Routing control added to map.");
        routingControlRef.current = instance;

        // Cleanup function
        return () => {
            if (routingControlRef.current) {
                console.log("RoutingMachine: Cleaning up route control.");
                map.removeControl(routingControlRef.current);
                routingControlRef.current = null;
            }
        };
    }, [map, userPosition, targetPosition, onRouteFound, onRoutingError]); 

    return null; 
}