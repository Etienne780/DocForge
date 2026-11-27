/**
 * Texts of the command bar commands (init/InitCommands.js, '>' mode of @common/QuickOpen.js).
 * Labels are "Area: action", a trailing … means the command shows a list to choose from.
 * Format: see core/i18n/I18n.js
 */
export default {

  search: {

    all: {
      en: 'Search: entries and tabs',
      de: 'Suche: Einträge und Tabs'
    },

    tabs: {
      en: 'Search: tabs',
      de: 'Suche: Tabs'
    },

    entries: {
      en: 'Search: entries',
      de: 'Suche: Einträge'
    },
  },

  navigate: {

    leaveProject: {
      en: 'Project: close and go to the project hub',
      de: 'Projekt: schließen und zum Project Hub'
    },

    docEditor: {
      en: 'Go to: doc editor',
      de: 'Wechseln zu: Doc-Editor'
    },

    appearance: {
      en: 'Go to: appearance manager',
      de: 'Wechseln zu: Darstellungsverwaltung'
    },

    appearanceThemes: {
      en: 'Go to: doc themes in the appearance manager',
      de: 'Wechseln zu: Doc-Themes in der Darstellungsverwaltung'
    },

    appearanceLanguages: {
      en: 'Go to: languages in the appearance manager',
      de: 'Wechseln zu: Sprachen in der Darstellungsverwaltung'
    },
  },

  theme: {

    create: {
      en: 'Doc theme: create new',
      de: 'Doc-Theme: neu erstellen'
    },

    edit: {
      en: 'Doc theme: edit…',
      de: 'Doc-Theme: bearbeiten…'
    },

    editPlaceholder: {
      en: 'Choose the doc theme to edit…',
      de: 'Doc-Theme zum Bearbeiten auswählen…'
    },

    activate: {
      en: 'Doc theme: use for this project…',
      de: 'Doc-Theme: für dieses Projekt verwenden…'
    },

    activatePlaceholder: {
      en: 'Choose the doc theme of the project…',
      de: 'Doc-Theme des Projekts auswählen…'
    },

    active: {
      en: 'active',
      de: 'aktiv'
    },

    builtIn: {
      en: 'built-in',
      de: 'eingebaut'
    },
  },

  language: {

    create: {
      en: 'Language: create new',
      de: 'Sprache: neu erstellen'
    },

    edit: {
      en: 'Language: edit…',
      de: 'Sprache: bearbeiten…'
    },

    editPlaceholder: {
      en: 'Choose the language to edit…',
      de: 'Sprache zum Bearbeiten auswählen…'
    },
  },

  app: {

    preferences: {
      en: 'Preferences: open',
      de: 'Einstellungen: öffnen'
    },

    preferencesSection: {
      vars: ['section'],
      en: 'Preferences: {section}',
      de: 'Einstellungen: {section}'
    },

    backups: {
      en: 'Backups: open',
      de: 'Backups: öffnen'
    },

    darkMode: {
      en: 'App: switch between dark and light mode',
      de: 'App: zwischen Dark und Light Mode wechseln'
    },

    overview: {
      en: 'Help: overview',
      de: 'Hilfe: Übersicht'
    },

    changelog: {
      en: 'Help: changelog',
      de: 'Hilfe: Changelog'
    },

    info: {
      en: 'Help: info',
      de: 'Hilfe: Info'
    },
  },

  project: {

    settings: {
      en: 'Project: settings',
      de: 'Projekt: Einstellungen'
    },

    save: {
      en: 'Project: save',
      de: 'Projekt: speichern'
    },

    saveAll: {
      en: 'App: save all',
      de: 'App: alles speichern'
    },

    export: {
      en: 'Project: export',
      de: 'Projekt: exportieren'
    },

    previewExport: {
      en: 'Project: export preview',
      de: 'Projekt: Export-Vorschau'
    },

    saveAsTemplate: {
      en: 'Project: save as template',
      de: 'Projekt: als Vorlage speichern'
    },

    reveal: {
      en: 'Project: show in file explorer',
      de: 'Projekt: im Dateiexplorer zeigen'
    },

    undo: {
      en: 'Edit: undo',
      de: 'Bearbeiten: rückgängig'
    },

    redo: {
      en: 'Edit: redo',
      de: 'Bearbeiten: wiederholen'
    },

    create: {
      en: 'Project: create new',
      de: 'Projekt: neu erstellen'
    },

    import: {
      en: 'Project: import',
      de: 'Projekt: importieren'
    },

    openRecent: {
      en: 'Project: open recent…',
      de: 'Projekt: zuletzt geöffnetes öffnen…'
    },

    openRecentPlaceholder: {
      en: 'Choose a project…',
      de: 'Projekt auswählen…'
    },
  },

  // sub-commands when the open project would be left with unsaved changes
  unsaved: {

    title: {
      vars: ['name'],
      en: 'Unsaved changes in "{name}"',
      de: 'Ungespeicherte Änderungen in „{name}“'
    },

    placeholder: {
      en: 'Save the changes before leaving?',
      de: 'Änderungen vor dem Verlassen speichern?'
    },

    saveAndLeave: {
      en: 'Save and leave',
      de: 'Speichern und verlassen'
    },

    discardAndLeave: {
      en: 'Discard changes and leave',
      de: 'Änderungen verwerfen und verlassen'
    },

    cancel: {
      en: 'Cancel (stay in the project)',
      de: 'Abbrechen (im Projekt bleiben)'
    },
  },
};
