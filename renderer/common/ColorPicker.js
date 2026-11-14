import { state } from '@core/State.js';
import { getEyedropperIcon } from '@ui/Icon.js';
import { t } from '@core/i18n/I18n.js';

const VIEWPORT_MARGIN = 4;
const ANCHOR_GAP = 4;
const CHECKER_SIZE = 4;

/** Views of the picker. The selected one is stored in state.colorPickerMode and used by every picker. */
const MODES = ['sv-square', 'hsl-wheel', 'hsl-sliders', 'rgb-sliders'].map(id => ({
  id,
  get name() { return t(`common.colorPicker.modes.${id}`); },
}));

const OPPOSITE_SIDE = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' };
const CROSS_SIDES = { bottom: ['right', 'left'], top: ['right', 'left'], left: ['bottom', 'top'], right: ['bottom', 'top'] };

let host = null;
let panel = null;
let body = null;
let preview = null;
let hexInput = null;
let anchor = null;   // element that opened the picker (gets the 'open' class)
let options = null;
let controls = [];   // { render(skip) } of every control in the open panel

// HSV is the source of truth, HSL is kept next to it so hue/saturation don't jump on grays and black/white
let hsv = { h: 0, s: 0, v: 0 };
let hsl = { h: 0, s: 0, l: 0 };
let alpha = 1;
let initialValue = null;
let lastValue = null;
let isPickingFromScreen = false;
let parseContext = null;

/**
 * Opens the color picker as a popup next to `anchorEl`. Closes any picker that is already open.
 *
 * @param {HTMLElement} anchorEl - Element the picker is attached to.
 * @param {object} [opts]
 * @param {string} [opts.value] - Start color (any CSS color, e.g. '#1bb58f').
 * @param {boolean} [opts.allowAlpha=false] - Shows the alpha slider and returns '#rrggbbaa' for transparent colors.
 * @param {Array<{color: string, name?: string}>|(() => Array)} [opts.palette] - Colors shown below the picker, the name is the tooltip.
 * @param {'bottom'|'top'|'right'|'left'} [opts.placement='bottom'] - Preferred side, flipped if it doesn't fit on screen.
 * @param {'start'|'end'} [opts.align='start'] - Aligns the picker to the start or end edge of the anchor.
 * @param {(value: string) => void} [opts.onInput] - Called on every change while picking.
 * @param {(value: string) => void} [opts.onChange] - Called on close if the color changed.
 * @param {() => void} [opts.onClose]
 */
export function openColorPicker(anchorEl, opts = {}) {
  closeColorPicker();
  _ensureHost();
  host.showPopover();

  anchor = anchorEl;
  anchor?.classList.add('open');
  options = { allowAlpha: false, placement: 'bottom', align: 'start', ...opts };

  hsv = { h: 0, s: 0, v: 0 };
  _setFromRgb(parseColor(options.value) ?? { r: 0, g: 0, b: 0, a: 1 });
  initialValue = lastValue = _currentValue();

  panel = _buildPanel();
  host.append(panel);
  _buildBody(_getMode());
  _render();
  _place();
}

/** Closes the open picker. */
export function closeColorPicker() {
  if (!panel)
    return;

  panel.remove();
  panel = body = preview = hexInput = null;
  controls = [];
  host?.hidePopover();

  anchor?.classList.remove('open');
  anchor = null;

  const { onChange, onClose } = options;
  const changed = lastValue !== initialValue;
  options = null;

  if (changed)
    onChange?.(lastValue);
  onClose?.();
}

/** @returns {boolean} true if `element` opened the picker that is currently open. */
export function isColorPickerOpenFor(element) {
  return Boolean(panel && anchor && anchor === element);
}

/**
 * Shows `value` in a `.color-swatch` element (transparent colors over a checkerboard).
 * @param {HTMLElement} swatch
 * @param {string|null} value
 */
export function setSwatchColor(swatch, value) {
  swatch.dataset.color = value ?? '';
  swatch.style.setProperty('--swatch-color', value || 'transparent');
}

/**
 * Turns a `.color-swatch` button into a color input: a click opens the picker with the swatch color,
 * a second click closes it. The swatch follows the picked color.
 * @param {HTMLElement} swatch
 * @param {object} [opts] - Same options as openColorPicker(), `value` is taken from the swatch.
 * @returns {() => void} Removes the listener.
 */
