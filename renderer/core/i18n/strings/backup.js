/**
 * Texts of the backup manager (core/modal/BackupManagerModal.js).
 * Format: see core/i18n/I18n.js
 */
export default {

  title: {
    en: 'Backup manager',
    de: 'Sicherungsverwaltung'
  },

  deleteTitle: {
    en: 'Delete',
    de: 'Löschen'
  },

  deleteMessage: {
    en: 'Are you sure you want to delete this backup?',
    de: 'Möchtest du diese Sicherung wirklich löschen?'
  },

  savedBackups: {
    en: 'Saved backups',
    de: 'Gespeicherte Sicherungen'
  },

  noBackups: {
    en: 'No backups yet',
    de: 'Noch keine Sicherungen'
  },

  selectBackup: {
    en: 'Select a backup to preview',
    de: 'Wähle eine Sicherung für die Vorschau'
  },

  restore: {
    en: 'Restore',
    de: 'Wiederherstellen'
  },

  restoreAsCopy: {
    en: 'Restore as copy',
    de: 'Als Kopie wiederherstellen'
  },

  contents: {
    en: 'Contents',
    de: 'Inhalt'
  },

  back: {
    en: '← Back',
    de: '← Zurück'
  },

  noEntries: {
    en: 'No entries in this backup',
    de: 'Keine Einträge in dieser Sicherung'
  },

  nodeCount: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} node', other: '{count} nodes' },
    de: { one: '{count} Eintrag', other: '{count} Einträge' }
  },

  deleteBackup: {
    en: 'Delete backup',
    de: 'Sicherung löschen'
  },

  open: {
    vars: ['name'],
    en: '{name} (open)',
    de: '{name} (geöffnet)'
  },

  deleteFailed: {
    en: 'Failed to delete backup',
    de: 'Die Sicherung konnte nicht gelöscht werden'
  },

  deleted: {
    en: 'Backup deleted',
    de: 'Sicherung gelöscht'
  },

  restoreTitle: {
    en: 'Restore backup',
    de: 'Sicherung wiederherstellen'
  },

  restoreUnsaved: {
    en: 'The open project has unsaved changes. Replace them with this backup?',
    de: 'Das geöffnete Projekt hat ungespeicherte Änderungen. Durch diese Sicherung ersetzen?'
  },

  replace: {
    en: 'Replace',
    de: 'Ersetzen'
  },

  noProjectData: {
    en: 'Backup contains no project data.',
    de: 'Die Sicherung enthält keine Projektdaten.'
  },

  restoredSave: {
    en: 'Backup restored. Save the project to keep it.',
    de: 'Sicherung wiederhergestellt. Speichere das Projekt, um sie zu behalten.'
  },

  chooseLocation: {
    en: 'Choose restore location',
    de: 'Ort für die Wiederherstellung auswählen'
  },

  restoreHere: {
    en: 'Restore here',
    de: 'Hier wiederherstellen'
  },

  folderExists: {
    vars: ['name'],
    en: 'A folder named "{name}" already exists there.',
    de: 'Dort gibt es bereits einen Ordner „{name}“.'
  },

  restoreFailed: {
    vars: ['message'],
    en: 'Failed to restore backup: {message}',
    de: 'Die Sicherung konnte nicht wiederhergestellt werden: {message}'
  },

  restored: {
    en: 'Backup restored.',
    de: 'Sicherung wiederhergestellt.'
  },

  sections: {

    tabs: {
      en: 'Tabs',
      de: 'Tabs'
    },

    themes: {
      en: 'Doc themes',
      de: 'Doc-Themes'
    },

    languages: {
      en: 'Languages',
      de: 'Sprachen'
    },
  },

  details: {

    name: {
      en: 'Name',
      de: 'Name'
    },

    nodes: {
      en: 'Nodes',
      de: 'Einträge'
    },

    created: {
      en: 'Created',
      de: 'Erstellt'
    },

    entries: {
      en: 'Entries',
      de: 'Einträge'
    },

    aliases: {
      en: 'Aliases',
      de: 'Aliasse'
    },

    none: {
      en: 'None',
      de: 'Keine'
    },

    states: {
      en: 'States',
      de: 'Zustände'
    },

    hoisting: {
      en: 'Hoisting',
      de: 'Hoisting'
    },

    yes: {
      en: 'Yes',
      de: 'Ja'
    },

    no: {
      en: 'No',
      de: 'Nein'
    },
  },
};
