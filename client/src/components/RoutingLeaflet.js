import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-routing-machine';

export default function RoutingLeaflet({ origin, destination }) {
    const map = useMap();

    useEffect(() => {
        if (!origin || !destination) return;

        const routingControl = L.Routing.control({
            waypoints: [L.latLng(origin.lat, origin.lng), L.latLng(destination.lat, destination.lng)],
            lineOptions: {
                styles: [{ color: 'blue', weight: 4 }],
            },
            show: false,
            addWaypoints: false,
            routeWhileDragging: false,
            draggableWaypoints: false,
        }).addTo(map);

        return () => map.removeControl(routingControl); // cleanup on unmount
    }, [origin, destination, map]);

    return null;
}