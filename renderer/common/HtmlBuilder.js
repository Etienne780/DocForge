import { APP_NAME, APP_VERSION } from '@core/AppMeta.js';
import { session } from '@core/SessionState.js';
import { blobManager } from '@core/BlobManager.js';
import { syntaxHighlighter } from '@core/syntaxHighlighter/SyntaxHighlighter.js';
import {
  DOC_THEME_BLOB_SECTION,
  getCurrentTheme,
  getPresetDocThemes,
  getLanguageStyleId,
  getThemeValue,
  ResolveProjectTheme,
  getFallbackTheme
} from '@data/DocThemeManager.js';
import { findSyntaxDefinitionByName } from '@data/SyntaxDefinitionManager.js';

import { parseMarkdownAsync, cleanupCodeBlockCache } from './MarkdownParser.js';
import { escapeHTML } from './Common.js';

const HTML_BUILDER_SCRIPT_BLOB_SECTION = 'html_builder-blob_section';

// ─── Theme -> CSS ──────────────────────────────────────────────────────────────

const FONT_STACKS = {
  system: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
  serif:  `Georgia, 'Times New Roman', serif`,
  mono:   `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`,
};

const FONT_MONO_STACK = `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`;

const THEME_COLOR_MAP = {
  'background':          '--bg',
  'background-surface':  '--bg1',
  'background-elevated': '--bg2',
  'border':              '--brd',
  'text-primary':        '--text',
  'text-secondary':      '--text2',
  'text-muted':          '--muted',
  'accent':              '--accent',
  'accent-hover':        '--accent-hover',
  'link':                '--link',
  'link-underline':      '--link-ul',
  'code-background':     '--cbg',
  'code-border':         '--cbrd',
  'code-text':           '--ctext',
  'code-tag-text':       '--ctag-text',
  'heading':             '--heading-color',
};

const FALLBACK_MAP = {
  '--ctag-text': '--muted'
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

  return `:root {\n${colorCSS}\n${sizeCSS}\n${fontCSS}\n}`;
}

