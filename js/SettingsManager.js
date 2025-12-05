/**
 * Settings Manager Module
 * Manages user preferences and settings with localStorage persistence
 */

class SettingsManager {
    constructor() {
        this.storageKey = 'jollykite-settings';
        this.defaultSettings = {
            // Wind speed units: 'knots', 'ms' (m/s), 'kmh' (km/h)
            windSpeedUnit: 'knots',

            // Temperature units: 'celsius', 'fahrenheit'
            temperatureUnit: 'fahrenheit',

            // Update interval in seconds
            updateInterval: 30,

            // Language: 'ru', 'en'
            language: 'ru'
        };

        this.settings = this.loadSettings();
        this.listeners = [];
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // Merge with defaults to ensure all keys exist
                return { ...this.defaultSettings, ...parsed };
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
        return { ...this.defaultSettings };
    }

    /**
     * Save settings to localStorage
     */
    saveSettings() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.settings));
            this.notifyListeners();
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    /**
     * Get a specific setting value
     */
    get(key) {
        return this.settings[key];
    }

    /**
     * Set a specific setting value
     */
    set(key, value) {
        if (this.settings.hasOwnProperty(key)) {
            this.settings[key] = value;
            this.saveSettings();
            return true;
        }
        console.warn(`Unknown setting key: ${key}`);
        return false;
    }

    /**
     * Get all settings
     */
    getAll() {
        return { ...this.settings };
    }

    /**
     * Reset settings to defaults
     */
    reset() {
        this.settings = { ...this.defaultSettings };
        this.saveSettings();
        console.log('✓ Settings reset to defaults');
    }

    /**
     * Register a listener for settings changes
     */
    addListener(callback) {
        if (typeof callback === 'function') {
            this.listeners.push(callback);
        }
    }

    /**
     * Remove a listener
     */
    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) {
            this.listeners.splice(index, 1);
        }
    }

    /**
     * Notify all listeners of settings change
     */
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.settings);
            } catch (error) {
                console.error('Error in settings listener:', error);
            }
        });
    }

    // Wind Speed Unit Conversions

    /**
     * Convert knots to the current wind speed unit
     */
    convertWindSpeed(knots) {
        const unit = this.settings.windSpeedUnit;

        switch (unit) {
            case 'ms':
                // 1 knot = 0.514444 m/s
                return knots * 0.514444;
            case 'kmh':
                // 1 knot = 1.852 km/h
                return knots * 1.852;
            case 'knots':
            default:
                return knots;
        }
    }

    /**
     * Get wind speed unit label
     */
    getWindSpeedUnitLabel(lang = 'ru') {
        const unit = this.settings.windSpeedUnit;
        const labels = {
            knots: {
                ru: 'узлов',
                en: 'knots'
            },
            ms: {
                ru: 'м/с',
                en: 'm/s'
            },
            kmh: {
                ru: 'км/ч',
                en: 'km/h'
            }
        };

        return labels[unit]?.[lang] || labels['knots'][lang];
    }

    /**
     * Get wind speed unit short label (for compact display)
     */
    getWindSpeedUnitShort() {
        const unit = this.settings.windSpeedUnit;
        const labels = {
            knots: 'kts',
            ms: 'm/s',
            kmh: 'km/h'
        };
        return labels[unit] || 'kts';
    }

    // Temperature Unit Conversions

    /**
     * Convert Fahrenheit to the current temperature unit
     */
    convertTemperature(fahrenheit) {
        const unit = this.settings.temperatureUnit;

        if (unit === 'celsius') {
            return (fahrenheit - 32) * (5/9);
        }

        return fahrenheit;
    }

    /**
     * Get temperature unit symbol
     */
    getTemperatureUnitSymbol() {
        return this.settings.temperatureUnit === 'celsius' ? '°C' : '°F';
    }

    // Update Interval

    /**
     * Get update interval in milliseconds
     */
    getUpdateIntervalMs() {
        return this.settings.updateInterval * 1000;
    }
}

export default SettingsManager;
