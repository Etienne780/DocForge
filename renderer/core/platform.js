/**
 * Returns platform string (win, linux, macOS, web, unknown)
 */
export function getPlatform() {
  if (window.electronAPI)
    return window.electronAPI.getPlatform();

  return 'web';
}

export function isPlatformWeb() {
  return getPlatform() === 'web';
}

export function isPlatformMacOS() {
  return getPlatform() === 'macOS';
}