/**
 * Backend Data Manager
 * Handles API calls to Vercel Functions backend and external sources
 */

import config from './config.js';
import WindUtils from './utils/WindUtils.js';

export default class BackendDataManager {
    constructor() {
        // Determine API base URL based on environment
        this.apiBaseUrl = this.getApiBaseUrl();
        this.isBackendAvailable = false;
        this.lastFetchTime = null;
        this.currentSource = config.dataSource.default;
    }

    /**
     * Get API base URL
     */
    getApiBaseUrl() {
        // In production (GitHub Pages or Vercel)
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            // If deployed on GitHub Pages, use Vercel domain for API
            if (window.location.hostname.includes('github.io')) {
                return 'https://jollykite1.vercel.app';
            }
            // If deployed on Vercel, use relative paths
            return '';
        }
        // In development, use localhost or configure custom backend URL
        return 'http://localhost:3000';
    }

    /**
     * Check if backend is available
     */
    async checkBackendHealth() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/wind-history?limit=1`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            this.isBackendAvailable = response.ok;
            return this.isBackendAvailable;
        } catch (error) {
            console.warn('Backend not available, will use direct API calls:', error.message);
            this.isBackendAvailable = false;
            return false;
        }
    }

    /**
     * Get latest wind data from backend
     */
    async getLatestWindData() {
        if (!this.isBackendAvailable) {
            await this.checkBackendHealth();
        }

        if (!this.isBackendAvailable) {
            throw new Error('Backend not available');
        }

        try {
            const response = await fetch(`${this.apiBaseUrl}/api/wind-history?limit=1&hours=1`);

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success || !data.latest) {
                throw new Error('No data available from backend');
            }

            this.lastFetchTime = new Date();

            // Convert backend format to app format
            return this.convertBackendData(data.latest);

        } catch (error) {
            console.error('Error fetching from backend:', error);
            throw error;
        }
    }

    /**
     * Get wind history
     */
    async getWindHistory(hours = 24, limit = 100) {
        if (!this.isBackendAvailable) {
            await this.checkBackendHealth();
        }

        if (!this.isBackendAvailable) {
            return [];
        }

        try {
            const response = await fetch(
                `${this.apiBaseUrl}/api/wind-history?hours=${hours}&limit=${limit}`
            );

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();

            if (!data.success) {
                throw new Error('Failed to fetch history');
            }

            return {
                history: data.history.map(item => this.convertBackendData(item)),
                stats: data.stats,
                meta: data.meta
            };

        } catch (error) {
            console.error('Error fetching history:', error);
            return [];
        }
    }

    /**
     * Convert backend data format to frontend format
     */
    convertBackendData(backendData) {
        return {
            windSpeedKnots: parseFloat(backendData.wind_speed_knots) || 0,
            windGustKnots: parseFloat(backendData.wind_gust_knots) || 0,
            maxGustKnots: parseFloat(backendData.max_gust_knots) || 0,
            windDir: parseInt(backendData.wind_direction) || 0,
            windDirAvg: parseInt(backendData.wind_direction_avg) || 0,
            temperature: parseFloat(backendData.temperature_f) || 0,
            humidity: parseInt(backendData.humidity) || 0,
            pressure: parseFloat(backendData.pressure) || 0,
            timestamp: new Date(backendData.timestamp),
            safety: {
                level: backendData.safety_level,
                text: backendData.safety_text,
                color: backendData.safety_color,
                isOffshore: backendData.is_offshore,
                isOnshore: backendData.is_onshore
            }
        };
    }

    /**
     * Get backend status
     */
    getStatus() {
        return {
            isAvailable: this.isBackendAvailable,
            apiBaseUrl: this.apiBaseUrl,
            lastFetchTime: this.lastFetchTime,
            currentSource: this.currentSource
        };
    }

    /**
     * Set data source
     */
    setSource(source) {
        if (config.dataSource.sources[source]) {
            this.currentSource = source;
            console.log(`✓ Data source switched to: ${source}`);
            return true;
        }
        console.warn(`⚠ Invalid data source: ${source}`);
        return false;
    }

    /**
     * Get current data source
     */
    getSource() {
        return this.currentSource;
    }

    /**
     * Fetch data from Windguru station via backend proxy
     */
    async fetchWindguruData() {
        try {
            const stationId = config.api.windguru.match(/station\/(\d+)/)?.[1] || '5725';
            const response = await fetch(`${this.apiBaseUrl}/api/windguru-proxy?station=${stationId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Windguru proxy error: ${response.status}`);
            }

            const result = await response.json();

            if (!result.success || !result.data) {
                throw new Error('No data available from Windguru');
            }

            this.lastFetchTime = new Date();

            // Data is already in the correct format from the proxy
            return result.data;

        } catch (error) {
            console.error('Error fetching Windguru data:', error);
            throw error;
        }
    }

    /**
     * Get data from current source
     */
    async getCurrentSourceData() {
        if (this.currentSource === 'windguru') {
            return await this.fetchWindguruData();
        } else {
            // Default to backend/Ambient Weather data
            return await this.getLatestWindData();
        }
    }
}
