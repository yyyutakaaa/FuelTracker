// FuelTracker - Main Application Module
import { FuelPriceService } from './api.js';
import { StorageService } from './storage.js';
import { MapService } from './map.js';
import { ChartService } from './chart.js';

// Initialize Vue app
const { createApp } = Vue;

createApp({
    data() {
        return {
            // Form inputs
            departure: '',
            destination: '',
            consumption: null,
            fuelType: 'euro95',
            
            // Autocomplete
            departureSuggestions: [],
            destinationSuggestions: [],
            departureFocused: false,
            destinationFocused: false,
            departureCoords: null,
            destinationCoords: null,
            
            // State
            isCalculating: false,
            result: null,
            history: [],
            
            // Fuel prices
            currentFuelPrice: null,
            lastPriceUpdate: null,
            
            // Services
            fuelService: null,
            storageService: null,
            mapService: null,
            chartService: null,
            
            // Debounce timers
            departureTimer: null,
            destinationTimer: null
        };
    },
    
    async mounted() {
        // Initialize services
        this.fuelService = new FuelPriceService();
        this.storageService = new StorageService();
        this.mapService = new MapService();
        this.chartService = new ChartService();
        
        // Load data
        this.history = this.storageService.loadHistory();
        await this.updateFuelPrice();
        
        // Initialize map
        this.mapService.initMap();
        
        // Setup UI
        this.setupThemeToggle();
        this.setupMobileMenu();
        
        // Hide loading screen
        setTimeout(() => {
            document.getElementById('loadingScreen').classList.add('hidden');
        }, 500);
        
        // Update chart if history exists
        if (this.history.length > 0) {
            this.$nextTick(() => {
                this.chartService.updateChart(this.history);
            });
        }
    },
    
    computed: {
        reversedHistory() {
            return [...this.history].reverse();
        },
        
        totalDistance() {
            return this.history.reduce((sum, trip) => sum + parseFloat(trip.distance), 0).toFixed(1);
        },
        
        totalCost() {
            return this.history.reduce((sum, trip) => sum + parseFloat(trip.cost), 0).toFixed(2);
        },
        
        avgCostPerKm() {
            if (this.totalDistance === 0) return '0.00';
            return (this.totalCost / this.totalDistance).toFixed(3);
        }
    },
    
    methods: {
        // Autocomplete methods
        searchDeparture() {
            clearTimeout(this.departureTimer);
            this.departureTimer = setTimeout(() => {
                if (this.departure.length >= 3) {
                    this.fetchSuggestions(this.departure, 'departure');
                } else {
                    this.departureSuggestions = [];
                }
            }, 300);
        },
        
        searchDestination() {
            clearTimeout(this.destinationTimer);
            this.destinationTimer = setTimeout(() => {
                if (this.destination.length >= 3) {
                    this.fetchSuggestions(this.destination, 'destination');
                } else {
                    this.destinationSuggestions = [];
                }
            }, 300);
        },
        
        async fetchSuggestions(query, type) {
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=be,nl&limit=5&accept-language=nl`;
                const response = await fetch(url);
                const data = await response.json();
                
                const suggestions = data.map(item => ({
                    name: item.name || item.display_name.split(',')[0],
                    display_name: item.display_name,
                    lat: parseFloat(item.lat),
                    lon: parseFloat(item.lon)
                }));
                
                if (type === 'departure') {
                    this.departureSuggestions = suggestions;
                } else {
                    this.destinationSuggestions = suggestions;
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        },
        
        selectDeparture(suggestion) {
            this.departure = suggestion.name;
            this.departureCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.departureSuggestions = [];
            this.departureFocused = false;
        },
        
        selectDestination(suggestion) {
            this.destination = suggestion.name;
            this.destinationCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.destinationSuggestions = [];
            this.destinationFocused = false;
        },
        
        handleDepartureBlur() {
            setTimeout(() => {
                this.departureFocused = false;
            }, 200);
        },
        
        handleDestinationBlur() {
            setTimeout(() => {
                this.destinationFocused = false;
            }, 200);
        },
        
        // Calculation method
        async calculateTrip() {
            // Validation
            if (!this.validateInputs()) {
                return;
            }
            
            this.isCalculating = true;
            
            try {
                // Get coordinates if not already selected from suggestions
                if (!this.departureCoords) {
                    this.departureCoords = await this.geocodeAddress(this.departure);
                }
                if (!this.destinationCoords) {
                    this.destinationCoords = await this.geocodeAddress(this.destination);
                }
                
                if (!this.departureCoords || !this.destinationCoords) {
                    throw new Error('Een of beide adressen konden niet worden gevonden');
                }
                
                // Get route
                const route = await this.getRoute(this.departureCoords, this.destinationCoords);
                if (!route) {
                    throw new Error('Route kon niet worden berekend');
                }
                
                // Calculate results
                const distanceKm = route.distance / 1000;
                const durationMin = route.duration / 60;
                const fuelNeeded = (distanceKm * this.consumption) / 100;
                const cost = fuelNeeded * this.currentFuelPrice;
                const co2Emission = this.calculateCO2(fuelNeeded, this.fuelType);
                
                this.result = {
                    distance: distanceKm.toFixed(1),
                    duration: Math.round(durationMin),
                    cost: cost.toFixed(2),
                    fuelPrice: this.currentFuelPrice.toFixed(3),
                    co2: co2Emission.toFixed(1)
                };
                
                // Draw route on map
                this.mapService.drawRoute(
                    route.geometry,
                    this.departureCoords,
                    this.destinationCoords,
                    this.departure,
                    this.destination
                );
                
                // Save to history
                const trip = {
                    departure: this.departure,
                    destination: this.destination,
                    distance: distanceKm.toFixed(1),
                    cost: cost.toFixed(2),
                    fuelType: this.fuelType,
                    fuelPrice: this.currentFuelPrice.toFixed(3),
                    date: new Date().toISOString(),
                    co2: co2Emission.toFixed(1)
                };
                
                this.history.push(trip);
                this.storageService.saveHistory(this.history);
                
                // Update chart
                this.$nextTick(() => {
                    this.chartService.updateChart(this.history);
                });
                
                // Scroll to results
                setTimeout(() => {
                    document.querySelector('#map').scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
                
            } catch (error) {
                this.showError(error.message);
            } finally {
                this.isCalculating = false;
            }
        },
        
        validateInputs() {
            if (!this.departure || !this.destination) {
                this.showError('Vul beide adressen in');
                return false;
            }
            
            if (!this.consumption || this.consumption < 2 || this.consumption > 25) {
                this.showError('Vul een realistisch brandstofverbruik in (2-25 L/100km)');
                return false;
            }
            
            return true;
        },
        
        async geocodeAddress(address) {
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=be,nl&limit=1`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.length > 0) {
                    return {
                        lat: parseFloat(data[0].lat),
                        lon: parseFloat(data[0].lon)
                    };
                }
                return null;
            } catch (error) {
                console.error('Geocoding error:', error);
                return null;
            }
        },
        
        async getRoute(start, end) {
            try {
                const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
                    return data.routes[0];
                }
                return null;
            } catch (error) {
                console.error('Routing error:', error);
                return null;
            }
        },
        
        calculateCO2(liters, fuelType) {
            // CO2 emission factors (kg CO2 per liter)
            const factors = {
                'euro95': 2.35,
                'euro98': 2.35,
                'diesel': 2.65,
                'lpg': 1.66
            };
            
            return liters * (factors[fuelType] || 2.35);
        },
        
        // Fuel price methods
        async updateFuelPrice() {
            const price = await this.fuelService.getCurrentPrice(this.fuelType);
            this.currentFuelPrice = price;
            this.lastPriceUpdate = new Date().toLocaleString('nl-BE');
        },
        
        // History methods
        deleteTrip(index) {
            const actualIndex = this.history.length - 1 - index;
            this.history.splice(actualIndex, 1);
            this.storageService.saveHistory(this.history);
            this.chartService.updateChart(this.history);
        },
        
        exportHistory() {
            let csv = 'Datum,Vertrek,Bestemming,Afstand (km),Kosten (€),Brandstoftype,Prijs/L (€),CO2 (kg)\\n';
            
            this.history.forEach(trip => {
                csv += `${this.formatDate(trip.date)},${trip.departure},${trip.destination},${trip.distance},${trip.cost},${this.getFuelTypeName(trip.fuelType)},${trip.fuelPrice},${trip.co2 || '0'}\\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            
            link.setAttribute('href', url);
            link.setAttribute('download', `fueltracker_export_${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        },
        
        // Utility methods
        formatDuration(minutes) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            if (hours > 0) {
                return `${hours}u ${mins}m`;
            }
            return `${mins} min`;
        },
        
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString('nl-BE', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        },
        
        getFuelTypeName(type) {
            const names = {
                'euro95': 'Euro 95',
                'euro98': 'Euro 98',
                'diesel': 'Diesel',
                'lpg': 'LPG'
            };
            return names[type] || type;
        },
        
        showError(message) {
            alert(message); // You can replace this with a better notification system
        },
        
        // UI Setup methods
        setupThemeToggle() {
            const themeToggle = document.getElementById('themeToggle');
            const html = document.documentElement;
            
            // Check saved theme
            const savedTheme = localStorage.getItem('theme') || 'light';
            html.classList.toggle('dark', savedTheme === 'dark');
            
            themeToggle.addEventListener('click', () => {
                const isDark = html.classList.toggle('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
            });
        },
        
        setupMobileMenu() {
            const mobileMenuBtn = document.getElementById('mobileMenuBtn');
            const mobileMenu = document.getElementById('mobileMenu');
            
            mobileMenuBtn.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
            });
            
            // Close mobile menu when clicking a link
            mobileMenu.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileMenu.classList.add('hidden');
                });
            });
        }
    },
    
    watch: {
        fuelType(newType) {
            this.updateFuelPrice();
        }
    }
}).mount('#app');

// Register service worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/js/service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed'));
    });
}