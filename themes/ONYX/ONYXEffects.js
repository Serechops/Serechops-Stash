(function () {
  'use strict';

  if (window.stashMaterialEffectsEnhancerLoaded) return;
  window.stashMaterialEffectsEnhancerLoaded = true;
  console.log('✨ Material Effects Enhancer Initialized');

  function applyRippleEffect() {
    document.body.addEventListener('click', function (e) {
      const el = e.target.closest('button, .btn, .ripple-container');
      if (!el) return;

      const ripple = document.createElement('span');
      ripple.className = 'material-ripple';

      const rect = el.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = e.clientX - rect.left - size / 2 + 'px';
      ripple.style.top = e.clientY - rect.top - size / 2 + 'px';

      el.appendChild(ripple);
      setTimeout(function () {
        ripple.remove();
      }, 600);
    });
  }

  function elevateCardsOnHover() {
    var elevate = function (el) {
      el.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
      el.addEventListener('mouseenter', function () {
        el.style.transform = 'translateY(-4px)';
        el.style.boxShadow = '0 8px 20px rgba(0, 0, 0, 0.3)';
      });
      el.addEventListener('mouseleave', function () {
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.15)';
      });
    };

    var selectors = '.card, .scene-card, .tag-card, .performer-card, .studio-card';
    document.querySelectorAll(selectors).forEach(function (el) {
      elevate(el);
    });
  }

  function addRippleStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .material-ripple {
        position: absolute;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.3);
        animation: material-ripple-animation 0.6s ease-out;
        pointer-events: none;
        transform: scale(0);
      }

      @keyframes material-ripple-animation {
        to {
          transform: scale(2.5);
          opacity: 0;
        }
      }

      button, .btn, .ripple-container {
        position: relative;
        overflow: hidden;
      }
    `;
    document.head.appendChild(style);
  }

  function init() {
    elevateCardsOnHover();
    applyRippleEffect();
    addRippleStyles();
    
  }

  const lazyObserver = new MutationObserver(function () {
    elevateCardsOnHover(); // for dynamically inserted cards
  });
  lazyObserver.observe(document.body, { childList: true, subtree: true });

  document.addEventListener('DOMContentLoaded', init);
})();
