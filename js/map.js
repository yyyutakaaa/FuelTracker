let map;
let routeLayer;
export function initMap() {
  if (!map) {
    map = L.map("map").setView([51.505, -0.09], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
    }).addTo(map);
  }
}
export function drawRoute(geojson) {
  if (!map) initMap();
  if (routeLayer) map.removeLayer(routeLayer);
  routeLayer = L.geoJSON(geojson).addTo(map);
  map.fitBounds(routeLayer.getBounds());
}
