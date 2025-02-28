// js/app.js
import { geocodeAddress, getRoute, getFuelPrice } from "./api.js";
import { saveHistory, loadHistory } from "./storage.js";
import { initMap, drawRoute } from "./map.js";
import { drawChart } from "./chart.js";

// Haal DOM-elementen op
const departureInput = document.getElementById("departure");
const destinationInput = document.getElementById("destination");
const consumptionInput = document.getElementById("consumption");
const fuelSelect = document.getElementById("fuelSelect");
const calculateBtn = document.getElementById("calculateBtn");
const resultBox = document.getElementById("resultBox");
const distanceEl = document.getElementById("distance");
const durationEl = document.getElementById("duration");
const costEl = document.getElementById("cost");
const fuelPriceEl = document.getElementById("fuelPrice");
const mapBox = document.getElementById("mapBox");
const historyBox = document.getElementById("historyBox");
const historyList = document.getElementById("historyList");
const chartBox = document.getElementById("chartBox");

// Globale ritgeschiedenis
let history = loadHistory();
updateHistoryUI();

// Voeg event listener toe aan de knop
calculateBtn.addEventListener("click", async () => {
  const departure = departureInput.value.trim();
  const destination = destinationInput.value.trim();
  const consumption = parseFloat(consumptionInput.value);
  const fuelType = fuelSelect.value; // Lees de gekozen brandstof

  if (!departure || !destination || isNaN(consumption)) {
    alert("Vul alle velden correct in!");
    return;
  }

  try {
    // 1. Geocode de adressen
    const geoDeparture = await geocodeAddress(departure);
    const geoDestination = await geocodeAddress(destination);
    if (!geoDeparture || !geoDestination) {
      alert("Een of beide adressen zijn niet gevonden.");
      return;
    }

    // 2. Haal de route op via OSRM
    const routeData = await getRoute(geoDeparture, geoDestination);
    if (!routeData) {
      alert("Route kon niet worden berekend.");
      return;
    }

    const route = routeData.routes[0];
    const distanceKm = route.distance / 1000;
    const durationMin = route.duration / 60;

    // 3. Brandstofprijs ophalen met de gekozen brandstof
    const fuelPrice = await getFuelPrice(fuelType);

    // 4. Bereken de kosten
    // Formule: (afstand (km) * verbruik (L/100km) / 100) * brandstofprijs
    const cost = ((distanceKm * consumption) / 100) * fuelPrice;

    // Update de resultaatweergave
    distanceEl.textContent = distanceKm.toFixed(2);
    durationEl.textContent = durationMin.toFixed(0); // Reistijd zonder decimalen
    costEl.textContent = cost.toFixed(2);
    fuelPriceEl.textContent = fuelPrice ? fuelPrice.toFixed(3) : "1.700";
    resultBox.style.display = "block";

    // 5. Update de kaartweergave
    mapBox.style.display = "block";
    initMap();
    drawRoute(route.geometry);

    // 6. Werk de ritgeschiedenis bij
    const ride = {
      departure,
      destination,
      distance: distanceKm.toFixed(2),
      cost: cost.toFixed(2),
      fuelType,
      fuelPrice: fuelPrice ? fuelPrice.toFixed(3) : "1.700",
    };
    history.push(ride);
    saveHistory(history);
    updateHistoryUI();

    // 7. Update de grafiek
    chartBox.style.display = "block";
    drawChart(history);
  } catch (error) {
    console.error(error);
    alert("Er is iets misgegaan tijdens de berekening.");
  }
});

/**
 * Update de UI van de ritgeschiedenis.
 */
function updateHistoryUI() {
  // Toon of verberg de geschiedenis en grafiek afhankelijk van data
  if (history.length > 0) {
    historyBox.style.display = "block";
    chartBox.style.display = "block";
  } else {
    historyBox.style.display = "none";
    chartBox.style.display = "none";
  }

  // Maak de lijst leeg en vul opnieuw
  historyList.innerHTML = "";
  history.forEach((ride) => {
    const li = document.createElement("li");
    li.textContent = `${ride.departure} naar ${ride.destination}: ${ride.distance} km, €${ride.cost} (Brandstof: ${ride.fuelType} à €${ride.fuelPrice}/L)`;
    historyList.appendChild(li);
  });
}
