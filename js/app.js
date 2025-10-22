// FuelTracker - Simplified App without module imports

const { createApp } = Vue;

// Inline Services to avoid import issues
class FuelPriceService {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.sources = [
            {
                name: 'primary',
                fetch: this.fetchPrimaryPrices.bind(this)
            },
            {
                name: 'fallback',
                fetch: this.fetchFallbackPrices.bind(this)
            }
        ];
    }

    async getCurrentPrice(fuelType) {
        // Check cache first
        const cacheKey = `price_${fuelType}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`Using cached price for ${fuelType}: €${cached}`);
            return cached;
        }

        // Try each source in order
        for (const source of this.sources) {
            try {
                console.log(`Fetching price from ${source.name}...`);
                const price = await source.fetch(fuelType);
                if (price && price > 0) {
                    console.log(`Got price from ${source.name}: €${price}`);
                    this.setCache(cacheKey, price);
                    return price;
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${source.name}:`, error);
            }
        }

        // Final fallback prices (October 2025 Belgian averages)
        console.warn('Using hardcoded fallback prices');
        const fallbackPrices = {
            'euro95': 1.644,
            'euro98': 1.785,
            'diesel': 1.712,
            'lpg': 0.749
        };

        return fallbackPrices[fuelType] || 1.70;
    }

    async fetchPrimaryPrices(fuelType) {
        // Belgian government StatBel API
        const fuelTypeMapping = {
            'euro95': 'Euro Super 95 E10 (€/L)',
            'euro98': 'Super Plus 98 E5 (€/L)',
            'diesel': 'Road Diesel B7 (€/L)',
            'lpg': 'LPG (€/L)'
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(
            'https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON',
            { signal: controller.signal }
        );

        clearTimeout(timeoutId);

        if (!response.ok) throw new Error('StatBel API failed');

        const data = await response.json();
        const mappedType = fuelTypeMapping[fuelType];

        // Get most recent price
        const relevantData = data.facts
            .filter(item => item['Product'] === mappedType && item['Price incl. VAT'] !== null)
            .sort((a, b) => new Date(b['Period'] || 0) - new Date(a['Period'] || 0));

        if (relevantData.length > 0) {
            return parseFloat(relevantData[0]['Price incl. VAT']);
        }

        throw new Error('No data found in StatBel');
    }

    async fetchFallbackPrices(fuelType) {
        // Fallback to hardcoded prices (October 2025 Belgian averages)
        const prices = {
            'euro95': 1.644,
            'euro98': 1.785,
            'diesel': 1.712,
            'lpg': 0.749
        };
        return prices[fuelType] || null;
    }

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            return cached.value;
        }
        this.cache.delete(key);
        return null;
    }

    setCache(key, value) {
        this.cache.set(key, {
            value,
            timestamp: Date.now()
        });
    }

    clearCache() {
        this.cache.clear();
    }

    getCacheTimestamp(fuelType) {
        const cacheKey = `price_${fuelType}`;
        const cached = this.cache.get(cacheKey);
        return cached ? new Date(cached.timestamp) : null;
    }

    // Get price for station - returns base price from API without modifications
    getPriceForStation(basePrice, gasStation) {
        // All stations show the same price from the API
        // This ensures accurate pricing based on official Belgian data
        return basePrice;
    }

    getStationName(stationCode) {
        const names = {
            'average': 'Gemiddelde prijs',
            'shell': 'Shell',
            'totalenergies': 'TotalEnergies',
            'q8': 'Q8',
            'esso': 'Esso',
            'gabriels': 'Gabriels',
            'octaplus': 'Octa+',
            'dats24': 'Dats 24',
            'lukoil': 'Lukoil',
            'custom': 'Aangepaste prijs'
        };
        return names[stationCode] || stationCode;
    }
}

class StorageService {
    constructor() {
        this.storageKey = 'fueltracker_history';
    }
    
    saveHistory(history) {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(history));
            return true;
        } catch (error) {
            console.error('Error saving history:', error);
            return false;
        }
    }
    
    loadHistory() {
        try {
            const data = localStorage.getItem(this.storageKey);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error loading history:', error);
            return [];
        }
    }
}

class MapService {
    constructor() {
        this.map = null;
        this.routeLayer = null;
        this.markersLayer = null;
    }
    
