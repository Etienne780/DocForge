/**
 * Texts of the export modals (core/modal/export).
 * Format: see core/i18n/I18n.js
 */
export default {

  fileName: {
    en: 'File Name:',
    de: 'Dateiname:'
  },

  namePlaceholder: {
    en: 'Name...',
    de: 'Name...'
  },

  invalidName: {
    en: 'Invalid file name',
    de: 'Ungültiger Dateiname'
  },

  export: {
    en: 'Export',
    de: 'Exportieren'
  },

  project: {

    title: {
      en: 'Export Project',
      de: 'Projekt exportieren'
    },

    typeProject: {
      en: 'Project (*.dfproj)',
      de: 'Projekt (*.dfproj)'
    },

    typeHtml: {
      en: 'HTML (*.html)',
      de: 'HTML (*.html)'
    },

    typeFolder: {
      en: 'Folder',
      de: 'Ordner'
    },

    includeTheme: {
      en: 'Include theme:',
      de: 'Theme einschließen:'
    },

    untitled: {
      en: 'untitled project',
      de: 'unbenanntes Projekt'
    },

    exportSuffix: {
      vars: ['name'],
      en: '{name}_export',
      de: '{name}_export'
    },

    failedNamed: {
      vars: ['name'],
      en: 'Failed to export project \'{name}\'',
      de: 'Das Projekt \'{name}\' konnte nicht exportiert werden'
    },

    notFound: {
      en: 'Failed to open export modal, project was null!',
      de: 'Das Export-Fenster konnte nicht geöffnet werden, es gibt kein Projekt!'
    },

    failed: {
      en: 'Failed to export project',
      de: 'Das Projekt konnte nicht exportiert werden'
    },

    exported: {
      vars: ['name'],
      en: 'Exported project \'{name}\'',
      de: 'Projekt \'{name}\' exportiert'
    },

    failedError: {
      vars: ['name', 'error'],
      en: 'Failed to export project \'{name}\': {error}',
      de: 'Das Projekt \'{name}\' konnte nicht exportiert werden: {error}'
    },

    invalidType: {
      vars: ['name', 'type'],
      en: 'Failed to export project \'{name}\', invalid type \'{type}\'',
      de: 'Das Projekt \'{name}\' konnte nicht exportiert werden, ungültiger Typ \'{type}\''
    },
  },

  theme: {

    title: {
      en: 'Export Theme',
      de: 'Theme exportieren'
    },

    includeLanguages: {
      en: 'Include languages',
      de: 'Sprachen einschließen'
    },

    notFound: {
      en: 'Failed to open export modal, theme was not found!',
      de: 'Das Export-Fenster konnte nicht geöffnet werden, das Theme wurde nicht gefunden!'
    },

    untitled: {
      en: 'untitled theme',
      de: 'unbenanntes Theme'
    },

    failed: {
      en: 'Failed to export theme',
      de: 'Das Theme konnte nicht exportiert werden'
    },

    exported: {
      vars: ['name'],
      en: 'Exported theme \'{name}\'',
      de: 'Theme \'{name}\' exportiert'
    },

    failedError: {
      vars: ['name', 'error'],
      en: 'Failed to export theme \'{name}\': {error}',
      de: 'Das Theme \'{name}\' konnte nicht exportiert werden: {error}'
    },
  },

  language: {

    title: {
      en: 'Export Language',
      de: 'Sprache exportieren'
    },

    includeStyles: {
      en: 'Include styles',
      de: 'Stile einschließen'
    },

    searchStyles: {
      en: 'Search styles…',
      de: 'Stile suchen…'
    },

    notFound: {
      en: 'Failed to open export modal, language was not found!',
      de: 'Das Export-Fenster konnte nicht geöffnet werden, die Sprache wurde nicht gefunden!'
    },

    untitled: {
      en: 'untitled language',
      de: 'unbenannte Sprache'
    },

    noStyles: {
      en: 'No styles for this language',
      de: 'Keine Stile für diese Sprache'
    },

    projectStyles: {
      en: 'Project styles',
      de: 'Projektstile'
    },

    builtInStyles: {
      en: 'Built-in styles',
      de: 'Mitgelieferte Stile'
    },

    noMatch: {
      en: 'No styles match your search',
      de: 'Keine Stile passen zu deiner Suche'
    },

    failed: {
      en: 'Failed to export language',
      de: 'Die Sprache konnte nicht exportiert werden'
    },

    exported: {
      vars: ['name'],
      en: 'Exported language \'{name}\'',
      de: 'Sprache \'{name}\' exportiert'
    },

    failedError: {
      vars: ['name', 'error'],
      en: 'Failed to export language \'{name}\': {error}',
      de: 'Die Sprache \'{name}\' konnte nicht exportiert werden: {error}'
    },
  },

  style: {

    title: {
      en: 'Export Language Style',
      de: 'Sprachstil exportieren'
    },

    language: {
      en: 'Language:',
      de: 'Sprache:'
    },

    notFound: {
      en: 'Failed to open export modal, style was not found!',
      de: 'Das Export-Fenster konnte nicht geöffnet werden, der Stil wurde nicht gefunden!'
    },

    untitled: {
      en: 'untitled style',
      de: 'unbenannter Stil'
    },

    unknownLanguage: {
      en: 'Unknown language',
      de: 'Unbekannte Sprache'
    },

    langMissing: {
      en: 'The language was not found and will not be included.',
      de: 'Die Sprache wurde nicht gefunden und wird nicht eingeschlossen.'
    },

    langBuiltIn: {
      en: 'Built-in language, it is not included in the file.',
      de: 'Mitgelieferte Sprache, sie wird nicht in die Datei aufgenommen.'
    },

    langCustom: {
      en: 'Custom language, it is included in the file.',
      de: 'Eigene Sprache, sie wird in die Datei aufgenommen.'
    },

    failed: {
      en: 'Failed to export language style',
      de: 'Der Sprachstil konnte nicht exportiert werden'
    },

    exported: {
      vars: ['name'],
      en: 'Exported style \'{name}\'',
      de: 'Stil \'{name}\' exportiert'
    },

    failedError: {
      vars: ['name', 'error'],
      en: 'Failed to export style \'{name}\': {error}',
      de: 'Der Stil \'{name}\' konnte nicht exportiert werden: {error}'
    },
  },
};
