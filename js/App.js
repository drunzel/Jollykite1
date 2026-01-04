import config from './config.js';
import WindUtils from './utils/WindUtils.js';
import WindDataManager from './WindDataManager.js';
import MapController from './MapController.js';
import ForecastManager from './ForecastManager.js';
import WindArrowController from './WindArrowController.js';
import HistoryManager from './HistoryManager.js';
import WindStatistics from './WindStatistics.js';
import LanguageManager from './LanguageManager.js';
import HistoryDisplay from './HistoryDisplay.js';
import SettingsManager from './SettingsManager.js';
import SettingsUI from './SettingsUI.js';

class App {
    constructor() {
        // Initialize settings manager first
        this.settingsManager = new SettingsManager();

        // Инициализация языка (может быть переопределен настройками)
        this.languageManager = new LanguageManager();

        // Sync language from settings
        const savedLanguage = this.settingsManager.get('language');
        if (savedLanguage) {
            this.languageManager.setLanguage(savedLanguage);
        }

        // Инициализация всех менеджеров
        this.windDataManager = new WindDataManager();
        this.mapController = new MapController();
        this.forecastManager = new ForecastManager(this.languageManager, this.settingsManager);
        this.historyManager = new HistoryManager();
        this.windStatistics = new WindStatistics();
        this.historyDisplay = null; // Будет инициализирован после historyManager

        this.windArrowController = null; // Будет инициализирован после карты
        this.settingsUI = null; // Settings UI controller
        this.updateInterval = null;
        this.isInitialized = false;
        this.lastWindData = null; // Store last wind data for language switching

        // Cache for preventing redundant fetches
        this.forecastCache = {
            data: null,
            timestamp: null,
            ttl: 5 * 60 * 1000 // 5 минут cache для прогноза
        };

        // Debounce timers
        this.debounceTimers = {
            forecast: null,
            windData: null
        };

        // Prevent multiple simultaneous fetches
        this.fetchInProgress = {
            forecast: false,
            windData: false
        };
    }

    async init() {
        try {
            console.log('Инициализация JollyKite App...');

            // Инициализация Settings UI
            this.settingsUI = new SettingsUI(this.settingsManager, this.languageManager);
            console.log('✓ Settings UI инициализирован');

            // Setup settings change listener
            this.settingsManager.addListener((settings) => {
                this.handleSettingsChange(settings);
            });

            // Инициализация языка
            this.initLanguageToggle();
            this.updateUILanguage();
            console.log('✓ Язык инициализирован:', this.languageManager.getCurrentLanguage());

            // Инициализация переключателя источников данных
            this.initSourceToggle();
            console.log('✓ Переключатель источников инициализирован');

            // Инициализация карты
            this.mapController.initMap();
            console.log('✓ Карта инициализирована');

            // Инициализация контроллера стрелки ветра
            this.windArrowController = new WindArrowController(
                this.mapController,
                this.windDataManager
            );
            console.log('✓ Контроллер стрелки ветра создан');

            // Инициализация менеджера прогнозов
            if (!this.forecastManager.init()) {
                console.warn('⚠ Не удалось инициализировать менеджер прогнозов');
            } else {
                console.log('✓ Менеджер прогнозов инициализирован');
            }

            // Настройка симуляции ветра для прогнозов
            this.forecastManager.setupSimulation((direction, speed) => {
                this.simulateWind(direction, speed);
            });

            // Проверка доступности истории
            if (!this.historyManager.isStorageAvailable()) {
                console.warn('⚠ История недоступна (localStorage не поддерживается)');
            } else {
                console.log('✓ Менеджер истории готов');
            }

            // Инициализация отображения истории
            this.historyDisplay = new HistoryDisplay(this.historyManager, this.languageManager, this.settingsManager);
            if (!this.historyDisplay.init()) {
                console.warn('⚠ Не удалось инициализировать отображение истории');
            } else {
                console.log('✓ Отображение истории инициализировано');
            }

            // Загрузка первоначальных данных
            await this.loadInitialData();
            
            // Запуск автообновления
            this.startAutoUpdate();
            
            this.isInitialized = true;
            console.log('✅ JollyKite App успешно инициализирован');
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка инициализации приложения:', error);
            return false;
        }
    }

