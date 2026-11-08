/**
 * Texts of the keyboard shortcuts: descriptions of the shortcuts (init/InitHotkeys.js, key = shortcut name),
 * key names (ShortcutManager) and the hotkeys modal (@common/HotkeysModal.js).
 * Format: see core/i18n/I18n.js
 */
export default {

  title: {
    en: 'Hotkeys',
    de: 'Tastenkürzel'
  },

  searchPlaceholder: {
    en: 'Search hotkeys…',
    de: 'Tastenkürzel suchen…'
  },

  searchLabel: {
    en: 'Search hotkeys',
    de: 'Tastenkürzel suchen'
  },

  resetAll: {
    en: 'Reset all',
    de: 'Alle zurücksetzen'
  },

  hint: {
    en: 'Click a key and press the new combination (Esc cancels). Shortcuts of a view only work there, the ones under "Everywhere" in every view.',
    de: 'Klicke auf eine Taste und drücke die neue Kombination (Esc bricht ab). Tastenkürzel einer Ansicht funktionieren nur dort, die unter „Überall“ in jeder Ansicht.'
  },

  resetAllTitle: {
    en: 'Reset all hotkeys?',
    de: 'Alle Tastenkürzel zurücksetzen?'
  },

  resetAllMessage: {
    en: 'Every shortcut gets its original key again.',
    de: 'Jedes Tastenkürzel bekommt wieder seine ursprüngliche Taste.'
  },

  reset: {
    en: 'Reset',
    de: 'Zurücksetzen'
  },

  default: {
    vars: ['combo'],
    en: 'Default: {combo}',
    de: 'Standard: {combo}'
  },

  noKeyLower: {
    en: 'no key',
    de: 'keine Taste'
  },

  sameKey: {
    vars: ['list'],
    en: 'Same key as: {list}',
    de: 'Gleiche Taste wie: {list}'
  },

  keyTitle: {
    en: 'Click and press the new keys',
    de: 'Klicken und die neuen Tasten drücken'
  },

  noKey: {
    en: 'No key',
    de: 'Keine Taste'
  },

  removeKey: {
    en: 'Remove the key',
    de: 'Die Taste entfernen'
  },

  resetToDefault: {
    en: 'Reset to default',
    de: 'Auf Standard zurücksetzen'
  },

  recording: {
    en: 'Press keys… (Esc cancels)',
    de: 'Tasten drücken… (Esc bricht ab)'
  },

  usedTitle: {
    en: 'Key already used',
    de: 'Taste bereits belegt'
  },

  usedMessageBoth: {
    vars: ['combo', 'list'],
    en: '{combo} is already used by {list}.\n\nUse it here and remove it there, or keep both (in the view of the specific shortcut only that one reacts)?',
    de: '{combo} wird bereits von {list} verwendet.\n\nHier verwenden und dort entfernen, oder beide behalten (in der Ansicht des spezifischen Tastenkürzels reagiert nur dieses)?'
  },

  usedMessage: {
    vars: ['combo', 'list'],
    en: '{combo} is already used by {list}.\n\nUse it here and remove it there?',
    de: '{combo} wird bereits von {list} verwendet.\n\nHier verwenden und dort entfernen?'
  },

  keepBoth: {
    en: 'Keep both',
    de: 'Beide behalten'
  },

  useHere: {
    en: 'Use it here',
    de: 'Hier verwenden'
  },

  contexts: {

    global: {
      en: 'Everywhere',
      de: 'Überall'
    },

    projectHub: {
      en: 'Project hub',
      de: 'Project Hub'
    },

    docEditor: {
      en: 'Doc editor',
      de: 'Doc-Editor'
    },

    appearanceManager: {
      en: 'Appearance manager',
      de: 'Darstellungsverwaltung'
    },

    themeEditor: {
      en: 'Theme editor',
      de: 'Theme-Editor'
    },

    languageEditor: {
      en: 'Language editor',
      de: 'Spracheditor'
    },

    languageStyleEditor: {
      en: 'Language style editor',
      de: 'Sprachstil-Editor'
    },

    preferences: {
      en: 'Preferences',
      de: 'Einstellungen'
    },
  },

  keys: {

    ctrl: {
      en: 'Ctrl',
      de: 'Strg'
    },

    shift: {
      en: 'Shift',
      de: 'Umschalt'
    },

    alt: {
      en: 'Alt',
      de: 'Alt'
    },

    meta: {
      en: 'Win',
      de: 'Win'
    },

    arrowup: {
      en: 'Up',
      de: 'Oben'
    },

    arrowdown: {
      en: 'Down',
      de: 'Unten'
    },

    arrowleft: {
      en: 'Left',
      de: 'Links'
    },

    arrowright: {
      en: 'Right',
      de: 'Rechts'
    },

    escape: {
      en: 'Esc',
      de: 'Esc'
    },

    enter: {
      en: 'Enter',
      de: 'Eingabe'
    },

    backspace: {
      en: 'Backspace',
      de: 'Rücktaste'
    },

    delete: {
      en: 'Del',
      de: 'Entf'
    },

    tab: {
      en: 'Tab',
      de: 'Tab'
    },

    space: {
      en: 'Space',
      de: 'Leertaste'
    },
  },

  shortcuts: {

    Save: {
      en: 'Save everything',
      de: 'Alles speichern'
    },

    closemodal: {
      en: 'Close any open modal',
      de: 'Offenes Fenster schließen'
    },

    toggleDeveloperTools: {
      en: 'Toggle developer tools',
      de: 'Entwicklertools umschalten'
    },

    OpenPreferences: {
      en: 'Open the preferences',
      de: 'Die Einstellungen öffnen'
    },

    'Edit:undo': {
      en: 'Undo the last project change',
      de: 'Die letzte Projektänderung rückgängig machen'
    },

    'Edit:redo': {
      en: 'Redo the last undone change',
      de: 'Die zuletzt rückgängig gemachte Änderung wiederholen'
    },

    'Edit:redoAlt': {
      en: 'Redo the last undone change',
      de: 'Die zuletzt rückgängig gemachte Änderung wiederholen'
    },

    SaveRecentProjects: {
      en: 'Save recent projects',
      de: 'Zuletzt geöffnete Projekte speichern'
    },

    CreateNewProject: {
      en: 'Creates a new project',
      de: 'Erstellt ein neues Projekt'
    },

    SaveOpenProject: {
      en: 'Save open project',
      de: 'Geöffnetes Projekt speichern'
    },

    ExportProject: {
      en: 'Export project',
      de: 'Projekt exportieren'
    },

    PreviewExport: {
      en: 'Preview exported HTML',
      de: 'Vorschau des exportierten HTML'
    },

    'Format:bold': {
      en: 'Bold',
      de: 'Fett'
    },

    'Format:italic': {
      en: 'Italic',
      de: 'Kursiv'
    },

    'Format:inline-code': {
      en: 'Inline code',
      de: 'Inline-Code'
    },

    'Format:code-block': {
      en: 'Code block',
      de: 'Codeblock'
    },

    'Format:link': {
      en: 'Insert link',
      de: 'Link einfügen'
    },

    'Format:h1': {
      en: 'Heading 1',
      de: 'Überschrift 1'
    },

    'Format:h2': {
      en: 'Heading 2',
      de: 'Überschrift 2'
    },

    'Format:h3': {
      en: 'Heading 3',
      de: 'Überschrift 3'
    },

    'Format:unordered-list': {
      en: 'Unordered list',
      de: 'Ungeordnete Liste'
    },

    'Format:ordered-list': {
      en: 'Ordered list',
      de: 'Nummerierte Liste'
    },

    'Format:check-mark': {
      en: 'Check mark (add / toggle)',
      de: 'Häkchen (hinzufügen / umschalten)'
    },

    'Format:blockquote': {
      en: 'Blockquote',
      de: 'Zitat'
    },

    'Format:comment': {
      en: 'Toggle comment',
      de: 'Kommentar umschalten'
    },

    'Editor:wordWrapOn': {
      en: 'Word wrap on',
      de: 'Zeilenumbruch an'
    },

    'Editor:wordWrapOff': {
      en: 'Word wrap off',
      de: 'Zeilenumbruch aus'
    },

    'Editor:wordWrapToggle': {
      en: 'Word wrap on / off',
      de: 'Zeilenumbruch an / aus'
    },

    'View:cycle': {
      en: 'Next view: split, editor only, preview only',
      de: 'Nächste Ansicht: geteilt, nur Editor, nur Vorschau'
    },

    'View:split': {
      en: 'Split view (editor and preview)',
      de: 'Geteilte Ansicht (Editor und Vorschau)'
    },

    'View:editor': {
      en: 'Editor only',
      de: 'Nur Editor'
    },

    'View:preview': {
      en: 'Preview only',
      de: 'Nur Vorschau'
    },

    'Navigate:back': {
      en: 'Back to the previously opened entry',
      de: 'Zurück zum zuvor geöffneten Eintrag'
    },

    'Navigate:forward': {
      en: 'Forward to the next opened entry',
      de: 'Vor zum nächsten geöffneten Eintrag'
    },

    'Navigate:treeUp': {
      en: 'Entry above in the tree',
      de: 'Eintrag darüber im Baum'
    },

    'Navigate:treeDown': {
      en: 'Entry below in the tree',
      de: 'Eintrag darunter im Baum'
    },

    'Navigate:treeUpAll': {
      en: 'Entry above in the tree, also in collapsed entries',
      de: 'Eintrag darüber im Baum, auch in eingeklappten Einträgen'
    },

    'Navigate:treeDownAll': {
      en: 'Entry below in the tree, also in collapsed entries',
      de: 'Eintrag darunter im Baum, auch in eingeklappten Einträgen'
    },

    'Navigate:quickOpen': {
      en: 'Quick open: search and open an entry',
      de: 'Schnell öffnen: einen Eintrag suchen und öffnen'
    },

    'Entry:new': {
      en: 'New entry (child of the open entry)',
      de: 'Neuer Eintrag (unter dem geöffneten Eintrag)'
    },

    'Edit:structure': {
      en: 'Edit the properties of the table or code block at the cursor',
      de: 'Eigenschaften der Tabelle oder des Codeblocks am Cursor bearbeiten'
    },

    'Find:entry': {
      en: 'Find in this entry',
      de: 'In diesem Eintrag suchen'
    },

    'Find:selection': {
      en: 'Find in the selection',
      de: 'In der Auswahl suchen'
    },

    'Find:tab': {
      en: 'Find in this tab',
      de: 'In diesem Tab suchen'
    },

    'Find:all': {
      en: 'Find in all tabs',
      de: 'In allen Tabs suchen'
    },

    'Replace:entry': {
      en: 'Replace in this entry',
      de: 'In diesem Eintrag ersetzen'
    },

    'Replace:selection': {
      en: 'Replace in the selection',
      de: 'In der Auswahl ersetzen'
    },

    'Replace:tab': {
      en: 'Replace in this tab',
      de: 'In diesem Tab ersetzen'
    },

    'Replace:all': {
      en: 'Replace in all tabs',
      de: 'In allen Tabs ersetzen'
    },

    FindNext: {
      en: 'Next search match',
      de: 'Nächster Suchtreffer'
    },

    FindPrevious: {
      en: 'Previous search match',
      de: 'Vorheriger Suchtreffer'
    },

    'Find:matchCase': {
      en: 'Search: match case',
      de: 'Suche: Groß-/Kleinschreibung beachten'
    },

    'Find:wholeWord': {
      en: 'Search: match whole word',
      de: 'Suche: nur ganze Wörter'
    },

    'Find:regex': {
      en: 'Search: use regular expression',
      de: 'Suche: regulären Ausdruck verwenden'
    },

    'Find:preserveCase': {
      en: 'Replace: preserve case',
      de: 'Ersetzen: Groß-/Kleinschreibung beibehalten'
    },

    'Find:replaceAll': {
      en: 'Replace all search matches (with preview)',
      de: 'Alle Suchtreffer ersetzen (mit Vorschau)'
    },

    'Navigate:editorAppearanceToggle': {
      en: 'Switch between doc editor and appearance manager',
      de: 'Zwischen Doc-Editor und Darstellungsverwaltung wechseln'
    },

    'Navigate:docEditor': {
      en: 'Go to the doc editor',
      de: 'Zum Doc-Editor wechseln'
    },

    'Navigate:appearance': {
      en: 'Go to the appearance manager',
      de: 'Zur Darstellungsverwaltung wechseln'
    },
  },
};
