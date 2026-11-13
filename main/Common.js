import path from 'path';
import { fileURLToPath } from 'url';
import { app } from 'electron';

/**
 * Returns the path of the app logo used as the BrowserWindow icon (Windows / Linux,
 * macOS ignores it). In packaged builds the logo is copied next to the app resources
 * via `build.extraResources` in package.json, in development it is read from assets/.
 */
export function getLogoPath() {
  if (app.isPackaged)
    return path.join(process.resourcesPath, 'logo.png');

  return path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '../assets/icons/logo/logo.png'
  );
}
