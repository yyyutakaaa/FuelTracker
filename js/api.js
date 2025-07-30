// FuelTracker - Fuel Price API Service

export class FuelPriceService {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 24 * 60 * 60 * 1000; // 24 hours
        this.sources = [
            {
                name: 'primary',
                fetch: this.fetchPrimaryPrices.bind(this)
            },
            {
                name: 'secondary',
                fetch: this.fetchSecondaryPrices.bind(this)
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
            return cached;
        }
        
        // Try each source in order
        for (const source of this.sources) {
            try {
                const price = await source.fetch(fuelType);
                if (price && price > 0) {
                    this.setCache(cacheKey, price);
                    return price;
                }
            } catch (error) {
                console.warn(`Failed to fetch from ${source.name}:`, error);
            }
        }
        
        // Final fallback prices (December 2024 Belgian averages)
        const fallbackPrices = {
            'euro95': 1.649,
            'euro98': 1.759,
            'diesel': 1.689,
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
        
        const response = await fetch(
            'https://bestat.statbel.fgov.be/bestat/api/views/665e2960-bf86-4d64-b4a8-90f2d30ea892/result/JSON',
            { timeout: 5000 }
        );
        
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
    
    async fetchSecondaryPrices(fuelType) {
        // Alternative API - European Commission Oil Bulletin
        const response = await fetch(
            'https://energy.ec.europa.eu/system/files/2024-12/weekly_oil_bulletin_prices_2024.xlsx',
            { timeout: 5000 }
        );
        
        // Since we can't parse Excel in browser easily, we'll use a proxy or simplified endpoint
        // For now, returning null to fall through to next source
        return null;
    }
    
    async fetchFallbackPrices(fuelType) {
        // Scrape from a fuel price comparison website
        // Note: In production, you'd want to use a proper API or your own backend
        try {
            const response = await fetch(
                `https://www.carbu.com/belgique/prixmoyens`,
                { 
                    mode: 'no-cors',
                    timeout: 3000 
                }
            );
            
            // Can't actually parse due to CORS, so returning null
            return null;
        } catch {
            return null;
        }
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
        const basePrice = await this.getCurrentPrice(fuelType);
        
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