export function buildBaseCSS() {
  return `
/* -- Reset ---------------------------------------------------------------- */
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }

/* -- Spacing scale (static — not theme-controlled) ------------------------ */
:root {
  --indent-spacing: 16px;
  --sp-xxs: 4px;
  --sp-xs:  8px;
  --sp-s:   12px;
  --sp-m:   16px;
  --sp-l:   20px;
  --sp-xl:  24px;
  --sp-xxl:  28px;
}

/* -- Base ------------------------------------------------------------------- */
html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}
  
body {
  font-family: var(--font-body);
  background: var(--bg);
  color: var(--text);
  font-size: var(--font-size);
  line-height: var(--line-height, 1.8);
}

.document {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  z-index: 9999;
}

:focus:not(:focus-visible) {
  outline: none;
}

/* -- Scrollbars ---------------------------------------------------------- */
::-webkit-scrollbar {
  width: var(--scrollbar-size);
  height: var(--scrollbar-size);
}
::-webkit-scrollbar-track {
  background: var(--bg);
}
::-webkit-scrollbar-thumb {
  background: var(--bg1);
  border-radius: 1px;
}
::-webkit-scrollbar-thumb:hover {
  background: var(--bg2);
}
::-webkit-scrollbar-corner {
  background: var(--bg);
}

/* -- Layout ------------------------------------------------------------- */
.layout {
  display: flex;
  flex: 1;
  min-height: 0px;
  width: 100%;
}

.content-col { 
  display: flex; 
  flex-direction: column; 
  flex: 1; 
  min-width: 0;
  width: 100%; 
}

.content-row {
  display: flex; 
  flex-direction: row; 
  flex: 1;
  min-width: 0; 
  height: 100%;
}

/* -- Header ------------------------------------------------------------- */
.doc-header {
  z-index: 30;
  height: var(--header-height);
  display: flex;
  align-items: center;
  padding: 0 8px;
  flex-shrink: 0;
  transition: transform 0.25s ease, opacity 0.25s ease;
}
.doc-header.header-style-solid {
  background: var(--bg1);
  border-bottom: 1px solid var(--brd);
}
.doc-header.hidden-scrolled {
  transform: translateY(-100%);
  opacity: 0;
  pointer-events: none;
}
.doc-header .header-title {
  font-family: var(--font-heading);
  font-size: 15px;
  color: var(--text2);
  font-weight: 600;
}
/* header-show:never */
.doc-header.header-never { display: none; }


/* -- TOC ------------------------------------------------------------ */
.toc {
  width: fit-content;
  min-width: var(--toc-min-width, 0px);
  flex-shrink: 0;
  padding: 40px 16px;
  position: sticky;
  top: 0;
  overflow-y: auto;
  border-left: 1px solid var(--brd);
  height: calc(100% - 20px);
  margin-top: 10px
}
.toc.toc-left {
  border-left: none;
  border-right: 1px solid var(--brd);
  padding: 40px 16px 40px 0;
  order: -1;
}
.toc.toc-hidden { display: none; }
@media (max-width: 1100px) { .toc.toc-desktop { display: none; } }
.toc-title {
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--muted);
  margin-bottom: 10px;
  padding-left: 8px;
}
.toc-link {
  display: block;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  padding: 3px 8px;
  border-radius: 3px;
  text-decoration: none;
  border-bottom: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color .15s, background .15s;
}
.toc-link:hover { color: var(--accent-hover); background: color-mix(in srgb, var(--accent) 8%, transparent); border-bottom: none; }
.toc-link.active { color: var(--accent); }
.toc-link[data-level="2"] { padding-left: 16px; }
.toc-link[data-level="3"] { padding-left: 26px; font-size: 10px; }
.toc-link[data-level="4"] { padding-left: 36px; font-size: 10px; }
.toc-width-px { width: var(--toc-width-px, 200px); }
.toc-width-per { width: var(--toc-width-per, 20%); }

/* Nav verstecken via content-show-nav:never */
.nav.nav-hidden { display: none; }

/* -- Sidebar --------------------------------------------------------- */
.nav-container { display: flex; flex-direction: column; height: 100%; background: var(--bg1); }
.nav {
  width: fit-content;
  min-width: var(--sidebar-min-width, 0px);
  border-right: 1px solid var(--brd);
  padding: 20px 0;
  position: sticky;
  top: 0;
  height: 100%;
  overflow-y: auto;
  flex-shrink: 0;
  scrollbar-gutter: stable;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--brd);
  margin-bottom: 8px;
}

.nav-visibility-constrains {
  display: none;
}

.nav-brand {
  padding: 0;
  border-bottom: none;
  margin-bottom: 0;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 18px;
  color: var(--accent);
  font-family: var(--font-heading);
  font-style: italic;
}

.nav-brand small {
  display: block;
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
  font-style: normal;
}

.nav-width-px { width: var(--sidebar-width-px, 200px); }
.nav-width-per { width: var(--sidebar-width-per, 20%); }
.sidebar-section { display: none; }
.sidebar-section.active { display: block; }
.nav-row { display: flex; align-items: center; gap: 4px; padding: 3px 0; padding-left: var(--indent, 16px); padding-right: var(--sp-xxs, 4px); border-bottom: unset; color: var(--muted); font-family: var(--font-mono); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; transition: color .15s; text-decoration: none; cursor: pointer; }
.nav-row:hover { color: var(--accent); }
.nav-row--parent { color: var(--text2); font-weight: 600; margin-top: 6px; border-bottom: unset; }
.nav-row--parent .nav-link { color: inherit; text-decoration: none; overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; border-bottom: unset; }
.nav-row--parent .nav-link:hover { color: var(--accent); }
.nav-chevron-btn { flex-shrink: 0; background: none; border: none; cursor: pointer; color: var(--muted); font-size: 20px; padding: 0 4px; line-height: 1; transition: color .15s, transform .2s; }
.nav-chevron-btn:hover { color: var(--accent); }
.nav-chevron-btn:focus-visible { outline: none; };
.nav-children { overflow: hidden; transition: max-height .2s ease, opacity .15s ease; max-height: 2000px; opacity: 1; }
.nav-group.collapsed .nav-children { max-height: 0; opacity: 0; }
.nav-group.collapsed .nav-chevron-btn { transform: rotate(-90deg); }


/* -- nav-sidebar ---------------------------------------------------------- */
.document.sidebar-collapsed .nav {
  width: 0;
  min-width: 0;
  padding: 0;
  border-right: none;
  overflow: hidden;
}

.nav-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: 1px solid var(--brd);
  background: transparent;
  color: var(--text2);
  cursor: pointer;
  flex-shrink: 0;
  margin: 8px;
}
.nav-toggle-btn:hover { color: var(--accent); border-color: var(--accent); }

.nav-close-btn {
  display: none;
  flex-shrink: 0;
  margin: 0;
  margin-left: auto;
}

@media (max-width: 768px) {
  .nav {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 100;
    width: min(82vw, 280px) !important;
    padding: 20px 0 !important;
    border-right: 1px solid var(--brd) !important;
    overflow-y: auto !important;
    box-shadow: 4px 0 24px rgba(0,0,0,0.35);
    transform: translateX(0);
    transition: transform 0.25s ease;
  }
  .document.sidebar-collapsed .nav {
    transform: translateX(-100%);
  }

  .nav-visibility-constrains { display: flex; }

  .nav-close-btn { display: flex; }

  .nav-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 99;
  }
  .document:not(.sidebar-collapsed) .nav-backdrop {
    display: block;
  }
}

/* -- Tab navigation bar --------------------------------------------------- */
.tab-nav { display: flex; align-items: stretch; background: var(--bg1); border-bottom: 2px solid var(--brd); scrollbar-gutter: stable both-edges; position: sticky; top: 0; z-index: 20; flex-shrink: 0; }
.tab-nav.hidden { display: none; }
.tab-nav-container { display: flex; flex-wrap: nowrap; overflow-x: auto; overflow-y: hidden; padding: 0 8px; }
.tab-btn { background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: 0px; padding: 12px 18px; cursor: pointer;  white-space: nowrap; font-family: var(--font-mono); font-size: 12px; text-transform: uppercase; letter-spacing: .07em; color: var(--muted); transition: color .15s, border-color .15s; }
.tab-btn:hover { color: var(--text); }
.tab-btn.active { color: var(--accent); border-bottom-color: var(--accent); }

/* -- Dynamic content area with crossfade ---------------------------------- */
.content-stage {
  display: flex;
  justify-content: center;
  position: relative;
  height: 100%;
  width: 100%;
  overflow: hidden;
}
.dynamic-content {
  padding: 60px var(--padding);
  max-width: var(--max-width);
  transition: opacity 0.2s ease-in-out;
  opacity: 1;
  flex: 1;
  overflow: auto;
  scroll-behavior: auto;
}
.dynamic-content.fade-out {
  opacity: 0;
}
.preview-root {
  padding: var(--padding);
  max-width: var(--max-width);
  margin: 0 auto;
  overflow: auto;
}

/* -- Hidden templates container -------------------------------------------- */
.node-templates {
  display: none;
}

/* -- Headings -------------------------------------------------------------- */
h1 { font-family: var(--font-heading); font-size: var(--h1); font-weight: 600; letter-spacing: -0.02em; margin: 0 0 var(--sp-m); color: var(--heading-color); line-height: 1.3; }
h2 { font-family: var(--font-heading); font-size: var(--h2); font-weight: 600; margin: var(--gap-h) 0 10px; color: var(--heading-color); }
h3 { font-family: var(--font-mono); font-size: var(--h3); font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: var(--heading-color); margin: 24px 0 8px; }
h4 { font-family: var(--font-mono); font-size: var(--h4); color: var(--heading-color); margin: 18px 0 6px; }

/* -- Body text ------------------------------------------------------------- */
p { font-family: var(--font-body); margin: 0 0 var(--gap-p); line-height: 1.75; color: var(--text); }
a { color: var(--link); text-decoration: none; border-bottom: 1px solid var(--link-ul); transition: border-color .12s; }
a:hover { border-color: var(--link); }
strong { font-weight: 600; color: var(--text); }
em { font-style: italic; color: var(--accent); }

/* -- Inline code ----------------------------------------------------------- */
code { font-family: var(--font-mono); font-size: var(--font-size-code); background: var(--cbg); color: var(--ctext); padding: var(--sp-xxs) var(--sp-xs); border-radius: 3px; border: 2px solid var(--brd); }

/* -- Code blocks ----------------------------------------------------------- */
pre { position: relative; background: var(--cbg); border: 2px solid var(--cbrd); border-radius: var(--code-radius); padding: var(--sp-s) var(--sp-m); margin: 0 0 var(--sp-s); overflow-x: auto; }
pre code { background: none; border: none; padding: 0; font-size: var(--font-size-code); line-height: var(--code-line-height, 1.65); color: var(--ctext); }
.code-block-wrapper { min-width: 250px; margin-top: var(--gap-code); position: relative; display: flex; flex-direction: column; width: 100%; }
.code-block-wrapper pre { margin: 0 0 var(--sp-xs); border-radius: 0 6px 6px 6px; }
.code-block-wrapper--no-tag pre { border-radius: 6px; }
.code-language-tag { position: absolute; display: flex; align-items: center; justify-content: center; height: calc(var(--font-size-code-tag) + var(--sp-xs) + 2px); top: calc(-1 * (var(--font-size-code-tag) + var(--sp-xs))); width: fit-content; padding: 0 var(--sp-xs); border: 2px solid var(--cbrd); border-bottom: none; border-radius: 4px 4px 0 0; background: var(--cbg); font-family: var(--font-mono); font-size: var(--font-size-code-tag); color: var(--ctag-text); text-transform: uppercase; letter-spacing: 0.08em; }
.code-language-tag--unrecognized { color: var(--muted); }

/* -- Lists ----------------------------------------------------------------- */
ul, ol { padding-left: 24px; margin: 8px 0 var(--gap-p); font-family: var(--font-body); color: var(--text); }
li { margin: var(--list-gap, 4px) 0; line-height: 1.7; }

/* -- Blockquote ------------------------------------------------------------ */
blockquote {
  margin: 14px 0; 
  padding: 8px 14px; 
  background: color-mix(in srgb, var(--accent) 8%, transparent); 
  color: var(--muted); 
  border-radius: 0 var(--bq-radius, 5px) var(--bq-radius, 5px) 0;
  border-left: var(--bq-border, 3px) solid var(--accent);
  font-style: italic; 
  font-family: var(--font-body); 
  overflow: auto;
}

/* -- Misc ------------------------------------------------------------------ */
hr { border: none; border-top: 1px solid var(--brd); margin: 24px 0; }

/* -- Tables ---------------------------------------------------------------- */
table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: var(--font-size); }
th { padding: var(--table-pad, 7px) 12px; background: var(--bg2); border: 1px solid var(--brd); text-align: left; font-family: var(--font-mono); font-size: var(--font-size); text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }
td { padding: var(--table-pad, 7px) 12px; border: 1px solid var(--brd); font-family: var(--font-body); color: var(--text); }

.nav-row:hover { color: var(--accent-hover); }
.tab-btn:hover { color: var(--accent-hover); }
a:hover { border-color: var(--accent-hover); color: var(--accent-hover); }

.indent-0 { --indent: calc(var(--indent-spacing) * 1) }
.indent-1 { --indent: calc(var(--indent-spacing) * 2) }
.indent-2 { --indent: calc(var(--indent-spacing) * 3) }
.indent-3 { --indent: calc(var(--indent-spacing) * 4) }
.indent-4 { --indent: calc(var(--indent-spacing) * 5) }

/* -- Search --------------------------------------------------------------- */
.doc-search {
  position: relative;
  display: flex;
  align-items: center;
  gap: var(--sp-xs);
  margin-left: auto;
  align-self: center;
  padding: 0 var(--sp-s);
  flex-shrink: 0;
}
.doc-search-input {
  background: var(--bg);
  border: 1px solid var(--brd);
  border-radius: 4px;
  color: var(--text);
  font-family: var(--font-mono);
  font-size: 12px;
  padding: 5px 10px;
  width: 180px;
  outline: none;
  transition: border-color .15s, width .2s ease;
}
.doc-search-input::placeholder {
  color: var(--muted);
}
.doc-search-input:focus {
  border-color: var(--accent);
  width: 240px;
}
.doc-search-toggle {
  display: flex;
  align-items: center;
  gap: 5px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  flex-shrink: 0;
}

.doc-search-toggle input[type="checkbox"] {
  appearance: none;
  -webkit-appearance: none;
  width: 13px;
  height: 13px;
  flex-shrink: 0;
  background: var(--bg);
  border: 1px solid var(--brd);
  border-radius: 3px;
  cursor: pointer;
  margin: 0;
  position: relative;
  transition: background .15s, border-color .15s;
}

.doc-search-toggle input[type="checkbox"]:checked {
  background: var(--accent);
  border-color: var(--accent);
}

.doc-search-toggle input[type="checkbox"]:checked::after {
  content: '';
  position: absolute;
  left: 3px;
  top: 0px;
  width: 5px;
  height: 8px;
  border: 2px solid var(--bg);
  border-top: none;
  border-left: none;
  transform: rotate(45deg);
}
.search-results-list {
  overflow-y: auto;
  max-height: 360px;
}

.search-results-footer {
  padding: 8px 12px;
  border-top: 1px solid var(--brd);
  background: var(--bg2);
  border-radius: 0 0 6px 6px;
  flex-shrink: 0;
}
.search-results {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  right: var(--sp-s);
  width: 360px;
  max-height: 420px;
  overflow-y: auto;
  background: var(--bg1);
  border: 1px solid var(--brd);
  border-radius: 6px;
  z-index: 200;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
}
.search-results.visible {
  display: block;
}
.search-result {
  padding: 10px 14px;
  border-bottom: 1px solid var(--brd);
  cursor: pointer;
  transition: background .1s;
}
.search-result:last-child {
  border-bottom: none;
}
.search-result:hover {
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.search-result-title {
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-result-heading {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--accent);
  margin-bottom: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.search-result-preview {
  font-family: var(--font-body);
  font-size: 11px;
  color: var(--muted);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  line-height: 1.5;
}
.search-result-title mark,
.search-result-heading mark,
.search-result-preview mark {
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  color: var(--text);
  border-radius: 2px;
  padding: 0 2px;
}
.search-no-results {
  padding: 20px 16px;
  text-align: center;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}

@media (max-width: 650px) {
  .doc-search-input {
    width: 120px;
  }
}
`.trim();
}

