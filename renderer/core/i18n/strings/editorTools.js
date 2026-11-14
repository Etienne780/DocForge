/**
 * Texts of the doc editor helpers: structure edit button, inserted snippets, highlighting tooltips
 * and the suggestions of the editor input (EditorCompletions.js).
 * Format: see core/i18n/I18n.js
 */
export default {

  editProperties: {
    en: 'Edit properties',
    de: 'Eigenschaften bearbeiten'
  },

  placeCursor: {
    en: 'Place the cursor in a table, code block, list, section or [toc]',
    de: 'Setze den Cursor in eine Tabelle, einen Codeblock, eine Liste, einen Abschnitt oder [toc]'
  },

  entryChanged: {
    en: 'The entry changed, the changes were not applied',
    de: 'Der Eintrag hat sich geändert, die Änderungen wurden nicht übernommen'
  },

  missingEnd: {
    vars: ['end'],
    en: 'Missing end "{end}"',
    de: 'Fehlendes Ende „{end}“'
  },

  snippets: {

    text: {
      en: 'text',
      de: 'Text'
    },

    code: {
      en: '// code here',
      de: '// Code hier'
    },

    column: {
      vars: ['n'],
      en: 'Column {n}',
      de: 'Spalte {n}'
    },

    value: {
      en: 'Value',
      de: 'Wert'
    },

    folder: {
      en: 'folder',
      de: 'ordner'
    },

    file: {
      en: 'file.txt',
      de: 'datei.txt'
    },

    title: {
      en: 'Title',
      de: 'Titel'
    },
  },

  completions: {

    table: {

      hover: {
        en: 'Highlight under the mouse',
        de: 'Hervorhebung unter der Maus'
      },

      striped: {
        en: 'Every second row / column brighter',
        de: 'Jede zweite Zeile / Spalte heller'
      },
    },

    row: {

      hl: {
        en: 'Highlight',
        de: 'Hervorheben'
      },

      line: {
        en: 'Line below in px',
        de: 'Linie darunter in px'
      },
    },

    col: {

      hl: {
        en: 'Highlight',
        de: 'Hervorheben'
      },

      line: {
        en: 'Line to the right in px',
        de: 'Linie rechts in px'
      },

      width: {
        en: 'Width in px or %',
        de: 'Breite in px oder %'
      },

      align: {
        en: 'Text alignment',
        de: 'Textausrichtung'
      },
    },

    cell: {

      hl: {
        en: 'Highlight',
        de: 'Hervorheben'
      },

      align: {
        en: 'Text alignment',
        de: 'Textausrichtung'
      },
    },

    code: {

      copy: {
        en: 'Copy button',
        de: 'Kopieren-Button'
      },

      numbers: {
        en: 'Line numbers',
        de: 'Zeilennummern'
      },

      label: {
        en: 'Text of the language tag',
        de: 'Text der Sprach-Kennzeichnung'
      },

      indent: {
        en: 'Indent guides, spaces per level or tab (Tab key width)',
        de: 'Einrückungslinien, Leerzeichen pro Ebene oder tab (Breite der Tab-Taste)'
      },
    },

    toc: {

      depth: {
        en: 'Lowest heading level, e.g. 2 = up to ##',
        de: 'Tiefste Überschriftenebene, z. B. 2 = bis ##'
      },

      title: {
        en: 'Title above the list, e.g. title="Contents"',
        de: 'Titel über der Liste, z. B. title="Inhalt"'
      },

      style: {
        en: 'Look: card, tree, outline (numbered) or leader',
        de: 'Aussehen: card, tree, outline (nummeriert) oder leader'
      },

      numbered: {
        en: 'Numbers like 1.1 in front of the entries',
        de: 'Nummern wie 1.1 vor den Einträgen'
      },
    },

    tree: {

      collapsible: {
        en: 'Folders open / close on click',
        de: 'Ordner öffnen / schließen sich per Klick'
      },

      collapsed: {
        en: 'Start collapsed, =N: only N levels open',
        de: 'Eingeklappt starten, =N: nur N Ebenen offen'
      },
    },

    section: {

      open: {
        en: 'Start open (sections start collapsed)',
        de: 'Offen starten (Abschnitte starten eingeklappt)'
      },
    },

    list: {

      bullet: {
        en: 'Bullet style, a comma list sets it per level',
        de: 'Aufzählungszeichen, eine Komma-Liste legt sie pro Ebene fest'
      },
    },

    targets: {

      col: {
        en: 'Properties of columns, e.g. col 0,2:',
        de: 'Eigenschaften von Spalten, z. B. col 0,2:'
      },

      row: {
        en: 'Properties of rows, e.g. row 1-3:',
        de: 'Eigenschaften von Zeilen, z. B. row 1-3:'
      },

      cell: {
        en: 'Properties of cells, e.g. cell 1,2:',
        de: 'Eigenschaften von Zellen, z. B. cell 1,2:'
      },
    },

    fences: {

      diff: {
        en: 'Added / removed lines',
        de: 'Hinzugefügte / entfernte Zeilen'
      },

      diffLang: {
        en: 'Diff highlighted as a language',
        de: 'Diff, hervorgehoben als Sprache'
      },

      tree: {
        en: 'Folder structure',
        de: 'Ordnerstruktur'
      },
    },

    toc_block: {
      en: 'Table of contents of the headings below',
      de: 'Inhaltsverzeichnis der Überschriften darunter'
    },

    noDefinition: {
      en: 'No definition yet',
      de: 'Noch keine Definition'
    },

    snippets: {

      link: {
        en: 'External link',
        de: 'Externer Link'
      },

      linkText: {
        en: 'text',
        de: 'Text'
      },

      refLink: {
        en: 'Reference link',
        de: 'Referenz-Link'
      },

      footnote: {
        en: 'Footnote',
        de: 'Fußnote'
      },

      comment: {
        en: 'Comment, not shown in the preview and export',
        de: 'Kommentar, wird in Vorschau und Export nicht angezeigt'
      },

      commentBlock: {
        en: 'Comment over several lines',
        de: 'Kommentar über mehrere Zeilen'
      },

      section: {
        en: 'Collapsible section, starts collapsed',
        de: 'Aufklappbarer Abschnitt, startet zugeklappt'
      },

      sectionOpen: {
        en: 'Collapsible section, starts open',
        de: 'Aufklappbarer Abschnitt, startet aufgeklappt'
      },

      sectionTitle: {
        en: 'Title',
        de: 'Titel'
      },

      checkOpen: {
        en: 'Open check mark',
        de: 'Offenes Häkchen'
      },

      checkDone: {
        en: 'Checked check mark',
        de: 'Gesetztes Häkchen'
      },

      anchor: {
        en: 'Anchor a link can point to',
        de: 'Anker, auf den ein Link zeigen kann'
      },

      anchorHeading: {
        en: 'From the heading',
        de: 'Aus der Überschrift'
      },

      anchorLink: {
        vars: ['name'],
        en: 'Link \'{name}\' points here, anchor missing',
        de: 'Link \'{name}\' zeigt hierher, Anker fehlt'
      },
    },
  },
};
