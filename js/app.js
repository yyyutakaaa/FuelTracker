// FuelTracker application

import { CO2_FACTORS_KG_PER_LITRE, calculateTripMetrics } from './calculations.js';
import {
    EUROPE_COUNTRY_CODES_QUERY,
    filterAllowedGeocodingResults,
    findFirstAllowedGeocodingResult,
    formatGeocodingSuggestions
} from './geocoding.js';

const { createApp } = Vue;

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const externalSignal = options.signal;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromExternalSignal = () => controller.abort();

    if (externalSignal) {
        if (externalSignal.aborted) controller.abort();
        else externalSignal.addEventListener('abort', abortFromExternalSignal, { once: true });
    }

    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
        externalSignal?.removeEventListener('abort', abortFromExternalSignal);
    }
}

function escapeHtml(value) {
    const element = document.createElement('div');
    element.textContent = String(value ?? '');
    return element.innerHTML;
}

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
        this.profileKey = 'fueltracker_vehicle_profiles';
        this.defaultsKey = 'fueltracker_vehicle_defaults';
        this.favoritesKey = 'fueltracker_favorites';
        this.recentsKey = 'fueltracker_recent_routes';
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

    save(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error(`Error saving ${key}:`, error);
            return false;
        }
    }

    load(key, fallback = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch (error) {
            console.error(`Error loading ${key}:`, error);
            return fallback;
        }
    }
}

class MapService {
    constructor() {
        this.map = null;
        this.routeLayer = null;
        this.markersLayer = null;
        this.container = null;
    }
    
    initMap() {
        const container = document.getElementById('map');
        if (!container || typeof L === 'undefined') return false;

        if (this.map && this.container === container) {
            this.map.invalidateSize();
            return true;
        }

        this.destroy();
        if (container._leaflet_id) delete container._leaflet_id;
        
        this.container = container;
        this.map = L.map(container, {
            center: [50.8503, 4.3517],
            zoom: 8
        });
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors'
        }).addTo(this.map);
        
        this.routeLayer = L.layerGroup().addTo(this.map);
        this.markersLayer = L.layerGroup().addTo(this.map);
        return true;
    }
    
    drawRoute(geometry, startCoords, endCoords, startName, endName) {
        if (!this.map || !this.routeLayer || !this.markersLayer) return;
        
        this.routeLayer.clearLayers();
        this.markersLayer.clearLayers();
        
        // Add markers
        L.marker([startCoords.lat, startCoords.lon])
            .bindPopup(`<strong>Vertrek:</strong><br>${escapeHtml(startName)}`)
            .addTo(this.markersLayer);
        
        L.marker([endCoords.lat, endCoords.lon])
            .bindPopup(`<strong>Bestemming:</strong><br>${escapeHtml(endName)}`)
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

    destroy() {
        if (this.map) this.map.remove();
        this.map = null;
        this.routeLayer = null;
        this.markersLayer = null;
        this.container = null;
    }
}

class ChartService {
    constructor() {
        this.chart = null;
    }
    
    updateChart(history) {
        const ctx = document.getElementById('costChart');
        if (typeof Chart === 'undefined') return;
        if (!ctx || history.length === 0) {
            this.destroy();
            return;
        }
        
        this.destroy();

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

    destroy() {
        if (this.chart) this.chart.destroy();
        this.chart = null;
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
            vehicleName: '',
            roundTrip: false,
            passengers: 1,
            
            // Autocomplete
            departureSuggestions: [],
            destinationSuggestions: [],
            departureSearchStatus: 'idle',
            destinationSearchStatus: 'idle',
            departureFocused: false,
            destinationFocused: false,
            departureCoords: null,
            destinationCoords: null,
            
            // State
            isCalculating: false,
            result: null,
            history: [],
            vehicleProfiles: [],
            favoriteRoutes: [],
            recentRoutes: [],
            appError: '',
            toast: null,
            deletedTrip: null,
            
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
            priceRefreshInterval: null,
            toastTimer: null,
            undoTimer: null,
            departureRequestId: 0,
            destinationRequestId: 0,
            departureAbortController: null,
            destinationAbortController: null,
            priceRequestId: 0
        };
    },
    
