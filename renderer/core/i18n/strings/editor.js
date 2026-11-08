/**
 * Texts of the doc editor view and its editor area (views/docEditor, editorArea).
 * Format: see core/i18n/I18n.js
 */
export default {

  toolbar: {

    h1: {
      en: 'Heading 1',
      de: 'Überschrift 1'
    },

    h2: {
      en: 'Heading 2',
      de: 'Überschrift 2'
    },

    h3: {
      en: 'Heading 3',
      de: 'Überschrift 3'
    },

    bold: {
      en: 'Bold',
      de: 'Fett'
    },

    italic: {
      en: 'Italic',
      de: 'Kursiv'
    },

    'inline-code': {
      en: 'Inline code',
      de: 'Inline-Code'
    },

    'unordered-list': {
      en: 'Unordered list',
      de: 'Ungeordnete Liste'
    },

    'ordered-list': {
      en: 'Ordered list',
      de: 'Nummerierte Liste'
    },

    'check-mark': {
      en: 'Check mark',
      de: 'Häkchen'
    },

    blockquote: {
      en: 'Blockquote',
      de: 'Zitat'
    },

    'code-block': {
      en: 'Code block',
      de: 'Codeblock'
    },

    link: {
      en: 'Insert link',
      de: 'Link einfügen'
    },

    'ref-anchor': {
      en: 'Link here (anchor + reference link)',
      de: 'Hierher verlinken (Anker + Referenz-Link)'
    },

    hr: {
      en: 'Horizontal rule',
      de: 'Horizontale Linie'
    },

    table: {
      en: 'Insert table',
      de: 'Tabelle einfügen'
    },

    tree: {
      en: 'Insert tree (folder structure)',
      de: 'Baum einfügen (Ordnerstruktur)'
    },

    section: {
      en: 'Insert collapsible section (around the selected lines)',
      de: 'Einklappbaren Abschnitt einfügen (um die ausgewählten Zeilen)'
    },

    footnote: {
      en: 'Insert footnote',
      de: 'Fußnote einfügen'
    },
  },

  modes: {

    split: {
      en: 'Split view',
      de: 'Geteilte Ansicht'
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

  wordWrap: {
    en: 'Word wrap',
    de: 'Zeilenumbruch'
  },

  placeholder: {
    en: 'Enter Markdown here…\n\n# Heading\n## Section\n**bold** *italic* `code`',
    de: 'Markdown hier eingeben…\n\n# Überschrift\n## Abschnitt\n**fett** *kursiv* `code`'
  },

  placeholderShort: {
    en: 'Enter Markdown here…',
    de: 'Markdown hier eingeben…'
  },

  noEntry: {
    en: 'No entry selected',
    de: 'Kein Eintrag ausgewählt'
  },

  noEntryHint: {
    en: 'Select an entry from the sidebar or create a new one.',
    de: 'Wähle einen Eintrag in der Seitenleiste aus oder erstelle einen neuen.'
  },

  unknownLink: {
    vars: ['slug'],
    en: 'Unknown link "{slug}"',
    de: 'Unbekannter Link „{slug}“'
  },

  brokenLink: {
    vars: ['reason'],
    en: 'Broken link: {reason}',
    de: 'Defekter Link: {reason}'
  },

  noticeFolderEmbedded: {
    vars: ['page'],
    en: 'Folder: the content of this entry is not exported. Only its name is shown as a heading on the page \'{page}\'.',
    de: 'Ordner: Der Inhalt dieses Eintrags wird nicht exportiert. Nur sein Name erscheint als Überschrift auf der Seite \'{page}\'.'
  },

  noticeFolder: {
    en: 'Folder: the content of this entry is not exported. It only groups its children in the navigation.',
    de: 'Ordner: Der Inhalt dieses Eintrags wird nicht exportiert. Er gruppiert nur seine Untereinträge in der Navigation.'
  },

  noticeMerged: {
    vars: ['page'],
    en: 'Merged: this entry is shown as a section on the page \'{page}\' in the export.',
    de: 'Zusammengeführt: Dieser Eintrag erscheint im Export als Abschnitt auf der Seite \'{page}\'.'
  },

  noticeTypeIgnored: {
    vars: ['type'],
    en: ' Its own type \'{type}\' is ignored there.',
    de: ' Sein eigener Typ \'{type}\' wird dort ignoriert.'
  },

  previewFailed: {
    en: 'Failed to render entry preview',
    de: 'Die Vorschau des Eintrags konnte nicht erstellt werden'
  },

  linkModal: {

    title: {
      en: 'Insert Link',
      de: 'Link einfügen'
    },

    text: {
      en: 'Link text',
      de: 'Link-Text'
    },

    textPlaceholder: {
      en: 'Display text',
      de: 'Angezeigter Text'
    },

    url: {
      en: 'URL',
      de: 'URL'
    },

    insert: {
      en: 'Insert',
      de: 'Einfügen'
    },
  },

  view: {

    openFailed: {
      en: 'Failed to open Project-editor',
      de: 'Der Projekt-Editor konnte nicht geöffnet werden'
    },

    changedTitle: {
      en: 'Project changed on disk',
      de: 'Projekt auf dem Datenträger geändert'
    },

    changedMessage: {
      vars: ['name'],
      en: '"{name}" was changed outside of DocForge. Reload it and discard your unsaved changes?',
      de: '„{name}“ wurde außerhalb von DocForge geändert. Neu laden und deine ungespeicherten Änderungen verwerfen?'
    },

    keepChanges: {
      en: 'Keep my changes',
      de: 'Meine Änderungen behalten'
    },

    reload: {
      en: 'Reload',
      de: 'Neu laden'
    },

    loadFailedError: {
      vars: ['error'],
      en: 'Failed to load external project changes: {error}',
      de: 'Die externen Projektänderungen konnten nicht geladen werden: {error}'
    },

    loadFailed: {
      en: 'Failed to load external project changes.',
      de: 'Die externen Projektänderungen konnten nicht geladen werden.'
    },

    loaded: {
      en: 'Loaded external project changes',
      de: 'Externe Projektänderungen geladen'
    },

    recoveryTitle: {
      en: 'Restore unsaved changes?',
      de: 'Ungespeicherte Änderungen wiederherstellen?'
    },

    recoveryMessage: {
      vars: ['name', 'date'],
      en: 'DocForge was closed without saving "{name}". A backup from {date} contains the unsaved changes.\n\nIt stays available under File -> Backups.',
      de: 'DocForge wurde geschlossen, ohne „{name}“ zu speichern. Eine Sicherung vom {date} enthält die ungespeicherten Änderungen.\n\nSie bleibt unter Datei -> Sicherungen verfügbar.'
    },

    ignore: {
      en: 'Ignore',
      de: 'Ignorieren'
    },

    restore: {
      en: 'Restore',
      de: 'Wiederherstellen'
    },

    restored: {
      en: 'Backup restored. Save the project to keep it.',
      de: 'Sicherung wiederhergestellt. Speichere das Projekt, um sie zu behalten.'
    },

    watcherError: {
      vars: ['error'],
      en: 'File watcher error: {error}',
      de: 'Fehler bei der Dateiüberwachung: {error}'
    },
  },
};