export function bindColorSwatch(swatch, opts = {}) {
  const handler = () => {
    if (isColorPickerOpenFor(swatch)) {
      closeColorPicker();
      return;
    }

    openColorPicker(swatch, {
      ...opts,
      value: swatch.dataset.color,
      onInput: value => {
        setSwatchColor(swatch, value);
        opts.onInput?.(value);
      },
    });
  };

  swatch.addEventListener('click', handler);
  return () => swatch.removeEventListener('click', handler);
}

/**
 * Parses any CSS color.
 * @param {string} value
 * @returns {{r: number, g: number, b: number, a: number}|null} r/g/b 0-255, a 0-1
 */
export function parseColor(value) {
  if (typeof value !== 'string' || !value.trim())
    return null;

  const hex = value.trim().match(/^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    let digits = hex[1];
    if (digits.length <= 4)
      digits = [...digits].map(c => c + c).join('');

    const byte = i => parseInt(digits.slice(i, i + 2), 16);
    return { r: byte(0), g: byte(2), b: byte(4), a: digits.length === 8 ? byte(6) / 255 : 1 };
  }

  // other CSS colors (rgb(), hsl(), names): the canvas normalizes them to '#rrggbb' or 'rgba(...)'.
  // An invalid color leaves fillStyle unchanged, so two different start values give two results.
  parseContext ??= document.createElement('canvas').getContext('2d');
  parseContext.fillStyle = '#000000';
  parseContext.fillStyle = value;
  const normalized = parseContext.fillStyle;
  parseContext.fillStyle = '#ffffff';
  parseContext.fillStyle = value;
  if (parseContext.fillStyle !== normalized)
    return null;

  if (normalized.startsWith('#'))
    return parseColor(normalized);

  const numbers = normalized.match(/[\d.]+/g)?.map(Number);
  if (!numbers || numbers.length < 3)
    return null;

  return { r: numbers[0], g: numbers[1], b: numbers[2], a: numbers[3] ?? 1 };
}

// ─── Private: panel ──────────────────────────────────────────────────────────

function _ensureHost() {
  if (host?.isConnected)
    return;

  host = _div('color-picker-host');
  host.setAttribute('popover', 'manual');
  document.body.append(host);

  // Close on any press outside of the picker. A press on the anchor is left to
  // the anchor's own click handler (toggle).
  document.addEventListener('pointerdown', event => {
    if (!panel || isPickingFromScreen || panel.contains(event.target) || anchor?.contains(event.target))
      return;
    closeColorPicker();
  }, true);

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && panel && !_isModeSelectOpen())
      closeColorPicker();
  }, true);

  // the anchored position goes stale when something scrolls
  document.addEventListener('scroll', event => {
    if (panel && !panel.contains(event.target))
      closeColorPicker();
  }, true);
  window.addEventListener('resize', () => {
    if (panel)
      _place();
  });
}

function _buildPanel() {
  const element = _div('color-picker');
  element.setAttribute('role', 'dialog');

  const header = _div('color-picker__header');
  preview = _div('color-swatch color-picker__preview');
  header.append(preview);

  if ('EyeDropper' in window) {
    const eyedropper = document.createElement('button');
    eyedropper.type = 'button';
    eyedropper.className = 'color-picker__eyedropper';
    eyedropper.title = t('common.colorPicker.eyedropper');
    eyedropper.innerHTML = getEyedropperIcon();
    eyedropper.addEventListener('click', _pickFromScreen);
    header.append(eyedropper);
  }

  const modeSelect = document.createElement('select');
  modeSelect.className = 'color-picker__mode';
  for (const mode of MODES) {
    const option = document.createElement('option');
    option.value = mode.id;
    option.textContent = mode.name;
    modeSelect.append(option);
  }
  modeSelect.value = _getMode();
  modeSelect.addEventListener('change', () => {
    state.set('colorPickerMode', modeSelect.value);
    _buildBody(modeSelect.value);
    _render();
    _place();
  });
  header.append(modeSelect);

  body = _div('color-picker__body');

  hexInput = document.createElement('input');
  hexInput.type = 'text';
  hexInput.className = 'color-picker__hex';
  hexInput.spellcheck = false;
  _selectOnFocus(hexInput);
  hexInput.addEventListener('input', () => {
    const color = parseColor(hexInput.value);
    if (!color)
      return;
    _setFromRgb(color);
    _render(hexInput);
  });
  // rewrites the text to the normalized value (Enter or leaving the field)
  hexInput.addEventListener('change', () => _render());

  element.append(header, body, hexInput);

  const palette = _buildPalette();
  if (palette)
    element.append(palette);

  return element;
}