    mounted() {
        console.log('App mounting...');
        
        // Initialize services
        this.fuelService = new FuelPriceService();
        this.storageService = new StorageService();
        this.mapService = new MapService();
        this.chartService = new ChartService();
        
        // Load history
        const storedHistory = this.storageService.loadHistory();
        const storedProfiles = this.storageService.load(this.storageService.profileKey, []);
        const storedFavorites = this.storageService.load(this.storageService.favoritesKey, []);
        const storedRecents = this.storageService.load(this.storageService.recentsKey, []);
        this.history = Array.isArray(storedHistory) ? storedHistory : [];
        this.vehicleProfiles = Array.isArray(storedProfiles) ? storedProfiles : [];
        this.favoriteRoutes = Array.isArray(storedFavorites) ? storedFavorites : [];
        this.recentRoutes = Array.isArray(storedRecents) ? storedRecents : [];

        const defaults = this.storageService.load(this.storageService.defaultsKey, null);
        if (defaults) {
            this.applyVehicleDefaults(defaults);
        } else {
            const legacySettings = this.storageService.load('fueltracker_settings', null);
            if (legacySettings) {
                this.applyVehicleDefaults({
                    vehicleName: legacySettings.vehicleName || '',
                    consumption: legacySettings.defaultConsumption ?? legacySettings.consumption,
                    fuelType: legacySettings.defaultFuelType || legacySettings.fuelType
                });
            }
        }

        // Get initial fuel price
        this.updateFuelPrice();

        // Setup automatic price refresh every 6 hours
        this.priceRefreshInterval = setInterval(() => {
            this.updateFuelPrice(true);
        }, 6 * 60 * 60 * 1000);

        // The map only exists after a result is rendered. The chart can be
        // initialized immediately when persisted history is present.
        this.$nextTick(() => {
            this.mapService.initMap();
            this.chartService.updateChart(this.history);
        });
        
        // Setup UI
        this.setupThemeToggle();
        this.setupMobileMenu();
        
        // Hide loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) loadingScreen.style.display = 'none';
        
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
        },
        costPerPerson() {
            return this.result?.costPerPerson || '0.00';
        },
        favorites() {
            return this.favoriteRoutes;
        },
        appMessage() {
            if (this.toast) return { text: this.toast.message, type: this.toast.type };
            if (this.appError) return { text: this.appError, type: 'error' };
            return null;
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
            const requestId = ++this.priceRequestId;
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
                if (requestId !== this.priceRequestId) return;

                // Extract price and source info
                const basePrice = typeof priceData === 'object' ? priceData.price : priceData;
                const source = typeof priceData === 'object' ? (priceData.description || 'Unknown') : 'Unknown';

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
                if (requestId !== this.priceRequestId) return;
                this.priceSource = 'Error loading price';
                this.showError('De actuele brandstofprijs kon niet worden geladen. De laatst bekende prijs blijft actief.');
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
                this.showError('Fout bij het ophalen van de brandstofprijs.');
            } finally {
                this.isRefreshingPrice = false;
            }
        },

        showError(message) {
            this.appError = String(message || 'Er is iets misgegaan.');
            this.showToast(this.appError, 'error', 6000);
        },

        clearError() {
            this.appError = '';
        },

        showToast(message, type = 'info', duration = 4000) {
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toast = { message: String(message), type };
            if (duration > 0) {
                this.toastTimer = setTimeout(() => {
                    this.toast = null;
                    this.toastTimer = null;
                }, duration);
            }
        },

        dismissToast() {
            if (this.toastTimer) clearTimeout(this.toastTimer);
            this.toastTimer = null;
            this.toast = null;
        },

        // Autocomplete
        searchDeparture() {
            // @input only fires for manual edits, not when selectDeparture sets
            // the model. Any previously selected coordinates are now stale.
            this.departureCoords = null;
            this.clearError();
            this.departureAbortController?.abort();
            clearTimeout(this.departureTimer);
            const query = this.departure.trim();
            if (query.length < 3) {
                this.departureSuggestions = [];
                this.departureSearchStatus = 'idle';
                return;
            }
            this.departureSearchStatus = 'loading';
            const requestId = ++this.departureRequestId;
            this.departureTimer = setTimeout(() => {
                this.fetchSuggestions(query, 'departure', requestId);
            }, 300);
        },
        
        searchDestination() {
            this.destinationCoords = null;
            this.clearError();
            this.destinationAbortController?.abort();
            clearTimeout(this.destinationTimer);
            const query = this.destination.trim();
            if (query.length < 3) {
                this.destinationSuggestions = [];
                this.destinationSearchStatus = 'idle';
                return;
            }
            this.destinationSearchStatus = 'loading';
            const requestId = ++this.destinationRequestId;
            this.destinationTimer = setTimeout(() => {
                this.fetchSuggestions(query, 'destination', requestId);
            }, 300);
        },
        
        async fetchSuggestions(query, type, requestId = null) {
            const idKey = type === 'departure' ? 'departureRequestId' : 'destinationRequestId';
            const controllerKey = type === 'departure' ? 'departureAbortController' : 'destinationAbortController';
            const inputKey = type === 'departure' ? 'departure' : 'destination';
            const suggestionsKey = type === 'departure' ? 'departureSuggestions' : 'destinationSuggestions';
            const statusKey = type === 'departure' ? 'departureSearchStatus' : 'destinationSearchStatus';

            this[controllerKey]?.abort();
            const controller = new AbortController();
            this[controllerKey] = controller;
            const activeRequestId = requestId ?? ++this[idKey];

            try {
                const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&countrycodes=${EUROPE_COUNTRY_CODES_QUERY}&limit=18&addressdetails=1&namedetails=1&accept-language=nl-BE,nl,en`;
                const response = await fetchWithTimeout(url, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.6'
                    }
                }, 8000);
                if (!response.ok) throw new Error(`Adresdienst gaf HTTP ${response.status}`);
                const data = await response.json();
                if (!Array.isArray(data)) throw new Error('Ongeldig antwoord van de adresdienst');

                if (controller.signal.aborted || activeRequestId !== this[idKey] || this[inputKey].trim() !== query) {
                    return;
                }

                const suggestions = formatGeocodingSuggestions(filterAllowedGeocodingResults(data), 6);

                this[suggestionsKey] = suggestions;
                this[statusKey] = suggestions.length ? 'ready' : 'empty';
            } catch (error) {
                if (error.name === 'AbortError') return;
                console.error('Error fetching suggestions:', error);
                if (activeRequestId === this[idKey]) {
                    this[suggestionsKey] = [];
                    this[statusKey] = 'error';
                }
            } finally {
                if (this[controllerKey] === controller) this[controllerKey] = null;
            }
        },
        
        selectDeparture(suggestion) {
            this.departureAbortController?.abort();
            this.departureRequestId++;
            this.departure = suggestion.formatted_address;
            this.departureCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.departureSuggestions = [];
            this.departureSearchStatus = 'idle';
        },

        selectDestination(suggestion) {
            this.destinationAbortController?.abort();
            this.destinationRequestId++;
            this.destination = suggestion.formatted_address;
            this.destinationCoords = { lat: suggestion.lat, lon: suggestion.lon };
            this.destinationSuggestions = [];
            this.destinationSearchStatus = 'idle';
        },
        
        handleDepartureBlur() {
            setTimeout(() => this.departureFocused = false, 200);
        },
        
        handleDestinationBlur() {
            setTimeout(() => this.destinationFocused = false, 200);
        },
        
        // Calculate
        async calculateTrip() {
            this.clearError();
            const consumption = Number(this.consumption);
            const passengers = Math.min(9, Math.max(1, Math.floor(Number(this.passengers) || 1)));
            this.passengers = passengers;

            if (!this.departure.trim() || !this.destination.trim() || !Number.isFinite(consumption) || consumption < 2 || consumption > 25) {
                this.showError('Vul vertrek, bestemming en een verbruik tussen 2 en 25 L/100 km in.');
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
                const fuelPrice = Number(this.currentFuelPrice);
                if (!Number.isFinite(fuelPrice) || fuelPrice <= 0) throw new Error('De brandstofprijs is ongeldig.');
                const {
                    distanceKm,
                    durationMin,
                    fuelNeeded,
                    cost,
                    costPerPerson,
                    co2,
                    co2Factor
                } = calculateTripMetrics({
                    oneWayDistanceMeters: route.distance,
                    oneWayDurationSeconds: route.duration,
                    consumption,
                    fuelPrice,
                    fuelType: this.fuelType,
                    roundTrip: this.roundTrip,
                    passengers
                });
                
                this.result = {
                    distance: distanceKm.toFixed(1),
                    duration: Math.round(durationMin),
                    cost: cost.toFixed(2),
                    costPerPerson: costPerPerson.toFixed(2),
                    fuelNeeded: fuelNeeded.toFixed(2),
                    consumption: consumption.toFixed(1),
                    fuelPrice: fuelPrice.toFixed(3),
                    co2: co2.toFixed(1),
                    co2Factor,
                    roundTrip: this.roundTrip,
                    passengers,
                    vehicleName: this.vehicleName.trim()
                };
                
                // The result section uses v-if, so wait until #map exists.
                await this.$nextTick();
                if (this.mapService.initMap()) {
                    this.mapService.drawRoute(
                        route.geometry,
                        this.departureCoords,
                        this.destinationCoords,
                        this.departure,
                        this.destination
                    );
                }
                
                // Save to history
                const trip = {
                    id: `trip-${Date.now()}`,
                    departure: this.departure,
                    destination: this.destination,
                    distance: distanceKm.toFixed(1),
                    duration: Math.round(durationMin),
                    cost: cost.toFixed(2),
                    costPerPerson: costPerPerson.toFixed(2),
                    consumption: consumption.toFixed(1),
                    fuelNeeded: fuelNeeded.toFixed(2),
                    fuelType: this.fuelType,
                    gasStation: this.gasStation,
                    fuelPrice: fuelPrice.toFixed(3),
                    date: new Date().toISOString(),
                    co2: co2.toFixed(1),
                    co2Factor,
                    roundTrip: this.roundTrip,
                    passengers,
                    vehicleName: this.vehicleName.trim()
                };
                
                this.history.push(trip);
                this.storageService.saveHistory(this.history);
                this.addRecentRoute();
                await this.$nextTick();
                this.chartService.updateChart(this.history);
                this.showToast('Rit berekend en aan je geschiedenis toegevoegd.', 'success');
                
            } catch (error) {
                console.error('Error calculating trip:', error);
                this.showError(error.message || 'De rit kon niet worden berekend.');
            } finally {
                this.isCalculating = false;
            }
        },
        
        async geocodeAddress(address) {
            const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(address)}&countrycodes=${EUROPE_COUNTRY_CODES_QUERY}&limit=12&addressdetails=1&namedetails=1&accept-language=nl-BE,nl,en`;
            const response = await fetchWithTimeout(url, {
                headers: {
                    'Accept': 'application/json',
                    'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.6'
                }
            }, 10000);
            if (!response.ok) throw new Error(`Adresdienst gaf HTTP ${response.status}`);
            const data = await response.json();
            
            const result = findFirstAllowedGeocodingResult(data);
            if (result) {
                const lat = parseFloat(result.lat);
                const lon = parseFloat(result.lon);
                if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                return {
                    lat,
                    lon
                };
            }
            return null;
        },
        
        async getRoute(start, end) {
            const url = `https://router.project-osrm.org/route/v1/driving/${start.lon},${start.lat};${end.lon},${end.lat}?overview=full&geometries=geojson`;
            const response = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 15000);
            if (!response.ok) throw new Error(`Routedienst gaf HTTP ${response.status}`);
            const data = await response.json();
            
            if (data && data.code === 'Ok' && data.routes && data.routes.length > 0) {
                return data.routes[0];
            }
            return null;
        },

        // Vehicle profiles and defaults
        applyVehicleDefaults(defaults) {
            if (!defaults || typeof defaults !== 'object') return;
            if (typeof defaults.vehicleName === 'string') this.vehicleName = defaults.vehicleName;
            if (Number(defaults.consumption) >= 2 && Number(defaults.consumption) <= 25) {
                this.consumption = Number(defaults.consumption);
            }
            if (CO2_FACTORS_KG_PER_LITRE[defaults.fuelType]) this.fuelType = defaults.fuelType;
        },

        saveVehicleDefaults() {
            const consumption = Number(this.consumption);
            if (!Number.isFinite(consumption) || consumption < 2 || consumption > 25) {
                this.showError('Vul eerst een geldig voertuigverbruik tussen 2 en 25 L/100 km in.');
                return false;
            }
            const defaults = {
                vehicleName: this.vehicleName.trim(),
                consumption,
                fuelType: this.fuelType
            };
            const saved = this.storageService.save(this.storageService.defaultsKey, defaults);
            if (saved) this.showToast('Voertuig als standaard ingesteld.', 'success');
            else this.showError('Het standaardvoertuig kon niet worden opgeslagen.');
            return saved;
        },

        saveVehicleProfile(profileData = null) {
            const source = profileData && typeof profileData === 'object' && 'consumption' in profileData ? profileData : this;
            const consumption = Number(source.consumption);
            const vehicleName = String(source.vehicleName || '').trim();
            const fuelType = source.fuelType;
            if (!vehicleName || !Number.isFinite(consumption) || consumption < 2 || consumption > 25 || !CO2_FACTORS_KG_PER_LITRE[fuelType]) {
                this.showError('Geef het voertuig een naam en een geldig verbruik tussen 2 en 25 L/100 km.');
                return null;
            }

            const existing = this.vehicleProfiles.find(profile => String(profile.vehicleName || '').toLowerCase() === vehicleName.toLowerCase());
            const profile = {
                id: existing?.id || `vehicle-${Date.now()}`,
                vehicleName,
                consumption,
                fuelType,
                updatedAt: new Date().toISOString()
            };
            if (existing) Object.assign(existing, profile);
            else this.vehicleProfiles.push(profile);

            if (!this.storageService.save(this.storageService.profileKey, this.vehicleProfiles)) {
                this.showError('Het voertuigprofiel kon niet worden opgeslagen.');
                return null;
            }
            this.showToast(`Voertuigprofiel “${vehicleName}” opgeslagen.`, 'success');
            return profile;
        },

        applyVehicleProfile(profileOrId) {
            const profile = typeof profileOrId === 'string'
                ? this.vehicleProfiles.find(item => item.id === profileOrId)
                : profileOrId;
            if (!profile) return false;
            this.applyVehicleDefaults(profile);
            this.showToast(`Voertuigprofiel “${profile.vehicleName}” toegepast.`, 'success');
            return true;
        },

        deleteVehicleProfile(profileOrId) {
            const id = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
            const index = this.vehicleProfiles.findIndex(profile => profile.id === id);
            if (index < 0) return false;
            const [removed] = this.vehicleProfiles.splice(index, 1);
            this.storageService.save(this.storageService.profileKey, this.vehicleProfiles);
            this.showToast(`Voertuigprofiel “${removed.vehicleName}” verwijderd.`, 'info');
            return true;
        },

        // Favorite and recent routes
        routeKey(route) {
            return `${String(route?.departure || '').trim().toLowerCase()}::${String(route?.destination || '').trim().toLowerCase()}`;
        },

        currentRouteData() {
            return {
                departure: this.departure.trim(),
                destination: this.destination.trim(),
                departureCoords: this.departureCoords ? { ...this.departureCoords } : null,
                destinationCoords: this.destinationCoords ? { ...this.destinationCoords } : null
            };
        },

        addRecentRoute(routeData = null) {
            const route = routeData && routeData.departure !== undefined ? routeData : this.currentRouteData();
            if (!route.departure || !route.destination) return null;
            const key = this.routeKey(route);
            this.recentRoutes = this.recentRoutes.filter(item => this.routeKey(item) !== key);
            const recent = {
                ...route,
                id: `recent-${Date.now()}`,
                lastUsedAt: new Date().toISOString()
            };
            this.recentRoutes.unshift(recent);
            this.recentRoutes = this.recentRoutes.slice(0, 8);
            this.storageService.save(this.storageService.recentsKey, this.recentRoutes);
            return recent;
        },

        saveFavoriteRoute(routeData = null) {
            const route = routeData && routeData.departure !== undefined ? routeData : this.currentRouteData();
            if (!route.departure || !route.destination) {
                this.showError('Vul eerst een vertrekpunt en bestemming in.');
                return null;
            }
            const key = this.routeKey(route);
            const existing = this.favoriteRoutes.find(item => this.routeKey(item) === key);
            if (existing) return existing;
            const favorite = {
                ...route,
                id: `favorite-${Date.now()}`,
                createdAt: new Date().toISOString()
            };
            this.favoriteRoutes.unshift(favorite);
            this.storageService.save(this.storageService.favoritesKey, this.favoriteRoutes);
            this.showToast('Route toegevoegd aan favorieten.', 'success');
            return favorite;
        },

        deleteFavoriteRoute(routeOrId) {
            const id = typeof routeOrId === 'string' ? routeOrId : routeOrId?.id;
            const key = typeof routeOrId === 'object' ? this.routeKey(routeOrId) : null;
            const index = this.favoriteRoutes.findIndex(item => item.id === id || (key && this.routeKey(item) === key));
            if (index < 0) return false;
            this.favoriteRoutes.splice(index, 1);
            this.storageService.save(this.storageService.favoritesKey, this.favoriteRoutes);
            this.showToast('Route uit favorieten verwijderd.', 'info');
            return true;
        },

        isFavoriteRoute(routeData = null) {
            const route = routeData && routeData.departure !== undefined ? routeData : this.currentRouteData();
            const key = this.routeKey(route);
            return Boolean(route.departure && route.destination && this.favoriteRoutes.some(item => this.routeKey(item) === key));
        },

        toggleFavoriteRoute(routeData = null) {
            const route = routeData && routeData.departure !== undefined ? routeData : this.currentRouteData();
            return this.isFavoriteRoute(route) ? this.deleteFavoriteRoute(route) : this.saveFavoriteRoute(route);
        },

        // UI-friendly aliases retained alongside the explicit route methods.
        saveCurrentAsFavorite() {
            return this.saveFavoriteRoute();
        },

        applyFavorite(favorite) {
            return this.applySavedRoute(favorite);
        },

        deleteFavorite(id) {
            return this.deleteFavoriteRoute(id);
        },

        applySavedRoute(route) {
            if (!route) return false;
            this.departure = route.departure || '';
            this.destination = route.destination || '';
            this.departureCoords = route.departureCoords ? { ...route.departureCoords } : null;
            this.destinationCoords = route.destinationCoords ? { ...route.destinationCoords } : null;
            this.departureSuggestions = [];
            this.destinationSuggestions = [];
            return true;
        },

        swapLocations() {
            [this.departure, this.destination] = [this.destination, this.departure];
            [this.departureCoords, this.destinationCoords] = [this.destinationCoords, this.departureCoords];
            [this.departureSuggestions, this.destinationSuggestions] = [[], []];
        },
        
        async deleteTrip(index) {
            const actualIndex = this.history.length - 1 - index;
            if (actualIndex < 0 || actualIndex >= this.history.length) return;
            const [trip] = this.history.splice(actualIndex, 1);
            this.deletedTrip = { trip, index: actualIndex };
            this.storageService.saveHistory(this.history);
            await this.$nextTick();
            this.chartService.updateChart(this.history);
            if (this.undoTimer) clearTimeout(this.undoTimer);
            this.undoTimer = setTimeout(() => {
                this.deletedTrip = null;
                this.undoTimer = null;
            }, 8000);
            this.showToast('Rit verwijderd. Je kunt dit nog ongedaan maken.', 'info', 8000);
        },

        async undoDeleteTrip() {
            if (!this.deletedTrip) return false;
            const { trip, index } = this.deletedTrip;
            this.history.splice(Math.min(index, this.history.length), 0, trip);
            this.deletedTrip = null;
            if (this.undoTimer) clearTimeout(this.undoTimer);
            this.undoTimer = null;
            this.storageService.saveHistory(this.history);
            await this.$nextTick();
            this.chartService.updateChart(this.history);
            this.showToast('Verwijderde rit hersteld.', 'success');
            return true;
        },

        undoDelete() {
            return this.undoDeleteTrip();
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

            let csv = 'Datum,Vertrek,Bestemming,Afstand (km),Duur (min),Kosten,Per persoon,Verbruik (L/100km),Liters,Brandstof,Tankstation,Prijs,Retour,Passagiers,CO2 (kg),Voertuig\n';
            this.history.forEach(trip => {
                const stationName = this.fuelService.getStationName(trip.gasStation || 'average');
                const row = [
                    new Date(trip.date).toLocaleDateString('nl-BE'),
                    escapeCsvField(trip.departure),
                    escapeCsvField(trip.destination),
                    trip.distance,
                    trip.duration ?? '',
                    trip.cost,
                    trip.costPerPerson ?? trip.cost,
                    trip.consumption ?? '',
                    trip.fuelNeeded ?? '',
                    this.getFuelTypeName(trip.fuelType),
                    stationName,
                    trip.fuelPrice || 'N/A',
                    trip.roundTrip ? 'Ja' : 'Nee',
                    trip.passengers || 1,
                    trip.co2 ?? '',
                    escapeCsvField(trip.vehicleName || '')
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
        if (this.toastTimer) clearTimeout(this.toastTimer);
        if (this.undoTimer) clearTimeout(this.undoTimer);
        this.departureAbortController?.abort();
        this.destinationAbortController?.abort();
        this.mapService?.destroy();
        this.chartService?.destroy();
    }
}).mount('#app');
