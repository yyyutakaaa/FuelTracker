// js/map.js
let map; // Globale kaartvariabele
let routeLayer; // Laag voor de route

/**
 * Initialiseert de Leaflet-kaart als deze nog niet bestaat.
 * Wordt aangeroepen wanneer de gebruiker een berekening uitvoert.
 */
export function initMap() {
  if (!map) {
    map = L.map("map").setView([51.505, -0.09], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
  }
}

/**
 * Tekent de route op de kaart met de meegegeven GeoJSON-gegevens.
 */
export function drawRoute(geojson) {
  if (!map) {
    initMap();
  }
  // Verwijder bestaande route
  if (routeLayer) {
    map.removeLayer(routeLayer);
  }
  // Voeg nieuwe route toe en pas de zoom aan
  routeLayer = L.geoJSON(geojson).addTo(map);
  map.fitBounds(routeLayer.getBounds());
}
