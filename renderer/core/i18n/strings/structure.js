/**
 * Texts of the structure edit modal (properties of tables, code blocks, trees, [toc], lists and sections)
 * and of the table grid editor (views/docEditor/components/editorArea/helpers).
 * Format: see core/i18n/I18n.js
 */
export default {

  apply: {
    en: 'Apply',
    de: 'Übernehmen'
  },

  titles: {

    table: {
      en: 'Edit table',
      de: 'Tabelle bearbeiten'
    },

    code: {
      en: 'Code block properties',
      de: 'Eigenschaften des Codeblocks'
    },

    toc: {
      en: 'Table of contents',
      de: 'Inhaltsverzeichnis'
    },

    tree: {
      en: 'Tree',
      de: 'Baum'
    },

    list: {
      en: 'List',
      de: 'Liste'
    },

    section: {
      en: 'Section',
      de: 'Abschnitt'
    },
  },

  title: {
    en: 'Title',
    de: 'Titel'
  },

  display: {
    en: 'Display',
    de: 'Anzeige'
  },

  behavior: {
    en: 'Behavior',
    de: 'Verhalten'
  },

  toc: {

    noTitle: {
      en: 'No title',
      de: 'Kein Titel'
    },

    look: {
      en: 'Look',
      de: 'Aussehen'
    },

    headings: {
      en: 'Headings',
      de: 'Überschriften'
    },

    numbered: {
      en: 'Numbers like 1.1 (always on in the outline look)',
      de: 'Nummern wie 1.1 (beim Gliederungs-Aussehen immer an)'
    },

    styles: {

      card: {
        en: 'Card - border around, title as header',
        de: 'Karte - Rahmen außen herum, Titel als Kopfzeile'
      },

      tree: {
        en: 'Tree - guide line per level',
        de: 'Baum - Führungslinie pro Ebene'
      },

      outline: {
        en: 'Outline - numbered 1, 1.1, 1.1.1',
        de: 'Gliederung - nummeriert 1, 1.1, 1.1.1'
      },

      leader: {
        en: 'Leader - dotted line to an arrow',
        de: 'Leitlinie - gepunktete Linie bis zu einem Pfeil'
      },
    },

    depths: {

      '1': {
        en: 'Up to # (h1)',
        de: 'Bis # (h1)'
      },

      '2': {
        en: 'Up to ## (h2)',
        de: 'Bis ## (h2)'
      },

      '3': {
        en: 'Up to ### (h3)',
        de: 'Bis ### (h3)'
      },

      '4': {
        en: 'All headings',
        de: 'Alle Überschriften'
      },
    },
  },

  tree: {

    collapsible: {
      en: 'Folders open / close on click',
      de: 'Ordner öffnen / schließen sich per Klick'
    },

    atStart: {
      en: 'At the start (makes the folders collapsible)',
      de: 'Am Anfang (macht die Ordner einklappbar)'
    },

    collapsed: {

      all: {
        en: 'All open',
        de: 'Alle offen'
      },

      '1': {
        en: 'Only the top level',
        de: 'Nur die oberste Ebene'
      },

      '2': {
        en: '2 levels open',
        de: '2 Ebenen offen'
      },

      '3': {
        en: '3 levels open',
        de: '3 Ebenen offen'
      },
    },

    hint: {
      en: 'Per folder in the text: `+ name/` starts collapsed, `- name/` starts open, `! name/` never collapses. Text after ` #` is a comment.',
      de: 'Pro Ordner im Text: `+ name/` startet eingeklappt, `- name/` startet offen, `! name/` klappt nie ein. Text nach ` #` ist ein Kommentar.'
    },
  },

  section: {

    titlePlaceholder: {
      en: 'Title of the section',
      de: 'Titel des Abschnitts'
    },

    open: {
      en: 'Start open (sections start collapsed)',
      de: 'Offen starten (Abschnitte starten eingeklappt)'
    },

    hint: {
      en: 'The section ends at the next `:::` on its own line. Everything in between can be any content, also other sections.',
      de: 'Der Abschnitt endet beim nächsten `:::` in einer eigenen Zeile. Dazwischen kann beliebiger Inhalt stehen, auch weitere Abschnitte.'
    },
  },

  list: {

    bullets: {
      en: 'Bullets',
      de: 'Aufzählungszeichen'
    },

    level: {
      vars: ['level'],
      en: 'Level {level}',
      de: 'Ebene {level}'
    },

    defaultPerLevel: {
      en: 'Default per level',
      de: 'Standard pro Ebene'
    },

    likeLevel1: {
      en: 'Like level 1',
      de: 'Wie Ebene 1'
    },

    hint: {
      en: 'Deeper levels repeat the styles from level 1.',
      de: 'Tiefere Ebenen wiederholen die Stile ab Ebene 1.'
    },

    bulletNames: {

      disc: {
        en: 'disc',
        de: 'Punkt'
      },

      circle: {
        en: 'circle',
        de: 'Kreis'
      },

      square: {
        en: 'square',
        de: 'Quadrat'
      },

      dash: {
        en: 'dash',
        de: 'Strich'
      },

      arrow: {
        en: 'arrow',
        de: 'Pfeil'
      },

      none: {
        en: 'none',
        de: 'keins'
      },
    },
  },

  code: {

    language: {
      en: 'Language',
      de: 'Sprache'
    },

    languagePlaceholder: {
      en: 'e.g. js, cpp, diff:js',
      de: 'z. B. js, cpp, diff:js'
    },

    copy: {
      en: 'Copy button',
      de: 'Kopieren-Button'
    },

    numbers: {
      en: 'Line numbers',
      de: 'Zeilennummern'
    },

    tag: {
      en: 'Language tag',
      de: 'Sprach-Kennzeichnung'
    },

    tagLanguage: {
      en: 'Language name',
      de: 'Name der Sprache'
    },

    tagCustom: {
      en: 'Custom text',
      de: 'Eigener Text'
    },

    tagHidden: {
      en: 'Hidden',
      de: 'Ausgeblendet'
    },

    tagText: {
      en: 'Tag text',
      de: 'Text der Kennzeichnung'
    },

    indent: {
      en: 'Indent guides',
      de: 'Einrückungslinien'
    },

    indentOff: {
      en: 'Off',
      de: 'Aus'
    },

    indentSpaces: {
      en: 'Spaces per level',
      de: 'Leerzeichen pro Ebene'
    },

    indentTabs: {
      en: 'Tabs',
      de: 'Tabs'
    },
  },

  table: {

    grid: {
      en: 'Table (Alt + arrow keys: move between cells)',
      de: 'Tabelle (Alt + Pfeiltasten: zwischen Zellen wechseln)'
    },

    properties: {
      en: 'Properties',
      de: 'Eigenschaften'
    },

    striped: {
      en: 'Striped',
      de: 'Gestreift'
    },

    hover: {
      en: 'Highlight on hover',
      de: 'Hervorheben beim Darüberfahren'
    },

    targets: {
      en: 'Columns, rows and cells',
      de: 'Spalten, Zeilen und Zellen'
    },

    targetsHint: {
      en: 'Counted from 0, row 0 is the header. Lists and ranges: 0,2-4. They follow moved rows and columns.',
      de: 'Gezählt ab 0, Zeile 0 ist die Kopfzeile. Listen und Bereiche: 0,2-4. Sie wandern mit verschobenen Zeilen und Spalten mit.'
    },

    add: {
      en: '+ Add',
      de: '+ Hinzufügen'
    },

    types: {

      col: {
        en: 'Column',
        de: 'Spalte'
      },

      row: {
        en: 'Row',
        de: 'Zeile'
      },

      cell: {
        en: 'Cell',
        de: 'Zelle'
      },
    },

    stripes: {

      row: {
        en: 'Rows',
        de: 'Zeilen'
      },

      col: {
        en: 'Columns',
        de: 'Spalten'
      },
    },

    cellPlaceholder: {
      en: 'row,col e.g. 1,2',
      de: 'Zeile,Spalte z. B. 1,2'
    },

    index: {
      en: 'Index',
      de: 'Index'
    },

    highlight: {
      en: 'Highlight',
      de: 'Hervorheben'
    },

    alignment: {
      en: 'Alignment',
      de: 'Ausrichtung'
    },

    align: {
      en: 'Align',
      de: 'Ausrichten'
    },

    aligns: {

      left: {
        en: 'left',
        de: 'links'
      },

      center: {
        en: 'center',
        de: 'mittig'
      },

      right: {
        en: 'right',
        de: 'rechts'
      },
    },

    width: {
      en: 'Width',
      de: 'Breite'
    },

    widthTitle: {
      en: 'Width in px or %',
      de: 'Breite in px oder %'
    },

    line: {
      en: 'Line',
      de: 'Linie'
    },

    lineTitle: {
      en: 'Line width in px',
      de: 'Linienbreite in px'
    },

    remove: {
      en: 'Remove',
      de: 'Entfernen'
    },
  },

  grid: {

    moveColLeft: {
      en: 'Move column left',
      de: 'Spalte nach links verschieben'
    },

    alignment: {
      vars: ['align'],
      en: 'Alignment: {align} (click to change)',
      de: 'Ausrichtung: {align} (zum Ändern klicken)'
    },

    alignDefault: {
      en: 'default',
      de: 'Standard'
    },

    moveColRight: {
      en: 'Move column right',
      de: 'Spalte nach rechts verschieben'
    },

    insertCol: {
      en: 'Insert column to the right',
      de: 'Spalte rechts einfügen'
    },

    deleteCol: {
      en: 'Delete column',
      de: 'Spalte löschen'
    },

    moveRowUp: {
      en: 'Move row up',
      de: 'Zeile nach oben verschieben'
    },

    moveRowDown: {
      en: 'Move row down',
      de: 'Zeile nach unten verschieben'
    },

    insertRow: {
      en: 'Insert row below',
      de: 'Zeile darunter einfügen'
    },

    deleteRow: {
      en: 'Delete row',
      de: 'Zeile löschen'
    },

    insertRowHeader: {
      en: 'Insert row below the header',
      de: 'Zeile unter der Kopfzeile einfügen'
    },

    size: {
      vars: ['rows', 'columns'],
      en: '{rows} × {columns}',
      de: '{rows} × {columns}'
    },

    rows: {
      vars: ['count'],
      plural: 'count',
      en: { one: '{count} row', other: '{count} rows' },
      de: { one: '{count} Zeile', other: '{count} Zeilen' }
    },

    columns: {
      vars: ['count'],
      plural: 'count',
      en: { one: '{count} column', other: '{count} columns' },
      de: { one: '{count} Spalte', other: '{count} Spalten' }
    },
  },
};
