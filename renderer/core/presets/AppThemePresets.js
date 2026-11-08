/**
 * Built-in app themes (@data/AppThemeManager.js). Each has a dark and a light variant.
 * Colors are CSS variable names without '--'. A missing color falls back to the
 * DocForge value of the same mode (the [data-theme] blocks in main.css), so DocForge
 * itself needs none.
 */

const SOFT_DARK = {
  'background-dark': '#15171c', 'background': '#1e2128', 'background-elevated': '#232731',
  'background-surface': '#2c313c', 'background-raised': '#343a47', 'background-overlay': '#2a2f3a',
  'background-danger-lighter': '#f0a0a0', 'background-danger': '#d96c6c', 'background-danger-darker': '#a84444',
  'text-warning': '#e5c07b',
  'resize-handle-color': '#262a33', 'resize-handle-hover-color': '#3a404d',
  'border-color': '#343a47', 'border-color-secondary': '#6b7385',
  'text-primary': '#d5d8de', 'text-muted': '#9aa1ae', 'accent-color': '#7aa2d6',
  'link-color': '#8fb3e0', 'link-underline': 'rgba(143, 179, 224, 0.3)',
  'code-background': '#181b21', 'code-text': '#a8cc8c',
  'accent-bg-lighter': '#3e5675', 'accent-bg': '#31435a', 'accent-bg-darker': '#1c2633', 'focus-ring': '#2f4560',
  'scrollbar-thumb': '#343a47', 'scrollbar-thumb-raised': '#4f5666', 'scrollbar-track': '#1a1d23',
  'editor-color-text': '#d5d8de', 'editor-color-markup': '#6b7385', 'editor-color-heading': '#7aa2d6',
  'editor-color-bold': '#eceff4', 'editor-color-italic': '#d5d8de', 'editor-color-code': '#d8b47a',
  'editor-color-code-block': '#c3b48f', 'editor-color-link': '#8fb3e0', 'editor-color-link-url': '#7d8597',
  'editor-color-ref': '#6fb8a6', 'editor-color-ref-broken': '#d96c6c', 'editor-color-anchor': '#b19cd9',
  'editor-color-property': '#88c0d0', 'editor-color-property-value': '#a8cc8c', 'editor-color-comment': '#6b7385',
  'editor-color-list': '#d8b47a', 'editor-color-quote': '#a8cc8c', 'editor-color-table': '#7d8597',
  'editor-color-selection': 'rgba(122, 162, 214, 0.28)', 'editor-color-search-match': 'rgba(216, 180, 122, 0.25)',
  'editor-color-search-active': 'rgba(216, 180, 122, 0.5)', 'editor-color-search-active-border': '#d8b47a',
  'editor-color-search-range': 'rgba(122, 162, 214, 0.08)',
};

const SOFT_LIGHT = {
  'background-dark': '#a7abb3', 'background': '#eef0f3', 'background-elevated': '#e2e5ea',
  'background-surface': '#cfd3da', 'background-raised': '#d7dbe1', 'background-overlay': '#c9cdd4',
  'background-danger-lighter': '#a82828', 'background-danger': '#cc4b4b', 'background-danger-darker': '#e48a8a',
  'text-warning': '#b38900',
  'resize-handle-color': '#cdd1d8', 'resize-handle-hover-color': '#a9aeb7',
  'border-color': '#bcc1c9', 'border-color-secondary': '#6d7380',
  'text-primary': '#2b2f36', 'text-muted': '#5a606b', 'accent-color': '#3f6fae',
  'link-color': '#2f5fa8', 'link-underline': 'rgba(47, 95, 168, 0.4)',
  'code-background': '#1e2128', 'code-text': '#a8cc8c',
  'accent-bg-lighter': '#7d9cc6', 'accent-bg': '#a9c0de', 'accent-bg-darker': '#dbe5f2', 'focus-ring': '#c4d4ea',
  'scrollbar-thumb': '#9aa0aa', 'scrollbar-thumb-raised': '#b5bac2', 'scrollbar-track': '#cfd3da',
  'editor-color-text': '#2b2f36', 'editor-color-markup': '#8a909b', 'editor-color-heading': '#2f5fa8',
  'editor-color-bold': '#000000', 'editor-color-italic': '#2b2f36', 'editor-color-code': '#9a5b13',
  'editor-color-code-block': '#6e5a2e', 'editor-color-link': '#2f5fa8', 'editor-color-link-url': '#5f6b80',
  'editor-color-ref': '#2e7d6b', 'editor-color-ref-broken': '#c03a3a', 'editor-color-anchor': '#7046b8',
  'editor-color-property': '#1f7a99', 'editor-color-property-value': '#4a7a1f', 'editor-color-comment': '#8a909b',
  'editor-color-list': '#9a5b13', 'editor-color-quote': '#4a7a1f', 'editor-color-table': '#8a909b',
  'editor-color-selection': 'rgba(63, 111, 174, 0.22)', 'editor-color-search-match': 'rgba(200, 140, 30, 0.22)',
  'editor-color-search-active': 'rgba(200, 140, 30, 0.45)', 'editor-color-search-active-border': '#9a5b13',
  'editor-color-search-range': 'rgba(47, 95, 168, 0.07)',
};

