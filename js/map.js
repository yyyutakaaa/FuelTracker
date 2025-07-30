// FuelTracker - Map Service

export class MapService {
    constructor() {
        this.map = null;
        this.routeLayer = null;
        this.markersLayer = null;
    }
    
    initMap() {
        // Initialize map centered on Belgium
        this.map = L.map('map', {
            center: [50.8503, 4.3517], // Brussels coordinates
            zoom: 8,
            zoomControl: true,
            attributionControl: true
        });
        
        // Add tile layer with better styling
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(this.map);
        
        // Create layer groups
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.markersLayer = L.layerGroup().addTo(this.map);
        
        // Add scale control
        L.control.scale({
            imperial: false,
            position: 'bottomright'
        }).addTo(this.map);
        
        // Fix map size after initialization
        setTimeout(() => {
            this.map.invalidateSize();
        }, 100);
    }
    
    drawRoute(geometry, startCoords, endCoords, startName, endName) {
        // Clear previous route and markers
        this.routeLayer.clearLayers();
        this.markersLayer.clearLayers();
        
        // Create custom icons
        const startIcon = L.divIcon({
            html: '<i class="fas fa-map-marker-alt text-green-500 text-3xl"></i>',
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40],
            className: 'custom-div-icon'
        });
        
        const endIcon = L.divIcon({
            html: '<i class="fas fa-map-marker-alt text-red-500 text-3xl"></i>',
            iconSize: [30, 40],
            iconAnchor: [15, 40],
            popupAnchor: [0, -40],
            className: 'custom-div-icon'
        });
        
        // Add markers
        const startMarker = L.marker([startCoords.lat, startCoords.lon], { icon: startIcon })
            .bindPopup(`<strong>Vertrek:</strong><br>${startName}`)
            .addTo(this.markersLayer);
        
        const endMarker = L.marker([endCoords.lat, endCoords.lon], { icon: endIcon })
            .bindPopup(`<strong>Bestemming:</strong><br>${endName}`)
            .addTo(this.markersLayer);
        
        // Draw route line
        if (geometry && geometry.coordinates) {
            const latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            
            const routeLine = L.polyline(latlngs, {
                color: '#3b82f6',
                weight: 5,
                opacity: 0.8,
                smoothFactor: 1
            }).addTo(this.routeLayer);
            
            // Add animated dashed line overlay
            const dashedLine = L.polyline(latlngs, {
                color: '#60a5fa',
                weight: 5,
                opacity: 0.4,
                dashArray: '10, 20',
                className: 'animated-route'
            }).addTo(this.routeLayer);
            
            // Fit map to show entire route with padding
            const bounds = L.latLngBounds([
                [startCoords.lat, startCoords.lon],
                [endCoords.lat, endCoords.lon]
            ]);
            
            // Extend bounds to include route
            routeLine.getBounds && bounds.extend(routeLine.getBounds());
            
            this.map.fitBounds(bounds, {
                padding: [50, 50],
                animate: true,
                duration: 0.5
            });
        }
        
        // Open start marker popup
        setTimeout(() => {
            startMarker.openPopup();
        }, 500);
    }
    
    clearMap() {
        if (this.routeLayer) {
            this.routeLayer.clearLayers();
        }
        if (this.markersLayer) {
            this.markersLayer.clearLayers();
        }
    }
    
    centerOnBelgium() {
        this.map.setView([50.8503, 4.3517], 8, {
            animate: true,
            duration: 0.5
        });
    }
    
    addHeatmap(trips) {
        // Future feature: Add heatmap of frequent routes
        console.log('Heatmap feature coming soon');
    }
}