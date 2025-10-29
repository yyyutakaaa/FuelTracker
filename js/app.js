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
                fetch: this.fetchPrimaryPrices.bind(this),
                description: 'StatBel API (direct)'
            },
            {
                name: 'secondary',
                fetch: this.fetchSecondaryPrices.bind(this),
                description: 'StatBel API (via proxy)'
            },
            {
                name: 'fallback',
                fetch: this.fetchFallbackPrices.bind(this),
                description: 'October 2025 averages'
            }
        ];
    }

    async getCurrentPrice(fuelType) {
        // Check cache first
        const cacheKey = `price_${fuelType}`;
        const cached = this.getFromCache(cacheKey);
        if (cached) {
            console.log(`Using cached price for ${fuelType}: €${cached.price}`);
            return cached;
        }

        // Try each source in order
        for (const source of this.sources) {
            try {
                console.log(`Fetching price from ${source.name}...`);
                const price = await source.fetch(fuelType);
                if (price && price > 0) {
                    console.log(`Got price from ${source.name}: €${price}`);
                    const priceData = {
                        price: price,
                        source: source.name,
                        description: source.description || source.name
                    };
                    this.setCache(cacheKey, priceData);
                    return priceData;
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

        return {
            price: fallbackPrices[fuelType] || 1.70,
            source: 'hardcoded',
            description: 'Emergency fallback'
        };
    }

    async fetchPrimaryPrices(fuelType) {
        // Belgian government StatBel API with CORS proxy for local development
        const fuelTypeMapping = {
            'euro95': 'Euro Super 95 E10 (€/L)',
            'euro98': 'Super Plus 98 E5 (€/L)',
            'diesel': 'Road Diesel B7 (€/L)',
            'lpg': 'LPG (€/L)'
        };

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        try {
            // Try direct API call first
            const apiUrl = 'https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON';

            console.log('Fetching from StatBel API...');
            const response = await fetch(apiUrl, {
                signal: controller.signal,
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                console.error('StatBel API response not OK:', response.status);
                throw new Error('StatBel API failed');
            }

            const data = await response.json();
            const mappedType = fuelTypeMapping[fuelType];

            console.log('StatBel API data received, looking for:', mappedType);

            // Get most recent price
            const relevantData = data.facts
                .filter(item => item['Product'] === mappedType && item['Price incl. VAT'] !== null)
                .sort((a, b) => new Date(b['Period'] || 0) - new Date(a['Period'] || 0));

            if (relevantData.length > 0) {
                const price = parseFloat(relevantData[0]['Price incl. VAT']);
                console.log(`✓ StatBel API success: €${price} for ${fuelType}`);
                return price;
            }

            throw new Error('No data found in StatBel');
        } catch (error) {
            clearTimeout(timeoutId);
            console.error('StatBel API error:', error.message);

            // If CORS error, log specific message
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                console.warn('⚠ CORS error detected - falling back to alternative source');
            }

            throw error;
        }
    }

    async fetchSecondaryPrices(fuelType) {
        // Alternative: Use a CORS-friendly proxy for local development
        console.log('Trying secondary source with CORS proxy...');

        try {
            const apiUrl = 'https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON';
            const proxyUrl = 'https://api.allorigins.win/raw?url=';

            const response = await fetch(proxyUrl + encodeURIComponent(apiUrl), {
                timeout: 8000
            });

            if (!response.ok) throw new Error('Proxy API failed');

            const data = await response.json();

            const fuelTypeMapping = {
                'euro95': 'Euro Super 95 E10 (€/L)',
                'euro98': 'Super Plus 98 E5 (€/L)',
                'diesel': 'Road Diesel B7 (€/L)',
                'lpg': 'LPG (€/L)'
            };

            const mappedType = fuelTypeMapping[fuelType];
            const relevantData = data.facts
                .filter(item => item['Product'] === mappedType && item['Price incl. VAT'] !== null)
                .sort((a, b) => new Date(b['Period'] || 0) - new Date(a['Period'] || 0));

            if (relevantData.length > 0) {
                const price = parseFloat(relevantData[0]['Price incl. VAT']);
                console.log(`✓ Proxy API success: €${price} for ${fuelType}`);
                return price;
            }

            throw new Error('No data in proxy response');
        } catch (error) {
            console.error('Secondary source error:', error.message);
            throw error;
        }
    }

    async fetchFallbackPrices(fuelType) {
        // Last resort: Use reliable fallback prices (October 2025 Belgian averages)
        console.log('Using fallback prices (last resort)');
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

    // Get price - returns base price from API
    getPriceForStation(basePrice, gasStation) {
        // Always return the official average price from StatBel API
        // Prices vary significantly by location, not by brand
        // Without a real-time API per station, we use the official average
        return basePrice;
    }

    getStationName(stationCode) {
        const names = {
            'average': 'Officiële gemiddelde',
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
            priceSource: 'Laden...',
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
            // Update price when fuel type changes - force refresh to get latest price
            this.updateFuelPrice(true);
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
                    this.priceSource = 'Aangepaste prijs';
                    return;
                }

                if (forceRefresh) {
                    this.fuelService.clearCache();
                }

                // Get base price from API
                const priceData = await this.fuelService.getCurrentPrice(this.fuelType);

                // Extract price and source info
                const basePrice = typeof priceData === 'object' ? priceData.price : priceData;
                const source = priceData.description || 'Unknown';

                // Use official average price
                this.currentFuelPrice = this.fuelService.getPriceForStation(basePrice, this.gasStation);
                this.priceSource = source;

                const cacheTimestamp = this.fuelService.getCacheTimestamp(this.fuelType);
                if (cacheTimestamp) {
                    this.lastPriceUpdate = cacheTimestamp.toLocaleString('nl-BE');
                } else {
                    this.lastPriceUpdate = new Date().toLocaleString('nl-BE');
                }

                console.log(`Price updated: €${this.currentFuelPrice} from ${source} (base: €${basePrice})`);
            } catch (error) {
                console.error('Error updating fuel price:', error);
                this.priceSource = 'Error loading price';
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
                const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=be,nl&limit=5&addressdetails=1`;
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'FuelTracker/1.0'
                    }
                });
                const data = await response.json();

                const suggestions = data.map(item => {
                    // Format the address for display
                    let formattedAddress = '';

                    // Check if this is a named location (POI, building, etc.)
                    const hasSpecificName = item.name && item.type !== 'road' && item.type !== 'residential';

                    if (hasSpecificName) {
                        // Use the name for POIs (e.g., "Brussels Airport", "Grand Place")
                        formattedAddress = item.name;
                    } else if (item.address) {
                        // Build address from components: street + house_number + city
                        const parts = [];

                        // Add street (road, street, or other street types)
                        const street = item.address.road || item.address.street || item.address.pedestrian || item.address.footway;
                        if (street) parts.push(street);

                        // Add house number
                        if (item.address.house_number) parts.push(item.address.house_number);

                        // Add city (try different fields)
                        const city = item.address.city || item.address.town || item.address.village || item.address.municipality;
                        if (city) {
                            formattedAddress = parts.join(' ') + (parts.length > 0 ? ', ' : '') + city;
                        } else {
                            formattedAddress = parts.join(' ') || item.display_name.split(',')[0];
                        }
                    } else {
                        // Fallback to first part of display_name
                        formattedAddress = item.display_name.split(',')[0];
                    }

                    return {
                        name: item.name || item.display_name.split(',')[0],
                        display_name: item.display_name,
                        formatted_address: formattedAddress,
                        lat: parseFloat(item.lat),
                        lon: parseFloat(item.lon)
                    };
                });

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
            this.departure = suggestion.formatted_address;
            this.departureCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.departureSuggestions = [];
        },

        selectDestination(suggestion) {
            this.destination = suggestion.formatted_address;
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
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'FuelTracker/1.0'
                }
            });
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
            // Helper function to escape CSV fields
            const escapeCsvField = (field) => {
                if (field == null) return '';
                const str = String(field);
                // If field contains comma, quote, or newline, wrap in quotes and escape quotes
                if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                return str;
            };

            let csv = 'Datum,Vertrek,Bestemming,Afstand,Kosten,Brandstof,Tankstation,Prijs\n';
            this.history.forEach(trip => {
                const stationName = this.fuelService.getStationName(trip.gasStation || 'average');
                const row = [
                    new Date(trip.date).toLocaleDateString('nl-BE'),
                    escapeCsvField(trip.departure),
                    escapeCsvField(trip.destination),
                    trip.distance,
                    trip.cost,
                    this.getFuelTypeName(trip.fuelType),
                    stationName,
                    trip.fuelPrice || 'N/A'
                ];
                csv += row.join(',') + '\n';
            });

            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fueltracker_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            URL.revokeObjectURL(url);
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
            const btnMobile = document.getElementById('themeToggleMobile');
            const html = document.documentElement;

            // Load saved theme from localStorage or use system preference
            const savedTheme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

            // Apply theme on load
            if (savedTheme === 'dark' || (!savedTheme && systemPrefersDark)) {
                html.classList.add('dark');
            } else {
                html.classList.remove('dark');
            }

            // Toggle function
            const toggleTheme = () => {
                html.classList.toggle('dark');
                const isDark = html.classList.contains('dark');
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                console.log('Theme switched to:', isDark ? 'dark' : 'light');
            };

            // Add event listeners to both buttons
            btn?.addEventListener('click', toggleTheme);
            btnMobile?.addEventListener('click', toggleTheme);
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