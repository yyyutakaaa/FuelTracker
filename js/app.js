import { showCookieBanner } from "./cookieBanner.js";
import { getFuelPrice } from "./api.js";
import { saveHistory, loadHistory } from "./storage.js";
import { initMap, drawRoute } from "./map.js";
import { drawChart } from "./chart.js";

const app = Vue.createApp({
  data() {
    return {
      departure: "",
      destination: "",
      consumption: null,
      fuelType: "Euro Super 95 E10 (€/L)",
      result: null,
      routeGeoJson: null,
      history: [],
    };
  },
  mounted() {
    this.history = loadHistory();
    showCookieBanner();
    if (this.history.length) {
      this.showLastTripBanner();
    }
    initMap();
    const burger = document.querySelector(".navbar-burger");
    const menu = document.getElementById("navMenu");
    burger.addEventListener("click", () => {
      burger.classList.toggle("is-active");
      menu.classList.toggle("is-active");
    });
  },
  methods: {
    async calculateTrip() {
      if (!this.departure || !this.destination || !this.consumption) {
        alert("Vul alle velden correct in!");
        return;
      }
      try {
        const geoDeparture = await this.geocodeAddress(this.departure);
        const geoDestination = await this.geocodeAddress(this.destination);
        if (!geoDeparture || !geoDestination) {
          alert("Een of beide adressen niet gevonden.");
          return;
        }
        const routeData = await this.getRoute(geoDeparture, geoDestination);
        if (!routeData) {
          alert("Route kon niet worden berekend.");
          return;
        }
        const route = routeData.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;
        const fuelPrice = await getFuelPrice(this.fuelType);
        const adjustedFuelPrice = fuelPrice;
        const cost =
          ((distanceKm * this.consumption) / 100) * adjustedFuelPrice;
        this.result = {
          distance: distanceKm.toFixed(2),
          duration: durationMin.toFixed(0),
          cost: cost.toFixed(2),
          fuelPrice: adjustedFuelPrice.toFixed(3),
        };
        drawRoute(route.geometry);
        const ride = {
          departure: this.departure,
          destination: this.destination,
          distance: distanceKm.toFixed(2),
          cost: cost.toFixed(2),
          fuelType: this.fuelType,
          fuelPrice: adjustedFuelPrice.toFixed(3),
        };
        this.history.push(ride);
        saveHistory(this.history);
        drawChart(this.history);
      } catch (error) {
        console.error(error);
        alert("Er is iets misgegaan tijdens de berekening.");
      }
    },
    async geocodeAddress(address) {
      const url =
        "https://nominatim.openstreetmap.org/search?format=json&q=" +
        encodeURIComponent(address);
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.length > 0) {
        return { lat: data[0].lat, lon: data[0].lon };
      }
      return null;
    },
    async getRoute(start, end) {
      const url =
        "https://router.project-osrm.org/route/v1/car/" +
        start.lon +
        "," +
        start.lat +
        ";" +
        end.lon +
        "," +
        end.lat +
        "?overview=full&geometries=geojson";
      const response = await fetch(url);
      const data = await response.json();
      if (data && data.code === "Ok") {
        return data;
      }
      return null;
    },
    showLastTripBanner() {
      const lastRide = this.history[this.history.length - 1];
      Swal.fire({
        title: "Laatste berekening weergeven?",
        text:
          "Je laatste rit: " +
          lastRide.departure +
          " naar " +
          lastRide.destination +
          " voor €" +
          lastRide.cost,
        icon: "question",
        showCancelButton: true,
        confirmButtonText: "Weergeven",
        cancelButtonText: "Nieuwe berekening",
      }).then((result) => {
        if (result.isConfirmed) {
          const historySection = document.getElementById("historySection");
          historySection.scrollIntoView({ behavior: "smooth" });
        }
      });
    },
  },
});
app.mount("#app");
