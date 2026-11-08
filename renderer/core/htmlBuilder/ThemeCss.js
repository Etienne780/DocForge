import { getThemeValue } from '@data/DocThemeManager.js';
import { MAX_TABLE_LINE_WIDTH } from '@core/markdownParser/MarkdownParser.js';
import { DEFAULT_TAB_SIZE, TAB_SIZE_RANGE, normalizeLineEndings } from '@common/Common.js';
import baseCssRaw from './ExportBase.css?raw';

// line endings depend on the checkout (git autocrlf), the output must not
const baseCss = normalizeLineEndings(baseCssRaw);

// ─── Theme -> CSS ──────────────────────────────────────────────────────────────

const FONT_STACKS = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  serif:  `Georgia, 'Times New Roman', serif`,
  mono:   `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`,
};

const FONT_MONO_STACK = `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`;

const THEME_COLOR_MAP = {
  'background':           '--bg',
  'background-surface':   '--bg1',
  'background-elevated':  '--bg2',
  'border':               '--brd',
  'text-primary':         '--text',
  'text-secondary':       '--text2',
  'text-muted':           '--muted',
  'accent':               '--accent',
  'accent-hover':         '--accent-hover',
  'link':                 '--link',
  'link-underline':       '--link-ul',
  'code-background':      '--cbg',
  'code-border':          '--cbrd',
  'code-text':            '--ctext',
  'code-tag-text':        '--ctag-text',
  'code-diff-add':        '--code-diff-add',
  'code-diff-removed':        '--code-diff-removed',
  'code-indent-guide':    '--code-indent-guide',
  'heading':              '--heading-color',
  'table-highlight':      '--table-hl',
  'table-hover':          '--table-hover',
  'table-stripe':         '--table-stripe',
  'checkbox':             '--checkbox',
  'bullet':               '--bullet',
  'footnote':             '--footnote',
  'section-background':   '--section-bg',
  'section-title':        '--section-title',
  'section-border':       '--section-brd',
  'section-icon':         '--section-icon',
  // only set while active, used by buildAreaColorCSS()
  'header-background':    '--header-bg',
  'header-text':          '--header-text',
  'sidebar-background':   '--sidebar-bg',
  'sidebar-text':         '--sidebar-text',
  'toc-background':       '--toc-bg',
  'toc-text':             '--toc-text',
};

/**
 * @param {string} key - theme entry name
 * @returns {string|null} the CSS variable of a theme color
 */
export function getThemeColorVar(key) {
  return THEME_COLOR_MAP[key] ?? null;
}

/**
 * Areas of the export with their own colors. `surface` is the variable the
 * area is painted with by default, `paint` sets the background explicitly
 * (the TOC has none of its own).
 */
const THEME_COLOR_AREAS = [
  { key: 'header',  selector: '.doc-header',    surface: '--bg1' },
  { key: 'sidebar', selector: '.nav-container', surface: '--bg1' },
  { key: 'toc',     selector: '.toc',           surface: '--bg', paint: true },
];

/**
 * Overrides the page colors inside an area whose background / text color is
 * active. The shades (surfaces, borders, secondary and muted text) are mixed
 * from the area colors, so everything inside (search field, buttons, ...)
 * stays readable.
 * @param {Object} theme
 * @returns {string}
 */
function buildAreaColorCSS(theme) {
  const rules = [];

  for (const { key, selector, surface, paint } of THEME_COLOR_AREAS) {
    const hasBg = getThemeValue(theme, `${key}-background`) != null;
    const hasText = getThemeValue(theme, `${key}-text`) != null;
    const props = [];

    if (hasBg) {
      const bg = `var(--${key}-bg)`;
      props.push(
        `--bg: ${bg};`,
        `--bg1: ${bg};`,
        `--bg2: color-mix(in srgb, ${bg} 88%, var(--text));`,
        `--brd: color-mix(in srgb, ${bg} 78%, var(--text));`,
      );
      if (paint)
        props.push(`background: ${bg};`);
    }

    if (hasText) {
      const text = `var(--${key}-text)`;
      props.push(
        `--text: ${text};`,
        `--text2: color-mix(in srgb, ${text} 85%, var(${surface}));`,
        `--muted: color-mix(in srgb, ${text} 65%, var(${surface}));`,
        `--heading-color: ${text};`,
      );
    }

    if (props.length)
      rules.push(`${selector} { ${props.join(' ')} }`);
  }

  return rules.join('\n');
}

const FALLBACK_MAP = {
  '--ctag-text': '--muted',
  // text color: brighter cells in dark themes, darker ones in light themes
  '--table-hl': '--text',
  '--table-hover': '--text',
  '--table-stripe': '--text',
  '--checkbox': '--accent',
  '--bullet': '--text',
  '--footnote': '--link',
  // --section-bg has none: the CSS default is a tint of the accent color
  '--section-title': '--heading-color',
  '--section-brd': '--brd',
  '--section-icon': '--accent',
};