function buildCombinedCSS(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  return buildThemeCSS(resolvedTheme) + '\n' + buildBaseCSS();
}

function buildLanguageCssForContent(project, content, theme) {
  const urls = getCachedLanguageStyle(project, content, theme, 'url');
  let html = '';

  urls.forEach((u) => {
    html += `    <link rel="stylesheet" href="${u}">\n`;
  });

  return html;
}

export function buildLanguageCssForProject(project, theme, type) {
  const allData = new Set();

  const collectDataFromContent = (content) => {
    if (!content) 
      return;
    const data = getCachedLanguageStyle(project, content, theme, type); // returns a Set
    for (const d of data) {
      allData.add(d);
    }
  };

  const traverseNodes = (nodes) => {
    for (const node of nodes) {
      collectDataFromContent(node.content);
      if (node.children?.length) 
        traverseNodes(node.children);
    }
  };

  for (const tab of project.tabs) {
    if (tab.nodes?.length) 
      traverseNodes(tab.nodes);
  }

  // Combine all CSS data into a single string

  if (type === 'data') {
    return Array.from(allData).join('\n');
  } else if (type === 'url') {
    let html = '';
    allData.forEach((u) => {
      html += `    <link rel="stylesheet" href="${u}">\n`;
    });
    return html;
  } else {
    console.log(`[htmlBuilder.js]: buildLanguageCssForProject unkown type '${type}'`);
    return null;
  }
}

function getCachedThemeStyleEntry(theme) {
  const resolvedTheme = (theme && typeof theme === 'object') ? theme : {};
  const themeId = resolvedTheme.id ?? '__default__';

  const entry = blobManager.get(DOC_THEME_BLOB_SECTION, themeId);
  if (entry)
    return entry;

  const css = buildCombinedCSS(resolvedTheme);
  const newEntry = blobManager.add(DOC_THEME_BLOB_SECTION, themeId, { 
    data: css, 
    type: 'text/css',
  });
  return newEntry;
}

export function getCachedThemeStyleUrl(theme) {
  return getCachedThemeStyleEntry(theme).url;
}

export function getCachedThemeStyleContent(theme) {
  return getCachedThemeStyleEntry(theme).data;
}

export function getCachedLanguageStyle(project, content, theme, type) {
  const tags = _getLanguageTagsByText(content);
  const results = new Set();

  if (!theme || !project)
    return results;

  tags.forEach(tag => {
    const def = findSyntaxDefinitionByName(tag, project.languages);
    if (!def || def.id === null)
      return;

    const styleId = getLanguageStyleId(project, theme, def);
    if (styleId === null)
      return;

    const entry = syntaxHighlighter.getLanguageBlobEntry(def.id, styleId);
    if (entry && entry[type]) {
      results.add(entry[type]);
    }
  });

  return results;
}