const HIGH_CONTRAST_DARK = {
  'background-dark': '#000000', 'background': '#000000', 'background-elevated': '#0a0a0a',
  'background-surface': '#1a1a1a', 'background-raised': '#1f1f1f', 'background-overlay': '#141414',
  'background-danger-lighter': '#ff9b9b', 'background-danger': '#ff4d4d', 'background-danger-darker': '#c00000',
  'text-warning': '#ffd400',
  'resize-handle-color': '#3a3a3a', 'resize-handle-hover-color': '#7a7a7a',
  'border-color': '#6e6e6e', 'border-color-secondary': '#bdbdbd',
  'text-primary': '#ffffff', 'text-muted': '#d0d0d0', 'accent-color': '#00e5b0',
  'link-color': '#6cb6ff', 'link-underline': 'rgba(108, 182, 255, 0.6)',
  'code-background': '#000000', 'code-text': '#7dff9b',
  'accent-bg-lighter': '#007a5e', 'accent-bg': '#005c47', 'accent-bg-darker': '#00291f', 'focus-ring': '#00a37d',
  'popup-shadow-color': '#000000aa',
  'scrollbar-thumb': '#5a5a5a', 'scrollbar-thumb-raised': '#9a9a9a', 'scrollbar-track': '#000000',
  'editor-color-text': '#ffffff', 'editor-color-markup': '#a0a0a0', 'editor-color-heading': '#6cb6ff',
  'editor-color-bold': '#ffffff', 'editor-color-italic': '#ffffff', 'editor-color-code': '#ffcc4d',
  'editor-color-code-block': '#ffd98a', 'editor-color-link': '#6cb6ff', 'editor-color-link-url': '#b0b0ff',
  'editor-color-ref': '#00e5b0', 'editor-color-ref-broken': '#ff4d4d', 'editor-color-anchor': '#d9a6ff',
  'editor-color-property': '#6ce0ff', 'editor-color-property-value': '#a6ff6c', 'editor-color-comment': '#a0a0a0',
  'editor-color-list': '#ffcc4d', 'editor-color-quote': '#a6ff6c', 'editor-color-table': '#c0c0c0',
  'editor-color-selection': 'rgba(0, 229, 176, 0.35)', 'editor-color-search-match': 'rgba(255, 204, 77, 0.35)',
  'editor-color-search-active': 'rgba(255, 204, 77, 0.65)', 'editor-color-search-active-border': '#ffcc4d',
  'editor-color-search-range': 'rgba(108, 182, 255, 0.15)',
};