export function buildThemeCSS(theme) {
  const tv = key => getThemeValue(theme, key);

    const buildCSSVar = (varName, opts = {}) => {
      let resolved;
    
      if (opts.key != null) {
        resolved = tv(opts.key);
      } else {
        resolved = opts.value;
      }
    
      if (resolved == null) {
        const fallback = FALLBACK_MAP[varName];
        if (fallback) {
          return `  ${varName}: var(${fallback});`;
        }
        return null;
      }
    
      return `  ${varName}: ${resolved}${opts.suffix ?? ''};`;
    };

  const colors = Object.entries(THEME_COLOR_MAP)
    .map(([k, v]) => buildCSSVar(v, { key: k}));

  const codeSize = tv('font-size-code') ?? 14;
  const bodyTypo = tv('typography-body') ?? 'system';
  const headingTypo = tv('typography-heading') ?? 'system';

  const sizes = [
    buildCSSVar('--header-height', { key: 'header-height', suffix: 'px' }),
    buildCSSVar('--font-size', { key: 'font-size', suffix: 'px' }),
    buildCSSVar('--font-size-code', { key: 'font-size-code', suffix: 'px' }),

    buildCSSVar('--font-size-code-tag', {
      value: Math.max(10, codeSize - 1),
      suffix: 'px'
    }),

    buildCSSVar('--h1', { key: 'heading-h1', suffix: 'px' }),
    buildCSSVar('--h2', { key: 'heading-h2', suffix: 'px' }),
    buildCSSVar('--h3', { key: 'heading-h3', suffix: 'px' }),
    buildCSSVar('--h4', { key: 'heading-h4', suffix: 'px' }),

    buildCSSVar('--max-width', { key: 'content-max-width', suffix: 'px' }),
    buildCSSVar('--padding', { key: 'padding-content', suffix: 'px' }),
    buildCSSVar('--code-radius', { key: 'code-radius', suffix: 'px' }),

    buildCSSVar('--gap-p', { key: 'gap-paragraph', suffix: 'px' }),
    buildCSSVar('--gap-h', { key: 'gap-heading', suffix: 'px' }),
    buildCSSVar('--gap-code', { key: 'code-block-gap', suffix: 'px' }),
    buildCSSVar('--line-height',      { key: 'line-height' }),          // unitless
    buildCSSVar('--code-line-height', { key: 'code-line-height' }),     // unitless

    buildCSSVar('--sidebar-width-px',   { key: 'sidebar-width-px',  suffix: 'px' }),
    buildCSSVar('--sidebar-width-per',  { key: 'sidebar-width-per', suffix: '%' }),
    buildCSSVar('--sidebar-min-width',  { key: 'sidebar-min-width', suffix: 'px' }),
    buildCSSVar('--toc-width-px',       { key: 'toc-width-px',      suffix: 'px' }),
    buildCSSVar('--toc-width-per',      { key: 'toc-width-per',     suffix: '%' }),
    buildCSSVar('--toc-min-width',      { key: 'toc-min-width',     suffix: 'px' }),

    buildCSSVar('--list-gap',         { key: 'list-item-gap',          suffix: 'px' }),
    buildCSSVar('--table-pad',        { key: 'table-cell-padding',     suffix: 'px' }),
    buildCSSVar('--bq-border',        { key: 'blockquote-border-width',suffix: 'px' }),
    buildCSSVar('--bq-radius',        { key: 'blockquote-radius',      suffix: 'px' }),

    buildCSSVar('--scrollbar-size',   { key: 'scrollbar-size',   suffix: 'px' }),
  ];

  const fonts = [
    buildCSSVar('--font-body', {
      value: FONT_STACKS[bodyTypo] ?? FONT_STACKS.system
    }),
    buildCSSVar('--font-heading', {
      value: FONT_STACKS[headingTypo] ?? FONT_STACKS.system
    }),
    buildCSSVar('--font-mono', {
      value: FONT_MONO_STACK
    }),
  ];

  const colorCSS = colors.filter(Boolean).join('\n');
  const sizeCSS  = sizes.filter(Boolean).join('\n');
  const fontCSS  = fonts.filter(Boolean).join('\n');

  return `:root {\n${colorCSS}\n${sizeCSS}\n${fontCSS}\n}\n${buildAreaColorCSS(theme)}`;
}

/** {line=N} of table rows/cols: .tbl-line-b-N (bottom) and .tbl-line-r-N (right) */
function buildTableLineCSS() {
  const rules = [];
  for (let width = 1; width <= MAX_TABLE_LINE_WIDTH; width++) {
    rules.push(`table .tbl-line-b-${width} { border-bottom-width: ${width}px; }`);
    rules.push(`table .tbl-line-r-${width} { border-right-width: ${width}px; }`);
  }
  return rules.join('\n');
}

/**
 * Default tab size of <pre> plus --code-tab-size of the code-tab-N classes
 * (N = every valid project tab size).
 */
function buildTabSizeCSS() {
  const rules = [];
  for (let size = TAB_SIZE_RANGE.min; size <= TAB_SIZE_RANGE.max; size++)
    rules.push(`.code-tab-${size} { --code-tab-size: ${size}; }`);
  return `pre { tab-size: var(--code-tab-size, ${DEFAULT_TAB_SIZE}); }\n` + rules.join(' ');
}

/** Static CSS of the export and the previews (ExportBase.css) with the generated rules filled in. */
export function buildBaseCSS() {
  return baseCss
    .replace('/* @generated tab-size */', () => buildTabSizeCSS())
    .replace('/* @generated table-lines */', () => buildTableLineCSS())
    .trim();
}

export function buildCombinedCSS(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  return buildThemeCSS(resolvedTheme) + '\n' + buildBaseCSS();
}
