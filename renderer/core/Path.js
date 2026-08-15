import {
  PLATFORM_WEB,
  PLATFORM_WIN,

  getPlatform,
  getWebPlatform
} from '@core/Platform.js';

/**
 * Returns the path separator for the current platform.
 *
 * @returns {string} '\\' for Windows paths, '/' for Unix-based paths.
 */
export function getPlatformPathSeparator() {
  const platform = getPlatform();
  if (platform === PLATFORM_WEB) {
    const webPlatform = getWebPlatform();

    if (webPlatform === PLATFORM_WIN)
      return '\\';
  }

  if (platform === PLATFORM_WIN)
    return '\\';

  return '/';
}

/**
 * Combines two path segments using the correct platform separator.
 *
 * @param {string} path1 - First path segment.
 * @param {string} path2 - Second path segment.
 * @returns {string} Combined path.
 */
export function combinePath(path1, path2) {
  const separator = getPlatformPathSeparator();

  return `${path1.replace(/[\\/]+$/, '')}${separator}${path2.replace(/^[/\\]+/, '')}`;
}

/**
 * Returns the file extension of a path.
 *
 * @param {string} path - File path.
 * @returns {string} File extension without the dot.
 */
export function getExtension(path) {
  const segment = getLastSegment(path);
  const index = segment.lastIndexOf('.');

  if (index <= 0)
    return '';

  return segment.substring(index + 1);
}

/**
 * Splits a path into its segments.
 *
 * @param {string} path - File path.
 * @returns {string[]} Array of path segments.
 */
export function getAllPathSegements(path) {
  return path.split(/[\\/]/).filter(value => value.length > 0);
}

/**
 * Returns the last segment of a path.
 *
 * @param {string} path - File path.
 * @returns {string} Last path segment.
 */
export function getLastSegment(path) {
  return path.split(/[\\/]/).pop();
}


/**
 * Returns the number of segments in a path.
 *
 * @param {string} path - File path.
 * @returns {number} Number of path segments.
 */
export function getNumberOfSegments(path) {
  return getAllPathSegements(path).length;
}

/**
 * Returns a specific path segment.
 *
 * @param {string} path - File path.
 * @param {number} segment - Segment index.
 * @returns {string} Path segment or empty string if index is invalid.
 */
export function getPathSegment(path, segment) {
  const segments = getAllPathSegements(path);

  if (segment < 0 || segment >= segments.length)
    return '';

  return segments[segment];
}

/**
 * Extracts a slice of path segments between start (inclusive) and end (exclusive).
 *
 * @param {string} path - The full path to be sliced.
 * @param {number} startSegment - Start index (inclusive).
 * @param {number} endSegment - End index (exclusive).
 * @returns {string} The combined sub‑path or an empty string if the range is invalid.
 */
export function slicePath(path, startSegment, endSegment) {
  const segments = getAllPathSegements(path);

  const start = Math.min(startSegment, endSegment);
  const end = Math.max(startSegment, endSegment);

  if (start < 0 || end > segments.length || start >= end)
    return '';
  
  const sliced = segments.slice(start, end);
  return sliced.join(getPlatformPathSeparator());
}

/**
 * Normalizes a path by resolving '.' and '..' segments and removing redundant separators.
 *
 * @param {string} path - The path to normalize.
 * @returns {string} The normalized path.
 */
export function normalizePath(path) {
  // Detect if the path is absolute (starts with a separator)
  const isAbsolute = /^[\\/]/.test(path);

  // Split into segments (ignore empty ones)
  const segments = getAllPathSegements(path);

  // Stack for resolved segments
  const resolved = [];

  for (const segment of segments) {
    if (segment === '.' || segment === '') {
      // Ignore current directory markers and empty segments
      continue;
    } else if (segment === '..') {
      // Go up one level if possible
      if (resolved.length > 0) {
        resolved.pop();
      }
      // If the path is absolute, we cannot go above root, so ignore extra '..'
      // (but we also need to handle cases like '/..' -> '/' ? – we'll keep it simple)
    } else {
      resolved.push(segment);
    }
  }

  // Rebuild the path with the platform separator
  const separator = getPlatformPathSeparator();
  let normalized = resolved.join(separator);

  // If the original path was absolute, prepend the separator
  if (isAbsolute) {
    normalized = separator + normalized;
  }

  // If the normalized path is empty, return the root separator for absolute paths,
  // or '.' for relative paths (current directory)
  if (normalized === '') {
    return isAbsolute ? separator : '.';
  }

  return normalized;
}