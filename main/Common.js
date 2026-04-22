import path from 'path';
import { fileURLToPath } from 'url';

/**
 * Returns the correct icon path depending on the platform.
 * Ensures correct file resolution for Electron BrowserWindow.
 */
export function getLogoPath() {
  const basePath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../assets/icons'
  );

  switch (process.platform) {
    case 'win32':
      return path.join(basePath, 'icon.ico');

    case 'darwin':
      return path.join(basePath, 'icon.icns');

    default:
      return path.join(basePath, 'icon.png');
  }
}