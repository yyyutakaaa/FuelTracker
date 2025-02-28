export async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
    address
  )}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data && data.length > 0) {
    return { lat: data[0].lat, lon: data[0].lon };
  }
  return null;
}
export async function getRoute(start, end) {
  const url = `https://router.project-osrm.org/route/v1/car/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  const data = await response.json();
  if (data && data.code === "Ok") {
    return data;
  }
  return null;
}

export async function getFuelPrice() {
  return 1.7; // €1.70 per liter
}
