/**
 * Texts of the app modals: info, overview, changelog, update, export preview (core/modal).
 * Format: see core/i18n/I18n.js
 */
export default {

  info: {

    title: {
      en: 'Info',
      de: 'Info'
    },

    version: {
      en: 'Version:',
      de: 'Version:'
    },

    sourceCode: {
      en: 'Source Code:',
      de: 'Quellcode:'
    },

    author: {
      en: 'Author:',
      de: 'Autor:'
    },

    license: {
      en: 'License',
      de: 'Lizenz'
    },

    licenseText: {
      en: 'See repository for license details.',
      de: 'Details zur Lizenz stehen im Repository.'
    },
  },

  overview: {

    title: {
      en: 'DocForge - Overview',
      de: 'DocForge - Übersicht'
    },

    whatIs: {
      en: 'What is DocForge',
      de: 'Was ist DocForge'
    },

    whatIsText: {
      en: 'DocForge is a lightweight desktop application for creating, structuring, and managing technical documentation. It focuses on clarity, speed, and a clean editing experience for structured content.',
      de: 'DocForge ist eine schlanke Desktop-Anwendung zum Erstellen, Strukturieren und Verwalten technischer Dokumentation. Im Mittelpunkt stehen Übersichtlichkeit, Geschwindigkeit und ein aufgeräumtes Bearbeiten strukturierter Inhalte.'
    },

    structure: {
      en: 'Application Structure',
      de: 'Aufbau der Anwendung'
    },

    project: {
      en: 'Project',
      de: 'Projekt'
    },

    appearance: {
      en: 'Appearance',
      de: 'Darstellung'
    },

    projectArea: {
      en: 'Project Area',
      de: 'Projektbereich'
    },

    projectHub: {
      en: 'Project Hub',
      de: 'Project Hub'
    },

    projectEditor: {
      en: 'Project Editor',
      de: 'Projekt-Editor'
    },

    appearanceArea: {
      en: 'Appearance Area',
      de: 'Darstellungsbereich'
    },

    appearanceManager: {
      en: 'Appearance Manager',
      de: 'Darstellungsverwaltung'
    },

    themeEditor: {
      en: 'Theme Editor',
      de: 'Theme-Editor'
    },

    languageEditor: {
      en: 'Language Editor',
      de: 'Spracheditor'
    },

    styleEditor: {
      en: 'Style Editor',
      de: 'Stil-Editor'
    },

    navigation: {
      en: 'Navigation',
      de: 'Navigation'
    },

    navigationText: {
      en: 'The titlebar always shows buttons to switch between the Project and Appearance area. Both areas are accessible at any time without losing your current state.',
      de: 'Die Titelleiste zeigt immer Buttons, um zwischen Projekt- und Darstellungsbereich zu wechseln. Beide Bereiche sind jederzeit erreichbar, ohne dass dein aktueller Stand verloren geht.'
    },

    projectAreaText: {
      en: 'The Project Hub lists your recently opened projects and project presets, where you can start a new project or import an existing one. Opening a project launches the Project Editor, where you create tabs and nodes to structure your content and export the finished project (e.g. as HTML).',
      de: 'Der Project Hub listet deine zuletzt geöffneten Projekte und Projektvorlagen auf. Dort startest du ein neues Projekt oder importierst ein vorhandenes. Ein geöffnetes Projekt startet den Projekt-Editor, in dem du mit Tabs und Einträgen deine Inhalte strukturierst und das fertige Projekt exportierst (z. B. als HTML).'
    },

    appearanceAreaText: {
      en: 'Click "Appearance" from the Project Editor to manage the building blocks used to render your documentation:',
      de: 'Klicke im Projekt-Editor auf „Darstellung“, um die Bausteine zu verwalten, mit denen deine Dokumentation dargestellt wird:'
    },

    docThemes: {
      en: 'Doc Themes',
      de: 'Doc-Themes'
    },

    docThemesText: {
      en: 'Colors, sizing, and layout behavior for the exported output (e.g. whether a header is shown)',
      de: 'Farben, Größen und Layout der exportierten Ausgabe (z. B. ob ein Header angezeigt wird)'
    },

    languages: {
      en: 'Languages',
      de: 'Sprachen'
    },

    languagesText: {
      en: 'Rules that identify tokens in your code (keywords, functions, values, …)',
      de: 'Regeln, die Tokens in deinem Code erkennen (Schlüsselwörter, Funktionen, Werte, …)'
    },

    styles: {
      en: 'Styles',
      de: 'Stile'
    },

    stylesText: {
      en: 'Colors for a language\'s tokens, and can extend its rules',
      de: 'Farben für die Tokens einer Sprache, können auch ihre Regeln erweitern'
    },

    presetsText: {
      en: 'Presets are available for themes, languages, and styles, and you can create your own. Each opens its own editor (Theme Editor, Language Editor, Style Editor) directly from its card.',
      de: 'Für Themes, Sprachen und Stile gibt es Vorlagen, und du kannst eigene erstellen. Jede öffnet direkt über ihre Karte ihren eigenen Editor (Theme-Editor, Spracheditor, Stil-Editor).'
    },
  },

  changelog: {

    title: {
      en: 'Changelog',
      de: 'Änderungsprotokoll'
    },

    current: {
      en: 'Current',
      de: 'Aktuell'
    },

    groups: {

      'User Features': {
        en: 'User Features',
        de: 'Neue Funktionen'
      },

      Changes: {
        en: 'Changes',
        de: 'Änderungen'
      },

      Improvements: {
        en: 'Improvements',
        de: 'Verbesserungen'
      },

      Fixes: {
        en: 'Fixes',
        de: 'Fehlerbehebungen'
      },
    },
  },

  update: {

    title: {
      en: 'Update available',
      de: 'Update verfügbar'
    },

    newVersion: {
      en: 'New Version',
      de: 'Neue Version'
    },

    releaseNotes: {
      en: 'Release Notes',
      de: 'Versionshinweise'
    },

    incompatible: {
      en: 'This version is not compatible with your current version and cannot be installed automatically. Please download it manually.',
      de: 'Diese Version ist nicht mit deiner aktuellen Version kompatibel und kann nicht automatisch installiert werden. Bitte lade sie manuell herunter.'
    },

    skip: {
      en: 'Skip this version',
      de: 'Diese Version überspringen'
    },

    update: {
      en: 'Update',
      de: 'Aktualisieren'
    },

    restart: {
      en: 'Restart now',
      de: 'Jetzt neu starten'
    },

    downloading: {
      en: 'Downloading…',
      de: 'Wird heruntergeladen…'
    },

    downloadingPercent: {
      vars: ['percent'],
      en: 'Downloading… {percent}%',
      de: 'Wird heruntergeladen… {percent} %'
    },

    noDetails: {
      en: 'No details available.',
      de: 'Keine Details verfügbar.'
    },

    requiresVersion: {
      vars: ['min', 'current'],
      en: 'This version requires at least version {min}. Your current version ({current}) is too old for an automatic update. Please download the new version manually.',
      de: 'Diese Version setzt mindestens Version {min} voraus. Deine aktuelle Version ({current}) ist für ein automatisches Update zu alt. Bitte lade die neue Version manuell herunter.'
    },
  },

  exportPreview: {

    title: {
      en: 'Export Preview',
      de: 'Export-Vorschau'
    },

    building: {
      en: 'Building preview…',
      de: 'Vorschau wird erstellt…'
    },

    noProject: {
      en: 'No project open to preview.',
      de: 'Kein Projekt für die Vorschau geöffnet.'
    },

    failed: {
      vars: ['message'],
      en: 'Failed to build export preview: {message}',
      de: 'Die Export-Vorschau konnte nicht erstellt werden: {message}'
    },
  },
};
