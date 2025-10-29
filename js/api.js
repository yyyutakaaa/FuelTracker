// FuelTracker - Fuel Price API Service

export class FuelPriceService {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.sources = [
            {
                name: 'primary',
                fetch: this.fetchPrimaryPrices.bind(this),
                description: 'StatBel API direct'
            },
            {
                name: 'secondary',
                fetch: this.fetchSecondaryPrices.bind(this),
                description: 'StatBel API via CORS proxy'
            },
            {
                name: 'fallback',
                fetch: this.fetchFallbackPrices.bind(this),
                description: 'Hardcoded October 2025 averages'
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
    
    // Get historical prices for chart
    async getHistoricalPrices(fuelType, days = 30) {
        // This would normally fetch from an API
        // For now, generating sample data
        const prices = [];
        const priceData = await this.getCurrentPrice(fuelType);
        const basePrice = typeof priceData === 'object' ? priceData.price : priceData;

        for (let i = days; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);

            // Simulate price fluctuation
            const variation = (Math.random() - 0.5) * 0.1;
            const price = basePrice + variation;

            prices.push({
                date: date.toISOString().split('T')[0],
                price: Math.max(0.5, price).toFixed(3)
            });
        }

        return prices;
    }
}