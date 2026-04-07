import { isPlatformMacOS, isPlatformWeb } from '@core/platform.js';

// Handle custom titlebar interactions
export function initWindowControls() {
  if (isPlatformMacOS() || isPlatformWeb()) {
    document.querySelector('.window-controls').classList.add('physically-hidden');
    return;
  }

  if (!window.electronAPI) 
    return;

  document.querySelectorAll('[data-win-bar]').forEach(btn => {
    btn.addEventListener('dblclick', (event) => {
      if (event.target === event.currentTarget) {
        window.electronAPI.maximize();
      }
    });
  });

  document.querySelectorAll('[data-win-min]').forEach(btn => {
    btn.addEventListener('click', () => window.electronAPI.minimize());
  });

  document.querySelectorAll('[data-win-max]').forEach(btn => {
    btn.addEventListener('click', () => window.electronAPI.maximize());
  });

  document.querySelectorAll('[data-win-close]').forEach(btn => {
    btn.addEventListener('click', () => window.electronAPI.close());
  });
}