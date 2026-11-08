/**
 * Texts of find / replace in the doc editor (FindWidget, ReplacePreviewModal).
 * Format: see core/i18n/I18n.js
 */
export default {

  toggleReplace: {
    en: 'Toggle replace',
    de: 'Ersetzen ein-/ausblenden'
  },

  find: {
    en: 'Find',
    de: 'Suchen'
  },

  matchCase: {
    en: 'Match case',
    de: 'Groß-/Kleinschreibung beachten'
  },

  wholeWord: {
    en: 'Match whole word',
    de: 'Nur ganze Wörter'
  },

  regex: {
    en: 'Use regular expression',
    de: 'Regulären Ausdruck verwenden'
  },

  previous: {
    en: 'Previous match',
    de: 'Vorheriger Treffer'
  },

  next: {
    en: 'Next match',
    de: 'Nächster Treffer'
  },

  close: {
    en: 'Close (Escape)',
    de: 'Schließen (Escape)'
  },

  closeLabel: {
    en: 'Close',
    de: 'Schließen'
  },

  replace: {
    en: 'Replace',
    de: 'Ersetzen'
  },

  preserveCase: {
    en: 'Preserve case',
    de: 'Groß-/Kleinschreibung beibehalten'
  },

  replaceNext: {
    en: 'Replace the current match (Enter)',
    de: 'Den aktuellen Treffer ersetzen (Enter)'
  },

  replaceAll: {
    en: 'All…',
    de: 'Alle…'
  },

  replaceAllTitle: {
    en: 'Replace all (with preview)',
    de: 'Alle ersetzen (mit Vorschau)'
  },

  lookIn: {
    en: 'Look in',
    de: 'Suchen in'
  },

  scopes: {

    entry: {
      en: 'This entry',
      de: 'Diesem Eintrag'
    },

    selection: {
      en: 'Selection',
      de: 'Auswahl'
    },

    tab: {
      en: 'This tab',
      de: 'Diesem Tab'
    },

    all: {
      en: 'All tabs',
      de: 'Allen Tabs'
    },
  },

  selectFirst: {
    en: 'Select the text to search in first',
    de: 'Wähle zuerst den Text aus, in dem gesucht werden soll'
  },

  invalidPattern: {
    vars: ['error'],
    en: 'Invalid pattern: {error}',
    de: 'Ungültiges Muster: {error}'
  },

  noResults: {
    en: 'No results',
    de: 'Keine Treffer'
  },

  position: {
    vars: ['index', 'total'],
    en: '{index} of {total}',
    de: '{index} von {total}'
  },

  inEntries: {
    vars: ['total', 'entries'],
    en: '{total} in {entries}',
    de: '{total} in {entries}'
  },

  results: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} result', other: '{count} results' },
    de: { one: '{count} Treffer', other: '{count} Treffer' }
  },

  entryCount: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} entry', other: '{count} entries' },
    de: { one: '{count} Eintrag', other: '{count} Einträgen' }
  },

  matchCount: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} match', other: '{count} matches' },
    de: { one: '{count} Treffer', other: '{count} Treffer' }
  },

  nothingToReplace: {
    en: 'Nothing to replace',
    de: 'Nichts zu ersetzen'
  },

  replaced: {
    vars: ['matches', 'entries'],
    en: 'Replaced {matches} in {entries}',
    de: '{matches} in {entries} ersetzt'
  },

  preview: {

    title: {
      en: 'Replace preview',
      de: 'Vorschau: Ersetzen'
    },

    summary: {
      vars: ['matches', 'entries'],
      en: '{matches} in {entries}. Uncheck what should stay as it is.',
      de: '{matches} in {entries}. Entferne den Haken bei allem, was bleiben soll, wie es ist.'
    },

    positionHint: {
      en: 'Space checks / unchecks the current match',
      de: 'Leertaste setzt / entfernt den Haken beim aktuellen Treffer'
    },

    replaceCount: {
      vars: ['count'],
      en: 'Replace {count}',
      de: '{count} ersetzen'
    },

    position: {
      vars: ['index', 'total'],
      en: 'Match {index} of {total}',
      de: 'Treffer {index} von {total}'
    },

    foldTab: {
      en: 'Show / hide the entries of this tab',
      de: 'Einträge dieses Tabs ein-/ausblenden'
    },

    replaceTab: {
      en: 'Replace in this tab',
      de: 'In diesem Tab ersetzen'
    },

    foldEntry: {
      en: 'Show / hide the matches of this entry',
      de: 'Treffer dieses Eintrags ein-/ausblenden'
    },

    replaceEntry: {
      en: 'Replace in this entry',
      de: 'In diesem Eintrag ersetzen'
    },

    replaceMatch: {
      en: 'Replace this match',
      de: 'Diesen Treffer ersetzen'
    },
  },
};
