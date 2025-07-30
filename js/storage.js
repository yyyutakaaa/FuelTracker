// FuelTracker - Storage Service

export class StorageService {
    constructor() {
        this.storageKey = 'fueltracker_history';
        this.settingsKey = 'fueltracker_settings';
    }
    
    // History methods
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
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading history:', error);
        }
        return [];
    }
    
    clearHistory() {
        try {
            localStorage.removeItem(this.storageKey);
            return true;
        } catch (error) {
            console.error('Error clearing history:', error);
            return false;
        }
    }
    
    // Settings methods
    saveSettings(settings) {
        try {
            localStorage.setItem(this.settingsKey, JSON.stringify(settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }
    
    loadSettings() {
        try {
            const data = localStorage.getItem(this.settingsKey);
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        
        // Default settings
        return {
            theme: 'light',
            defaultFuelType: 'euro95',
            defaultConsumption: null,
            language: 'nl',
            units: 'metric'
        };
    }
    
    // Favorites methods
    saveFavoriteRoute(route) {
        const favorites = this.getFavoriteRoutes();
        favorites.push({
            ...route,
            id: Date.now().toString(),
            addedAt: new Date().toISOString()
        });
        
        try {
            localStorage.setItem('fueltracker_favorites', JSON.stringify(favorites));
            return true;
        } catch (error) {
            console.error('Error saving favorite:', error);
            return false;
        }
    }
    
    getFavoriteRoutes() {
        try {
            const data = localStorage.getItem('fueltracker_favorites');
            if (data) {
                return JSON.parse(data);
            }
        } catch (error) {
            console.error('Error loading favorites:', error);
        }
        return [];
    }
    
    deleteFavoriteRoute(id) {
        const favorites = this.getFavoriteRoutes();
        const filtered = favorites.filter(fav => fav.id !== id);
        
        try {
            localStorage.setItem('fueltracker_favorites', JSON.stringify(filtered));
            return true;
        } catch (error) {
            console.error('Error deleting favorite:', error);
            return false;
        }
    }
    
    // Export/Import methods
    exportData() {
        const data = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            history: this.loadHistory(),
            settings: this.loadSettings(),
            favorites: this.getFavoriteRoutes()
        };
        
        return JSON.stringify(data, null, 2);
    }
    
    importData(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            
            if (data.history) {
                this.saveHistory(data.history);
            }
            if (data.settings) {
                this.saveSettings(data.settings);
            }
            if (data.favorites) {
                localStorage.setItem('fueltracker_favorites', JSON.stringify(data.favorites));
            }
            
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }
    
    // Storage info
    getStorageInfo() {
        let totalSize = 0;
        
        for (const key in localStorage) {
            if (key.startsWith('fueltracker_')) {
                const item = localStorage.getItem(key);
                totalSize += item ? item.length : 0;
            }
        }
        
        return {
            totalSize: totalSize,
            formattedSize: this.formatBytes(totalSize),
            itemCount: this.loadHistory().length
        };
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}