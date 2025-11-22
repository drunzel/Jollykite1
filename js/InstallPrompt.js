/**
 * InstallPrompt.js
 * Управление установкой PWA как приложения
 */

class InstallPrompt {
    constructor() {
        this.deferredPrompt = null;
        this.installButton = null;
        this.init();
    }

    init() {
        // Слушаем событие beforeinstallprompt
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[InstallPrompt] beforeinstallprompt event fired');
            // Предотвращаем автоматическое появление браузерного промпта
            e.preventDefault();
            // Сохраняем событие для последующего использования
            this.deferredPrompt = e;
            // Показываем кнопку установки
            this.showInstallButton();
        });

        // Отслеживаем успешную установку
        window.addEventListener('appinstalled', () => {
            console.log('[InstallPrompt] PWA was installed');
            this.hideInstallButton();
            this.deferredPrompt = null;

            // Отправляем аналитику (если есть)
            if (window.gtag) {
                gtag('event', 'app_installed', {
                    event_category: 'engagement',
                    event_label: 'PWA Installation'
                });
            }
        });

        // Проверяем, установлено ли приложение
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('[InstallPrompt] Running in standalone mode');
            this.onAppInstalled();
        }
    }

    /**
     * Показываем кнопку установки
     */
    showInstallButton() {
        // Создаем кнопку установки, если её нет
        if (!this.installButton) {
            this.createInstallButton();
        }

        if (this.installButton) {
            this.installButton.style.display = 'block';
        }
    }

    /**
     * Скрываем кнопку установки
     */
    hideInstallButton() {
        if (this.installButton) {
            this.installButton.style.display = 'none';
        }
    }

    /**
     * Создаем красивую кнопку установки
     */
    createInstallButton() {
        // Проверяем, не существует ли уже кнопка
        const existingButton = document.getElementById('pwa-install-button');
        if (existingButton) {
            this.installButton = existingButton;
            return;
        }

        // Создаем контейнер для кнопки
        const buttonContainer = document.createElement('div');
        buttonContainer.id = 'pwa-install-container';
        buttonContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 9999;
            animation: slideUp 0.3s ease-out;
        `;

        // Создаем кнопку
        const button = document.createElement('button');
        button.id = 'pwa-install-button';
        button.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="margin-right: 8px;">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            Установить приложение
        `;
        button.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: center;
            background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 30px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(14, 165, 233, 0.4);
            transition: all 0.3s ease;
            font-family: 'Poppins', sans-serif;
        `;

        // Добавляем эффекты при наведении
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.05)';
            button.style.boxShadow = '0 6px 20px rgba(14, 165, 233, 0.6)';
        });

        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.boxShadow = '0 4px 15px rgba(14, 165, 233, 0.4)';
        });

        // Обработчик клика
        button.addEventListener('click', () => this.handleInstallClick());

        // Кнопка закрытия
        const closeButton = document.createElement('button');
        closeButton.innerHTML = '✕';
        closeButton.style.cssText = `
            position: absolute;
            top: -10px;
            right: -10px;
            background: rgba(0, 0, 0, 0.5);
            color: white;
            border: none;
            width: 24px;
            height: 24px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        closeButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.hideInstallButton();
        });

        buttonContainer.appendChild(button);
        buttonContainer.appendChild(closeButton);
        document.body.appendChild(buttonContainer);

        this.installButton = buttonContainer;

        // Добавляем CSS анимацию
        if (!document.getElementById('pwa-install-styles')) {
            const style = document.createElement('style');
            style.id = 'pwa-install-styles';
            style.textContent = `
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateX(-50%) translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(-50%) translateY(0);
                    }
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Обработка клика по кнопке установки
     */
    async handleInstallClick() {
        if (!this.deferredPrompt) {
            console.log('[InstallPrompt] No deferred prompt available');
            return;
        }

        console.log('[InstallPrompt] Showing install prompt');

        // Показываем браузерный промпт
        this.deferredPrompt.prompt();

        // Ждем выбора пользователя
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`[InstallPrompt] User choice: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('[InstallPrompt] User accepted the install prompt');
        } else {
            console.log('[InstallPrompt] User dismissed the install prompt');
        }

        // Очищаем промпт
        this.deferredPrompt = null;
        this.hideInstallButton();
    }

    /**
     * Действия при установке приложения
     */
    onAppInstalled() {
        console.log('[InstallPrompt] App is running in installed mode');

        // Можно добавить специальную логику для установленного приложения
        // Например, скрыть элементы UI браузера
        document.body.classList.add('pwa-installed');

        // Добавляем мета-тег для iOS для полноэкранного режима
        const viewport = document.querySelector('meta[name="viewport"]');
        if (viewport && window.navigator.standalone) {
            viewport.setAttribute('content',
                'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover'
            );
        }
    }

    /**
     * Проверка поддержки установки PWA
     */
    static isInstallable() {
        // Проверяем поддержку Service Worker
        if (!('serviceWorker' in navigator)) {
            console.log('[InstallPrompt] Service Workers not supported');
            return false;
        }

        // Проверяем, не установлено ли уже приложение
        if (window.matchMedia('(display-mode: standalone)').matches) {
            console.log('[InstallPrompt] App already installed');
            return false;
        }

        // Проверяем iOS Safari
        if (window.navigator.standalone !== undefined) {
            console.log('[InstallPrompt] iOS Safari detected');
            return true;
        }

        return true;
    }

    /**
     * Показываем инструкцию для iOS
     */
    static showIOSInstructions() {
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
        const isInStandaloneMode = window.navigator.standalone;

        if (isIOS && !isInStandaloneMode) {
            // Создаем баннер с инструкцией для iOS
            const banner = document.createElement('div');
            banner.id = 'ios-install-banner';
            banner.style.cssText = `
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
                color: white;
                padding: 15px;
                text-align: center;
                z-index: 9999;
                animation: slideUp 0.3s ease-out;
                box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.2);
            `;
            banner.innerHTML = `
                <div style="font-size: 14px; margin-bottom: 5px;">
                    📱 Установите JollyKite на свой iPhone
                </div>
                <div style="font-size: 12px; opacity: 0.9;">
                    Нажмите
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="vertical-align: middle; display: inline;">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    затем "На экран Домой"
                </div>
                <button onclick="this.parentElement.style.display='none'"
                        style="position: absolute; top: 5px; right: 10px; background: none; border: none; color: white; font-size: 20px; cursor: pointer;">
                    ✕
                </button>
            `;

            // Показываем баннер только если его еще нет
            if (!document.getElementById('ios-install-banner')) {
                document.body.appendChild(banner);

                // Автоматически скрываем через 10 секунд
                setTimeout(() => {
                    if (banner && banner.parentElement) {
                        banner.style.animation = 'slideDown 0.3s ease-out';
                        setTimeout(() => banner.remove(), 300);
                    }
                }, 10000);
            }
        }
    }
}

// Экспортируем класс
export default InstallPrompt;