function _buildPalette() {
  const entries = (typeof options.palette === 'function' ? options.palette() : options.palette) ?? [];

  const palette = _div('color-picker__palette');
  for (const entry of entries) {
    const color = parseColor(entry?.color);
    if (!color)
      continue;

    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'color-swatch color-picker__palette-swatch';
    setSwatchColor(swatch, entry.color);
    if (entry.name)
      swatch.title = entry.name;

    swatch.addEventListener('click', () => {
      _setFromRgb(color);
      _render();
    });
    palette.append(swatch);
  }

  return palette.children.length ? palette : null;
}

/** Builds the controls of the given view (plus the alpha slider). */
function _buildBody(mode) {
  body.replaceChildren();
  controls = [];

  const add = control => {
    body.append(control.element);
    controls.push(control);
  };

  switch (mode) {
    case 'hsl-wheel':
      add(_createWheel());
      add(_createSlider({
        label: 'L', max: 100,
        get: () => hsl.l,
        set: l => _setFromHsl(hsl.h, hsl.s, l),
        stops: () => [0, 0.5, 1].map(l => _hslCss(hsl.h, hsl.s, l)),
      }));
      break;

    case 'hsl-sliders':
      add(_createSlider({
        label: 'H', max: 360,
        get: () => hsl.h / 360,
        set: h => _setFromHsl(h * 360, hsl.s, hsl.l),
        stops: () => [0, 60, 120, 180, 240, 300, 360].map(h => _hslCss(h, hsl.s, hsl.l)),
      }));
      add(_createSlider({
        label: 'S', max: 100,
        get: () => hsl.s,
        set: s => _setFromHsl(hsl.h, s, hsl.l),
        stops: () => [0, 1].map(s => _hslCss(hsl.h, s, hsl.l)),
      }));
      add(_createSlider({
        label: 'L', max: 100,
        get: () => hsl.l,
        set: l => _setFromHsl(hsl.h, hsl.s, l),
        stops: () => [0, 0.5, 1].map(l => _hslCss(hsl.h, hsl.s, l)),
      }));
      break;

    case 'rgb-sliders':
      for (const channel of ['r', 'g', 'b']) {
        add(_createSlider({
          label: channel.toUpperCase(), max: 255,
          get: () => _rgb()[channel] / 255,
          set: x => _setFromRgb({ ..._rgb(), [channel]: x * 255 }),
          stops: () => [0, 255].map(n => _rgbCss({ ..._rgb(), [channel]: n })),
        }));
      }
      break;

    default:
      add(_createSvSquare());
      add(_createSlider({
        get: () => hsv.h / 360,
        set: h => _setFromHsv(h * 360, hsv.s, hsv.v),
        stops: () => [0, 60, 120, 180, 240, 300, 360].map(h => _hslCss(h, 1, 0.5)),
      }));
      break;
  }

  if (options.allowAlpha) {
    add(_createSlider({
      label: 'A', max: 100,
      get: () => alpha,
      set: a => { alpha = a; },
      stops: () => [0, 1].map(a => _rgbCss(_rgb(), a)),
      checker: true,
    }));
  }
}

/** Updates every control, the preview and the hex field. `skip` is the input the user is typing in. */
function _render(skip = null) {
  controls.forEach(control => control.render(skip));

  const value = _currentValue();
  setSwatchColor(preview, value);
  if (hexInput !== skip)
    hexInput.value = value;

  if (value !== lastValue) {
    lastValue = value;
    options.onInput?.(value);
  }
}

/**
 * Places the picker on the preferred side of the anchor. If it doesn't fit there, the opposite
 * side is tried, then the two other sides. The result is kept inside the viewport.
 */
