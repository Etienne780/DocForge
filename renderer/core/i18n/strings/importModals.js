/**
 * Texts of the import modals (core/modal/import).
 * Format: see core/i18n/I18n.js
 */
export default {

  selectFile: {
    en: 'Select a file',
    de: 'Eine Datei auswählen'
  },

  selectFolder: {
    en: 'Select a folder',
    de: 'Einen Ordner auswählen'
  },

  project: {
    en: 'Project:',
    de: 'Projekt:'
  },

  name: {
    en: 'Name:',
    de: 'Name:'
  },

  path: {
    en: 'Path:',
    de: 'Pfad:'
  },

  noPath: {
    en: 'No path available',
    de: 'Kein Pfad verfügbar'
  },

  back: {
    en: 'Back',
    de: 'Zurück'
  },

  import: {
    en: 'Import',
    de: 'Importieren'
  },

  open: {
    vars: ['name'],
    en: '{name} (open)',
    de: '{name} (geöffnet)'
  },

  included: {
    vars: ['count'],
    en: '{count} included',
    de: '{count} enthalten'
  },

  invalidExtension: {
    vars: ['entity', 'extension'],
    en: 'Failed to import {entity}: invalid extension \'{extension}\'',
    de: '{entity} konnte nicht importiert werden: ungültige Dateiendung \'{extension}\''
  },

  failed: {
    vars: ['entity', 'error'],
    en: 'Failed to import {entity}: {error}',
    de: '{entity} konnte nicht importiert werden: {error}'
  },

  invalidJson: {
    vars: ['entity'],
    en: 'Failed to import {entity}: invalid JSON file',
    de: '{entity} konnte nicht importiert werden: ungültige JSON-Datei'
  },

  invalidFile: {
    vars: ['entity'],
    en: 'Failed to import {entity}: invalid file',
    de: '{entity} konnte nicht importiert werden: ungültige Datei'
  },

  noProjectAvailable: {
    vars: ['entity'],
    en: 'Failed to import {entity}: no project available',
    de: '{entity} konnte nicht importiert werden: kein Projekt verfügbar'
  },

  projectNotLoaded: {
    en: 'project could not be loaded',
    de: 'Das Projekt konnte nicht geladen werden'
  },

  projectNotSaved: {
    vars: ['name'],
    en: 'failed to save project \'{name}\'',
    de: 'Das Projekt \'{name}\' konnte nicht gespeichert werden'
  },

  importedInto: {
    vars: ['entity', 'name', 'project'],
    en: 'Imported {entity} \'{name}\' into \'{project}\'',
    de: '{entity} \'{name}\' in \'{project}\' importiert'
  },

  entities: {

    project: {
      en: 'project',
      de: 'Projekt'
    },

    theme: {
      en: 'theme',
      de: 'Theme'
    },

    language: {
      en: 'language',
      de: 'Sprache'
    },

    style: {
      en: 'language style',
      de: 'Sprachstil'
    },
  },

  entitiesTitle: {

    theme: {
      en: 'Theme',
      de: 'Theme'
    },

    language: {
      en: 'Language',
      de: 'Sprache'
    },

    style: {
      en: 'Style',
      de: 'Stil'
    },
  },

  projectModal: {

    title: {
      en: 'Import Project',
      de: 'Projekt importieren'
    },

    from: {
      en: 'Import a project from',
      de: 'Ein Projekt importieren aus'
    },

    pathInvalid: {
      en: 'Path was invalid',
      de: 'Der Pfad war ungültig'
    },

    kind: {
      en: 'Kind:',
      de: 'Art:'
    },

    invalidKind: {
      en: 'Invalid kind',
      de: 'Ungültige Art'
    },

    theme: {
      en: 'Theme:',
      de: 'Theme:'
    },

    noTheme: {
      en: 'No themes included in this file',
      de: 'Diese Datei enthält keine Themes'
    },

    kinds: {

      file: {
        en: 'File',
        de: 'Datei'
      },

      folder: {
        en: 'Folder',
        de: 'Ordner'
      },
    },

    webMemory: {
      en: 'Projects are stored in memory on web. Use "Export" to save.',
      de: 'Im Web werden Projekte nur im Arbeitsspeicher gehalten. Speichere sie mit „Exportieren“.'
    },

    fileFilter: {
      en: 'DocForge Project',
      de: 'DocForge-Projekt'
    },

    untitled: {
      en: 'untitled',
      de: 'unbenannt'
    },

    untitledTheme: {
      en: 'untitled theme',
      de: 'unbenanntes Theme'
    },

    themeCount: {
      vars: ['count'],
      en: '{count} Themes',
      de: '{count} Themes'
    },
  },

  themeModal: {

    title: {
      en: 'Import Theme',
      de: 'Theme importieren'
    },

    from: {
      en: 'Import a theme from',
      de: 'Ein Theme importieren aus'
    },

    languages: {
      en: 'Languages:',
      de: 'Sprachen:'
    },

    untitled: {
      en: 'untitled theme',
      de: 'unbenanntes Theme'
    },
  },

  languageModal: {

    title: {
      en: 'Import Language',
      de: 'Sprache importieren'
    },

    from: {
      en: 'Import a language from',
      de: 'Eine Sprache importieren aus'
    },

    aliases: {
      en: 'Aliases:',
      de: 'Aliasse:'
    },

    styles: {
      en: 'Styles:',
      de: 'Stile:'
    },

    untitled: {
      en: 'untitled language',
      de: 'unbenannte Sprache'
    },
  },

  styleModal: {

    title: {
      en: 'Import Language Style',
      de: 'Sprachstil importieren'
    },

    from: {
      en: 'Import a language style from',
      de: 'Einen Sprachstil importieren aus'
    },

    exportedFor: {
      en: 'Exported for:',
      de: 'Exportiert für:'
    },

    language: {
      en: 'Language:',
      de: 'Sprache:'
    },

    untitled: {
      en: 'untitled style',
      de: 'unbenannter Stil'
    },

    unknownLanguage: {
      en: 'Unknown language',
      de: 'Unbekannte Sprache'
    },

    langIncluded: {
      vars: ['name'],
      en: '{name} (included)',
      de: '{name} (enthalten)'
    },

    langBuiltIn: {
      vars: ['name'],
      en: '{name} (built-in)',
      de: '{name} (mitgeliefert)'
    },

    fromFile: {
      vars: ['name'],
      en: '{name} (from file)',
      de: '{name} (aus der Datei)'
    },

    loadFailed: {
      vars: ['error'],
      en: 'Failed to load project: {error}',
      de: 'Das Projekt konnte nicht geladen werden: {error}'
    },

    matchWarn: {
      vars: ['found', 'total'],
      en: ' ⚠ {found}/{total} match',
      de: ' ⚠ {found}/{total} passen'
    },

    mismatch: {
      vars: ['missing', 'total', 'name'],
      en: '{missing} of {total} style elements don\'t match \'{name}\'. They are kept and can be adjusted in the style editor after importing.',
      de: '{missing} von {total} Stilelementen passen nicht zu \'{name}\'. Sie bleiben erhalten und können nach dem Import im Stil-Editor angepasst werden.'
    },

    noLanguage: {
      en: 'Failed to import language style: no language selected',
      de: 'Der Sprachstil konnte nicht importiert werden: keine Sprache ausgewählt'
    },
  },
};