    initMap() {
        if (!document.getElementById('map')) return;
        
        this.map = L.map('map', {
            center: [50.8503, 4.3517],
            zoom: 8
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.markersLayer = L.layerGroup().addTo(this.map);
    }
    
    drawRoute(geometry, startCoords, endCoords, startName, endName) {
        if (!this.map) return;
        
        this.routeLayer.clearLayers();
        this.markersLayer.clearLayers();
        
        // Add markers
        L.marker([startCoords.lat, startCoords.lon])
            .bindPopup(`<strong>Vertrek:</strong><br>${startName}`)
            .addTo(this.markersLayer);
        
        L.marker([endCoords.lat, endCoords.lon])
            .bindPopup(`<strong>Bestemming:</strong><br>${endName}`)
            .addTo(this.markersLayer);
        
        // Draw route
        if (geometry && geometry.coordinates) {
            const latlngs = geometry.coordinates.map(coord => [coord[1], coord[0]]);
            L.polyline(latlngs, {
                color: '#3b82f6',
                weight: 5,
                opacity: 0.8
            }).addTo(this.routeLayer);
            
            // Fit map
            const bounds = L.latLngBounds([
                [startCoords.lat, startCoords.lon],
                [endCoords.lat, endCoords.lon]
            ]);
            this.map.fitBounds(bounds, { padding: [50, 50] });
        }
    }
}

class ChartService {
    constructor() {
        this.chart = null;
    }
    
    updateChart(history) {
        const ctx = document.getElementById('costChart');
        if (!ctx || history.length === 0) return;
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        const labels = history.map((trip, index) => `Rit ${index + 1}`);
        const costs = history.map(trip => parseFloat(trip.cost));
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Kosten (€)',
                    data: costs,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false
            }
        });
    }
}

