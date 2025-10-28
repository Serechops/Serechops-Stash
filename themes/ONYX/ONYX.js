(async function () {
  'use strict';

  if (window.stashMaterialThemeSwitcherLoaded) return;
  window.stashMaterialThemeSwitcherLoaded = true;
  console.log('✅ Material Theme Switcher Initialized');

  const themes = {
    default: {
      '--m3-primary': '#f48fb1',
      '--m3-on-primary': '#000000',
      '--m3-secondary': '#f06292',
      '--m3-surface': '#121212',
      '--m3-background': '#121212',
      '--m3-on-surface': '#ffffff',
      '--m3-outline': '#424242',
      '--m3-error': '#e57373',
      '--m3-on-error': '#000000',
      '--m3-surface-variant': '#1f1f1f',
      '--m3-on-surface-variant': '#fce4ec',
      '--m3-inverse-surface': '#fce4ec',
      '--m3-inverse-on-surface': '#1a1a1a',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.05)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.08)',
      '--m3-radius': '12px'
    },
    pinkRose: {
      '--m3-primary': '#d81b60',
      '--m3-on-primary': '#ffffff',
      '--m3-secondary': '#f48fb1',
      '--m3-surface': '#1a1a1a',
      '--m3-background': '#1a1a1a',
      '--m3-on-surface': '#f8bbd0',
      '--m3-outline': '#5f5f5f',
      '--m3-error': '#ef5350',
      '--m3-on-error': '#ffffff',
      '--m3-surface-variant': '#2c2c2c',
      '--m3-on-surface-variant': '#ffc1e3',
      '--m3-inverse-surface': '#fce4ec',
      '--m3-inverse-on-surface': '#1a1a1a',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.04)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.06)',
      '--m3-radius': '12px'
    },
    greenMint: {
      '--m3-primary': '#00c896',
      '--m3-on-primary': '#000000',
      '--m3-secondary': '#a5f2df',
      '--m3-surface': '#0c1f1c',
      '--m3-background': '#0c1f1c',
      '--m3-on-surface': '#ccfff5',
      '--m3-outline': '#2e7d6b',
      '--m3-error': '#e57373',
      '--m3-on-error': '#000000',
      '--m3-surface-variant': '#1e3d37',
      '--m3-on-surface-variant': '#b2fef7',
      '--m3-inverse-surface': '#e0f2f1',
      '--m3-inverse-on-surface': '#1b1f1f',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.05)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.08)',
      '--m3-radius': '12px'
    },
    amberGlow: {
      '--m3-primary': '#ffb300',
      '--m3-on-primary': '#000000',
      '--m3-secondary': '#ffe082',
      '--m3-surface': '#1f1b14',
      '--m3-background': '#1f1b14',
      '--m3-on-surface': '#ffe082',
      '--m3-outline': '#8d6e63',
      '--m3-error': '#d32f2f',
      '--m3-on-error': '#ffffff',
      '--m3-surface-variant': '#3e2723',
      '--m3-on-surface-variant': '#ffe0b2',
      '--m3-inverse-surface': '#fff8e1',
      '--m3-inverse-on-surface': '#2a1b01',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.05)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.1)',
      '--m3-radius': '12px'
    },
    midnightBlue: {
      '--m3-primary': '#3b82f6',
      '--m3-on-primary': '#ffffff',
      '--m3-secondary': '#60a5fa',
      '--m3-surface': '#0d1117',
      '--m3-background': '#0d1117',
      '--m3-on-surface': '#dbeafe',
      '--m3-outline': '#1e3a8a',
      '--m3-error': '#ef4444',
      '--m3-on-error': '#ffffff',
      '--m3-surface-variant': '#1e293b',
      '--m3-on-surface-variant': '#bfdbfe',
      '--m3-inverse-surface': '#e0f2fe',
      '--m3-inverse-on-surface': '#0f172a',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.04)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.06)',
      '--m3-radius': '12px'
    },
    violetDusk: {
      '--m3-primary': '#8b5cf6',
      '--m3-on-primary': '#ffffff',
      '--m3-secondary': '#c084fc',
      '--m3-surface': '#1b1325',
      '--m3-background': '#1b1325',
      '--m3-on-surface': '#ede9fe',
      '--m3-outline': '#6b21a8',
      '--m3-error': '#f87171',
      '--m3-on-error': '#1a1a1a',
      '--m3-surface-variant': '#3b0764',
      '--m3-on-surface-variant': '#f3e8ff',
      '--m3-inverse-surface': '#f5f3ff',
      '--m3-inverse-on-surface': '#1c0e2e',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.03)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.05)',
      '--m3-radius': '12px'
    },
    oceanTeal: {
      '--m3-primary': '#14b8a6',
      '--m3-on-primary': '#ffffff',
      '--m3-secondary': '#5eead4',
      '--m3-surface': '#032e2f',
      '--m3-background': '#032e2f',
      '--m3-on-surface': '#ccfbf1',
      '--m3-outline': '#0f766e',
      '--m3-error': '#fb7185',
      '--m3-on-error': '#000000',
      '--m3-surface-variant': '#064e3b',
      '--m3-on-surface-variant': '#99f6e4',
      '--m3-inverse-surface': '#e0f2f1',
      '--m3-inverse-on-surface': '#032d2d',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.04)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.07)',
      '--m3-radius': '12px'
    },
    crimsonNight: {
      '--m3-primary': '#dc2626',
      '--m3-on-primary': '#ffffff',
      '--m3-secondary': '#f87171',
      '--m3-surface': '#1a0e0e',
      '--m3-background': '#1a0e0e',
      '--m3-on-surface': '#fee2e2',
      '--m3-outline': '#991b1b',
      '--m3-error': '#ff6b6b',
      '--m3-on-error': '#1a1a1a',
      '--m3-surface-variant': '#431515',
      '--m3-on-surface-variant': '#fecaca',
      '--m3-inverse-surface': '#ffe4e6',
      '--m3-inverse-on-surface': '#200101',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.05)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.08)',
      '--m3-radius': '12px'
    },
    steelGray: {
      '--m3-primary': '#94a3b8',
      '--m3-on-primary': '#1e293b',
      '--m3-secondary': '#cbd5e1',
      '--m3-surface': '#0f172a',
      '--m3-background': '#0f172a',
      '--m3-on-surface': '#e2e8f0',
      '--m3-outline': '#475569',
      '--m3-error': '#f87171',
      '--m3-on-error': '#1a1a1a',
      '--m3-surface-variant': '#1e293b',
      '--m3-on-surface-variant': '#cbd5e1',
      '--m3-inverse-surface': '#f1f5f9',
      '--m3-inverse-on-surface': '#0f172a',
      '--m3-elevation-1': 'rgba(255, 255, 255, 0.03)',
      '--m3-elevation-2': 'rgba(255, 255, 255, 0.06)',
      '--m3-radius': '12px'
    }
  };

  const themeOrder = Object.keys(themes);
  let currentThemeIndex = 0;

  const setMaterialTheme = (name) => {
    const root = document.documentElement;
    const theme = themes[name];
    if (!theme) return;

    Object.entries(theme).forEach(([k, v]) => root.style.setProperty(k, v));

    // Optional fallback aliases
    const aliasMap = {
      '--on-surface-color': '--m3-on-surface',
      '--primary-color': '--m3-primary',
      '--surface-color': '--m3-surface',
      '--background-color': '--m3-background',
      '--text-color': '--m3-on-surface',
      '--border-color': '--m3-outline',
      '--error-color': '--m3-error'
    };
    Object.entries(aliasMap).forEach(([alias, original]) => {
      const val = theme[original];
      if (val) root.style.setProperty(alias, val);
    });

    localStorage.setItem('material-theme', name);
    updateThemeIcon(name);
  };

  const updateThemeIcon = (theme) => {
    const icon = document.getElementById('material-theme-icon');
    if (!icon) return;
    const fill = themes[theme]?.['--m3-primary'] || '#bb86fc';
    icon.setAttribute('fill', fill);
  };

  const createThemeDropdown = (button) => {
    let menu = document.getElementById('theme-menu');
    if (menu) {
      menu.remove();
      return;
    }

    menu = document.createElement('div');
    menu.id = 'theme-menu';
    Object.assign(menu.style, {
      position: 'absolute',
      top: '100%',
      right: '0',
      marginTop: '4px',
      background: 'var(--m3-surface)',
      border: '1px solid var(--m3-outline)',
      padding: '4px 0',
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      zIndex: '9999',
      borderRadius: '8px',
      minWidth: '160px'
    });

    themeOrder.forEach(themeKey => {
      const item = document.createElement('div');
      item.textContent = themeKey;
      Object.assign(item.style, {
        padding: '8px 16px',
        cursor: 'pointer',
        color: 'var(--m3-on-surface)',
        fontSize: '14px',
        userSelect: 'none'
      });
      item.addEventListener('mouseenter', () => item.style.backgroundColor = 'var(--m3-surface-variant)');
      item.addEventListener('mouseleave', () => item.style.backgroundColor = 'transparent');
      item.addEventListener('click', () => {
        setMaterialTheme(themeKey);
        menu.remove();
      });
      menu.appendChild(item);
    });

    document.addEventListener('click', function closeMenu(e) {
      if (!menu.contains(e.target) && !button.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', closeMenu);
      }
    });

    button.appendChild(menu);
  };

  const createThemeSwitcherButton = () => {
    const parent = document.querySelector('.navbar-buttons');
    if (!parent || document.getElementById('theme-switcher-btn')) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'nav-utility nav-link';
    wrapper.style.position = 'relative';

    const button = document.createElement('button');
    button.id = 'theme-switcher-btn';
    button.className = 'btn btn-secondary';
    button.style.marginLeft = '8px';
    button.title = 'Theme Switcher';

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('id', 'material-theme-icon');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '20');
    svg.setAttribute('height', '20');
    svg.setAttribute('fill', '#bb86fc');
    svg.innerHTML = `<path fill="currentColor" d="M12 3C7.03 3 3 6.58 3 11c0 2.15 1.39 3.86 3.43 4.91.33.17.57.49.61.87l.23 2.33c.05.48.61.73 1 .45l2.08-1.43c.3-.2.69-.26 1.05-.17.52.13 1.07.2 1.6.2 4.97 0 9-3.58 9-8s-4.03-7-9-7zm-4 8.5C7.17 11.5 6 10.33 6 9s1.17-2.5 2.5-2.5S11 7.67 11 9s-1.17 2.5-2.5 2.5zm6 1.5c-.83 0-1.5-.67-1.5-1.5S13.17 10 14 10s1.5.67 1.5 1.5S14.83 13 14 13zm2.5-4c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z"/>`;

    button.appendChild(svg);
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      createThemeDropdown(button);
    });
    wrapper.appendChild(button);

    const donate = parent.querySelector('a[href*="opencollective"]');
    if (donate) {
      parent.insertBefore(wrapper, donate);
    } else {
      parent.appendChild(wrapper);
    }

    const saved = localStorage.getItem('material-theme');
    if (saved && themeOrder.includes(saved)) {
      currentThemeIndex = themeOrder.indexOf(saved);
      setMaterialTheme(saved);
    } else {
      setMaterialTheme('default');
    }
  };
  
  

  const waitForNavbarAndInit = () => {
    const observer = new MutationObserver(() => {
      if (document.querySelector('.navbar-buttons')) {
        createThemeSwitcherButton();
        observer.disconnect();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  };

  waitForNavbarAndInit();
})();
