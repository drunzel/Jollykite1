/**
 * Settings UI Controller
 * Handles the settings modal interface and user interactions
 */

class SettingsUI {
    constructor(settingsManager, languageManager) {
        this.settingsManager = settingsManager;
        this.languageManager = languageManager;

        // DOM elements
        this.menuButton = document.getElementById('settingsMenuButton');
        this.modal = document.getElementById('settingsModal');
        this.modalOverlay = document.getElementById('settingsModalOverlay');
        this.closeButton = document.getElementById('settingsModalClose');

        this.isOpen = false;
        this.init();
    }

    init() {
        if (!this.menuButton || !this.modal) {
            console.warn('Settings UI elements not found');
            return false;
        }

        // Setup event listeners
        this.menuButton.addEventListener('click', () => this.open());
        this.closeButton?.addEventListener('click', () => this.close());
        this.modalOverlay?.addEventListener('click', () => this.close());

        // Close on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Setup setting option buttons
        this.setupSettingOptions();

        // Load current settings and update UI
        this.updateUI();

        console.log('✓ Settings UI initialized');
        return true;
    }

    setupSettingOptions() {
        const optionButtons = document.querySelectorAll('.setting-option');

        optionButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const settingKey = e.currentTarget.dataset.setting;
                const value = e.currentTarget.dataset.value;

                if (settingKey && value) {
                    this.handleSettingChange(settingKey, value, e.currentTarget);
                }
            });
        });
    }

    handleSettingChange(key, value, buttonElement) {
        // Convert value to appropriate type
        let convertedValue = value;
        if (key === 'updateInterval') {
            convertedValue = parseInt(value, 10);
        }

        // Update setting
        const success = this.settingsManager.set(key, convertedValue);

        if (success) {
            // Update UI to show active state
            const parentGroup = buttonElement.closest('.setting-group');
            if (parentGroup) {
                // Remove active class from all buttons in this group
                parentGroup.querySelectorAll('.setting-option').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked button
                buttonElement.classList.add('active');
            }

            console.log(`✓ Setting changed: ${key} = ${convertedValue}`);
        }
    }

    updateUI() {
        const settings = this.settingsManager.getAll();

        // Update all setting option buttons to reflect current settings
        Object.keys(settings).forEach(key => {
            const value = settings[key].toString();
            const buttons = document.querySelectorAll(`[data-setting="${key}"]`);

            buttons.forEach(button => {
                if (button.dataset.value === value) {
                    button.classList.add('active');
                } else {
                    button.classList.remove('active');
                }
            });
        });
    }

    open() {
        if (this.isOpen) return;

        this.modal.classList.add('show');
        this.isOpen = true;
        document.body.style.overflow = 'hidden'; // Prevent background scrolling

        // Update UI to reflect current settings
        this.updateUI();

        console.log('Settings modal opened');
    }

    close() {
        if (!this.isOpen) return;

        this.modal.classList.remove('show');
        this.isOpen = false;
        document.body.style.overflow = ''; // Restore scrolling

        console.log('Settings modal closed');
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
}

export default SettingsUI;