// Vue App
createApp({
    data() {
        return {
            // Form inputs
            departure: '',
            destination: '',
            consumption: null,
            fuelType: 'euro95',
            gasStation: 'average',
            customPrice: null,
            
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
            currentFuelPrice: 1.70,
            lastPriceUpdate: 'Nu',
            isRefreshingPrice: false,

            // Services
            fuelService: null,
            storageService: null,
            mapService: null,
            chartService: null,

            // Timers
            departureTimer: null,
            destinationTimer: null,
            priceRefreshInterval: null
        };
    },
    
    async mounted() {
        console.log('App mounting...');
        
        // Initialize services
        this.fuelService = new FuelPriceService();
        this.storageService = new StorageService();
        this.mapService = new MapService();
        this.chartService = new ChartService();
        
        // Load history
        this.history = this.storageService.loadHistory();

        // Get initial fuel price
        await this.updateFuelPrice();

        // Setup automatic price refresh every 6 hours
        this.priceRefreshInterval = setInterval(() => {
            this.updateFuelPrice(true);
        }, 6 * 60 * 60 * 1000);

        // Initialize map after DOM ready
        this.$nextTick(() => {
            this.mapService.initMap();
        });
        
        // Setup UI
        this.setupThemeToggle();
        this.setupMobileMenu();
        
        // Hide loading screen
        document.getElementById('loadingScreen').style.display = 'none';
        
        console.log('App mounted successfully');
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
            return this.totalDistance > 0 ? (this.totalCost / this.totalDistance).toFixed(3) : '0.00';
        }
    },
    
    watch: {
        fuelType(newType) {
            // Update price when fuel type changes
            this.updateFuelPrice();
        },
        gasStation(newStation) {
            // Update price when gas station changes
            this.updateFuelPrice();
        },
        customPrice(newPrice) {
            // Update price when custom price changes
            if (this.gasStation === 'custom' && newPrice && newPrice > 0) {
                this.updateFuelPrice();
            }
        }
    },

    methods: {
        // Fuel price methods
        async updateFuelPrice(forceRefresh = false) {
            try {
                // If custom price is selected, use that
                if (this.gasStation === 'custom' && this.customPrice && this.customPrice > 0) {
                    this.currentFuelPrice = this.customPrice;
                    this.lastPriceUpdate = 'Handmatig ingevoerd';
                    return;
                }

                if (forceRefresh) {
                    this.fuelService.clearCache();
                }

                // Get base price from API
                const basePrice = await this.fuelService.getCurrentPrice(this.fuelType);

                // Apply gas station modifier
                this.currentFuelPrice = this.fuelService.getPriceForStation(basePrice, this.gasStation);

                const cacheTimestamp = this.fuelService.getCacheTimestamp(this.fuelType);
                if (cacheTimestamp) {
                    this.lastPriceUpdate = cacheTimestamp.toLocaleString('nl-BE');
                } else {
                    this.lastPriceUpdate = new Date().toLocaleString('nl-BE');
                }
            } catch (error) {
                console.error('Error updating fuel price:', error);
            }
        },

        async refreshFuelPrice() {
            this.isRefreshingPrice = true;
            try {
                // Clear cache and force refresh
                this.fuelService.clearCache();
                await this.updateFuelPrice();
            } catch (error) {
                console.error('Error refreshing price:', error);
                alert('Fout bij het ophalen van de brandstofprijs');
            } finally {
                this.isRefreshingPrice = false;
            }
        },

        // Autocomplete
        searchDeparture() {
            clearTimeout(this.departureTimer);
            this.departureTimer = setTimeout(() => {
                if (this.departure.length >= 3) {
                    this.fetchSuggestions(this.departure, 'departure');
                }
            }, 300);
        },
        
        searchDestination() {
            clearTimeout(this.destinationTimer);
            this.destinationTimer = setTimeout(() => {
                if (this.destination.length >= 3) {
                    this.fetchSuggestions(this.destination, 'destination');
                }
            }, 300);
        },
        
        async fetchSuggestions(query, type) {
            try {
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=be,nl&limit=5`;
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
        },
        
        selectDestination(suggestion) {
            this.destination = suggestion.name;
            this.destinationCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.destinationSuggestions = [];
        },
        
        handleDepartureBlur() {
            setTimeout(() => this.departureFocused = false, 200);
        },
        
        handleDestinationBlur() {
            setTimeout(() => this.destinationFocused = false, 200);
        },
        
        // Calculate
        async calculateTrip() {
            if (!this.departure || !this.destination || !this.consumption || this.consumption < 2 || this.consumption > 25) {
                alert('Vul alle velden correct in (brandstofverbruik: 2-25 L/100km)');
                return;
            }

            // Validate custom price if custom station is selected
            if (this.gasStation === 'custom' && (!this.customPrice || this.customPrice <= 0)) {
                alert('Vul een geldige aangepaste brandstofprijs in (minimaal €0.50/L)');
                return;
            }

            // Ensure fuel price is updated before calculation
            if (this.gasStation === 'custom' && this.customPrice > 0) {
                this.currentFuelPrice = this.customPrice;
            }

            if (!this.currentFuelPrice || this.currentFuelPrice <= 0) {
                alert('Brandstofprijs kon niet worden opgehaald. Probeer het opnieuw.');
                return;
            }

            this.isCalculating = true;
            
            try {
                // Get coordinates
                if (!this.departureCoords) {
                    this.departureCoords = await this.geocodeAddress(this.departure);
                }
                if (!this.destinationCoords) {
                    this.destinationCoords = await this.geocodeAddress(this.destination);
                }
                
                if (!this.departureCoords || !this.destinationCoords) {
                    throw new Error('Adressen niet gevonden');
                }
                
                // Get route
                const route = await this.getRoute(this.departureCoords, this.destinationCoords);
                if (!route) {
                    throw new Error('Route niet gevonden');
                }
                
                // Calculate
                const distanceKm = route.distance / 1000;
                const durationMin = route.duration / 60;
                const fuelNeeded = (distanceKm * this.consumption) / 100;
                const cost = fuelNeeded * this.currentFuelPrice;
                const co2 = fuelNeeded * 2.35; // Simple CO2 calculation
                
                this.result = {
                    distance: distanceKm.toFixed(1),
                    duration: Math.round(durationMin),
                    cost: cost.toFixed(2),
                    fuelPrice: this.currentFuelPrice.toFixed(3),
                    co2: co2.toFixed(1)
                };
                
                // Draw on map
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
                    gasStation: this.gasStation,
                    fuelPrice: this.currentFuelPrice.toFixed(3),
                    date: new Date().toISOString(),
                    co2: co2.toFixed(1)
                };
                
                this.history.push(trip);
                this.storageService.saveHistory(this.history);
                this.chartService.updateChart(this.history);
                
            } catch (error) {
                alert('Fout: ' + error.message);
            } finally {
                this.isCalculating = false;
            }
        },
        
        async geocodeAddress(address) {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.length > 0) {
                return {
                    lat: parseFloat(data[0].lat),
                    lon: parseFloat(data[0].lon)
                };
            }
            return null;
        },
        
        async getRoute(start, end) {
            const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            const data = await response.json();
            
            if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return data.routes[0];
            }
            return null;
        },
        
        deleteTrip(index) {
            const actualIndex = this.history.length - 1 - index;
            this.history.splice(actualIndex, 1);
            this.storageService.saveHistory(this.history);
            this.chartService.updateChart(this.history);
        },
        
        exportHistory() {
            let csv = 'Datum,Vertrek,Bestemming,Afstand,Kosten,Brandstof,Tankstation,Prijs\n';
            this.history.forEach(trip => {
                const stationName = this.fuelService.getStationName(trip.gasStation || 'average');
                csv += `${new Date(trip.date).toLocaleDateString()},${trip.departure},${trip.destination},${trip.distance},${trip.cost},${trip.fuelType},${stationName},${trip.fuelPrice || 'N/A'}\n`;
            });
            
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'fueltracker_export.csv';
            a.click();
        },
        
        formatDuration(minutes) {
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return hours > 0 ? `${hours}u ${mins}m` : `${mins} min`;
        },
        
        formatDate(dateStr) {
            return new Date(dateStr).toLocaleDateString('nl-BE');
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

        getStationName(stationCode) {
            return this.fuelService ? this.fuelService.getStationName(stationCode) : stationCode;
        },
        
        setupThemeToggle() {
            const btn = document.getElementById('themeToggle');
            const html = document.documentElement;
            
            btn?.addEventListener('click', () => {
                html.classList.toggle('dark');
                localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light');
            });
        },
        
        setupMobileMenu() {
            const btn = document.getElementById('mobileMenuBtn');
            const menu = document.getElementById('mobileMenu');
            
            btn?.addEventListener('click', () => {
                menu?.classList.toggle('hidden');
            });
        }
    },

    beforeUnmount() {
        // Clean up intervals
        if (this.priceRefreshInterval) {
            clearInterval(this.priceRefreshInterval);
        }
        if (this.departureTimer) {
            clearTimeout(this.departureTimer);
        }
        if (this.destinationTimer) {
            clearTimeout(this.destinationTimer);
        }
    }
}).mount('#app');