    async loadInitialData() {
        // Загрузка текущих данных о ветре
        try {
            await this.updateWindData();
            console.log('✓ Данные о ветре загружены');
        } catch (error) {
            console.error('⚠ Ошибка загрузки данных о ветре:', error);
            console.error('Error details:', error.message, error.stack);
            const t = (key) => this.languageManager.t(key);
            this.showWindError(t('errorLoadingData'));
        }

        // Загрузка прогноза
        try {
            await this.updateForecast();
            console.log('✓ Прогноз загружен');
        } catch (error) {
            console.error('⚠ Ошибка загрузки прогноза:', error);
            this.forecastManager.showError(error);
        }
    }

    async updateWindData() {
        // Prevent multiple simultaneous fetches
        if (this.fetchInProgress.windData) {
            console.log('⏸ Wind data fetch already in progress, skipping...');
            return this.lastWindData;
        }

        try {
            this.fetchInProgress.windData = true;
            const windData = await this.windDataManager.fetchCurrentWindDataFromSource();

            // Получение информации о безопасности
            const safety = this.windDataManager.getWindSafety(
                windData.windDir,
                windData.windSpeedKnots
            );

            // Обновление данных с информацией о безопасности
            windData.safety = safety;

            // Store last wind data for language switching
            this.lastWindData = windData;

            // Обновление UI
            this.updateWindDisplay(windData);

            // Обновление стрелки ветра
            if (this.windArrowController) {
                this.windArrowController.updateWind(windData.windDir, windData.windSpeedKnots);
            }

            // Добавление измерения в статистику
            this.windStatistics.addMeasurement(windData);

            // Обновление тренда
            this.updateWindTrend();

            // Сохранение в историю
            if (this.historyManager.isStorageAvailable()) {
                this.historyManager.saveWindData(windData);

                // Обновление отображения истории
                if (this.historyDisplay) {
                    this.historyDisplay.refresh();
                }
            }

            return windData;
        } catch (error) {
            console.error('Ошибка обновления данных о ветре:', error);
            throw error;
        } finally {
            this.fetchInProgress.windData = false;
        }
    }

    updateWindTrend() {
        const trend = this.windStatistics.analyzeTrend();
        const trendElement = document.getElementById('windTrend');
        const t = (key) => this.languageManager.t(key);

        if (trendElement) {
            // Translate trend text
            let trendText = trend.text;
            if (trend.trend === 'strengthening') trendText = t('strengthening');
            else if (trend.trend === 'weakening') trendText = t('weakening');
            else if (trend.trend === 'stable') trendText = t('stable');
            else if (trend.trend === 'insufficient_data') trendText = t('insufficientData');

            trendElement.innerHTML = `
                <span style="font-size: 1.5em;">${trend.icon}</span>
                <span style="margin-left: 5px; font-weight: bold;">${trendText}</span>
            `;
            trendElement.style.color = trend.color;

            // Добавляем tooltip с подробной информацией
            if (trend.currentSpeed && trend.previousSpeed) {
                const changeText = trend.change > 0 ? `+${trend.change.toFixed(1)}` : trend.change.toFixed(1);
                const currentLang = this.languageManager.getCurrentLanguage();
                if (currentLang === 'ru') {
                    trendElement.title = `Сейчас: ${trend.currentSpeed.toFixed(1)} узлов\nБыло: ${trend.previousSpeed.toFixed(1)} узлов\nИзменение: ${changeText} узлов (${trend.percentChange.toFixed(1)}%)`;
                } else {
                    trendElement.title = `Now: ${trend.currentSpeed.toFixed(1)} knots\nBefore: ${trend.previousSpeed.toFixed(1)} knots\nChange: ${changeText} knots (${trend.percentChange.toFixed(1)}%)`;
                }
            } else {
                if (this.languageManager.getCurrentLanguage() === 'ru') {
                    trendElement.title = 'Накапливаем данные для анализа тренда (требуется 10 минут)';
                } else {
                    trendElement.title = 'Accumulating data for trend analysis (requires 10 minutes)';
                }
            }
        }
    }

