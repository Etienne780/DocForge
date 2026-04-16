import { createBuiltInTheme } from '@data/DocThemeManager.js';

export const DOC_THEME_PRESETS = [
    createTheme_Dark,
    createTheme_Light,
    createTheme_MidnightBlue,
    createTheme_Solarized,
    createTheme_RosePine,
    createTheme_Paper,
];

export function createTheme_Dark() {
  return createBuiltInTheme('Dark');
}

export function createTheme_Light() {
  return createBuiltInTheme('Light', {
    'background':          '#f5f5f0',
    'background-surface':  '#ebebE6',
    'background-elevated': '#e0e0db',

    'text-primary':        '#1a1a1a',
    'text-secondary':      '#4a4a4a',
    'text-muted':          '#7a7a7a',

    'accent':              '#0066cc',
    'accent-hover':        '#0052a3',

    'link':                '#0055bb',
    'link-underline':      '#3377cc',

    'border':              '#d0d0cc',

    'code-background':     '#e8e8e3',
    'code-border':         '#ccccC8',
    'code-text':           '#2d7a3a',

    'heading':             '#0d0d0d',

    'header-style':        'solid',
  });
}

export function createTheme_MidnightBlue() {
  return createBuiltInTheme('Midnight Blue', {
    'background':          '#050d1a',
    'background-surface':  '#0a1628',
    'background-elevated': '#0f1e36',

    'text-primary':        '#d6e4f7',
    'text-secondary':      '#7a9ec8',
    'text-muted':          '#4a6a90',

    'accent':              '#00b4d8',
    'accent-hover':        '#0096b4',

    'link':                '#48cae4',
    'link-underline':      '#0096c7',

    'border':              '#112240',

    'code-background':     '#020810',
    'code-border':         '#0d1e38',
    'code-text':           '#64dfdf',

    'heading':             '#e8f4ff',

    'header-style':        'blur',
    'typography-heading':  'serif',
  });
}

export function createTheme_Solarized() {
  return createBuiltInTheme('Solarized', {
    'background':          '#002b36',
    'background-surface':  '#073642',
    'background-elevated': '#0d3f4e',

    'text-primary':        '#839496',
    'text-secondary':      '#657b83',
    'text-muted':          '#586e75',

    'accent':              '#2aa198',
    'accent-hover':        '#1e8a82',

    'link':                '#268bd2',
    'link-underline':      '#1a6fa8',

    'border':              '#0d4050',

    'code-background':     '#00212b',
    'code-border':         '#073642',
    'code-text':           '#859900',

    'heading':             '#fdf6e3',

    'typography-body':     'serif',
    'typography-heading':  'serif',
  });
}

export function createTheme_RosePine() {
  return createBuiltInTheme('Rosé Pine', {
    'background':          '#191724',
    'background-surface':  '#1f1d2e',
    'background-elevated': '#26233a',

    'text-primary':        '#e0def4',
    'text-secondary':      '#908caa',
    'text-muted':          '#6e6a86',

    'accent':              '#eb6f92',
    'accent-hover':        '#c75b7a',

    'link':                '#c4a7e7',
    'link-underline':      '#9b79c8',

    'border':              '#2a2740',

    'code-background':     '#111020',
    'code-border':         '#1f1d2e',
    'code-text':           '#9ccfd8',

    'heading':             '#f0ece8',

    'header-style':        'blur',
  });
}

export function createTheme_Paper() {
  return createBuiltInTheme('Paper', {
    'background':          '#f9f6f0',
    'background-surface':  '#f2ede4',
    'background-elevated': '#ece6da',

    'text-primary':        '#2c2416',
    'text-secondary':      '#6b5c44',
    'text-muted':          '#9c8b74',

    'accent':              '#b85c00',
    'accent-hover':        '#8f4600',

    'link':                '#7a4a00',
    'link-underline':      '#c87020',

    'border':              '#d8d0c4',

    'code-background':     '#ede8e0',
    'code-border':         '#ccc4b8',
    'code-text':           '#5a4030',

    'heading':             '#1a1208',

    'content-max-width':   680,
    'typography-body':     'serif',
    'typography-heading':  'serif',
    'toc-show':            'desktop',
  });
}