const HIGH_CONTRAST_LIGHT = {
  'background-dark': '#808080', 'background': '#ffffff', 'background-elevated': '#f2f2f2',
  'background-surface': '#d9d9d9', 'background-raised': '#e6e6e6', 'background-overlay': '#d0d0d0',
  'background-danger-lighter': '#8b0000', 'background-danger': '#c40000', 'background-danger-darker': '#ff6b6b',
  'text-warning': '#8a6d00',
  'resize-handle-color': '#c4c4c4', 'resize-handle-hover-color': '#7a7a7a',
  'border-color': '#5c5c5c', 'border-color-secondary': '#1f1f1f',
  'text-primary': '#000000', 'text-muted': '#2b2b2b', 'accent-color': '#006e54',
  'link-color': '#0033cc', 'link-underline': 'rgba(0, 51, 204, 0.6)',
  'code-background': '#000000', 'code-text': '#7dff9b',
  'accent-bg-lighter': '#3d8f7b', 'accent-bg': '#8fd3c2', 'accent-bg-darker': '#d5f2ea', 'focus-ring': '#7fcfba',
  'scrollbar-thumb': '#6e6e6e', 'scrollbar-thumb-raised': '#9a9a9a', 'scrollbar-track': '#e6e6e6',
  'editor-color-text': '#000000', 'editor-color-markup': '#5c5c5c', 'editor-color-heading': '#0033cc',
  'editor-color-bold': '#000000', 'editor-color-italic': '#000000', 'editor-color-code': '#8a4500',
  'editor-color-code-block': '#5c4200', 'editor-color-link': '#0033cc', 'editor-color-link-url': '#3d3d8f',
  'editor-color-ref': '#006e54', 'editor-color-ref-broken': '#c40000', 'editor-color-anchor': '#6a0dad',
  'editor-color-property': '#005f7f', 'editor-color-property-value': '#2e6b00', 'editor-color-comment': '#5c5c5c',
  'editor-color-list': '#8a4500', 'editor-color-quote': '#2e6b00', 'editor-color-table': '#5c5c5c',
  'editor-color-selection': 'rgba(0, 110, 84, 0.3)', 'editor-color-search-match': 'rgba(200, 120, 0, 0.3)',
  'editor-color-search-active': 'rgba(200, 120, 0, 0.55)', 'editor-color-search-active-border': '#8a4500',
  'editor-color-search-range': 'rgba(0, 51, 204, 0.1)',
};

// Solarized palette (Ethan Schoonover): base03 #002b36, base02 #073642, base01 #586e75, base00 #657b83,
// base0 #839496, base1 #93a1a1, base2 #eee8d5, base3 #fdf6e3, yellow #b58900, orange #cb4b16, red #dc322f,
// magenta #d33682, violet #6c71c4, blue #268bd2, cyan #2aa198, green #859900
const SOLARIZED_DARK = {
  'background-dark': '#001e26', 'background': '#002b36', 'background-elevated': '#01313d',
  'background-surface': '#073642', 'background-raised': '#0a4250', 'background-overlay': '#073642',
  'background-danger-lighter': '#f08080', 'background-danger': '#dc322f', 'background-danger-darker': '#a32420',
  'text-warning': '#b58900',
  'resize-handle-color': '#01313d', 'resize-handle-hover-color': '#0e4a59',
  'border-color': '#0e4a59', 'border-color-secondary': '#586e75',
  'text-primary': '#93a1a1', 'text-muted': '#839496', 'accent-color': '#2aa198',
  'link-color': '#268bd2', 'link-underline': 'rgba(38, 139, 210, 0.35)',
  'code-background': '#001e26', 'code-text': '#859900',
  'accent-bg-lighter': '#1f6f6a', 'accent-bg': '#12504e', 'accent-bg-darker': '#032a2c', 'focus-ring': '#165856',
  'scrollbar-thumb': '#0e4a59', 'scrollbar-thumb-raised': '#586e75', 'scrollbar-track': '#001e26',
  'editor-color-text': '#93a1a1', 'editor-color-markup': '#586e75', 'editor-color-heading': '#268bd2',
  'editor-color-bold': '#eee8d5', 'editor-color-italic': '#93a1a1', 'editor-color-code': '#b58900',
  'editor-color-code-block': '#b58900', 'editor-color-link': '#268bd2', 'editor-color-link-url': '#6c71c4',
  'editor-color-ref': '#2aa198', 'editor-color-ref-broken': '#dc322f', 'editor-color-anchor': '#d33682',
  'editor-color-property': '#2aa198', 'editor-color-property-value': '#859900', 'editor-color-comment': '#586e75',
  'editor-color-list': '#cb4b16', 'editor-color-quote': '#859900', 'editor-color-table': '#657b83',
  'editor-color-selection': 'rgba(42, 161, 152, 0.3)', 'editor-color-search-match': 'rgba(181, 137, 0, 0.3)',
  'editor-color-search-active': 'rgba(181, 137, 0, 0.55)', 'editor-color-search-active-border': '#b58900',
  'editor-color-search-range': 'rgba(38, 139, 210, 0.1)',
};

