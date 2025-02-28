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

export async function getFuelPrice(fuelType) {
  try {
    // Haal de JSON-data op van Statbel
    const response = await fetch(
      "https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON"
    );
    if (!response.ok) {
      throw new Error("Fout bij ophalen van de brandstofprijzen");
    }
    const data = await response.json();

    // Filter de facts op basis van de gekozen brandstof (exacte match)
    const filteredFacts = data.facts.filter(
      (item) => item["Product"] === fuelType
    );
    if (filteredFacts.length === 0) {
      throw new Error("Geen data gevonden voor de gekozen brandstof");
    }

    // Filter alleen objecten met een geldige prijs (Price incl. VAT niet null)
    const validFacts = filteredFacts.filter(
      (item) => item["Price incl. VAT"] !== null
    );
    if (validFacts.length === 0) {
      throw new Error(
        "Geen geldige prijzen gevonden voor de gekozen brandstof"
      );
    }

    // Haal de prijzen op als numerieke waarden
    const prices = validFacts.map((item) => Number(item["Price incl. VAT"]));
    // Bepaal de goedkoopste en duurste prijs
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    // Bereken het gemiddelde van de goedkoopste en duurste prijs
    const averagePrice = (minPrice + maxPrice) / 2;

    return averagePrice;
  } catch (error) {
    console.error("Error fetching fuel price:", error);
    // Fallback naar een standaardwaarde
    return 1.7;
  }
}
