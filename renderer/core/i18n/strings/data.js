/**
 * Texts of the data and core modules: undo / redo labels (@data/ProjectHistory.js), link states,
 * project and file messages, file dialogs, and the language editor placeholders.
 * Format: see core/i18n/I18n.js
 */
export default {

  history: {

    create: {
      vars: ['noun', 'name', 'more'],
      en: 'Create {noun} {name}{more}',
      de: '{noun} {name}{more} erstellen'
    },

    delete: {
      vars: ['noun', 'name', 'more'],
      en: 'Delete {noun} {name}{more}',
      de: '{noun} {name}{more} löschen'
    },

    rename: {
      vars: ['noun', 'old', 'new'],
      en: 'Rename {noun} {old} to {new}',
      de: '{noun} {old} in {new} umbenennen'
    },

    change: {
      vars: ['noun', 'name'],
      en: 'Change {noun} {name}',
      de: '{noun} {name} ändern'
    },

    move: {
      vars: ['noun', 'name', 'more'],
      en: 'Move {noun} {name}{more}',
      de: '{noun} {name}{more} verschieben'
    },

    reorder: {
      vars: ['nouns'],
      en: 'Reorder {nouns}',
      de: '{nouns} neu anordnen'
    },

    more: {
      vars: ['count'],
      en: ' and {count} more',
      de: ' und {count} weitere'
    },

    editText: {
      vars: ['name'],
      en: 'Edit text in {name}',
      de: 'Text in {name} bearbeiten'
    },

    editTextMany: {
      vars: ['count'],
      en: 'Edit text in {count} entries',
      de: 'Text in {count} Einträgen bearbeiten'
    },

    activeTheme: {
      en: 'Change active theme',
      de: 'Aktives Theme wechseln'
    },

    renameProject: {
      vars: ['name'],
      en: 'Rename project to {name}',
      de: 'Projekt in {name} umbenennen'
    },

    projectSettings: {
      en: 'Change project settings',
      de: 'Projekteinstellungen ändern'
    },

    project: {
      en: 'Change project',
      de: 'Projekt ändern'
    },

    restoreBackup: {
      en: 'Restore backup',
      de: 'Sicherung wiederherstellen'
    },

    nouns: {

      entry: {
        en: 'entry',
        de: 'Eintrag'
      },

      tab: {
        en: 'tab',
        de: 'Tab'
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

      link: {
        en: 'link',
        de: 'Link'
      },
    },

    nounsPlural: {

      entry: {
        en: 'entries',
        de: 'Einträge'
      },

      tab: {
        en: 'tabs',
        de: 'Tabs'
      },

      theme: {
        en: 'themes',
        de: 'Themes'
      },

      language: {
        en: 'languages',
        de: 'Sprachen'
      },

      style: {
        en: 'language styles',
        de: 'Sprachstile'
      },

      link: {
        en: 'links',
        de: 'Links'
      },
    },
  },

  links: {

    targetDeleted: {
      en: 'Target entry was deleted',
      de: 'Der Ziel-Eintrag wurde gelöscht'
    },

    targetFolder: {
      vars: ['name'],
      en: '\'{name}\' is a folder, its content is not exported',
      de: '\'{name}\' ist ein Ordner, sein Inhalt wird nicht exportiert'
    },

    anchorMissing: {
      vars: ['anchor', 'name'],
      en: 'Anchor \'#{anchor}\' not found in \'{name}\'',
      de: 'Anker \'#{anchor}\' nicht in \'{name}\' gefunden'
    },

    anchorMultiple: {
      vars: ['anchor', 'count', 'name'],
      en: 'Anchor \'#{anchor}\' exists {count} times in \'{name}\'',
      de: 'Anker \'#{anchor}\' kommt {count}-mal in \'{name}\' vor'
    },
  },

  project: {

    notInRecents: {
      en: 'Project not found in recents.',
      de: 'Das Projekt wurde in den zuletzt geöffneten Projekten nicht gefunden.'
    },

    invalidEntry: {
      en: 'Cannot open project: Invalid entry.',
      de: 'Das Projekt kann nicht geöffnet werden: ungültiger Eintrag.'
    },

    openFailed: {
      vars: ['message'],
      en: 'Failed to open project: {message}',
      de: 'Das Projekt konnte nicht geöffnet werden: {message}'
    },

    invalidData: {
      en: 'Cannot open project: Invalid project data.',
      de: 'Das Projekt kann nicht geöffnet werden: ungültige Projektdaten.'
    },

    defaultTab: {
      en: 'Documentation',
      de: 'Dokumentation'
    },

    defaultEntry: {
      en: 'New Entry',
      de: 'Neuer Eintrag'
    },

    unnamedPreset: {
      en: 'Unnamed Preset',
      de: 'Unbenannte Vorlage'
    },

    userPreset: {
      en: 'User-defined project template',
      de: 'Eigene Projektvorlage'
    },
  },

  document: {

    noFolderExport: {
      en: 'Folder export is not supported here.',
      de: 'Der Export als Ordner wird hier nicht unterstützt.'
    },

    invalidFile: {
      en: 'Failed to open project: invalid file.',
      de: 'Das Projekt konnte nicht geöffnet werden: ungültige Datei.'
    },

    missingData: {
      en: 'Failed to open project: missing project data.',
      de: 'Das Projekt konnte nicht geöffnet werden: Projektdaten fehlen.'
    },

    noLiveSave: {
      en: 'Saving to the original file is not supported here.',
      de: 'Das Speichern in die ursprüngliche Datei wird hier nicht unterstützt.'
    },

    fileFilter: {
      en: 'DocForge Project',
      de: 'DocForge-Projekt'
    },
  },

  fileImport: {

    openFailed: {
      vars: ['name', 'error'],
      en: 'Failed to open \'{name}\': {error}',
      de: '\'{name}\' konnte nicht geöffnet werden: {error}'
    },

    unsupported: {
      vars: ['name'],
      en: 'Unsupported file: \'{name}\'',
      de: 'Nicht unterstützte Datei: \'{name}\''
    },

    alreadyOpen: {
      vars: ['name'],
      en: '\'{name}\' is already open',
      de: '\'{name}\' ist bereits geöffnet'
    },

    invalidAppTheme: {
      vars: ['name'],
      en: '\'{name}\' is not a valid app theme',
      de: '\'{name}\' ist kein gültiges App-Theme'
    },

    appThemeImported: {
      vars: ['name'],
      en: 'Imported the app theme "{name}"',
      de: 'App-Theme „{name}“ importiert'
    },

    readFailed: {
      vars: ['name'],
      en: 'Failed to read \'{name}\'',
      de: '\'{name}\' konnte nicht gelesen werden'
    },
  },

  platform: {

    allowedFiles: {
      en: 'Allowed files',
      de: 'Erlaubte Dateien'
    },

    readFailed: {
      en: 'Failed to read file',
      de: 'Die Datei konnte nicht gelesen werden'
    },

    exportFile: {
      en: 'Export file',
      de: 'Exportdatei'
    },
  },

  appThemeSaveFailed: {
    vars: ['name'],
    en: 'Could not save the theme "{name}"',
    de: 'Das Theme „{name}“ konnte nicht gespeichert werden'
  },

  languages: {

    duplicateFailed: {
      en: 'Failed to duplicate language.',
      de: 'Die Sprache konnte nicht dupliziert werden.'
    },

    copyName: {
      vars: ['name'],
      en: '{name} Copy',
      de: '{name} Kopie'
    },

    duplicated: {
      en: 'Language duplicated.',
      de: 'Sprache dupliziert.'
    },
  },

  editors: {

    appearance: {
      en: 'Appearance',
      de: 'Darstellung'
    },

    language: {
      en: 'Language Editor',
      de: 'Spracheditor'
    },

    languageStyle: {
      en: 'Language style Editor',
      de: 'Sprachstil-Editor'
    },

    comingSoon: {
      en: 'Coming soon...',
      de: 'Demnächst verfügbar...'
    },
  },
};