function _getLanguageTagsByText(text) {
  // Keep in sync with the fenced-code regex in MarkdownParser.js — must also
  // accept '#', '+', '.', '-' so languages like C#, C++, F# are matched.
  return [...text.matchAll(/```([\w#+.-]*)\n/g)].map(m => m[1]);
}

export function revokeThemeCache(id) {
  if(id) {
    blobManager.remove(DOC_THEME_BLOB_SECTION, id);
  } else {
    blobManager.removeSection(DOC_THEME_BLOB_SECTION);
  }
}

// ─── <head> Builder ───────────────────────────────────────────────────────────

export function buildHead({ project, theme }) {
  const styleUrl = getCachedThemeStyleUrl(theme);
  const languageCss = buildLanguageCssForProject(project, theme, 'url');
  return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHTML(project.name)}</title>
  <link rel="stylesheet" href="${styleUrl}">
  ${languageCss}`.trim();
}

// ─── Search Bar Builder ───────────────────────────────────────────────────────

/**
 * Builds the search bar HTML fragment.
 * Rendered only when search-enabled is true.
 * The optional "Search in project" checkbox is shown only when
 * search-show-in-tab is true.
 *
 * @param   {object} theme  Resolved doc theme object.
 * @returns {string}        HTML string, or '' when search is disabled.
 */
export function buildSearchBar(theme) {
  const enabled = getThemeValue(theme, 'search-enabled') ?? true;
  if (!enabled)
    return '';

  const showToggle = getThemeValue(theme, 'search-show-in-tab') ?? false;

  const toggleHtml = showToggle
    ? `<div class="search-results-footer">
        <label class="doc-search-toggle">
          <input type="checkbox" id="searchIncludeTabs">
          Search in project
        </label>
      </div>`
    : '';

  return `<div class="doc-search" id="docSearch">
    <input class="doc-search-input" id="searchInput" type="text" placeholder="Search…" autocomplete="off" spellcheck="false">
    <div class="search-results" id="searchResults">
      <div class="search-results-list" id="searchResultsList"></div>
      ${toggleHtml}
    </div>
  </div>`;
}

function getSidebarExpandButton() {
  return `<button class="nav-toggle-btn" id="navToggleBtn" aria-label="Toggle sidebar" aria-expanded="true">☰</button>`;
}

export function buildHeader(projectName, headerShow, searchBarHtml = '') {
  if (headerShow !== 'top') 
    return '';

  return `
  <header class="doc-header header-style-solid" id="docHeader">
    ${getSidebarExpandButton()}
    <span class="header-title">${escapeHTML(projectName)}</span>
    ${searchBarHtml}
  </header>`;
}

export function buildToc(resolvedTheme, tocShow) {
  if (tocShow === 'never') 
    return '';

  const tocPosition = getThemeValue(resolvedTheme, 'toc-position') ?? 'right';
  const tocWidthType = getThemeValue(resolvedTheme, 'toc-width-type') ?? 'fit-content';

  const desktopClass = tocShow === 'desktop' ? ' toc-desktop' : '';
  const posClass = tocPosition === 'left' ? ' toc-left' : '';
  const widthClassMap = {
    pixels: 'toc-width-px',
    percent: 'toc-width-per',
  };

  const widthClass = widthClassMap[tocWidthType] || '';

  return `
  <aside class="toc${posClass}${desktopClass} ${widthClass}" id="tocSidebar">
    <div class="toc-title">Table of content:</div>
    <nav id="tocLinks"></nav>
  </aside>`;
}

// ─── Sidebar Builder (unchanged but nav-row gets data-node-id) ────────────────

export function buildSidebar(tabs, project, theme, headerShow) {
  const showNav = getThemeValue(theme, 'content-show-nav') ?? 'always';
  const hiddenClass = showNav === 'never' ? ' nav-hidden' : '';
  const widthType = getThemeValue(theme, 'sidebar-width-type') ?? 'fit-content';

  const widthClassMap = {
    pixels: 'nav-width-px',
    percent: 'nav-width-per',
  };
  
  const widthClass = widthClassMap[widthType] || '';

  const sections = tabs.map((tab, i) =>
  `<div class="sidebar-section${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
    ${buildNavTree(tab.nodes, tab.id)}
  </div>`
  ).join('\n');

  const sidebarHeader = headerShow === 'sidebar';
  const sidebarVisConstrains = !sidebarHeader ? 'nav-visibility-constrains' : '';

  return `
  <div class="nav${hiddenClass} nav-container">
    <div class="sidebar-header ${sidebarVisConstrains}">
      <div class="nav-brand">${escapeHTML(project.name)}</div>
      <button class="nav-toggle-btn nav-close-btn" id="navCloseBtn" aria-label="Close sidebar">✕</button>
    </div>
    <nav class="${widthClass}" id="docSidebar">
      ${sections}
    </nav>
  </div>`.trim();
}

function buildNavTree(nodes, tabId, depth = 0) {
  const indentClass = `indent-${depth}`;

  return nodes.map(node => {
    if (node.children.length > 0) {
      return `
      <div class="nav-group" id="navg-${node.id}">
        <div class="nav-row nav-row--parent ${indentClass}" data-node-id="${node.id}" data-tab-id="${tabId}">
          <a class="nav-link" href="#${node.id}">${escapeHTML(node.name)}</a>
          <button class="nav-chevron-btn" data-toggle-group="navg-${node.id}" aria-label="toggle section">▾</button>
        </div>
        <div class="nav-children">
          ${buildNavTree(node.children, tabId, depth + 1)}
        </div>
      </div>`;
    }

    return `<a class="nav-row ${indentClass}" data-node-id="${node.id}" data-tab-id="${tabId}" href="#${node.id}">${escapeHTML(node.name)}</a>`;
  }).join('\n');
}

// ─── Tab Navigation Bar ───────────────────────────────────────────────────────

/**
 * @param {Array}  tabs           All populated tabs.
 * @param {string} searchBarHtml  Optional search bar fragment to append.
 */
export function buildTabNav(tabs, hasHeader, searchBarHtml = '') {
  // Hide the entire bar only when there is a single tab AND no search bar.
  const hiddenClass = (tabs.length <= 1 && !searchBarHtml) ? ' hidden' : '';

  // Render tab buttons only when there are multiple tabs to switch between.
  const buttons = tabs.length > 1
    ? tabs.map((tab, i) =>
        `<button class="tab-btn${i === 0 ? ' active' : ''}" data-tab="${tab.id}">
          ${escapeHTML(tab.name)}
        </button>`
      ).join('\n')
    : '';

  return `
  <div class="tab-nav${hiddenClass}" id="tabNav">
    ${!hasHeader ? getSidebarExpandButton() : ''}
    <div id="tabNavContainer" class="tab-nav-container">
      ${buttons}
    </div>
    ${searchBarHtml}
  </div>`;
}

// ─── Dynamic Content & Templates ─────────────────────────────────────────────

/**
 * Builds the container for dynamic content (where the selected node will appear)
 * and the hidden templates container that holds every node's rendered HTML.
 */
export async function buildDynamicContentAndTemplates(tabs, theme, project, codeBlockCache, tocHtml = '') {
  const templates = [];
  const collectNodes = async (nodes, tabId) => {
    for (const node of nodes) {
      templates.push(await buildNodeTemplate(node, tabId, theme, project, codeBlockCache));
      if (node.children.length) 
        await collectNodes(node.children, tabId);
    }
  };

  for (const tab of tabs) 
    await collectNodes(tab.nodes, tab.id);

  return `
  <div class="content-stage">
    <div id="dynamicContent" class="dynamic-content">
      <!-- Initial content will be filled by JS -->
    </div>
    ${tocHtml}
  </div>
  <div class="node-templates">
    ${templates.join('\n')}
  </div>`;
}

async function buildNodeTemplate(node, tabId, theme, project, codeBlockCache) {
  const contentHtml = await buildNodeContentHtml(node, theme, project, codeBlockCache);
  return `<template id="tmpl-${node.id}">
  <div class="main" data-node-id="${node.id}" data-tab-id="${tabId}">
    ${contentHtml}
  </div>
</template>`;
}

/**
 * Renders a single node's content (without children sections).
 * For a single‑node view we do NOT render children recursively – only the node itself.
 */
async function buildNodeContentHtml(node, theme, project, codeBlockCache) {
  const rawContent = (node.content || '').trim();
  const hasHeading = /^#{1,6}\s/.test(rawContent);
  const heading = hasHeading ? '' : `<h1>${escapeHTML(node.name)}</h1>\n`;
  const body = await parseMarkdownAsync(rawContent, theme, project, codeBlockCache);
  return `<section id="${node.id}" class="export-section">
    ${heading}
    <div class="export-section__body">${body}</div>
  </section>`;
}

// ─── Search Index Builder ─────────────────────────────────────────────────────

/**
 * Builds a flat, serialisable search index from all nodes across every tab.
 * Called at export time so the result can be embedded as a JSON literal inside
 * the generated script — no DOM access required at search time.
 *
 * Each entry contains:
 *   nodeId   {string}   – node identifier
 *   tabId    {string}   – owning tab identifier
 *   title    {string}   – node display name
 *   headings {string[]} – markdown headings extracted from node.content
 *   content  {string}   – plain-text body with markdown stripped
 *
 * @param   {Array} tabs  Populated tab array (same shape used by createScript).
 * @returns {Array}       Flat array of search index entries.
 */
function extractSearchIndex(tabs) {
  const stripCodeFences = (text) => text.replace(/```[\s\S]*?```/g, '\n');

  const stripMd = (text) => text
    .replace(/```[\s\S]*?```/g, ' ')          // fenced code blocks
    .replace(/`[^`]+`/g, ' ')                  // inline code
    .replace(/^#{1,6}\s+.+/gm, ' ')            // headings (already indexed)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')     // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // links -> label text
    .replace(/[*_~>]+/g, ' ')                  // emphasis / blockquote markers
    .replace(/\s+/g, ' ')
    .trim();

  const entries = [];

  const collect = (nodes, tabId) => {
    for (const node of nodes) {
      const raw = node.content || '';

      // Extract heading text in document order — from a code-fence-free
      // copy, so a '#'-led line inside a fenced code block (a C
      // preprocessor directive, a shell shebang, a Python comment, ...)
      // is never mistaken for a Markdown heading.
      const headings = [];
      let m;
      const re = /^#{1,6}\s+(.+)/gm;
      const rawNoCode = stripCodeFences(raw);
      while ((m = re.exec(rawNoCode)) !== null)
        headings.push(m[1].trim());

      entries.push({
        nodeId:   node.id,
        tabId,
        title:    node.name   || '',
        headings,
        content:  stripMd(raw),
      });

      if (node.children?.length)
        collect(node.children, tabId);
    }
  };

  for (const tab of tabs)
    collect(tab.nodes, tab.id);

  return entries;
}

// ─── Inline Script Builder ────────────────────────────────────────────────────

export function createTabId(tabs) {
  if (!tabs || tabs.length === 0)
    return '__default__';

  const combined = tabs
    .map(t => t.id)
    .filter(Boolean)
    .join('|');

  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = (hash << 5) - hash + combined.charCodeAt(i);
    hash |= 0;
  }

  return `tab_${Math.abs(hash)}`;
}

export function createScript(tabs) {
  // Build a flat list of all nodes with their tab id for quick lookup.
  const allNodes = [];
  const collect = (nodes, tabId) => {
    for (const node of nodes) {
      allNodes.push({ id: node.id, tabId });
      if (node.children.length) collect(node.children, tabId);
    }
  };
  for (const tab of tabs)
    collect(tab.nodes, tab.id);

  const firstNode = allNodes[0] || null;

  // Build the static search index at export time.
  const searchIndex = extractSearchIndex(tabs);

  return `(() => {
  // -- Data ----------------------------------------------------------------
  var allNodes = ${JSON.stringify(allNodes)};
  var firstNode = ${JSON.stringify(firstNode)};
  var searchIndex = ${JSON.stringify(searchIndex)};
  var currentTabId = null;
  var currentNodeId = null;
  var isTransitioning = false;
  var dynamicContent = document.getElementById('dynamicContent');

  // -- Search state --------------------------------------------------------
  var searchInput   = document.getElementById('searchInput');
  var searchResults = document.getElementById('searchResults');
  var searchResultsList = document.getElementById('searchResultsList');
  var searchToggle  = document.getElementById('searchIncludeTabs');
  var searchDebounceTimer = null;

  // -- Helper: find node's tab --------------------------------------------
  function getNodeTabId(nodeId) {
    var node = allNodes.find(n => { return n.id === nodeId; });
    return node ? node.tabId : null;
  }

  // -- Header scroll-hide behaviour --------------------------------------
  var docHeader = document.getElementById('docHeader');
  if (docHeader && docHeader.classList.contains('header-scroll-hide')) {
    var lastScrollY = 0;
    var scrollTarget = document.querySelector('.dynamic-content') || window;
    var onScroll = () => {
      var y = (scrollTarget === window) ? window.scrollY : scrollTarget.scrollTop;
      if (y > lastScrollY && y > 60) {
        docHeader.classList.add('hidden-scrolled');
      } else {
        docHeader.classList.remove('hidden-scrolled');
      }
      lastScrollY = y;
    };
    scrollTarget.addEventListener('scroll', onScroll, { passive: true });
  }

  // -- TOC builder --------------------------------------------------------
  var tocLinks = document.getElementById('tocLinks');
  function buildToc() {
    if (!tocLinks) 
      return;
    var headings = dynamicContent.querySelectorAll('h1,h2,h3,h4');
    tocLinks.innerHTML = '';
    headings.forEach(h => {
      if (!h.id) h.id = 'h-' + Math.random().toString(36).slice(2, 7);
      var a = document.createElement('a');
      a.className = 'toc-link';
      a.href = '#' + h.id;
      a.textContent = h.textContent;
      a.dataset.level = h.tagName[1];
      a.addEventListener('click', e => {
        e.preventDefault();
        h.scrollIntoView({ behavior: 'smooth' });
      });
      tocLinks.appendChild(a);
    });
  }

  // -- Sidebar toggle ------------------------------------------------------
  var docRoot = document.getElementById('docRoot');
  var navBackdrop = document.getElementById('navBackdrop');
  var toggleButtons = [
    document.getElementById('navToggleBtn')
  ].filter(Boolean);
  var closeBtn = document.getElementById('navCloseBtn');

  function setSidebarCollapsed(collapsed, persist) {
    docRoot.classList.toggle('sidebar-collapsed', collapsed);
    toggleButtons.forEach(btn => {
      btn.setAttribute('aria-expanded', String(!collapsed));
    });
    if (persist) {
      try { sessionStorage.setItem('_docSidebarCollapsed', collapsed ? '1' : '0'); } catch (e) {}
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed(!docRoot.classList.contains('sidebar-collapsed'), true);
  }

  toggleButtons.forEach(btn => {
    btn.addEventListener('click', toggleSidebar);
  });

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      setSidebarCollapsed(true, true);
    });
  }

  navBackdrop.addEventListener('click', () => {
    setSidebarCollapsed(true, true);
  });

  // Default: open on desktop, closed on mobile — unless the user already
  // picked a state this session. Never auto-collapse if there is no way
  // to reopen the sidebar again (no toggle button rendered, e.g.
  // header-show:'sidebar'/'never').
  (function initSidebarState() {
    var stored = null;
    try { stored = sessionStorage.getItem('_docSidebarCollapsed'); } catch (e) {}

    var canReopen = toggleButtons.length > 0;
    var collapsed = stored !== null
      ? stored === '1'
      : (canReopen && window.innerWidth <= 768);

    setSidebarCollapsed(collapsed, false);
  })();

  // -- Load node content from template with crossfade ---------------------
  function loadNode(nodeId, updateUrl, onDone) {
    if (isTransitioning) {
      onDone?.();
      return;
    }

    if (nodeId === currentNodeId) { 
      onDone?.(); 
      return; 
    }

    var template = document.getElementById('tmpl-' + nodeId);
    if (!template) {
      console.warn('Template not found for node', nodeId);
      onDone?.(); 
      return;
    }

    var newTabId = getNodeTabId(nodeId);
    if (!newTabId) { 
      onDone?.(); 
      return;
    }

    var activeTabSection = document.querySelector('.sidebar-section.active');
    if (activeTabSection && activeTabSection.dataset.tab !== newTabId) {
      switchTab(newTabId, () => {
        loadNode(nodeId, updateUrl, onDone);
      });
      return;
    }

    isTransitioning = true;
    dynamicContent.classList.add('fade-out');

    setTimeout(() => {
      var clone = document.importNode(template.content, true);
      dynamicContent.innerHTML = '';
      dynamicContent.appendChild(clone);
      buildToc();

      document.querySelectorAll('.nav-row').forEach(row => {
        row.classList.remove('active');
      });
      document.querySelectorAll('.nav-row[data-node-id="' + nodeId + '"]').forEach(row => {
        row.classList.add('active');
      });

      currentNodeId = nodeId;
      currentTabId = newTabId;

      if (updateUrl !== false && window.location.hash !== '#' + nodeId) {
        history.pushState(null, '', '#' + nodeId);
      }

      dynamicContent.classList.remove('fade-out');
      setTimeout(() => {
        isTransitioning = false;
        onDone?.(); 
      }, 50);
    }, 150);
  }

  // -- Tab switching -----------
  function switchTab(tabId, callback) {
    document.querySelectorAll('.sidebar-section').forEach(s => {
      s.classList.toggle('active', s.dataset.tab === tabId);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });

    try { 
      sessionStorage.setItem('_docActiveTab', tabId); 
    } catch (e) {}

    var firstNodeInTab = allNodes.find(n => n.tabId === tabId);
    if (firstNodeInTab) {
      loadNode(firstNodeInTab.id, true, callback);
    } else {
      dynamicContent.innerHTML = '<div class="main"><p>No content in this tab.</p></div>';
      currentNodeId = null;
      currentTabId = tabId;
      callback?.();
    }
  }

  // -- Nav group toggle --------------------------------------
  function toggleNavGroup(groupId) {
    var group = document.getElementById(groupId);
    if (!group)
      return;
    group.classList.toggle('collapsed');
  }

  // -- Search helpers ------------------------------------------------------

  /** Escapes a string for safe insertion as HTML text content. */
  function _escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Returns the HTML-escaped string with all occurrences of query
   * wrapped in <mark> tags for highlighting.
   */
  function _highlight(text, query) {
    if (!query || !text)
      return _escHtml(text);
    var escaped = query.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
    var re = new RegExp('(' + escaped + ')', 'gi');
    return _escHtml(text).replace(re, '<mark>$1</mark>');
  }

  /**
   * Returns a short excerpt of text centred around the first occurrence
   * of query, padded by radius characters on each side.
   */
  function _getSnippet(text, query, radius) {
    radius = radius || 80;
    if (!text)
      return '';
    if (!query)
      return text.slice(0, radius * 2);
    var idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) 
      return text.slice(0, radius * 2);
    var start = Math.max(0, idx - radius);
    var end   = Math.min(text.length, idx + query.length + radius);
    return (start > 0 ? '\\u2026' : '') + text.slice(start, end) + (end < text.length ? '\\u2026' : '');
  }

  /**
   * Scores a single index entry against the query string.
   * Returns { score, matchedHeading }.
   *
   * Score weights:
   *   title match   +100
   *   heading match  +50  (first matched heading captured)
   *   content match  +10
   */
  function _scoreEntry(entry, query) {
    var ql = query.toLowerCase();
    var score = 0;
    var matchedHeading = null;

    if (entry.title.toLowerCase().indexOf(ql) >= 0)
      score += 100;

    for (var i = 0; i < entry.headings.length; i++) {
      if (entry.headings[i].toLowerCase().indexOf(ql) >= 0) {
        score += 50;
        if (!matchedHeading) matchedHeading = entry.headings[i];
      }
    }

    if (entry.content.toLowerCase().indexOf(ql) >= 0)
      score += 10;

    return { score: score, matchedHeading: matchedHeading };
  }

  /**
   * Executes a search over the index and renders results into the
   * floating results panel. Hides the panel when query is empty.
   */
  function _runSearch(query) {
    if (!searchResultsList)
      return;

    query = (query || '').trim();

    if (query.length < 2) {
      searchResults.classList.remove('visible');
      searchResultsList.innerHTML = '';
      return;
    }

    // Scope: current tab only, or all tabs when toggle is checked.
    var crossTab = searchToggle ? searchToggle.checked : false;
    var pool = crossTab
      ? searchIndex
      : searchIndex.filter(e => { return e.tabId === currentTabId; });

    var scored = [];
    for (var i = 0; i < pool.length; i++) {
      var res = _scoreEntry(pool[i], query);
      if (res.score > 0)
        scored.push({ entry: pool[i], score: res.score, matchedHeading: res.matchedHeading });
    }

    scored.sort((a, b) => { return b.score - a.score; });
    var top = scored.slice(0, 20);

    if (top.length === 0) {
      searchResultsList.innerHTML = '<div class="search-no-results">No results found</div>';
      searchResults.classList.add('visible');
      return;
    }

    searchResultsList.innerHTML = top.map(item => {
      var e = item.entry;
      var snippet = _getSnippet(e.content, query, 80);
      var headingHtml = item.matchedHeading
        ? '<div class="search-result-heading">' + _highlight(item.matchedHeading, query) + '</div>'
        : '';
      return '<div class="search-result" data-node-id="' + _escHtml(e.nodeId) + '">'
        + '<div class="search-result-title">'   + _highlight(e.title, query) + '</div>'
        + headingHtml
        + '<div class="search-result-preview">' + _highlight(snippet, query) + '</div>'
        + '</div>';
    }).join('');

    searchResults.classList.add('visible');
  }

  // -- Event handling -----------------------------------------------------

  // Sidebar-Klicks (Delegation)
  document.body.addEventListener('click', e => {
    var link = e.target.closest('.nav-row[data-node-id]');
    if (link && link.getAttribute('data-node-id')) {
      e.preventDefault();
      var nodeId = link.getAttribute('data-node-id');
      loadNode(nodeId, true);
    }
  });

  // Chevron-Klicks (statt inline onclick)
  document.body.addEventListener('click', e => {
    var btn = e.target.closest('.nav-chevron-btn');
    if (btn && btn.dataset.toggleGroup) {
      e.preventDefault();
      toggleNavGroup(btn.dataset.toggleGroup);
      return;
    }

    var link = e.target.closest('.nav-row[data-node-id]');
    if (link && link.getAttribute('data-node-id')) {
      e.preventDefault();
      loadNode(link.getAttribute('data-node-id'), true);
    }
  });

  // Tab-Klicks
  var tabNav = document.getElementById('tabNav');
  if (tabNav) {
    tabNav.addEventListener('click', e => {
      var btn = e.target.closest('.tab-btn');
      if (btn && btn.dataset.tab) {
        switchTab(btn.dataset.tab);
      }
    });
  }

  var tabNavContainer = document.getElementById('tabNavContainer');
  if (tabNavContainer) {
    // Convert vertical scroll to horizontal scroll
    tabNavContainer.addEventListener('wheel', (e) => {
      if (e.deltaY === 0)
        return;
    
      e.preventDefault(); // prevent vertical scroll
      tabNavContainer.scrollBy({
        left: e.deltaY,
        behavior: 'smooth'
      });
    }, { passive: false });
  }

  // Hash-Änderungen (z. B. Browser Zurück/Vorwärts)
  window.addEventListener('hashchange', () => {
    var hash = window.location.hash.slice(1);
    if (hash && allNodes.some(n => { return n.id === hash; })) {
      loadNode(hash, false);
    } else if (firstNode) {
      loadNode(firstNode.id, true);
    }
  });

  // -- Search event handling ----------------------------------------------

  if (searchInput) {
    // Debounced input -> run search after 120 ms of silence.
    searchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      var val = searchInput.value;
      searchDebounceTimer = setTimeout(() => {
        _runSearch(val);
      }, 120);
    });

    // Re-show results on focus if there is a pending query.
    searchInput.addEventListener('focus', () => {
      if (searchInput.value.trim().length >= 2 && searchResultsList)
        searchResults.classList.add('visible');
    });
  }

  // Result clicks: navigate to node and close panel.
  if (searchResultsList) {
    searchResultsList.addEventListener('click', e => {
      var item = e.target.closest('.search-result');
      if (!item)
        return;
      
      var nodeId = item.getAttribute('data-node-id');
      searchResults.classList.remove('visible');
      
      if (searchInput)
        searchInput.value = '';
      if (nodeId)
        loadNode(nodeId, true);
    });
  }

  // Close results when clicking anywhere outside the search widget.
  document.addEventListener('click', e => {
    if (!searchResultsList)
      return;
    var docSearch = document.getElementById('docSearch');
    if (docSearch && !docSearch.contains(e.target))
      searchResults.classList.remove('visible');
  });

  // -- Externe Navigation (postMessage) ------------------------------------
  var NAV_SOURCE = 'doc-nav';
  var navScrollPending = false;

  function getLocationPayload() {
    var scrollTop = dynamicContent.scrollTop;
    var scrollHeight = dynamicContent.scrollHeight;
    var clientHeight = dynamicContent.clientHeight;
    var maxScroll = scrollHeight - clientHeight;
    return {
      tabId: currentTabId,
      nodeId: currentNodeId,
      scrollTop: scrollTop,
      scrollHeight: scrollHeight,
      clientHeight: clientHeight,
      ratio: maxScroll > 0 ? scrollTop / maxScroll : 0
    };
  }

  function postLocation() {
    try {
      window.parent.postMessage({ source: NAV_SOURCE, type: 'location', payload: getLocationPayload() }, '*');
    } catch (e) {
    }
  }

  dynamicContent.addEventListener('scroll', function () {
    if (navScrollPending) 
      return;
    navScrollPending = true;
    requestAnimationFrame(function () {
      navScrollPending = false;
      postLocation();
    });
  }, { passive: true });

  function applyExternalScroll(scrollPosition) {
    if (scrollPosition == null) 
      return;
    var top;
    if (typeof scrollPosition === 'object' && scrollPosition.ratio != null) {
      top = scrollPosition.ratio * (dynamicContent.scrollHeight - dynamicContent.clientHeight);
    } else if (typeof scrollPosition === 'number') {
      top = scrollPosition;
    } else {
      return;
    }
    dynamicContent.scrollTop = top;
  }

  function handleExternalNavigate(msg) {
    var targetNodeId = msg.nodeId || currentNodeId;
    if (targetNodeId && targetNodeId !== currentNodeId) {
      loadNode(targetNodeId, true, function () {
        applyExternalScroll(msg.scrollPosition);
        postLocation();
      });
    } else {
      applyExternalScroll(msg.scrollPosition);
      postLocation();
    }
  }

  window.addEventListener('message', function (e) {
    var msg = e.data;
    if (!msg || msg.source !== NAV_SOURCE)
      return;
    if (msg.type === 'navigate') {
      handleExternalNavigate(msg);
    } else if (msg.type === 'location:get') {
      postLocation();
    }
  });

  // Direkter Zugriff, falls contentWindow verfügbar ist
  window.docNav = {
    navigate: function (opts) { handleExternalNavigate(opts || {}); },
    getLocation: getLocationPayload
  };

  // -- Initialization ---------------------------------------
  var savedTab = null;
  try { 
    savedTab = sessionStorage.getItem('_docActiveTab'); 
  } catch (e) {
  }
  var initialTab = (savedTab && allNodes.some(n => { 
      return n.tabId === savedTab; 
    })
  ) ? savedTab : (firstNode ? firstNode.tabId : null);
  
  var hashNodeId = window.location.hash.slice(1);
  var initialNodeId = null;
  if (hashNodeId && allNodes.some(n => { return n.id === hashNodeId; })) {
    initialNodeId = hashNodeId;
  } else if (firstNode) {
    initialNodeId = firstNode.id;
  }

  if (initialTab) {
    document.querySelectorAll('.sidebar-section').forEach(s => {
      s.classList.toggle('active', s.dataset.tab === initialTab);
    });
    document.querySelectorAll('.tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === initialTab);
    });
  }

  if (initialNodeId) {
    loadNode(initialNodeId, false, () => {
      postLocation();
      window.parent.postMessage({ source: NAV_SOURCE, type: 'ready' }, '*');
    });
  } else {
    postLocation();
    window.parent.postMessage({ source: NAV_SOURCE, type: 'ready' }, '*');
  }
})();
`.trim();
}

function createNodePreviewCommScript() {
  return `(() => {
  var SOURCE = 'doc-preview';
  var scrollEl = document.querySelector('.preview-root');
  if (!scrollEl)
    return;
  var pending = false;

  function getScrollPayload() {
    var scrollTop = scrollEl.scrollTop;
    var scrollHeight = scrollEl.scrollHeight;
    var clientHeight = scrollEl.clientHeight;
    var maxScroll = scrollHeight - clientHeight;
    return {
      scrollTop: scrollTop,
      scrollHeight: scrollHeight,
      clientHeight: clientHeight,
      ratio: maxScroll > 0 ? scrollTop / maxScroll : 0
    };
  }

  function postScroll() {
    try {
      window.parent.postMessage({ source: SOURCE, type: 'scroll', payload: getScrollPayload() }, '*');
    } catch (e) {}
  }

  function applyScroll(value) {
    if (value == null) 
      return;
    var top;
    if (typeof value === 'object' && value.ratio != null) {
      top = value.ratio * (scrollEl.scrollHeight - scrollEl.clientHeight);
    } else if (typeof value === 'number') {
      top = value;
    } else {
      return;
    }
    scrollEl.scrollTop = top;
  }

  scrollEl.addEventListener('scroll', () => {
    if (pending)
      return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      postScroll();
    });
  }, { passive: true });

  window.addEventListener('message', e => {
    var msg = e.data;
    if (!msg || msg.source !== SOURCE)
      return;
    if (msg.type === 'scroll:set') {
      applyScroll(msg.value);
    } else if (msg.type === 'scroll:get') {
      postScroll();
    }
  });

  // Direkter Zugriff, falls contentWindow verfügbar ist (same-origin, kein sandbox)
  window.docPreview = {
    setScrollPosition: applyScroll,
    getScrollPosition: getScrollPayload
  };

  window.parent.postMessage({ source: SOURCE, type: 'ready' }, '*');
})();`;
}

export function getCachedScriptEntry({id, createContent}) {  
  const entry = blobManager.get(HTML_BUILDER_SCRIPT_BLOB_SECTION, id);
  if (entry)
    return entry;

  const js = createContent();

  const newEntry = blobManager.add(HTML_BUILDER_SCRIPT_BLOB_SECTION, id, { 
    data: js, 
    type: 'application/javascript',
  });
  return newEntry;
}

export function getCachedThemeScriptContent(tabs) {
  return getCachedScriptEntry({
    id: createTabId(tabs),
    createContent: () => createScript(tabs),
  });
}

export function buildScript(tabs) {
  const entry = getCachedThemeScriptContent(tabs);
  return `<script src="${entry.url}"></script>`;
}

export function getCachedPreviewNodeScriptConent() {
  return getCachedScriptEntry({
    id: 'node_preview-id',
    createContent: createNodePreviewCommScript,
  });
}

export function buildNodePreviewScript() {
  const entry = getCachedPreviewNodeScriptConent();
  return `<script src="${entry.url}"></script>`;
}

// ─── Document Assembly ───────────────────────────────────────────────────────

export async function buildNodePreview(content, codeBlockCache, theme = null, project = null) {
  const resolvedTheme = (theme && typeof theme === 'object') ? 
    theme : 
    (getFallbackTheme() ?? {});

  const styleUrl = getCachedThemeStyleUrl(resolvedTheme);
  const bodyHTML = await parseMarkdownAsync(content ?? '', resolvedTheme, project, codeBlockCache);
  cleanupCodeBlockCache(codeBlockCache);
  const languageCss = buildLanguageCssForContent(project, content ?? '', resolvedTheme);
  
  return `<!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    
    <link rel="stylesheet" href="${styleUrl}">
    ${languageCss}
  </head>
  <body class="preview-root">
    <div class="dynamic-content preview-root main">
    ${bodyHTML}
    </div>
  </body>
    ${buildNodePreviewScript()}
  </html>`;
}

export async function buildDocument(project, theme = null) {
  const result = (doc, msg) => ({ doc, msg });
  if (!project) 
    return result(null, 'invalid project');

  const tabs = project.tabs.filter(t => t.nodes.length > 0);
  if (!tabs.length) 
    return result(null, 'project contains no populated tabs');

  const resolvedTheme = theme ?? ResolveProjectTheme(project);

  const headerShow = getThemeValue(resolvedTheme, 'header-show') ?? 'always';
  const tocShow = getThemeValue(resolvedTheme, 'toc-show')    ?? 'always';

  // ── Search placement ────────────────────────────────────────────────────
  // Honour the user's preferred position, but fall back to tab-nav when the
  // header is not rendered (header-show !== 'top').
  const searchEnabled = getThemeValue(resolvedTheme, 'search-enabled') ?? true;
  const searchPos = getThemeValue(resolvedTheme, 'search-position') ?? 'header';
  const effectiveSearchPos = (searchPos === 'header' && headerShow !== 'top')
    ? 'tab-nav'
    : searchPos;

  const searchBarHtml = searchEnabled ? buildSearchBar(resolvedTheme) : '';
  const headerSearchHtml = (effectiveSearchPos === 'header')  ? searchBarHtml : '';
  const tabNavSearchHtml = (effectiveSearchPos === 'tab-nav') ? searchBarHtml : '';
  // ────────────────────────────────────────────────────────────────────────

  const hasHeader = headerShow === 'top';
  const tocHtml = buildToc(resolvedTheme, tocShow);
  const dynamicArea = await buildDynamicContentAndTemplates(tabs, resolvedTheme, project, project.session.codeBlockCache, tocHtml);
  cleanupCodeBlockCache(project.session.codeBlockCache);
  
  const parts = {
    head:        buildHead({ project: project, theme: resolvedTheme }),
    header:      buildHeader(project.name, headerShow, headerSearchHtml),
    tabNav:      buildTabNav(tabs, hasHeader, tabNavSearchHtml),
    sidebar:     buildSidebar(tabs, project, resolvedTheme, headerShow),
    dynamicArea: dynamicArea,
    script:      buildScript(tabs),
    documentClass: hasHeader ? '' : ' no-header',
  };
  return result(assembleDocument(parts), null);
}

export function assembleDocument(parts) {
  return `<!-- Generated with ${APP_NAME} v${APP_VERSION} -->
  <!DOCTYPE html>
  <html lang="en">
  <head>
  ${parts.head}
  </head>
  <body>
  <div class="document${parts.documentClass ?? ''}" id="docRoot">
    ${parts.header ?? ''}
    <div class="nav-backdrop" id="navBackdrop"></div>
    <div class="layout">
      <div class="content-col">
        ${parts.tabNav}
        <div class="content-row">
          ${parts.sidebar}
          ${parts.dynamicArea}
        </div>
      </div>
    </div>
  </div> 
  ${parts.script ? parts.script : ''}
  </body>
  </html>`;
}