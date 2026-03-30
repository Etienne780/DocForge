import { getPlatform } from '../main.js';

// Handle custom titlebar interactions
export function initWindowControls() {
  const isMac = getPlatform() === 'macOS';
  const titlebar = document.getElementById('titlebar');

  // macOS: native titlebar nutzen → custom ausblenden
  if (isMac) {
      if (titlebar) {
          titlebar.style.display = 'none';
      }
      return;
  }

  if (!titlebar || !window.electronAPI) 
    return;

  titlebar.addEventListener('dblclick', () => {
      window.electronAPI.maximize();
  });

  document.getElementById('titlebar-btn-min')?.addEventListener('click', () => {
      window.electronAPI.minimize();
  });
  document.getElementById('titlebar-btn-max')?.addEventListener('click', () => {
      window.electronAPI.maximize();
  });
  document.getElementById('titlebar-btn-close')?.addEventListener('click', () => {
      window.electronAPI.close();
  });
}