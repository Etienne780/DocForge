/**
 * Texts of the right sidebar of the doc editor (contents, links, search, stats) and the link modal.
 * Format: see core/i18n/I18n.js
 */
export default {

  tabs: {

    contents: {
      en: 'Contents',
      de: 'Inhalt'
    },

    links: {
      en: 'Links',
      de: 'Links'
    },

    search: {
      en: 'Search',
      de: 'Suche'
    },
  },

  tocEmpty: {
    en: 'Headings (# H1, ## H2) appear here as navigation.',
    de: 'Überschriften (# H1, ## H2) erscheinen hier als Navigation.'
  },

  newLink: {
    en: 'New link',
    de: 'Neuer Link'
  },

  filters: {

    all: {
      en: 'All links',
      de: 'Alle Links'
    },

    current: {
      en: 'Links used in the open entry',
      de: 'Im geöffneten Eintrag verwendete Links'
    },

    broken: {
      en: 'Broken links',
      de: 'Defekte Links'
    },
  },

  words: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} word', other: '{count} words' },
    de: { one: '{count} Wort', other: '{count} Wörter' }
  },

  chars: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} char', other: '{count} chars' },
    de: { one: '{count} Zeichen', other: '{count} Zeichen' }
  },

  searchPlaceholder: {
    en: 'Search… (name:, slug:)',
    de: 'Suchen… (name:, slug:)'
  },

  searchIn: {
    en: 'Search in',
    de: 'Suchen in'
  },

  thisEntry: {
    en: 'This entry',
    de: 'Diesem Eintrag'
  },

  thisTab: {
    en: 'This tab',
    de: 'Diesem Tab'
  },

  allTabs: {
    en: 'All tabs',
    de: 'Allen Tabs'
  },

  invalidPattern: {
    en: 'Invalid pattern',
    de: 'Ungültiges Muster'
  },

  resultsSummary: {
    vars: ['results', 'entries'],
    en: '{results} in {entries}',
    de: '{results} in {entries}'
  },

  noResults: {
    en: 'No results.',
    de: 'Keine Treffer.'
  },

  showingFirst: {
    vars: ['shown', 'total'],
    en: 'Showing the first {shown} of {total} results.',
    de: 'Die ersten {shown} von {total} Treffern werden angezeigt.'
  },

  linkedFrom: {
    en: 'Linked from',
    de: 'Verlinkt von'
  },

  openNamed: {
    vars: ['name'],
    en: 'Open \'{name}\'',
    de: '\'{name}\' öffnen'
  },

  via: {
    vars: ['tab', 'links'],
    en: '{tab} · via {links}',
    de: '{tab} · über {links}'
  },

  linkCount: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} link', other: '{count} links' },
    de: { one: '{count} Link', other: '{count} Links' }
  },

  brokenCount: {
    vars: ['links', 'count'],
    en: '{links} · {count} broken',
    de: '{links} · {count} defekt'
  },

  noLinks: {
    en: 'No links yet. Create one with + or mark a place with {#} in the editor toolbar, then use it as [[slug]].',
    de: 'Noch keine Links. Erstelle einen mit + oder markiere eine Stelle mit {#} in der Editor-Toolbar und verwende ihn dann als [[slug]].'
  },

  noMatching: {
    en: 'No matching links.',
    de: 'Keine passenden Links.'
  },

  unknownLinks: {
    en: 'Unknown links',
    de: 'Unbekannte Links'
  },

  actions: {

    insert: {
      en: 'Insert',
      de: 'Einfügen'
    },

    insertDescription: {
      en: 'Insert at the cursor',
      de: 'Am Cursor einfügen'
    },

    goTo: {
      en: 'Go to target',
      de: 'Zum Ziel springen'
    },

    edit: {
      en: 'Edit',
      de: 'Bearbeiten'
    },

    delete: {
      en: 'Delete',
      de: 'Löschen'
    },

    create: {
      en: 'Create link',
      de: 'Link erstellen'
    },
  },

  deletedEntry: {
    en: '(deleted entry)',
    de: '(gelöschter Eintrag)'
  },

  uses: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} use', other: '{count} uses' },
    de: { one: '{count}-mal verwendet', other: '{count}-mal verwendet' }
  },

  usedIn: {
    en: ' · Used in:',
    de: ' · Verwendet in:'
  },

  noSlug: {
    en: '⚠ No link with this slug. Used in:',
    de: '⚠ Kein Link mit diesem Slug. Verwendet in:'
  },

  deleteTitle: {
    en: 'Delete link',
    de: 'Link löschen'
  },

  deleteUsed: {
    vars: ['name', 'entries'],
    en: '\'{name}\' is used in {entries}. These usages will show as broken links.',
    de: '\'{name}\' wird in {entries} verwendet. Diese Stellen werden als defekte Links angezeigt.'
  },

  entryCount: {
    vars: ['count'],
    plural: 'count',
    en: { one: '{count} entry', other: '{count} entries' },
    de: { one: '{count} Eintrag', other: '{count} Einträgen' }
  },

  deleteUnused: {
    vars: ['name'],
    en: 'Delete the link \'{name}\'?',
    de: 'Den Link \'{name}\' löschen?'
  },

  modal: {

    title: {
      en: 'Link',
      de: 'Link'
    },

    namePlaceholder: {
      en: 'Display name...',
      de: 'Angezeigter Name...'
    },

    slug: {
      en: 'Slug',
      de: 'Slug'
    },

    slugPlaceholder: {
      en: 'name-in-text',
      de: 'name-im-text'
    },

    target: {
      en: 'Target entry',
      de: 'Ziel-Eintrag'
    },

    anchor: {
      en: 'Anchor',
      de: 'Anker'
    },

    anchorHint: {
      en: 'Mark a place in the entry with {#name} to link to it.',
      de: 'Markiere eine Stelle im Eintrag mit {#name}, um darauf zu verlinken.'
    },

    anchorPlaceholder: {
      en: 'anchor-name',
      de: 'anker-name'
    },

    anchorInsertHint: {
      en: 'Inserted at the cursor as {#anchor-name}.',
      de: 'Wird am Cursor als {#anker-name} eingefügt.'
    },

    editTitle: {
      en: 'Edit link',
      de: 'Link bearbeiten'
    },

    hereTitle: {
      en: 'Link here',
      de: 'Hierher verlinken'
    },

    newTitle: {
      en: 'New link',
      de: 'Neuer Link'
    },

    notFound: {
      vars: ['anchor'],
      en: '#{anchor} (not found)',
      de: '#{anchor} (nicht gefunden)'
    },

    wholeEntry: {
      en: 'Whole entry',
      de: 'Ganzer Eintrag'
    },

    nameMissing: {
      en: 'Name is missing.',
      de: 'Der Name fehlt.'
    },

    slugInvalid: {
      en: 'Slug may only contain a-z, 0-9 and single dashes.',
      de: 'Der Slug darf nur a-z, 0-9 und einzelne Bindestriche enthalten.'
    },

    slugUsed: {
      vars: ['slug', 'name'],
      en: 'Slug \'{slug}\' is already used by \'{name}\'.',
      de: 'Der Slug \'{slug}\' wird bereits von \'{name}\' verwendet.'
    },

    anchorInvalid: {
      en: 'Anchor may only contain a-z, 0-9 and single dashes.',
      de: 'Der Anker darf nur a-z, 0-9 und einzelne Bindestriche enthalten.'
    },

    chooseTarget: {
      en: 'Choose a target entry.',
      de: 'Wähle einen Ziel-Eintrag.'
    },

    useAs: {
      vars: ['slug'],
      en: 'Use it as [[{slug}]] or [[{slug}|Text]].',
      de: 'Verwende ihn als [[{slug}]] oder [[{slug}|Text]].'
    },

    updateUsages: {
      vars: ['count'],
      plural: 'count',
      en: { one: 'Update {count} usage: ', other: 'Update {count} usages: ' },
      de: { one: '{count} Verwendung anpassen: ', other: '{count} Verwendungen anpassen: ' }
    },
  },
};