const SOLARIZED_LIGHT = {
  'background-dark': '#b9b3a0', 'background': '#fdf6e3', 'background-elevated': '#f5efdc',
  'background-surface': '#e4ddc8', 'background-raised': '#eee8d5', 'background-overlay': '#e4ddc8',
  'background-danger-lighter': '#a32420', 'background-danger': '#dc322f', 'background-danger-darker': '#f08080',
  'text-warning': '#b58900',
  'resize-handle-color': '#e4ddc8', 'resize-handle-hover-color': '#c9c2ac',
  'border-color': '#d6cfb9', 'border-color-secondary': '#93a1a1',
  'text-primary': '#586e75', 'text-muted': '#657b83', 'accent-color': '#2aa198',
  'link-color': '#268bd2', 'link-underline': 'rgba(38, 139, 210, 0.4)',
  'code-background': '#002b36', 'code-text': '#859900',
  'accent-bg-lighter': '#6fbfb8', 'accent-bg': '#a9d9d4', 'accent-bg-darker': '#ddf0ec', 'focus-ring': '#b5e0db',
  'scrollbar-thumb': '#c9c2ac', 'scrollbar-thumb-raised': '#b0aa95', 'scrollbar-track': '#eee8d5',
  'editor-color-text': '#586e75', 'editor-color-markup': '#93a1a1', 'editor-color-heading': '#268bd2',
  'editor-color-bold': '#073642', 'editor-color-italic': '#586e75', 'editor-color-code': '#b58900',
  'editor-color-code-block': '#866500', 'editor-color-link': '#268bd2', 'editor-color-link-url': '#6c71c4',
  'editor-color-ref': '#2aa198', 'editor-color-ref-broken': '#dc322f', 'editor-color-anchor': '#d33682',
  'editor-color-property': '#2aa198', 'editor-color-property-value': '#859900', 'editor-color-comment': '#93a1a1',
  'editor-color-list': '#cb4b16', 'editor-color-quote': '#859900', 'editor-color-table': '#93a1a1',
  'editor-color-selection': 'rgba(42, 161, 152, 0.25)', 'editor-color-search-match': 'rgba(181, 137, 0, 0.25)',
  'editor-color-search-active': 'rgba(181, 137, 0, 0.5)', 'editor-color-search-active-border': '#b58900',
  'editor-color-search-range': 'rgba(38, 139, 210, 0.08)',
};

export const DEFAULT_APP_THEME_ID = 'docforge';

/** @type {Array<{ id: string, name: string, builtIn: true, colors: { dark: Object, light: Object } }>} */
export const APP_THEME_PRESETS = [
  { id: DEFAULT_APP_THEME_ID, name: 'DocForge',      builtIn: true, colors: { dark: {},                 light: {} } },
  { id: 'high-contrast',      name: 'High contrast', builtIn: true, colors: { dark: HIGH_CONTRAST_DARK, light: HIGH_CONTRAST_LIGHT } },
  { id: 'soft',               name: 'Soft',          builtIn: true, colors: { dark: SOFT_DARK,          light: SOFT_LIGHT } },
  { id: 'solarized',          name: 'Solarized',     builtIn: true, colors: { dark: SOLARIZED_DARK,     light: SOLARIZED_LIGHT } },
];