function _place() {
  const rect = anchor ? anchor.getBoundingClientRect() : { left: 0, right: 0, top: 0, bottom: 0 };
  const viewportWidth = document.documentElement.clientWidth;
  const viewportHeight = document.documentElement.clientHeight;
  const { width, height } = panel.getBoundingClientRect();

  const space = {
    bottom: viewportHeight - VIEWPORT_MARGIN - rect.bottom - ANCHOR_GAP,
    top: rect.top - VIEWPORT_MARGIN - ANCHOR_GAP,
    right: viewportWidth - VIEWPORT_MARGIN - rect.right - ANCHOR_GAP,
    left: rect.left - VIEWPORT_MARGIN - ANCHOR_GAP,
  };
  const fits = side => space[side] >= (side === 'top' || side === 'bottom' ? height : width);

  const preferred = OPPOSITE_SIDE[options.placement] ? options.placement : 'bottom';
  const side = [preferred, OPPOSITE_SIDE[preferred], ...CROSS_SIDES[preferred]].find(fits) ?? preferred;

  let left;
  let top;
  if (side === 'top' || side === 'bottom') {
    top = side === 'bottom' ? rect.bottom + ANCHOR_GAP : rect.top - height - ANCHOR_GAP;
    left = options.align === 'end' ? rect.right - width : rect.left;
  } else {
    left = side === 'right' ? rect.right + ANCHOR_GAP : rect.left - width - ANCHOR_GAP;
    top = options.align === 'end' ? rect.bottom - height : rect.top;
  }

  panel.style.left = `${_clamp(left, VIEWPORT_MARGIN, viewportWidth - width - VIEWPORT_MARGIN)}px`;
  panel.style.top = `${_clamp(top, VIEWPORT_MARGIN, viewportHeight - height - VIEWPORT_MARGIN)}px`;
}

async function _pickFromScreen() {
  isPickingFromScreen = true;
  try {
    const { sRGBHex } = await new window.EyeDropper().open();
    const color = parseColor(sRGBHex);
    if (color && panel) {
      _setFromRgb({ ...color, a: alpha });
      _render();
    }
  } catch {
    // cancelled with Escape
  } finally {
    isPickingFromScreen = false;
  }
}

function _getMode() {
  const mode = state.get('colorPickerMode');
  return MODES.some(m => m.id === mode) ? mode : MODES[0].id;
}

function _isModeSelectOpen() {
  try {
    return Boolean(panel.querySelector('select:open'));
  } catch {
    return false;
  }
}

// ─── Private: controls ───────────────────────────────────────────────────────

/** Saturation (x) / value (y) square for the current hue. */
function _createSvSquare() {
  const area = _div('color-picker__area');
  const canvas = document.createElement('canvas');
  const thumb = _div('color-picker__thumb');
  area.append(canvas, thumb);

  _addDrag(area, (x, y) => {
    _setFromHsv(hsv.h, x, 1 - y);
    _render();
  });

  return {
    element: area,
    render: () => {
      const { ctx, width, height } = _prepareCanvas(canvas);
      ctx.fillStyle = _hslCss(hsv.h, 1, 0.5);
      ctx.fillRect(0, 0, width, height);

      const white = ctx.createLinearGradient(0, 0, width, 0);
      white.addColorStop(0, 'rgba(255, 255, 255, 1)');
      white.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = white;
      ctx.fillRect(0, 0, width, height);

      const black = ctx.createLinearGradient(0, 0, 0, height);
      black.addColorStop(0, 'rgba(0, 0, 0, 0)');
      black.addColorStop(1, 'rgba(0, 0, 0, 1)');
      ctx.fillStyle = black;
      ctx.fillRect(0, 0, width, height);

      thumb.style.left = `${hsv.s * 100}%`;
      thumb.style.top = `${(1 - hsv.v) * 100}%`;
      thumb.style.backgroundColor = _rgbCss(_rgb());
    },
  };
}

