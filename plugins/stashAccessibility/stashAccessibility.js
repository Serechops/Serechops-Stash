(async function () {
    'use strict';

    console.log("Accessibility Options Injector Script started");

    // Default shortcuts
    let shortcuts = JSON.parse(localStorage.getItem('shortcuts')) || {
        Q: '/scenes?sortby=date',
        W: '/images?sortby=path',
        E: '/groups?sortby=name',
        R: '/scenes/markers?sortby=title&disp=2',
        T: '/galleries?sortby=path',
        Y: '/performers?sortby=name',
        1: '/studios?sortby=name',
        2: '/tags?sortby=name',
    };
    
    // Add 'data-focusable' to elements for navigation
    const addFocusableAttributes = () => {
        document.querySelectorAll('.nav-link, .btn, input, .form-control').forEach((el, index) => {
            el.setAttribute('data-focusable', 'true');
            el.setAttribute('tabindex', index); // Make elements focusable
        });
        console.log("Focusable elements updated.");
    };

    // Keyboard navigation logic
    const handleKeyboardNavigation = (event) => {
        const focusableElements = Array.from(
            document.querySelectorAll('[data-focusable]')
        );

        if (focusableElements.length === 0) return;

        const activeElement = document.activeElement;
        const currentIndex = focusableElements.indexOf(activeElement);

        let nextIndex = currentIndex;

        switch (event.key) {
            case 'ArrowUp':
            case 'ArrowLeft':
                nextIndex = (currentIndex > 0) ? currentIndex - 1 : focusableElements.length - 1;
                break;

            case 'ArrowDown':
            case 'ArrowRight':
                nextIndex = (currentIndex < focusableElements.length - 1) ? currentIndex + 1 : 0;
                break;

            case 'Enter':
                if (activeElement.tagName === 'A' || activeElement.tagName === 'BUTTON') {
                    activeElement.click();
                }
                break;

            default:
                return;
        }

        focusableElements[nextIndex].focus();
        event.preventDefault();
    };

    // Initialize keyboard navigation
    const initializeNavigation = () => {
        addFocusableAttributes();
        document.addEventListener('keydown', handleKeyboardNavigation);
        console.log("Keyboard navigation initialized.");
    };

    // Apply stored settings (font size, high contrast mode, color-blind palette)
    const applyStoredSettings = () => {
        const fontSize = localStorage.getItem('fontSize');
        if (fontSize) {
            document.documentElement.style.fontSize = fontSize;
            console.log(`Applied stored font size: ${fontSize}`);
        }

        const highContrast = localStorage.getItem('high-contrast');
        if (highContrast === 'true') {
            document.body.classList.add('high-contrast');
            console.log('Applied stored high contrast mode.');
        }

        const colorBlindPalette = localStorage.getItem('color-blind-palette');
        if (colorBlindPalette) {
            document.body.classList.add(colorBlindPalette);
            console.log(`Applied stored color-blind palette: ${colorBlindPalette}`);
        }
    };

    // Get base URL dynamically
    const getBaseUrl = () => {
        const { protocol, hostname, port } = window.location;
        return `${protocol}//${hostname}${port ? `:${port}` : ''}`;
    };

    // Handle keyboard shortcuts
    const handleKeyboardShortcuts = (event) => {
        const activeElement = document.activeElement;

        // Ignore shortcuts if an input, textarea, or contenteditable element is focused
        if (
            activeElement.tagName === 'INPUT' ||
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.isContentEditable
        ) {
            return;
        }

        const key = event.key.toUpperCase();
        if (shortcuts[key]) {
            const action = shortcuts[key];
            const targetUrl = getBaseUrl() + action;

            console.log(`Navigating to: ${targetUrl}`);
            window.location.href = targetUrl;
        }
    };

    document.addEventListener('keydown', handleKeyboardShortcuts);
    console.log("Keyboard shortcuts initialized.");

    // Create the Accessibility Options button
    const createAccessibilityButton = (target) => {
        if (document.getElementById('accessibility-options-button')) {
            console.log("Accessibility button already exists.");
            return;
        }

        const button = document.createElement('button');
        button.id = 'accessibility-options-button';
        button.type = 'button';
        button.className = 'btn btn-secondary';
        button.style.marginLeft = '8px';

        button.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="svg-inline--fa fa-icon" aria-hidden="true" focusable="false" role="img">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                <path fill="white" d="M423.9 255.8L411 413.1c-3.3 40.7-63.9 35.1-60.6-4.9l10-122.5-41.1 2.3c10.1 20.7 15.8 43.9 15.8 68.5 0 41.2-16.1 78.7-42.3 106.5l-39.3-39.3c57.9-63.7 13.1-167.2-74-167.2-25.9 0-49.5 9.9-67.2 26L73 243.2c22-20.7 50.1-35.1 81.4-40.2l75.3-85.7-42.6-24.8-51.6 46c-30 26.8-70.6-18.5-40.5-45.4l68-60.7c9.8-8.8 24.1-10.2 35.5-3.6 0 0 139.3 80.9 139.5 81.1 16.2 10.1 20.7 36 6.1 52.6L285.7 229l106.1-5.9c18.5-1.1 33.6 14.4 32.1 32.7zm-64.9-154c28.1 0 50.9-22.8 50.9-50.9C409.9 22.8 387.1 0 359 0c-28.1 0-50.9 22.8-50.9 50.9 0 28.1 22.8 50.9 50.9 50.9zM179.6 456.5c-80.6 0-127.4-90.6-82.7-156.1l-39.7-39.7C36.4 287 24 320.3 24 356.4c0 130.7 150.7 201.4 251.4 122.5l-39.7-39.7c-16 10.9-35.3 17.3-56.1 17.3z"/>
            </svg>
        </svg>
        
    `;
        button.title = 'Accessibility Options';
        target.appendChild(button);

        button.addEventListener('click', openAccessibilityModal);
        console.log("Accessibility button added.");
    };

    // Open Accessibility Modal
    const openAccessibilityModal = () => {
        if (document.getElementById('accessibility-modal')) {
            console.log("Accessibility modal already exists.");
            return;
        }

        const overlay = document.createElement('div');
        overlay.id = 'accessibility-modal-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: rgba(0, 0, 0, 0.6);
            z-index: 9999;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                document.body.removeChild(overlay);
            }
        });

        const modal = document.createElement('div');
        modal.id = 'accessibility-modal';
        modal.style.cssText = `
            background-color: #ffffff;
            color: #000000;
            padding: 20px;
            border-radius: 10px;
            width: 400px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            text-align: center;
        `;
        modal.innerHTML = `<h2 style="margin-bottom: 20px;">Accessibility Options</h2>`;
        modal.appendChild(createFontSizeControl());
        modal.appendChild(createToggleButton('Toggle High Contrast', 'high-contrast', '#28a745'));
        modal.appendChild(createColorBlindOptions());
        modal.appendChild(createKeyEditor());
        modal.appendChild(createResetButton());

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    };

    // Color-Blind Options
    const createColorBlindOptions = () => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.textContent = 'Color-Blind Palettes:';
        label.style.cssText = 'display: block; margin-bottom: 10px;';

        const options = document.createElement('div');

        const palettes = [
            { name: 'None', className: '' },
            { name: 'Protanopia', className: 'color-blind-protanopia' },
            { name: 'Deuteranopia', className: 'color-blind-deuteranopia' },
            { name: 'Tritanopia', className: 'color-blind-tritanopia' },
        ];

        const currentPalette = localStorage.getItem('color-blind-palette') || '';

        palettes.forEach((palette) => {
            const option = document.createElement('div');
            option.style.marginBottom = '5px';

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'color-blind-palette';
            radio.value = palette.className;
            radio.checked = currentPalette === palette.className;

            radio.addEventListener('change', () => {
                // Remove all palette classes
                document.body.classList.remove('color-blind-protanopia', 'color-blind-deuteranopia', 'color-blind-tritanopia');
                // Add selected palette class if not 'None'
                if (palette.className) {
                    document.body.classList.add(palette.className);
                }
                localStorage.setItem('color-blind-palette', palette.className);
                console.log(`Color-blind palette set to: ${palette.name}`);
            });

            const label = document.createElement('label');
            label.textContent = ` ${palette.name}`;
            label.style.marginLeft = '5px';

            option.appendChild(radio);
            option.appendChild(label);
            options.appendChild(option);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(options);
        return wrapper;
    };

    // Key Editor
    const createKeyEditor = () => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.textContent = 'Customize Keys:';
        label.style.cssText = 'display: block; margin-bottom: 10px;';

        const editor = document.createElement('div');

        Object.entries(shortcuts).forEach(([key, action]) => {
            const row = document.createElement('div');
            row.style.marginBottom = '10px';

            const keyInput = document.createElement('input');
            keyInput.type = 'text';
            keyInput.value = key;
            keyInput.maxLength = 1;
            keyInput.style.width = '50px';
            keyInput.style.marginRight = '10px';
            keyInput.style.textTransform = 'uppercase';

            const actionLabel = document.createElement('span');
            actionLabel.textContent = `Action: ${action}`;
            actionLabel.style.marginRight = '10px';

            keyInput.addEventListener('input', () => {
                const newKey = keyInput.value.toUpperCase();
                if (newKey && newKey !== key) {
                    delete shortcuts[key]; // Remove old key
                    shortcuts[newKey] = action; // Add new key
                    localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
                    console.log(`Key updated: ${key} → ${newKey}`);
                }
            });

            row.appendChild(keyInput);
            row.appendChild(actionLabel);
            editor.appendChild(row);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(editor);
        return wrapper;
    };

    // Font size control
    const createFontSizeControl = () => {
        const wrapper = document.createElement('div');
        wrapper.style.marginBottom = '20px';

        const label = document.createElement('label');
        label.textContent = 'Adjust Font Size:';
        label.style.cssText = 'display: block; margin-bottom: 10px;';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.min = '12';
        slider.max = '24';
        slider.value = localStorage.getItem('fontSize') || '16';
        slider.style.width = '100%';

        slider.addEventListener('input', () => {
            const fontSize = `${slider.value}px`;
            document.documentElement.style.fontSize = fontSize;
            localStorage.setItem('fontSize', fontSize);
            console.log(`Font size adjusted to: ${fontSize}`);
        });

        wrapper.appendChild(label);
        wrapper.appendChild(slider);
        return wrapper;
    };

    // Toggle button
    const createToggleButton = (labelText, toggleClass, bgColor) => {
        const button = document.createElement('button');
        button.textContent = labelText;
        button.style.cssText = `
            margin-bottom: 10px;
            padding: 10px 20px;
            background-color: ${bgColor};
            color: #fff;
            border: none;
            border-radius: 5px;
        `;

        button.addEventListener('click', () => {
            document.body.classList.toggle(toggleClass);
            const isActive = document.body.classList.contains(toggleClass);
            localStorage.setItem(toggleClass, isActive);
            console.log(`${labelText} toggled: ${isActive}`);
        });

        return button;
    };

    // Reset button
    const createResetButton = () => {
        const button = document.createElement('button');
        button.textContent = 'Reset';
        button.style.cssText = `
            margin-top: 20px;
            padding: 10px 20px;
            background-color: #dc3545;
            color: #fff;
            border: none;
            border-radius: 5px;
        `;

        button.addEventListener('click', () => {
            localStorage.clear();
            document.documentElement.style.fontSize = '';
            document.body.classList.remove('high-contrast', 'color-blind-protanopia', 'color-blind-deuteranopia', 'color-blind-tritanopia');
            shortcuts = {
                Q: '/scenes?sortby=date',
                W: '/images?sortby=path',
                E: '/groups?sortby=name',
                R: '/scenes/markers?sortby=title&disp=2',
                T: '/galleries?sortby=path',
                Y: '/performers?sortby=name',
                1: '/studios?sortby=name',
                2: '/tags?sortby=name',
            };
            localStorage.setItem('shortcuts', JSON.stringify(shortcuts));
            console.log('Settings reset to default.');
        });

        return button;
    };

    const injectAccessibilityStyles = () => {
        const style = document.createElement('style');
        style.textContent = `
            /* High Contrast Mode */
            body.high-contrast {
                background-color: #000000;
                color: #ffffff;
                filter: contrast(150%);
                transition: background-color 0.3s, color 0.3s;
            }
    
            body.high-contrast a {
                color: #4fc3f7;
                text-decoration: underline;
            }
    
            body.high-contrast a:hover {
                color: #81d4fa;
            }
    
            body.high-contrast button {
                background-color: #333333;
                color: #ffffff;
                border: 2px solid #ffffff;
            }
            
            body.high-contrast nav.top-nav {
                background-color: #333333 !important;
                color: black;
            }
            
            body.high-contrast .bg-dark {
                background-color: #333333 !important;
                color: black;
            }
            
            body.high-contrast .nav-link {
                background-color: #333333;
                color: #ffffff;
                border-radius: 5px;
                padding: 1px 2px;
                margin: 0 5px;
                transition: background-color 0.3s, color 0.3s;
                border: 1px solid #ffffff;
            }
            
            body.high-contrast .btn-secondary,
            body.high-contrast .form-control,
            body.high-contrast .react-select__control,
            body.high-contrast .react-select__input-container,
            body.high-contrast #react-select-2-listbox,
            body.high-contrast .react-select,
            body.high-contrast .tag-item,
            body.high-contrast .mt-3,
            body.high-contrast .row,
            body.high-contrast .popover,
            body.high-contrast input,
            body.high-contrast .card,
            body.high-contrast .modal-header,
            body.high-contrast .modal-footer,
            body.high-contrast .modal-body,
            body.high-contrast .modal-content {
                background-color: #333333;
                color: #ffffff;
                border-radius: 5px;
                padding: 5px 10px;
                margin: 2px 5px;
                transition: background-color 0.3s, color 0.3s;
                border: 1px solid #ffffff;
            }
            
            body.high-contrast .nav-link:hover {
                background-color: #555555;
                color: #ffffff;
            }
    
            body.high-contrast .nav-link a {
                color: #ffffff;
                text-decoration: none;
            }
    
            body.high-contrast .nav-link a:hover {
                text-decoration: underline;
            }

            /* Color-Blind Palettes */
            body.color-blind-protanopia {
                filter: url('#protanopia-filter');
            }
    
            body.color-blind-deuteranopia {
                filter: url('#deuteranopia-filter');
            }
    
            body.color-blind-tritanopia {
                filter: url('#tritanopia-filter');
            }
    
            /* SVG Filters for Color-Blindness Simulation */
            svg defs {
                position: absolute;
                width: 0;
                height: 0;
            }
        `;
        document.head.appendChild(style);

        // Add SVG filters for color-blindness simulation
        const svgFilters = `
            <svg xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <!-- Protanopia Filter -->
                    <filter id="protanopia-filter">
                        <feColorMatrix type="matrix" values="0.567,0.433,0,0,0,0.558,0.442,0,0,0,0,0.242,0.758,0,0,0,0,0,1,0"/>
                    </filter>
                    <!-- Deuteranopia Filter -->
                    <filter id="deuteranopia-filter">
                        <feColorMatrix type="matrix" values="0.625,0.375,0,0,0,0.7,0.3,0,0,0,0,0.3,0.7,0,0,0,0,0,1,0"/>
                    </filter>
                    <!-- Tritanopia Filter -->
                    <filter id="tritanopia-filter">
                        <feColorMatrix type="matrix" values="0.95,0.05,0,0,0,0,0.433,0.567,0,0,0,0.475,0.525,0,0,0,0,0,1,0"/>
                    </filter>
                </defs>
            </svg>
        `;
        const div = document.createElement('div');
        div.innerHTML = svgFilters;
        document.body.appendChild(div);
    };

    applyStoredSettings();
    injectAccessibilityStyles();
    initializeNavigation();

    const observer = new MutationObserver(() => {
        const navbar = document.querySelector('.navbar-buttons');
        if (navbar) {
            createAccessibilityButton(navbar);
            observer.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    console.log("Accessibility Options Injector Script initialized");
})();