    updateWindDisplay(windData) {
        // Обновление скорости ветра
        const windSpeedElement = document.getElementById('windSpeed');
        if (windSpeedElement) {
            windSpeedElement.textContent = windData.windSpeedKnots.toFixed(1);
        }

        // Обновление индикатора на градиентном баре
        const windSpeedIndicator = document.getElementById('windSpeedIndicator');
        if (windSpeedIndicator) {
            // Масштабируем скорость ветра на шкалу от 0 до 30+ узлов
            const maxSpeed = 30;
            const speed = Math.min(windData.windSpeedKnots, maxSpeed);
            const percentage = (speed / maxSpeed) * 100;
            windSpeedIndicator.style.left = `${percentage}%`;
        }

        // Обновление порывов ветра
        const windGustElement = document.getElementById('windGust');
        if (windGustElement) {
            windGustElement.textContent = (windData.windGustKnots !== null && windData.windGustKnots !== undefined)
                ? windData.windGustKnots.toFixed(1)
                : '--';
        }

        // Обновление максимального порыва сегодня
        const maxGustElement = document.getElementById('maxGust');
        if (maxGustElement) {
            maxGustElement.textContent = (windData.maxGustKnots !== null && windData.maxGustKnots !== undefined)
                ? windData.maxGustKnots.toFixed(1)
                : '--';
        }

        // Обновление направления и описания ветра
        this.updateWindDescription(windData);
    }

    updateWindDescription(windData) {
        const windDesc = this.getWindDescription(windData.windSpeedKnots, windData.windDir);
        const t = (key) => this.languageManager.t(key);

        const windIcon = document.getElementById('windIcon');
        const windTitle = document.getElementById('windTitle');
        const windSubtitle = document.getElementById('windSubtitle');
        const windCardinal = document.getElementById('windCardinal');

        if (windIcon) windIcon.textContent = windDesc.icon;
        if (windTitle) windTitle.textContent = windDesc.title;

        // windSubtitle показывает только статус безопасности и тип ветра (без скорости)
        if (windSubtitle && windData.safety) {
            let safetyText = '';
            let textColor = windData.safety.color;

            // Translate safety level
            let safetyLevel = windData.safety.text;
            if (windData.safety.level === 'low') safetyLevel = t('weakWind');
            else if (windData.safety.level === 'danger') safetyLevel = t('danger');
            else if (windData.safety.level === 'high') safetyLevel = t('excellentConditions');
            else if (windData.safety.level === 'good') safetyLevel = t('goodConditions');
            else if (windData.safety.level === 'medium') safetyLevel = t('moderate');

            // Добавляем информацию о типе ветра (offshore/onshore)
            if (windData.safety.isOffshore) {
                safetyText = t('dangerOffshore');
                textColor = '#FF4500'; // Красный для offshore - это всегда опасно!
            } else if (windData.safety.isOnshore) {
                safetyText = `${safetyLevel} • ${t('onshore')}`;
            } else {
                safetyText = `${safetyLevel} • ${t('sideshore')}`;
            }

            windSubtitle.textContent = safetyText;
            windSubtitle.style.color = textColor;
            windSubtitle.style.fontWeight = '600';
        }

        // Обновление направления ветра (румб)
        if (windCardinal) {
            windCardinal.textContent = this.degreesToCardinal(windData.windDir);
        }

    }

    degreesToCardinal(degrees) {
        return WindUtils.degreesToCardinal(degrees);
    }

    getWindDescription(speedKnots, degrees) {
        const t = (key) => this.languageManager.t(key);
        const speed = parseFloat(speedKnots) || 0;

        // Wind categories based on speed (in knots)
        if (speed < 5) {
            return {
                icon: '🍃',
                title: t('calm'),
                subtitle: t('calmSubtitle')
            };
        } else if (speed < 12) {
            return {
                icon: '💨',
                title: t('lightWind'),
                subtitle: `${speed.toFixed(1)} ${t('knots')}`
            };
        } else if (speed < 20) {
            return {
                icon: '🌬️',
                title: t('moderateWind'),
                subtitle: `${speed.toFixed(1)} ${t('knots')} - ${t('moderateSubtitle')}`
            };
        } else if (speed < 30) {
            return {
                icon: '💨',
                title: t('strongWind'),
                subtitle: `${speed.toFixed(1)} ${t('knots')} - ${t('strongSubtitle')}`
            };
        } else {
            return {
                icon: '⚡',
                title: t('extremeWind'),
                subtitle: `${speed.toFixed(1)} ${t('knots')} - ${t('extremeSubtitle')}`
            };
        }
    }

    async updateForecast(forceRefresh = false) {
        // Check cache first
        const now = Date.now();
        if (!forceRefresh && this.forecastCache.data && this.forecastCache.timestamp) {
            const cacheAge = now - this.forecastCache.timestamp;
            if (cacheAge < this.forecastCache.ttl) {
                console.log(`✓ Using cached forecast (age: ${Math.round(cacheAge/1000)}s)`);
                this.forecastManager.displayForecast(this.forecastCache.data);
                return;
            }
        }

        // Prevent multiple simultaneous fetches
        if (this.fetchInProgress.forecast) {
            console.log('⏸ Forecast fetch already in progress, skipping...');
            return;
        }

        try {
            this.fetchInProgress.forecast = true;
            this.forecastManager.showLoading();
            const forecastData = await this.windDataManager.fetchWindForecast();

            // Update cache
            this.forecastCache.data = forecastData;
            this.forecastCache.timestamp = now;

            this.forecastManager.displayForecast(forecastData);
        } catch (error) {
            this.forecastManager.showError(error);
            throw error;
        } finally {
            this.fetchInProgress.forecast = false;
        }
    }