/** HSL color wheel: hue = angle, saturation = distance from the center, for the current lightness. */
function _createWheel() {
  const area = _div('color-picker__area color-picker__area--wheel');
  const canvas = document.createElement('canvas');
  const thumb = _div('color-picker__thumb');
  area.append(canvas, thumb);

  _addDrag(area, (x, y) => {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
    _setFromHsl(hue, Math.min(1, Math.hypot(dx, dy) * 2), hsl.l);
    _render();
  });

  let drawnLightness = null;

  return {
    element: area,
    render: () => {
      const { ctx, width, height, resized } = _prepareCanvas(canvas);

      // the wheel only depends on the lightness
      if (resized || drawnLightness !== hsl.l) {
        const image = ctx.createImageData(width, height);
        const radius = width / 2;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = x + 0.5 - radius;
            const dy = y + 0.5 - radius;
            const distance = Math.hypot(dx, dy);
            const edge = _clamp(radius - distance, 0, 1);  // 1px anti-aliased border
            if (!edge)
              continue;

            const hue = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
            const [r, g, b] = _hslToRgb(hue, Math.min(1, distance / radius), hsl.l);
            const i = (y * width + x) * 4;
            image.data[i] = r;
            image.data[i + 1] = g;
            image.data[i + 2] = b;
            image.data[i + 3] = edge * 255;
          }
        }

        ctx.putImageData(image, 0, 0);
        drawnLightness = hsl.l;
      }

      const angle = hsl.h * Math.PI / 180;
      thumb.style.left = `${(0.5 + Math.cos(angle) * hsl.s / 2) * 100}%`;
      thumb.style.top = `${(0.5 + Math.sin(angle) * hsl.s / 2) * 100}%`;
      thumb.style.backgroundColor = _rgbCss(_rgb());
    },
  };
}

/**
 * Horizontal slider with a gradient track, optional label and number field.
 * @param {object} config
 * @param {string} [config.label]
 * @param {number} [config.max] - Scale of the number field (no field without it).
 * @param {() => number} config.get - Current value 0-1.
 * @param {(value: number) => void} config.set - Sets a value 0-1.
 * @param {() => string[]} config.stops - CSS colors of the track gradient.
 * @param {boolean} [config.checker] - Draws a checkerboard under the track (alpha).
 */
function _createSlider({ label = null, max = null, get, set, stops, checker = false }) {
  const row = _div('color-picker__row');

  if (label) {
    const labelElement = _div('color-picker__label');
    labelElement.textContent = label;
    row.append(labelElement);
  }

  const track = _div('color-picker__slider');
  const canvas = document.createElement('canvas');
  const thumb = _div('color-picker__thumb');
  track.append(canvas, thumb);
  row.append(track);

  _addDrag(track, x => {
    set(x);
    _render();
  });

  let number = null;
  if (max != null) {
    number = document.createElement('input');
    number.type = 'number';
    number.className = 'color-picker__number';
    number.min = 0;
    number.max = max;
    _selectOnFocus(number);
    number.addEventListener('input', () => {
      const n = Number(number.value);
      if (number.value === '' || Number.isNaN(n))
        return;
      set(_clamp(n / max, 0, 1));
      _render(number);
    });
    number.addEventListener('change', () => _render());
    row.append(number);
  }

  return {
    element: row,
    render: skip => {
      const { ctx, width, height } = _prepareCanvas(canvas);
      ctx.clearRect(0, 0, width, height);
      if (checker)
        _drawChecker(ctx, width, height);

      const colors = stops();
      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      thumb.style.left = `${get() * 100}%`;
      if (number && number !== skip)
        number.value = Math.round(get() * max);
    },
  };
}

/** Calls onMove(x, y) with the pointer position (0-1) inside `element` while the pointer is pressed. */
function _addDrag(element, onMove) {
  const move = event => {
    const rect = element.getBoundingClientRect();
    onMove(
      _clamp((event.clientX - rect.left) / rect.width, 0, 1),
      _clamp((event.clientY - rect.top) / rect.height, 0, 1)
    );
  };
  const end = () => element.removeEventListener('pointermove', move);

  element.addEventListener('pointerdown', event => {
    if (event.button !== 0)
      return;
    event.preventDefault();
    element.setPointerCapture(event.pointerId);
    element.addEventListener('pointermove', move);
    move(event);
  });
  element.addEventListener('pointerup', end);
  element.addEventListener('lostpointercapture', end);
}

