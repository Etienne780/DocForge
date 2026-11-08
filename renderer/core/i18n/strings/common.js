/**
 * Texts used in many places (buttons, shared modals, pickers) and of the shared components
 * in common/ (navbar, search bar, sorting, file drop, theme cards, color picker).
 * Format: see core/i18n/I18n.js
 */
export default {

  cancel: {
    en: 'Cancel',
    de: 'Abbrechen'
  },

  save: {
    en: 'Save',
    de: 'Speichern'
  },

  dontSave: {
    en: 'Don\'t save',
    de: 'Nicht speichern'
  },

  delete: {
    en: 'Delete',
    de: 'Löschen'
  },

  rename: {
    en: 'Rename',
    de: 'Umbenennen'
  },

  create: {
    en: 'Create',
    de: 'Erstellen'
  },

  done: {
    en: 'Done',
    de: 'Fertig'
  },

  close: {
    en: 'Close',
    de: 'Schließen'
  },

  duplicate: {
    en: 'Duplicate',
    de: 'Duplizieren'
  },

  name: {
    en: 'Name',
    de: 'Name'
  },

  unknown: {
    en: 'unknown',
    de: 'unbekannt'
  },

  namePlaceholder: {
    en: 'name...',
    de: 'Name...'
  },

  builtIn: {
    en: 'Built In',
    de: 'Mitgeliefert'
  },

  moreActions: {
    en: 'More actions',
    de: 'Weitere Aktionen'
  },

  loading: {
    en: 'Loading…',
    de: 'Wird geladen…'
  },

  deleteItemTitle: {
    en: 'Delete item',
    de: 'Element löschen'
  },

  deleteItemMessage: {
    en: 'Are you sure you want to delete this item?',
    de: 'Möchtest du dieses Element wirklich löschen?'
  },

  nameMinLength: {
    vars: ['min'],
    en: 'Value must be at least {min} characters long',
    de: 'Der Wert muss mindestens {min} Zeichen lang sein'
  },

  unsaved: {

    title: {
      en: 'Unsaved changes',
      de: 'Ungespeicherte Änderungen'
    },

    message: {
      vars: ['name'],
      en: 'Do you want to save your changes to "{name}"?',
      de: 'Möchtest du deine Änderungen an „{name}“ speichern?'
    },

    saveFailed: {
      en: 'Failed to save the project.',
      de: 'Das Projekt konnte nicht gespeichert werden.'
    },
  },

  entryPicker: {

    placeholder: {
      en: 'Choose an entry…',
      de: 'Einen Eintrag auswählen…'
    },

    search: {
      en: 'Search entries…',
      de: 'Einträge suchen…'
    },

    deleted: {
      en: '(deleted entry)',
      de: '(gelöschter Eintrag)'
    },

    topLevel: {
      vars: ['tab'],
      en: '{tab} (top level)',
      de: '{tab} (oberste Ebene)'
    },
  },

  quickOpen: {

    placeholder: {
      en: 'Open entry…',
      de: 'Eintrag öffnen…'
    },

    recent: {
      en: 'recent',
      de: 'zuletzt geöffnet'
    },
  },

  export: {

    invalidProject: {
      en: 'Invalid project.',
      de: 'Ungültiges Projekt.'
    },

    chooseLocation: {
      en: 'Choose export location',
      de: 'Exportziel auswählen'
    },

    exportHere: {
      en: 'Export here',
      de: 'Hierhin exportieren'
    },

    exportedTo: {
      vars: ['path'],
      en: 'Project exported to \'{path}\'.',
      de: 'Projekt nach \'{path}\' exportiert.'
    },

    folderFailed: {
      en: 'Failed to export project folder.',
      de: 'Der Projektordner konnte nicht exportiert werden.'
    },

    noTheme: {
      en: 'No valid Doc-theme was found.',
      de: 'Es wurde kein gültiges Doc-Theme gefunden.'
    },

    failed: {
      vars: ['message'],
      en: 'Export failed: {message}',
      de: 'Export fehlgeschlagen: {message}'
    },

    htmlExported: {
      en: 'HTML exported.',
      de: 'HTML exportiert.'
    },
  },

  invalidProjectStructure: {
    en: 'Invalid project structure',
    de: 'Ungültige Projektstruktur'
  },

  navbar: {

    hub: {
      en: 'Hub',
      de: 'Hub'
    },

    theme: {
      en: 'Theme',
      de: 'Theme'
    },

    language: {
      en: 'Language',
      de: 'Sprache'
    },

    styles: {
      en: 'Styles',
      de: 'Stile'
    },

    unsaved: {
      en: 'Unsaved changes',
      de: 'Ungespeicherte Änderungen'
    },

    appearance: {
      en: 'Appearance',
      de: 'Darstellung'
    },

    appearanceTitle: {
      en: 'Open the appearance manager',
      de: 'Die Darstellungsverwaltung öffnen'
    },

    editor: {
      en: 'Editor',
      de: 'Editor'
    },

    editorTitle: {
      en: 'Open the doc editor',
      de: 'Den Doc-Editor öffnen'
    },
  },

  searchbar: {

    placeholder: {
      en: 'Search project…',
      de: 'Projekt durchsuchen…'
    },

    label: {
      en: 'Search entries',
      de: 'Einträge durchsuchen'
    },
  },

  sort: {

    'none': {
      en: 'No sorting',
      de: 'Keine Sortierung'
    },

    'recent': {
      en: 'Newest first',
      de: 'Neueste zuerst'
    },

    'oldest': {
      en: 'Oldest first',
      de: 'Älteste zuerst'
    },

    'order-az': {
      en: 'A to Z',
      de: 'A bis Z'
    },

    'order-za': {
      en: 'Z to A',
      de: 'Z bis A'
    },
  },

  fileDrop: {

    title: {
      en: 'Drop files to open',
      de: 'Dateien zum Öffnen ablegen'
    },
  },

  themeCard: {

    active: {
      en: '✓ Active',
      de: '✓ Aktiv'
    },

    useTheme: {
      en: 'Use theme',
      de: 'Theme verwenden'
    },

    ruleCount: {
      vars: ['count'],
      plural: 'count',
      en: { one: '{count} rule', other: '{count} rules' },
      de: { one: '{count} Regel', other: '{count} Regeln' }
    },

    overrides: {
      vars: ['name', 'matches'],
      en: 'Overrides built-in \'{name}\' for: {matches}',
      de: 'Ersetzt die mitgelieferte Sprache \'{name}\' für: {matches}'
    },

    overridesTag: {
      en: 'Overrides built-in',
      de: 'Ersetzt mitgelieferte'
    },

    styles: {
      en: 'Styles',
      de: 'Stile'
    },

    manageStyles: {
      en: 'Manage styles',
      de: 'Stile verwalten'
    },

    duplicateLanguage: {
      en: 'Duplicate language',
      de: 'Sprache duplizieren'
    },

    noExample: {
      en: '// no example',
      de: '// kein Beispiel'
    },
  },

  colorPicker: {

    eyedropper: {
      en: 'Pick a color from the screen',
      de: 'Eine Farbe vom Bildschirm aufnehmen'
    },

    modes: {

      'sv-square': {
        en: 'Square',
        de: 'Quadrat'
      },

      'hsl-wheel': {
        en: 'HSL wheel',
        de: 'HSL-Rad'
      },

      'hsl-sliders': {
        en: 'HSL sliders',
        de: 'HSL-Regler'
      },

      'rgb-sliders': {
        en: 'RGB sliders',
        de: 'RGB-Regler'
      },
    },
  },
};
