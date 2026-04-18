/**
 * Returns the current platform as a string.
 * @returns {string} 'win', 'linux', 'macOS', 'web', 'unknown'.
 */
export function getPlatform() {
  if (window.electronAPI)
    return window.electronAPI.getPlatform();

  return 'web';
}

/**
 * Checks if a given string is a valid platform.
 * @param {string} platform - The platform string to check.
 * @returns {boolean} True if the platform is one of 'win', 'linux', 'macOS', or 'web'.
 */
export function isPlatform(platform) {
  return platform === 'win' || platform === 'linux' || 
    platform === 'macOS' || platform === 'web';
}

/**
 * Checks if the current platform is 'web'.
 * @returns {boolean} True if the platform is 'web'.
 */
export function isPlatformWeb() {
  return getPlatform() === 'web';
}

/**
 * Checks if the current platform is 'macOS'.
 * @returns {boolean} True if the platform is 'macOS'.
 */
export function isPlatformMacOS() {
  return getPlatform() === 'macOS';
}

/**
 * Determines if the current platform matches a platform specification string.
 * Supports multiple platforms separated by spaces and negation with '!'.
 * 
 * Examples:
 *  - "win linux"   -> matches only if platform is 'win' or 'linux'
 *  - "!win linux"  -> matches if platform is not 'win' but is 'linux'
 *  - "!macOS !web" -> matches if platform is neither 'macOS' nor 'web'
 *  - "any" or ""   -> always matches
 *
 * @param {string} itemPlat - Platform specification string.
 * @returns {boolean} True if the current platform matches the specification.
 */
export function isPlatformMatch(itemPlat) {
  if (!itemPlat || itemPlat === 'any')
    return true;

  const plat = getPlatform();
  const items = itemPlat.split(' ');

  return items.every(i => {
    const negation = i.startsWith('!');
    const platform = i.slice(negation ? 1 : 0);

    if (!isPlatform(platform)) {
      console.log(`Invalid platform '${platform}' skipped in 'isPlatformMatch'`);
      return true; // ignore invalid entries
    }

    return negation ? plat !== platform : plat === platform;
  });
}

/**
 * Toggles the developer tools panel in an Electron environment.
 */
export function toggleDeveloperTools() {
  if (window.electronAPI)
    window.electronAPI.toggleDevTools();
}

/**
 * @brief Determines whether the current runtime is in development mode.
 *
 * This function provides a unified way to detect development mode across
 * different environments:
 *
 * - **Vite (Renderer / Browser)**:
 *   Uses `import.meta.env.DEV`, which is statically replaced at build time
 *   by the Vite bundler.
 *
 * - **Node.js / Electron (Fallback)**:
 *   Falls back to `process.env.NODE_ENV === 'development'` when Vite-specific
 *   environment variables are not available.
 *
 * If neither environment indicator is present, the function safely defaults
 * to `false`.
 *
 * @return {boolean} `true` if running in development mode, otherwise `false`.
 */
export function isDevelopment() {
  // Vite environment (renderer / browser)
  if(typeof import.meta !== 'undefined' && import.meta.env) {
    return !!import.meta.env.DEV;
  }

  // Node / Electron fallback
  if(typeof process !== 'undefined') {
    return process.env.NODE_ENV === 'development';
  }

  return false;
}