/** Matches the canvas resolution to its CSS size (sharp on high DPI screens). */
function _prepareCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(canvas.clientWidth * ratio));
  const height = Math.max(1, Math.round(canvas.clientHeight * ratio));
  const resized = canvas.width !== width || canvas.height !== height;
  if (resized) {
    canvas.width = width;
    canvas.height = height;
  }
  return { ctx: canvas.getContext('2d'), width, height, resized };
}

function _drawChecker(ctx, width, height) {
  const style = getComputedStyle(panel);
  const size = Math.round(CHECKER_SIZE * (window.devicePixelRatio || 1));

  ctx.fillStyle = style.getPropertyValue('--color-picker-checker-light').trim();
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = style.getPropertyValue('--color-picker-checker-dark').trim();
  for (let y = 0; y < height; y += size) {
    for (let x = (y / size) % 2 ? 0 : size; x < width; x += size * 2)
      ctx.fillRect(x, y, size, size);
  }
}

// ─── Private: color model ────────────────────────────────────────────────────

function _setFromHsv(h, s, v) {
  hsv = { h, s, v };
  hsl = { h, ..._hsvToHsl(s, v) };
}

function _setFromHsl(h, s, l) {
  hsl = { h, s, l };
  hsv = { h, ..._hslToHsv(s, l) };
}

function _setFromRgb({ r, g, b, a = alpha }) {
  const next = _rgbToHsv(r, g, b);
  // grays have no hue and black has no saturation: keep the current ones so the controls don't jump
  if (next.v === 0)
    next.s = hsv.s;
  if (next.s === 0 || next.v === 0)
    next.h = hsv.h;

  _setFromHsv(next.h, next.s, next.v);
  alpha = options?.allowAlpha ? _clamp(a, 0, 1) : 1;
}

function _rgb() {
  return _hsvToRgb(hsv.h, hsv.s, hsv.v);
}

function _currentValue() {
  const { r, g, b } = _rgb();
  const byte = n => Math.round(_clamp(n, 0, 255)).toString(16).padStart(2, '0');
  const hex = `#${byte(r)}${byte(g)}${byte(b)}`;
  return options.allowAlpha && alpha < 1 ? hex + byte(alpha * 255) : hex;
}

/** h 0-360, s/v 0-1 -> r/g/b 0-255 */
function _hsvToRgb(h, s, v) {
  const f = n => {
    const k = (n + h / 60) % 6;
    return (v - v * s * Math.max(0, Math.min(k, 4 - k, 1))) * 255;
  };
  return { r: f(5), g: f(3), b: f(1) };
}

/** r/g/b 0-255 -> h 0-360, s/v 0-1 */
function _rgbToHsv(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);

  let h = 0;
  if (d) {
    if (max === r)
      h = ((g - b) / d) % 6;
    else if (max === g)
      h = (b - r) / d + 2;
    else
      h = (r - g) / d + 4;
  }

  return { h: (h * 60 + 360) % 360, s: max ? d / max : 0, v: max };
}

function _hsvToHsl(s, v) {
  const l = v * (1 - s / 2);
  return { s: l === 0 || l === 1 ? 0 : (v - l) / Math.min(l, 1 - l), l };
}

function _hslToHsv(s, l) {
  const v = l + s * Math.min(l, 1 - l);
  return { s: v ? 2 * (1 - l / v) : 0, v };
}

/** h 0-360, s/l 0-1 -> [r, g, b] 0-255 */
function _hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255;
  };
  return [f(0), f(8), f(4)];
}

function _hslCss(h, s, l) {
  return `hsl(${h} ${s * 100}% ${l * 100}%)`;
}

function _rgbCss({ r, g, b }, a = 1) {
  return `rgb(${r} ${g} ${b} / ${a})`;
}

/** Selects the whole text when the input gets focus (click or Tab). */
function _selectOnFocus(input) {
  let justFocused = false;

  input.addEventListener('focus', () => {
    input.select();
    justFocused = true;
  });
  // the mouseup of the focusing click would place the caret and undo the selection
  input.addEventListener('mouseup', event => {
    if (justFocused)
      event.preventDefault();
    justFocused = false;
  });
  input.addEventListener('blur', () => {
    justFocused = false;
  });
}

function _div(className) {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

function _clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}
