import WindUtils from './utils/WindUtils.js';

/**
 * HistoryDisplay - Displays wind history table
 */
class HistoryDisplay {
    constructor(historyManager, languageManager, settingsManager = null) {
        this.historyManager = historyManager;
        this.languageManager = languageManager;
        this.settingsManager = settingsManager;
        this.containerId = 'windHistory';
        this.maxDisplayEntries = 20; // Show last 20 entries
        this.autoUpdateInterval = null;
    }

    /**
     * Initialize the history display
     */
    init() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.warn('History container not found');
            return false;
        }

        // Display initial history
        this.displayHistory();

        // Auto-update every minute
        this.autoUpdateInterval = setInterval(() => {
            this.displayHistory();
        }, 60000); // Update every 60 seconds

        console.log('✓ History display initialized');
        return true;
    }

    /**
     * Display wind history table
     */
    displayHistory() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const history = this.historyManager.getHistory();
        const displayData = history.slice(0, this.maxDisplayEntries);

        if (displayData.length === 0) {
            this.showEmptyState();
            return;
        }

        const t = (key) => this.languageManager.t(key);

        // Build table HTML
        const tableHTML = `
            <div class="history-table-wrapper">
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>${t('time')}</th>
                            <th>${t('speed')}</th>
                            <th>${t('gusts')}</th>
                            <th>${t('direction')}</th>
                            <th>${t('status')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${displayData.map(entry => this.renderHistoryRow(entry)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="history-footer">
                <span class="history-count">
                    ${t('showing')} ${displayData.length} ${t('of')} ${history.length} ${t('entries')}
                </span>
                <button id="clearHistoryBtn" class="clear-history-btn">
                    🗑️ ${t('clearHistory')}
                </button>
            </div>
        `;

        container.innerHTML = tableHTML;

        // Add clear button event listener
        const clearBtn = document.getElementById('clearHistoryBtn');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.confirmClearHistory());
        }
    }

    /**
     * Render a single history row
     */
    renderHistoryRow(entry) {
        const time = this.formatTime(entry.timestamp);

        // Convert speed to user's preferred units
        const displaySpeed = this.settingsManager ? this.settingsManager.convertWindSpeed(entry.windSpeed) : entry.windSpeed;
        const displayGust = (entry.windGust && this.settingsManager) ? this.settingsManager.convertWindSpeed(entry.windGust) : entry.windGust;

        const speed = displaySpeed.toFixed(1);
        const gust = displayGust ? displayGust.toFixed(1) : '--';
        const direction = WindUtils.degreesToCardinal(entry.windDirection);
        const directionDeg = entry.windDirection.toFixed(0);

        // Get safety color based on offshore/onshore
        let statusColor = '#87CEEB';
        if (entry.safety) {
            if (entry.safety.isOffshore) {
                statusColor = '#FF4500'; // Red for offshore (dangerous)
            } else if (entry.safety.isOnshore) {
                statusColor = '#00FF00'; // Green for onshore (safe)
            } else {
                statusColor = '#FFD700'; // Yellow for sideshore
            }
        }

        // Create wind arrow pointing in the direction wind is COMING FROM
        // Wind direction in degrees (0° = North, 90° = East, 180° = South, 270° = West)
        const arrowRotation = entry.windDirection;

        return `
            <tr>
                <td class="time-cell">${time}</td>
                <td class="speed-cell">${speed}</td>
                <td class="gust-cell">${gust}</td>
                <td class="direction-cell">
                    <span class="cardinal">${direction}</span>
                    <span class="degrees">${directionDeg}°</span>
                </td>
                <td class="status-cell">
                    <div class="wind-direction-arrow" style="transform: rotate(${arrowRotation}deg); color: ${statusColor};" title="${direction} ${directionDeg}°">
                        ↓
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Format timestamp for display
     */
    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMinutes = Math.floor((now - date) / 60000);

        // If less than 1 hour ago, show relative time
        if (diffMinutes < 60) {
            if (diffMinutes === 0) {
                return this.languageManager.t('justNow');
            } else if (diffMinutes === 1) {
                return this.languageManager.t('oneMinuteAgo');
            } else {
                const currentLang = this.languageManager.getCurrentLanguage();
                if (currentLang === 'ru') {
                    return `${diffMinutes} мин назад`;
                } else {
                    return `${diffMinutes} min ago`;
                }
            }
        }

        // Otherwise show time
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    /**
     * Show empty state when no history
     */
    showEmptyState() {
        const container = document.getElementById(this.containerId);
        if (!container) return;

        const t = (key) => this.languageManager.t(key);

        container.innerHTML = `
            <div class="history-empty-state">
                <div class="empty-icon">📊</div>
                <p>${t('noHistoryYet')}</p>
                <p class="empty-subtitle">${t('historyWillAppear')}</p>
            </div>
        `;
    }

    /**
     * Confirm before clearing history
     */
    confirmClearHistory() {
        const t = (key) => this.languageManager.t(key);
        const confirmed = confirm(t('confirmClearHistory'));

        if (confirmed) {
            this.historyManager.clearHistory();
            this.displayHistory();
            console.log('✓ History cleared');
        }
    }

    /**
     * Refresh the display
     */
    refresh() {
        this.displayHistory();
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
            this.autoUpdateInterval = null;
        }
    }
}

export default HistoryDisplay;
