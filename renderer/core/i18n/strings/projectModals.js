/**
 * Texts of the project modals: create project, project settings, create template (core/modal).
 * Format: see core/i18n/I18n.js
 */
export default {

  create: {

    title: {
      en: 'Create Project',
      de: 'Projekt erstellen'
    },

    namePlaceholder: {
      en: 'Project name...',
      de: 'Projektname...'
    },

    location: {
      en: 'Save location',
      de: 'Speicherort'
    },

    saveAs: {
      en: 'Save as:',
      de: 'Speichern als:'
    },

    file: {
      en: 'File (.dfproj)',
      de: 'Datei (.dfproj)'
    },

    folder: {
      en: 'Folder',
      de: 'Ordner'
    },

    selectFolder: {
      en: 'Select a folder...',
      de: 'Einen Ordner auswählen...'
    },

    selectFile: {
      en: 'Select a location and filename...',
      de: 'Ort und Dateinamen auswählen...'
    },

    browse: {
      en: 'Browse…',
      de: 'Durchsuchen…'
    },

    selectLocation: {
      en: 'Please select a save location.',
      de: 'Bitte wähle einen Speicherort.'
    },

    orImport: {
      en: 'or import project',
      de: 'oder Projekt importieren'
    },

    import: {
      en: 'import project',
      de: 'Projekt importieren'
    },

    nameTooShort: {
      vars: ['min'],
      en: 'Failed to create project, name has to be at least {min} characters long',
      de: 'Das Projekt konnte nicht erstellt werden, der Name muss mindestens {min} Zeichen lang sein'
    },

    saveFailed: {
      vars: ['message'],
      en: 'Failed to save project: {message}',
      de: 'Das Projekt konnte nicht gespeichert werden: {message}'
    },

    desktopOnly: {
      en: 'File selection is only available in the desktop version.',
      de: 'Die Dateiauswahl gibt es nur in der Desktop-Version.'
    },

    defaultFileName: {
      en: 'project',
      de: 'projekt'
    },

    fileFilter: {
      en: 'DocForge Project',
      de: 'DocForge-Projekt'
    },

    noSaveDialog: {
      en: 'Save dialog not available.',
      de: 'Der Speicherdialog ist nicht verfügbar.'
    },

    noFolderPicker: {
      en: 'Folder picker not available.',
      de: 'Die Ordnerauswahl ist nicht verfügbar.'
    },

    selectFailed: {
      vars: ['message'],
      en: 'Failed to select location: {message}',
      de: 'Der Ort konnte nicht ausgewählt werden: {message}'
    },

    newProject: {
      en: 'New project',
      de: 'Neues Projekt'
    },
  },

  settings: {

    title: {
      en: 'Project Settings',
      de: 'Projekteinstellungen'
    },

    editor: {
      en: 'Editor',
      de: 'Editor'
    },

    tabSize: {
      en: 'Tab size (spaces)',
      de: 'Tab-Breite (Leerzeichen)'
    },

    tabSizeHint: {
      en: 'Spaces the Tab key inserts and the width of tabs in the editor, code blocks, tree blocks and indent guides. New projects start with the value from the preferences.',
      de: 'Leerzeichen, die die Tab-Taste einfügt, und die Breite von Tabs im Editor, in Codeblöcken, Baumblöcken und Einrückungslinien. Neue Projekte starten mit dem Wert aus den Einstellungen.'
    },

    formatGuide: {
      en: 'Format Guide',
      de: 'Format-Guide'
    },

    generate: {
      vars: ['file'],
      en: 'Generate {file} on save',
      de: '{file} beim Speichern erzeugen'
    },

    generateHint: {
      en: 'Folder projects only. Written next to the config, it describes the project format, entry types and languages for tools and AI assistants.',
      de: 'Nur für Ordnerprojekte. Wird neben die Konfiguration geschrieben und beschreibt das Projektformat, die Eintragstypen und Sprachen für Tools und KI-Assistenten.'
    },

    preferences: {
      en: 'Documentation preferences (optional)',
      de: 'Vorgaben für die Dokumentation (optional)'
    },

    preferencesPlaceholder: {
      en: 'Rules for new and changed content, e.g. writing style, language, structure of an entry...',
      de: 'Regeln für neue und geänderte Inhalte, z. B. Schreibstil, Sprache, Aufbau eines Eintrags...'
    },

    exportGuide: {
      en: 'Export guide...',
      de: 'Guide exportieren...'
    },

    guideExported: {
      en: 'Format guide exported.',
      de: 'Format-Guide exportiert.'
    },

    noProject: {
      en: 'No project open.',
      de: 'Kein Projekt geöffnet.'
    },
  },

  template: {

    title: {
      en: 'Create Template',
      de: 'Vorlage erstellen'
    },

    namePlaceholder: {
      en: 'Template name...',
      de: 'Name der Vorlage...'
    },

    description: {
      en: 'Description (optional)',
      de: 'Beschreibung (optional)'
    },

    descriptionPlaceholder: {
      en: 'What is this template for?',
      de: 'Wofür ist diese Vorlage?'
    },

    noProject: {
      en: 'No project to create a template from.',
      de: 'Kein Projekt, aus dem eine Vorlage erstellt werden kann.'
    },

    newTemplate: {
      en: 'New Template',
      de: 'Neue Vorlage'
    },

    loadFailed: {
      en: 'Failed to load the project for the template.',
      de: 'Das Projekt für die Vorlage konnte nicht geladen werden.'
    },

    created: {
      vars: ['name'],
      en: 'Template \'{name}\' created.',
      de: 'Vorlage \'{name}\' erstellt.'
    },
  },
};