    simulateWind(direction, speed) {
        console.log(`Симуляция ветра: ${speed} узлов, направление ${direction}°`);
        
        // Симуляция данных
        const simulatedData = {
            windSpeedKnots: speed,
            windDir: direction,
            windGustKnots: speed * 1.2,
            windDirAvg: direction,
            temperature: 85, // Фиксированная температура для симуляции
            humidity: 65,
            pressure: 30.1,
            timestamp: new Date()
        };
        
        // Получение информации о безопасности
        const safety = this.windDataManager.getWindSafety(direction, speed);
        simulatedData.safety = safety;
        
        // Обновление отображения
        this.updateWindDisplay(simulatedData);
        
        // Обновление стрелки
        if (this.windArrowController) {
            this.windArrowController.updateWind(direction, speed);
        }
    }

    showWindError(message) {
        const windTitle = document.getElementById('windTitle');
        const windSubtitle = document.getElementById('windSubtitle');
        const windIcon = document.getElementById('windIcon');
        
        if (windTitle) windTitle.textContent = 'Ошибка загрузки';
        if (windSubtitle) windSubtitle.textContent = message;
        if (windIcon) windIcon.textContent = '⚠️';
    }

    startAutoUpdate(intervalMs = config.intervals.autoUpdate) {
        if (this.updateInterval) {
            this.stopAutoUpdate();
        }
        
        console.log(`Запуск автообновления каждые ${intervalMs/1000} сек`);
        this.updateInterval = setInterval(async () => {
            try {
                await this.updateWindData();
            } catch (error) {
                console.error('Ошибка автообновления:', error);
            }
        }, intervalMs);
    }

    stopAutoUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
            console.log('Автообновление остановлено');
        }
    }

    // Методы для работы с историей
    getWindHistory(hours = 24) {
        return this.historyManager.getHistoryByPeriod(hours);
    }

    getWindStatistics(hours = 24) {
        return this.historyManager.getWindStatistics(hours);
    }

    exportHistoryJSON(hours = null) {
        return this.historyManager.exportHistoryJSON(hours);
    }

    exportHistoryCSV(hours = null) {
        return this.historyManager.exportHistoryCSV(hours);
    }

    clearHistory() {
        return this.historyManager.clearHistory();
    }

    // Методы для работы со статистикой
    getStatisticsCacheInfo() {
        return this.windStatistics.getCacheInfo();
    }

    clearStatisticsCache() {
        this.windStatistics.clearHistory();
        console.log('✓ Кеш статистики очищен');
    }

    // Методы для внешнего управления
    async refreshData() {
        if (!this.isInitialized) return false;
        
        try {
            await this.updateWindData();
            await this.updateForecast();
            return true;
        } catch (error) {
            console.error('Ошибка обновления данных:', error);
            return false;
        }
    }

    destroy() {
        console.log('Завершение работы JollyKite App...');

        // Остановка автообновления
        this.stopAutoUpdate();

        // Очистка debounce таймеров
        Object.keys(this.debounceTimers).forEach(key => {
            if (this.debounceTimers[key]) {
                clearTimeout(this.debounceTimers[key]);
                this.debounceTimers[key] = null;
            }
        });

        // Очистка карты
        this.mapController.destroy();

        // Очистка менеджеров
        if (this.windArrowController) {
            this.windArrowController.clear();
        }

        this.forecastManager.clear();

        this.isInitialized = false;
        console.log('✅ JollyKite App завершен');
    }

    // Language Management Methods

    /**
     * Initialize language toggle button
     */
    initLanguageToggle() {
        const toggle = document.getElementById('languageToggle');
        if (!toggle) return;

        const currentLang = this.languageManager.getCurrentLanguage();
        this.updateLanguageToggleUI(currentLang);

        // Add click handlers to language options
        const langOptions = toggle.querySelectorAll('.lang-option');
        langOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const lang = e.target.dataset.lang;
                if (lang) {
                    this.switchLanguage(lang);
                }
            });
        });
    }

    /**
     * Switch to specified language
     */
    switchLanguage(lang) {
        if (this.languageManager.setLanguage(lang)) {
            this.updateLanguageToggleUI(lang);
            this.updateUILanguage();

            // Refresh wind data display with new language (no API call)
            if (this.lastWindData) {
                this.updateWindDisplay(this.lastWindData);
            }

            // Refresh wind trend with new language (no API call)
            this.updateWindTrend();

            // Refresh forecast with cached data (no API call needed)
            if (this.forecastManager && this.forecastCache.data) {
                this.forecastManager.displayForecast(this.forecastCache.data);
            }

            // Refresh history display with new language (no API call)
            if (this.historyDisplay) {
                this.historyDisplay.refresh();
            }

            console.log('✓ Language switched to:', lang);
        }
    }

    /**
     * Update language toggle UI
     */
    updateLanguageToggleUI(currentLang) {
        const langOptions = document.querySelectorAll('.lang-option');
        langOptions.forEach(option => {
            if (option.dataset.lang === currentLang) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    /**
     * Update all UI text with current language
     */
    updateUILanguage() {
        const t = (key) => this.languageManager.t(key);

        // Update static text elements
        const elements = {
            'windSpeed': null, // Will be updated by wind data
            'windCardinal': null, // Will be updated by wind data
            'windGust': null, // Will be updated by wind data
            'maxGust': null, // Will be updated by wind data
        };

        // Update labels
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.dataset.i18n;
            el.textContent = t(key);
        });

        // Update knots label in settings modal
        const knotsLabelElement = document.querySelector('.unit-label-knots');
        if (knotsLabelElement) {
            knotsLabelElement.textContent = t('knotsLabel');
        }

        // Update footer
        const footer = document.querySelector('footer p');
        if (footer) {
            footer.innerHTML = `&copy; 2024 Pak Nam Pran. ${t('footer')}`;
        }
    }

    getCurrentWindData() {
        return this.lastWindData || {};
    }

    // Data Source Management Methods

    /**
     * Initialize source toggle button
     */
    initSourceToggle() {
        const toggle = document.getElementById('sourceToggle');
        if (!toggle) return;

        const currentSource = this.windDataManager.getDataSource();
        this.updateSourceToggleUI(currentSource);

        // Add click handlers to source options
        const sourceOptions = toggle.querySelectorAll('.source-option');
        sourceOptions.forEach(option => {
            option.addEventListener('click', (e) => {
                const source = e.currentTarget.dataset.source;
                if (source) {
                    this.switchDataSource(source);
                }
            });
        });

        // Initialize minimum wind speed indicator
        // COMMENTED OUT: Minimum wind speed indicator removed from UI
        // this.updateMinWindSpeedIndicator();
    }

    /**
     * Switch to specified data source
     */
    async switchDataSource(source) {
        if (this.windDataManager.setDataSource(source)) {
            this.updateSourceToggleUI(source);

            // Debounce to prevent rapid source switching
            if (this.debounceTimers.windData) {
                clearTimeout(this.debounceTimers.windData);
            }

            // Show loading indicator
            const windTitle = document.getElementById('windTitle');
            const windSubtitle = document.getElementById('windSubtitle');
            const t = (key) => this.languageManager.t(key);

            if (windTitle) windTitle.textContent = t('loadingData');
            if (windSubtitle) windSubtitle.textContent = t('pleaseWait');

            // Debounced data fetch
            this.debounceTimers.windData = setTimeout(async () => {
                try {
                    await this.updateWindData();
                    console.log(`✓ Data source switched to: ${config.dataSource.sources[source].name}`);
                } catch (error) {
                    console.error('Error switching data source:', error);
                    // Show error message specific to Windguru
                    if (source === 'windguru') {
                        if (windTitle) windTitle.textContent = 'Windguru недоступен';
                        if (windSubtitle) windSubtitle.textContent = 'Требуется настройка backend. Используйте Ambient Weather.';
                    } else {
                        this.showWindError('Ошибка загрузки данных');
                    }
                }
            }, 300); // 300ms debounce
        }
    }

    /**
     * Update source toggle UI
     */
    updateSourceToggleUI(currentSource) {
        const sourceOptions = document.querySelectorAll('.source-option');
        sourceOptions.forEach(option => {
            if (option.dataset.source === currentSource) {
                option.classList.add('active');
            } else {
                option.classList.remove('active');
            }
        });
    }

    /**
     * Update minimum wind speed indicator on gradient bar
     * COMMENTED OUT: Minimum wind speed indicator removed from UI
     */
    /*
    updateMinWindSpeedIndicator() {
        const minSpeed = this.windDataManager.getMinWindSpeed();
        const indicator = document.getElementById('minWindSpeedIndicator');

        if (indicator && minSpeed > 0) {
            const maxSpeed = 30;
            const percentage = (minSpeed / maxSpeed) * 100;
            indicator.style.left = `${percentage}%`;

            const t = (key) => this.languageManager.t(key);
            const currentLang = this.languageManager.getCurrentLanguage();
            if (currentLang === 'ru') {
                indicator.title = `Минимальная скорость: ${minSpeed} узлов`;
            } else {
                indicator.title = `Minimum speed: ${minSpeed} knots`;
            }
        }
    }
    */

    /**
     * Update wind display with minimum speed check
     */
    updateWindDisplay(windData) {
        // Apply minimum wind speed filter
        const filteredData = this.windDataManager.applyMinWindSpeedFilter(windData);

        // Convert wind speed based on user settings
        const displaySpeed = this.settingsManager.convertWindSpeed(windData.windSpeedKnots);
        const speedUnit = this.settingsManager.getWindSpeedUnitLabel(this.languageManager.getCurrentLanguage());

        // Обновление скорости ветра
        const windSpeedElement = document.getElementById('windSpeed');
        if (windSpeedElement) {
            windSpeedElement.textContent = displaySpeed.toFixed(1);

            // Add visual indicator if below minimum
            if (filteredData.belowMinimum) {
                windSpeedElement.style.opacity = '0.6';
                windSpeedElement.title = `Ниже минимума: ${filteredData.minWindSpeed} узлов`;
            } else {
                windSpeedElement.style.opacity = '1';
                windSpeedElement.title = '';
            }
        }

        // Обновление индикатора на градиентном баре
        const windSpeedIndicator = document.getElementById('windSpeedIndicator');
        if (windSpeedIndicator) {
            // Масштабируем скорость ветра на шкалу от 0 до 30+ узлов
            const maxSpeed = 30;
            const speed = Math.min(windData.windSpeedKnots, maxSpeed);
            const percentage = (speed / maxSpeed) * 100;
            windSpeedIndicator.style.left = `${percentage}%`;
        }

        // Update wind speed unit label (only for main UI, not settings modal)
        const unitElements = document.querySelectorAll('[data-i18n="knots"]');
        unitElements.forEach(el => {
            // Skip if element is inside settings modal
            if (!el.closest('.settings-modal')) {
                el.textContent = speedUnit;
            }
        });

        // Обновление порывов ветра
        const windGustElement = document.getElementById('windGust');
        if (windGustElement) {
            const displayGust = this.settingsManager.convertWindSpeed(windData.windGustKnots || 0);
            windGustElement.textContent = (windData.windGustKnots !== null && windData.windGustKnots !== undefined)
                ? displayGust.toFixed(1)
                : '--';
        }

        // Обновление максимального порыва сегодня
        const maxGustElement = document.getElementById('maxGust');
        if (maxGustElement) {
            const displayMaxGust = this.settingsManager.convertWindSpeed(windData.maxGustKnots || 0);
            maxGustElement.textContent = (windData.maxGustKnots !== null && windData.maxGustKnots !== undefined)
                ? displayMaxGust.toFixed(1)
                : '--';
        }

        // Обновление направления и описания ветра
        this.updateWindDescription(windData);
    }

    /**
     * Handle settings changes
     */
    handleSettingsChange(settings) {
        console.log('Settings changed:', settings);

        // Handle language change
        if (settings.language !== this.languageManager.getCurrentLanguage()) {
            this.switchLanguage(settings.language);
        }

        // Handle update interval change
        if (settings.updateInterval) {
            const intervalMs = this.settingsManager.getUpdateIntervalMs();
            this.stopAutoUpdate();
            this.startAutoUpdate(intervalMs);
            console.log(`✓ Update interval changed to ${settings.updateInterval}s`);
        }

        // Refresh wind data display with new units (no API call)
        if (this.lastWindData) {
            this.updateWindDisplay(this.lastWindData);
        }

        // Refresh forecast with cached data and new units (no API call)
        if (this.forecastManager && this.forecastCache.data) {
            this.forecastManager.displayForecast(this.forecastCache.data);
        }

        // Refresh history display with new units (no API call)
        if (this.historyDisplay) {
            this.historyDisplay.refresh();
        }
    }
}

export default App;