/**
 * Texts of the preferences view (views/preferences) and its sections in the File menu.
 * Format: see core/i18n/I18n.js
 */
export default {

  title: {
    en: 'Preferences',
    de: 'Einstellungen'
  },

  back: {
    en: '← Back',
    de: '← Zurück'
  },

  backTitle: {
    en: 'Back to the previous view',
    de: 'Zurück zur vorherigen Ansicht'
  },

  search: {
    en: 'Search settings',
    de: 'Einstellungen durchsuchen'
  },

  navLabel: {
    en: 'Preference sections',
    de: 'Bereiche der Einstellungen'
  },

  reset: {
    en: 'Reset to default',
    de: 'Auf Standard zurücksetzen'
  },

  empty: {
    en: 'Nothing to set here yet.',
    de: 'Hier gibt es noch nichts einzustellen.'
  },

  sections: {

    'general': {

      label: {
        en: 'General',
        de: 'Allgemein'
      },

      menuDescription: {
        en: 'Opens the general preferences',
        de: 'Öffnet die allgemeinen Einstellungen'
      },
    },

    'editor': {

      label: {
        en: 'Doc editor',
        de: 'Doc-Editor'
      },

      menuDescription: {
        en: 'Opens the doc editor preferences',
        de: 'Öffnet die Einstellungen des Doc-Editors'
      },
    },

    'app-theme': {

      label: {
        en: 'App theme',
        de: 'App-Theme'
      },

      menuDescription: {
        en: 'Opens the app theme preferences',
        de: 'Öffnet die Einstellungen des App-Themes'
      },
    },

    'theme-editor': {

      label: {
        en: 'Theme editor',
        de: 'Theme-Editor'
      },

      menuDescription: {
        en: 'Opens the theme editor preferences',
        de: 'Öffnet die Einstellungen des Theme-Editors'
      },
    },

    'hotkeys': {

      label: {
        en: 'Hotkeys',
        de: 'Tastenkürzel'
      },

      menuDescription: {
        en: 'Opens the hotkeys',
        de: 'Öffnet die Tastenkürzel'
      },
    },
  },

  units: {

    spaces: {
      en: 'spaces',
      de: 'Leerzeichen'
    },

    steps: {
      en: 'steps',
      de: 'Schritte'
    },
  },

  settings: {

    uiLanguage: {

      label: {
        en: 'Language',
        de: 'Sprache'
      },

      description: {
        en: 'Language of the app. Projects and their content are not changed.',
        de: 'Sprache der App. Projekte und ihre Inhalte werden nicht verändert.'
      },

      options: {

        auto: {
          en: 'System language',
          de: 'Systemsprache'
        },
      },
    },

    isDarkMode: {

      label: {
        en: 'Dark mode',
        de: 'Dunkler Modus'
      },

      description: {
        en: 'Dark colors for the app. Also switchable with the moon / sun in the title bar.',
        de: 'Dunkle Farben für die App. Auch über Mond / Sonne in der Titelleiste umschaltbar.'
      },
    },

    colorPickerMode: {

      label: {
        en: 'Color picker',
        de: 'Farbwähler'
      },

      description: {
        en: 'View every color picker opens with. Also switchable in the picker itself.',
        de: 'Ansicht, mit der sich jeder Farbwähler öffnet. Auch im Farbwähler selbst umschaltbar.'
      },

      options: {

        'sv-square': {
          en: 'Color square',
          de: 'Farbquadrat'
        },

        'hsl-wheel': {
          en: 'Color wheel',
          de: 'Farbrad'
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

    hideWebProjectLimitWarn: {

      label: {
        en: 'Hide the project limit warning',
        de: 'Warnung zum Projektlimit ausblenden'
      },

      description: {
        en: 'No warning when opening a project would remove the oldest recent project.',
        de: 'Keine Warnung, wenn das Öffnen eines Projekts das älteste zuletzt geöffnete Projekt entfernen würde.'
      },
    },

    projectEditorMode: {

      label: {
        en: 'View mode',
        de: 'Ansichtsmodus'
      },

      description: {
        en: 'Editor and preview side by side, only the editor or only the preview. Also switchable in the editor toolbar.',
        de: 'Editor und Vorschau nebeneinander, nur der Editor oder nur die Vorschau. Auch in der Editor-Toolbar umschaltbar.'
      },

      options: {

        split: {
          en: 'Split',
          de: 'Geteilt'
        },

        editor: {
          en: 'Editor only',
          de: 'Nur Editor'
        },

        preview: {
          en: 'Preview only',
          de: 'Nur Vorschau'
        },
      },
    },

    docEditorWordWrapEnabled: {

      label: {
        en: 'Word wrap',
        de: 'Zeilenumbruch'
      },

      description: {
        en: 'Long lines wrap in the text input. Also switchable in the editor toolbar.',
        de: 'Lange Zeilen werden im Textfeld umgebrochen. Auch in der Editor-Toolbar umschaltbar.'
      },
    },

    rememberEntryScroll: {

      label: {
        en: 'Remember the scroll position',
        de: 'Scrollposition merken'
      },

      description: {
        en: 'Opening an entry again returns to where you left it (until the app is closed).',
        de: 'Ein erneut geöffneter Eintrag springt dorthin zurück, wo du aufgehört hast (bis die App geschlossen wird).'
      },
    },

    defaultTabSize: {

      label: {
        en: 'Tab size of new projects',
        de: 'Tab-Breite neuer Projekte'
      },

      description: {
        en: 'Spaces the Tab key inserts and the width of tabs (editor, code blocks). Every project has its own value in File -> Project Settings.',
        de: 'Leerzeichen, die die Tab-Taste einfügt, und die Breite von Tabs (Editor, Codeblöcke). Jedes Projekt hat einen eigenen Wert unter Datei -> Projekteinstellungen.'
      },
    },

    historySize: {

      label: {
        en: 'Undo steps',
        de: 'Rückgängig-Schritte'
      },

      description: {
        en: 'How many project changes can be undone (Edit menu, Ctrl+Z outside of the text). More steps need more memory in big projects.',
        de: 'Wie viele Projektänderungen rückgängig gemacht werden können (Menü Bearbeiten, Ctrl+Z außerhalb des Textes). Mehr Schritte brauchen in großen Projekten mehr Speicher.'
      },
    },

    themePreviewHighlightAmount: {

      label: {
        en: 'Color highlight strength',
        de: 'Stärke der Farbhervorhebung'
      },

      description: {
        en: 'How bright a color pulses in the preview while the mouse is over it. 0 turns it off.',
        de: 'Wie hell eine Farbe in der Vorschau pulsiert, während die Maus darüber ist. 0 schaltet es aus.'
      },
    },

    themePreviewHighlightDuration: {

      label: {
        en: 'Color highlight speed',
        de: 'Geschwindigkeit der Farbhervorhebung'
      },

      description: {
        en: 'Duration of one pulse.',
        de: 'Dauer eines Pulses.'
      },
    },
  },

  flashPreview: {

    search: {
      en: 'preview highlight pulse color theme editor',
      de: 'vorschau hervorhebung puls farbe theme editor'
    },

    label: {
      en: 'Preview, click a color:',
      de: 'Vorschau, klicke auf eine Farbe:'
    },

    heading: {
      en: 'Getting started',
      de: 'Erste Schritte'
    },

    text: {
      vars: ['link'],
      en: 'Open the {link}.',
      de: 'Öffne den {link}.'
    },

    link: {
      en: 'project hub',
      de: 'Project Hub'
    },

    colors: {

      background: {
        en: 'Background',
        de: 'Hintergrund'
      },

      heading: {
        en: 'Heading',
        de: 'Überschrift'
      },

      text: {
        en: 'Text',
        de: 'Text'
      },

      link: {
        en: 'Link',
        de: 'Link'
      },
    },
  },

  appTheme: {

    label: {
      en: 'Theme',
      de: 'Theme'
    },

    description: {
      en: 'Colors of the app. Every theme has a dark and a light variant, the dark mode setting picks one.',
      de: 'Farben der App. Jedes Theme hat eine dunkle und eine helle Variante, die Einstellung „Dunkler Modus“ wählt eine davon aus.'
    },

    selectLabel: {
      en: 'App theme',
      de: 'App-Theme'
    },

    groupBuiltIn: {
      en: 'Built-in',
      de: 'Mitgeliefert'
    },

    groupCustom: {
      en: 'Custom',
      de: 'Eigene'
    },

    storageWeb: {
      en: 'Custom themes are not stored in the browser: export them to keep them, import loads them again.',
      de: 'Eigene Themes werden im Browser nicht gespeichert: Exportiere sie, um sie zu behalten, mit Importieren lädst du sie wieder.'
    },

    storageDesktop: {
      en: 'Custom themes are stored in the app data folder (app-themes).',
      de: 'Eigene Themes werden im App-Datenordner gespeichert (app-themes).'
    },

    builtInLabel: {
      en: 'Built-in theme',
      de: 'Mitgeliefertes Theme'
    },

    customLabel: {
      en: 'Custom theme',
      de: 'Eigenes Theme'
    },

    builtInNote: {
      en: 'Built-in themes can\'t be changed, duplicate one to edit its colors.',
      de: 'Mitgelieferte Themes können nicht geändert werden, dupliziere eines, um seine Farben zu bearbeiten.'
    },

    showColors: {
      en: 'Show colors…',
      de: 'Farben anzeigen…'
    },

    editColors: {
      en: 'Edit colors…',
      de: 'Farben bearbeiten…'
    },

    duplicate: {
      en: 'Duplicate',
      de: 'Duplizieren'
    },

    rename: {
      en: 'Rename',
      de: 'Umbenennen'
    },

    delete: {
      en: 'Delete',
      de: 'Löschen'
    },

    filesLabel: {
      en: 'Theme files',
      de: 'Theme-Dateien'
    },

    filesDescription: {
      vars: ['extension'],
      en: 'Share themes as {extension} files.',
      de: 'Teile Themes als {extension}-Dateien.'
    },

    import: {
      en: 'Import…',
      de: 'Importieren…'
    },

    export: {
      en: 'Export',
      de: 'Exportieren'
    },

    duplicateTitle: {
      en: 'Duplicate theme',
      de: 'Theme duplizieren'
    },

    duplicateName: {
      vars: ['name'],
      en: '{name} copy',
      de: '{name} Kopie'
    },

    create: {
      en: 'Create',
      de: 'Erstellen'
    },

    renameTitle: {
      en: 'Rename theme',
      de: 'Theme umbenennen'
    },

    deleteTitle: {
      en: 'Delete theme?',
      de: 'Theme löschen?'
    },

    deleteMessage: {
      vars: ['name'],
      en: '"{name}" will be deleted. This can\'t be undone.',
      de: '„{name}“ wird gelöscht. Das kann nicht rückgängig gemacht werden.'
    },

    cancel: {
      en: 'Cancel',
      de: 'Abbrechen'
    },

    imported: {
      vars: ['name'],
      en: 'Imported "{name}"',
      de: '„{name}“ importiert'
    },
  },

  hotkeys: {

    label: {
      en: 'Keyboard shortcuts',
      de: 'Tastenkürzel'
    },

    changed: {
      vars: ['count'],
      plural: 'count',
      en: { one: '{count} shortcut changed.', other: '{count} shortcuts changed.' },
      de: { one: '{count} Tastenkürzel geändert.', other: '{count} Tastenkürzel geändert.' }
    },

    unchanged: {
      en: 'All shortcuts use their original keys.',
      de: 'Alle Tastenkürzel nutzen ihre ursprünglichen Tasten.'
    },

    edit: {
      en: 'Edit hotkeys…',
      de: 'Tastenkürzel bearbeiten…'
    },
  },
};
