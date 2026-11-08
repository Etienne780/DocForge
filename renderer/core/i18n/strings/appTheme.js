/**
 * Texts of the app themes: color groups (@data/AppThemeManager.js),
 * editor highlight tokens (@common/EditorColors.js) and the modals (@common/AppThemeModal.js).
 * Format: see core/i18n/I18n.js
 */
export default {

  modes: {

    dark: {
      en: 'Dark mode',
      de: 'Dunkler Modus'
    },

    light: {
      en: 'Light mode',
      de: 'Heller Modus'
    },
  },

  copyName: {
    vars: ['name'],
    en: '{name} copy',
    de: '{name} Kopie'
  },

  importedName: {
    en: 'Imported theme',
    de: 'Importiertes Theme'
  },

  editorColorsName: {
    en: 'My editor colors',
    de: 'Meine Editor-Farben'
  },

  colorsTitle: {
    en: 'Theme colors',
    de: 'Theme-Farben'
  },

  colorsTitleNamed: {
    vars: ['name'],
    en: 'Theme colors: {name}',
    de: 'Theme-Farben: {name}'
  },

  searchPlaceholder: {
    en: 'Search colors…',
    de: 'Farben suchen…'
  },

  searchLabel: {
    en: 'Search colors',
    de: 'Farben suchen'
  },

  copyFrom: {
    en: 'Copy colors from…',
    de: 'Farben übernehmen von…'
  },

  builtInNotice: {
    en: 'Built-in themes can\'t be changed.',
    de: 'Mitgelieferte Themes können nicht geändert werden.'
  },

  duplicateToEdit: {
    en: 'Duplicate to edit',
    de: 'Zum Bearbeiten duplizieren'
  },

  resetTitle: {
    en: 'Reset to the base theme',
    de: 'Auf das Basis-Theme zurücksetzen'
  },

  builtInTitle: {
    en: 'Built-in theme',
    de: 'Mitgeliefertes Theme'
  },

  builtInMessage: {
    vars: ['name'],
    en: '"{name}" can\'t be changed. Create a copy that you can edit?',
    de: '„{name}“ kann nicht geändert werden. Eine bearbeitbare Kopie erstellen?'
  },

  createCopy: {
    en: 'Create copy',
    de: 'Kopie erstellen'
  },

  duplicateTitle: {
    en: 'Duplicate theme',
    de: 'Theme duplizieren'
  },

  created: {
    vars: ['name'],
    en: 'Created "{name}"',
    de: '„{name}“ erstellt'
  },

  copyTitle: {
    vars: ['name', 'mode'],
    en: 'Copy colors into "{name}" ({mode})',
    de: 'Farben in „{name}“ übernehmen ({mode})'
  },

  copy: {
    en: 'Copy',
    de: 'Übernehmen'
  },

  from: {
    en: 'From',
    de: 'Von'
  },

  variant: {
    en: 'Variant',
    de: 'Variante'
  },

  copyHint: {
    en: 'Check a group to take all of its colors, then uncheck the ones you want to keep. Left: current color, right: the color you get.',
    de: 'Hake eine Gruppe an, um alle ihre Farben zu übernehmen, und entferne dann die Haken bei denen, die du behalten willst. Links: aktuelle Farbe, rechts: die Farbe, die du bekommst.'
  },

  noneSelected: {
    en: 'No colors selected',
    de: 'Keine Farben ausgewählt'
  },

  copied: {
    vars: ['count'],
    plural: 'count',
    en: { one: 'Copied {count} color', other: 'Copied {count} colors' },
    de: { one: '{count} Farbe übernommen', other: '{count} Farben übernommen' }
  },

  selected: {
    vars: ['count'],
    en: '{count} selected',
    de: '{count} ausgewählt'
  },

  groups: {

    backgrounds: {
      en: 'Backgrounds',
      de: 'Hintergründe'
    },

    text: {
      en: 'Text',
      de: 'Text'
    },

    accent: {
      en: 'Accent',
      de: 'Akzent'
    },

    borders: {
      en: 'Borders and handles',
      de: 'Rahmen und Griffe'
    },

    danger: {
      en: 'Danger',
      de: 'Gefahr'
    },

    'links-code': {
      en: 'Links and code',
      de: 'Links und Code'
    },

    scrollbars: {
      en: 'Scrollbars and shadows',
      de: 'Scrollleisten und Schatten'
    },

    'color-picker': {
      en: 'Color picker',
      de: 'Farbwähler'
    },

    editor: {
      en: 'Doc editor highlighting',
      de: 'Hervorhebung im Doc-Editor'
    },
  },

  colors: {

    background: {
      en: 'Window background',
      de: 'Fensterhintergrund'
    },

    'background-elevated': {
      en: 'Sidebars and panels',
      de: 'Seitenleisten und Bereiche'
    },

    'background-surface': {
      en: 'Surfaces',
      de: 'Flächen'
    },

    'background-raised': {
      en: 'Inputs and cards',
      de: 'Eingabefelder und Karten'
    },

    'background-overlay': {
      en: 'Overlays',
      de: 'Überlagerungen'
    },

    'background-dark': {
      en: 'Darkest background',
      de: 'Dunkelster Hintergrund'
    },

    'text-primary': {
      en: 'Text',
      de: 'Text'
    },

    'text-muted': {
      en: 'Muted text',
      de: 'Gedämpfter Text'
    },

    'text-warning': {
      en: 'Warnings',
      de: 'Warnungen'
    },

    'accent-color': {
      en: 'Accent',
      de: 'Akzent'
    },

    'accent-bg': {
      en: 'Accent background (hover, selection)',
      de: 'Akzent-Hintergrund (Hover, Auswahl)'
    },

    'accent-bg-lighter': {
      en: 'Accent background, lighter',
      de: 'Akzent-Hintergrund, heller'
    },

    'accent-bg-darker': {
      en: 'Accent background, darker',
      de: 'Akzent-Hintergrund, dunkler'
    },

    'focus-ring': {
      en: 'Focus ring',
      de: 'Fokusrahmen'
    },

    'border-color': {
      en: 'Borders',
      de: 'Rahmen'
    },

    'border-color-secondary': {
      en: 'Strong borders',
      de: 'Kräftige Rahmen'
    },

    'resize-handle-color': {
      en: 'Resize handles',
      de: 'Größenänderungs-Griffe'
    },

    'resize-handle-hover-color': {
      en: 'Resize handles (hover)',
      de: 'Größenänderungs-Griffe (Hover)'
    },

    'background-danger': {
      en: 'Danger',
      de: 'Gefahr'
    },

    'background-danger-lighter': {
      en: 'Danger, variant 1',
      de: 'Gefahr, Variante 1'
    },

    'background-danger-darker': {
      en: 'Danger, variant 2',
      de: 'Gefahr, Variante 2'
    },

    'link-color': {
      en: 'Links',
      de: 'Links'
    },

    'link-underline': {
      en: 'Link underline',
      de: 'Link-Unterstreichung'
    },

    'code-background': {
      en: 'Code background',
      de: 'Code-Hintergrund'
    },

    'code-text': {
      en: 'Code text',
      de: 'Code-Text'
    },

    'scrollbar-thumb': {
      en: 'Scrollbar',
      de: 'Scrollleiste'
    },

    'scrollbar-thumb-raised': {
      en: 'Scrollbar on raised surfaces',
      de: 'Scrollleiste auf erhöhten Flächen'
    },

    'scrollbar-track': {
      en: 'Scrollbar track',
      de: 'Scrollleisten-Spur'
    },

    'popup-shadow-color': {
      en: 'Popup shadow',
      de: 'Popup-Schatten'
    },

    'color-picker-checker-light': {
      en: 'Transparency checker, light',
      de: 'Transparenz-Karomuster, hell'
    },

    'color-picker-checker-dark': {
      en: 'Transparency checker, dark',
      de: 'Transparenz-Karomuster, dunkel'
    },

    'color-picker-thumb': {
      en: 'Handles',
      de: 'Griffe'
    },

    'color-picker-thumb-shadow': {
      en: 'Handle shadow',
      de: 'Griff-Schatten'
    },

    'color-picker-shadow': {
      en: 'Panel shadow',
      de: 'Panel-Schatten'
    },
  },

  editorTokens: {

    text: {
      en: 'Text',
      de: 'Text'
    },

    markup: {
      en: 'Markup characters',
      de: 'Markup-Zeichen'
    },

    heading: {
      en: 'Heading',
      de: 'Überschrift'
    },

    bold: {
      en: 'Bold',
      de: 'Fett'
    },

    italic: {
      en: 'Italic',
      de: 'Kursiv'
    },

    code: {
      en: 'Inline code',
      de: 'Inline-Code'
    },

    'code-block': {
      en: 'Code block',
      de: 'Codeblock'
    },

    link: {
      en: 'Link text',
      de: 'Link-Text'
    },

    'link-url': {
      en: 'Link URL',
      de: 'Link-URL'
    },

    ref: {
      en: 'Reference link',
      de: 'Referenz-Link'
    },

    'ref-broken': {
      en: 'Broken reference link',
      de: 'Defekter Referenz-Link'
    },

    anchor: {
      en: 'Anchor',
      de: 'Anker'
    },

    property: {
      en: 'Property name',
      de: 'Eigenschaftsname'
    },

    'property-value': {
      en: 'Property value',
      de: 'Eigenschaftswert'
    },

    comment: {
      en: 'Comment',
      de: 'Kommentar'
    },

    list: {
      en: 'List marker',
      de: 'Listenzeichen'
    },

    quote: {
      en: 'Blockquote',
      de: 'Zitat'
    },

    table: {
      en: 'Table',
      de: 'Tabelle'
    },

    selection: {
      en: 'Selection',
      de: 'Auswahl'
    },

    'search-match': {
      en: 'Search match',
      de: 'Suchtreffer'
    },

    'search-active': {
      en: 'Current search match',
      de: 'Aktueller Suchtreffer'
    },

    'search-active-border': {
      en: 'Current search match border',
      de: 'Rahmen des aktuellen Suchtreffers'
    },

    'search-range': {
      en: 'Search range (selection)',
      de: 'Suchbereich (Auswahl)'
    },
  },
};
