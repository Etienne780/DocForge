/**
 * Helpers for the color highlight of the theme editor preview (and its sample in the preferences):
 * a color pulses by mixing it with white, or with black if it is already light (white mixed
 * into white would not be visible).
 */

/** Relative luminance above this counts as light. */
const LIGHT_LUMINANCE = 0.6;

/**
 * Color to mix a color with for the highlight.
 * @param {string} color - any CSS color (also color-mix(), var() must be resolved)
 * @param {Document} [doc] - document to resolve the color in (e.g. a preview iframe)
 * @returns {'white'|'black'}
 */
export function getFlashMixColor(color, doc = document) {
  const rgb = _resolveRgb(color, doc);
  if (!rgb)
    return 'white';
  const [r, g, b] = rgb.map(channel => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > LIGHT_LUMINANCE ? 'black' : 'white';
}

/** rgb() of any CSS color, computed by the browser on a hidden element. */
function _resolveRgb(color, doc) {
  const probe = doc.createElement('span');
  probe.style.color = color;
  probe.style.display = 'none';
  doc.body?.append(probe);
  const computed = doc.defaultView?.getComputedStyle(probe).color ?? '';
  probe.remove();
  const match = computed.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] : null;
}
