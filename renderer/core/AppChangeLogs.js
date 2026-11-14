import { parseMarkdownAsync } from '@core/markdownParser/MarkdownParser.js';

// ─── Application changelog ──────────────────────────────────────────────────────
//
// One entry per released version, shown in the Changelog modal (Help menu).
// `changes` groups the items by category, e.g. 'User Features' / 'Changes' / 'Fixes'.
// An item is a string or `{ text, items: string[] }` for an item with sub items.
// Items are Markdown-light: only `inline code` is rendered in the modal.

const APP_CHANGE_LOGS = [
  {
    version: '2.4.0',
    date: '2026-11-14',
    changes: {
      'User Features': [
        'New project settings (File -> Project Settings) with the tab size of the project and an optional format guide that describes the project for tools and AI assistants, new projects use the tab size from the preferences',
        'C++: more standard types like mutexes, locks and threads are now highlighted',
        'Search bar and filters in the links tab of the doc editor',
        'Broken links now list the entries that use them',
        'Table headers now stay visible while scrolling through a table',
        'Right click on a link, a recent project or a template opens the same actions as its "⋯" menu',
        'Doc theme cards in the appearance manager now have a "⋯" menu (also on right click) to export, rename, duplicate or delete the theme',
        'Export preview now shows a loading indicator while it builds',
        'Comments in entries that are hidden in the preview and the export. Lines can be commented out with `Ctrl+#`',
        'Tables can highlight rows, columns and cells, show hover effects and stripes on rows or columns, and have custom column widths, line widths and alignment',
        'New table colors in the theme editor for highlights, hover effects and stripes',
        'Code blocks can show a copy button, line numbers and indent guides, and the language label can be changed or hidden',
        'New color for the indent guides of code blocks in the theme editor',
        'Syntax highlighting for inline code',
        'Check marks in lists with `- [ ]` and `- [x]`, also in numbered lists, with a toolbar button and `Ctrl+Shift+X`',
        'New color for check marks in the theme editor',
        'Collapsible sections with `::: Title` and `:::` around any other content, can be nested and start collapsed unless they have the `open` property, with a toolbar button to insert one, an edit button (also `Ctrl+.`) for the title and start state and their own colors in the theme editor',
        'Tree blocks (` ```tree `) show folder structures with folder and file icons and comments, folders can be collapsible and start collapsed, with a toolbar button to insert one',
        'The bullets of a list can be set to disc, circle, square, dash, arrow or none, also per level',
        'New color for bullets and list numbers in the theme editor',
        'Footnotes with `[^1]` in the text and `[^1]: text` anywhere in the entry, listed at the end of the entry and shown on hover, with a toolbar button to insert one',
        'New color for footnote numbers in the theme editor',
        'Header, sidebar and table of contents can have their own background and text color in the theme editor',
        'Hovering a color in the theme editor makes it softly pulse in the preview to show where it is used',
        'Reopening an entry in the doc editor now returns to the scroll position where you left it',
        'Go back and forward between the opened entries in the doc editor with `Alt+Left` and `Alt+Right`',
        'Move up and down through the entry tree of the doc editor with `Alt+Up` and `Alt+Down`, with `Ctrl` also into collapsed entries',
        'The contents tab of the doc editor now lists the entries that link to the open entry',
        'Entries can be moved to another tab or under another entry with "Move to tab" in their "⋯" menu',
        'Choosing an entry, e.g. the target of a link, now opens a searchable list grouped by tab',
        'When creating an entry you can now choose its tab and parent entry',
        '`Ctrl+N` in the doc editor creates a new entry under the open entry',
        '`[toc]` on its own line shows a table of contents of the headings below it, in one of four looks, optionally with a title, numbered or only up to a heading level',
        'Quick open with `Ctrl+P` or the search field in the title bar of the doc editor: search any entry by name and open it, recently opened entries come first',
        'Pressing Enter in a list item in the doc editor now starts the next list item, Enter in an empty item ends the list',
        'Numbered list items can be written as `n.` to be numbered automatically, the ordered list button and `Ctrl+Shift+O` now insert `n.`',
        'When removing a project from the recent projects, its file or folder can now also be moved to the recycle bin',
        'Leaving a project with unsaved changes (also by closing the app) now asks whether to save or discard them',
        'A dot next to the project name in the navigation bar shows that the project has unsaved changes',
        'After a crash, opening the project offers to restore the unsaved changes from its latest backup',
        'When an open project with unsaved changes is changed outside of DocForge, you can now choose whether to reload it',
        'Project, theme and language files can now be dragged onto the app to open or import them',
        'Opening a project, theme or language file from the file explorer now opens it in DocForge, also when the app is already running',
        'New color picker in the theme editor with a color square, a color wheel and sliders, the colors of the theme for quick reuse and a pipette to pick a color from anywhere on the screen',
        {
          text: 'Improvements to the text input of the doc editor',
          items: [
            'Markdown, links, footnotes, properties and comments are highlighted while writing, broken links, footnotes without text and code blocks, sections, property blocks and comments without an end are marked, hovering a broken link or a missing end shows the reason',
            'Suggestions for links, footnotes, code block languages, `[toc]` and the properties of tables, code blocks, tree blocks, lists and `[toc]` while writing, also with `Ctrl+Space`',
            'Ready-made snippets in the suggestions: `<` for a comment, `[` for an external link, `:::` for a collapsible section, check marks for a new list and `{#` for anchor names from the heading or from links that point to a missing anchor. A placeholder like the title is selected after inserting, Enter stays a normal key until a suggestion is chosen with the arrow keys',
            'Tables, code blocks, tree blocks, lists and `[toc]` get an edit button (also `Ctrl+.`) to set their properties without writing them and to edit tables in a grid, Alt + arrow keys move between its cells',
          ],
        },
        'Undo and redo for all project changes with `Ctrl+Z` and `Ctrl+Y` (also `Ctrl+Shift+Z`) or the new Edit menu, e.g. deleted or moved entries, tabs, theme and language changes. It opens where the change was made and shows what was undone, restoring a backup can be undone too',
        'Preferences (File -> Preferences or `Ctrl+,`) with all app settings on one page, a search and a section for every area',
        'Every keyboard shortcut can be changed or removed in the preferences, with a warning when a key is already used',
        'New shortcuts for word wrap, the doc editor view (split, editor only, preview only, next view) and switching between the doc editor and the appearance manager, without a key until you set one in the preferences',
        'App themes in the preferences: seven built-in themes (DocForge, High contrast, Soft, Solarized, Nord, Gruvbox, Catppuccin), each with a dark and a light variant',
        'Own app themes: duplicate a theme and change every color of the app and the doc editor text, copy colors from other themes, export and import them as files',
        {
          text: 'Find and replace in the doc editor',
          items: [
            'Find and replace in the selection, the entry, the tab or all tabs, with match case, whole word, regular expressions and preserve case',
            'Replacing all matches first shows a preview of every change that can be gone through one by one, single tabs, entries and matches can be left out',
            'New search tab in the right sidebar that lists all matches by tab and entry',
          ],
        },
        'The app can be switched between English and German in the preferences',
        'A backslash before a punctuation character shows it as plain text, e.g. `\\*` for a `*` that starts no italic or `\\#` for a line that is no heading. Escapes have their own color in the doc editor',
      ],
      'Changes': [
        'Ctrl+Z in the doc editor text now only undoes the text of the open entry and keeps working after switching between entries',
        'Entries in the document editor\'s left sidebar now show a "⋯" menu (also on right click). Hold Shift to show all entry actions as buttons like before',
        'On mobile, the sidebar of the HTML export now closes after selecting an entry',
        'Level 3 headings (`###`) are no longer shown in uppercase',
        'The slug in the links tab is now shown in the tooltip to keep the list readable',
        'The File and Help menus in the title bar are now sorted more clearly and divided into sections',
        'Projects are no longer saved automatically, changes are saved with Ctrl+S or File -> Save Project',
        'Backups are now only created while a project has unsaved changes, every 5 minutes, with up to 10 backups per project',
        'The backup manager now lists the backups by project, and restoring a backup of the open project replaces its content instead of creating a new project',
        'Restoring a backup of another project now creates a new folder with the project name in the chosen location',
        'Repeated toast messages are now shown as one with a counter and move to the bottom',
        'Clicking a doc theme card in the appearance manager now opens the theme editor right away',
        'Deleting a doc theme now asks for confirmation',
        'In fullscreen the title bar now hides the minimize, maximize and close buttons like a native title bar',
        'Numbered lists now show the numbers as they are written, e.g. a list starting with `2.` starts at 2',
        'Nested bullet lists deeper than three levels now repeat the bullets of the first levels',
        'Tabs in code blocks now have the same width in the doc editor, the preview and the HTML export, set by the tab size of the project',
      ],
      'Fixes': [
        'Fix the layout of the recent project cards in the project hub when the window is too small',
        'Fix an escaped pipe (`\\|`) in a table cell splitting the cell instead of being shown as `|`',
        'Fix the theme editor preview switching to the showcase when choosing a language while the open project is shown',
        'Fix extra blank lines being ignored and code blocks directly below text being shown incorrectly in the preview',
        'Fix keyboard shortcuts not working while clicked into a preview',
        'Fix open menus and popups staying open when clicking into a preview',
        'Fix the search bar of the HTML export on small screens',
        'Fix dropdowns in dialogs staying open when the dialog is closed with Escape',
        'Fix code blocks being displayed incorrectly after opening a document with Windows line endings',
        'Fix dropdown menus being cut off at the edge of the window',
        'Fix links with a custom text inside tables being split into two cells',
        'Fix long lists in the links tab being squeezed together',
        'Fix a short flicker in the HTML export when following a link',
        'Fix the "Override tag text color" toggle in the theme editor not showing its saved state',
        'Improved scrolling behavior of the doc editor preview in split mode, the preview now also follows the cursor',
        'Fix unchanged lines in diff code blocks being slightly shifted compared to added and removed lines',
        'Fix indented added and removed lines in diff code blocks losing their indentation in the preview',
        'Fix backups created during the same session all containing the latest state instead of the state at the time of the backup',
        'Fix the Tabs, Doc themes and Languages buttons in the backup manager not switching the shown contents',
        'Fix restoring a backup in the web version opening another project',
        'Fix the colors flashing when clicking the dark/light mode button repeatedly',
        'Fix long tab names stretching the tab dropdown',
        'Fix lines directly below a heading being shown in one row in the preview instead of below each other',
        'Fix the large space between a list and the text directly above or below it',
      ],
    },
  },
  {
    version: '2.3.0',
    date: '2026-10-04',
    changes: {
      'User Features': [
        'Partial syntax highlighting for `Whitespace` (Stack, Arithmetic, Heap, I/O — Flow Control not yet supported)',
        'Added a toolbar to the left sidebar of the document editor. Entries can now be expanded or collapsed all at once, and creating new entries has been moved into the toolbar.',
        'Hold Ctrl while collapsing/expanding an entry to collapse/expand its child entries',
        'Clicking on an already open tab entry scrolls to the top',
        'External changes to `.dfproj` files are now detected',
        'Doc themes, languages and language styles can now be exported and imported into any project. When importing a language style, the target language is checked against the style and languages that don\'t fully match show a warning',
        'New "Languages" tab in the theme editor to choose which style a theme uses for each language',
        'Custom languages whose name or aliases overlap with a built-in language are marked on their card and in the language popup',
        'Added more built-in language styles (Light+, One Dark, Monokai, Dracula, GitHub Light) for all built-in languages',
        'Export preview in the document editor (File -> Preview Export)',
        'Entry types: `Page`, `Folder` (only groups its children) and `Merged` (shows its children on the same page)',
        'Create templates from your own projects',
        'Rename projects in the project hub',
        'Exported themes can include the project\'s languages',
        'Reference links between entries (`[[slug]]`, anchors with `{#name}`) with a Links overview that shows broken links',
        'Formatting hotkeys in the editor (bold, italic, link, ...), shown on the toolbar tooltips',
      ],
      'Changes': [
        'Made the update modal larger',
        'Project cards in the project hub use a ⋯ menu for their actions',
      ],
      'Fixes': [
        'Selecting another tab entry resets the scroll position correctly',
        'HTML export could contain outdated entries and search results',
        'Child entries of a deleted entry no longer reappear after saving a folder project',
        'Deleted themes and languages no longer reappear after saving a folder project',
        'External changes to project config, themes and languages are now detected',
        'After loading external changes, the tab list showed outdated tabs and newly created tabs got lost',
      ],
    },
  },
  {
    version: '2.2.0',
    date: '2026-09-18',
    changes: {
      'User Features': [
        'Double-clicking a node in the project editor expands it',
        'External changes to project files and folders are now detected and update the editor automatically',
        'Added support for nested unordered and ordered lists',
        'Added support for diff code blocks. Use `diff` or `diff:langName` (e.g. `diff:cpp`) instead of `cpp`. Lines starting with `+` or `-` are displayed as added or removed changes.',
      ],
      'Changes': [
        'Doubled the debounce time in the project editor from 150 ms to 300 ms to prevent flashing while typing',
        'Newly created projects now have a default node',
        'Scrollbars of exported projects now use a different color',
        'Renamed "Search in project" to "Search in tab" in the theme editor',
        'Show element names on hover in the exported project sidebar',
        'Searches now include content from code blocks and inline code',
      ],
      'Fixes': [
        'Fixed project editor word wrap not being loaded correctly',
        'Fixed external links not opening correctly in the system browser',
        'Fixed an issue where the left sidebar arrow button was not always visible in exported projects',
        'Removed the auto updater from macOS',
        'Improved loading times for languages',
        'Fixed C++ language highlighting for template functions',
      ],
    },
  },
  {
    version: '2.1.0',
    date: '2026-08-23',
    changes: {
      'User Features': [
        'Visually highlight the active node when viewing the exported project',
      ],
      'Fixes': [
        'Fix the title bar briefly appearing on the loading screen during startup',
        'Fix the app window being unintentionally draggable after startup in Project-hub',
        'Fix C++ type highlighting for using aliases and for undefined variable types',
        'Fix the project path field appearing empty in the Create Project dialog when the project name is invalid',
        'Fix split view scrolling synchronization in the project editor',
        'Fix node preview position not updating after node changes',
        'Fix theme editor project preview position after updating',
        'Fix Drop down padding styling',
      ],
    },
  },
  {
    version: '2.0.0',
    date: '2026-08-16',
    changes: {
      'User Features': [
        'Projects now live on disk instead of in the appdata folder',
        'New UI for the main page with a list of presets and a list of recently opened projects',
        'Every project now has one corresponding theme',
        'New save type: Folder, storing the files in a folder-like structure',
        'Syntax highlighting for over 40 languages inside of code blocks',
        'New word wrap toggle in Doc-editor',
        'Extended DocTheme settings: preview using the currently open project, sidebar-min-width, sidebar-width-type (sidebar-width-px, sidebar-width-per), toc-min-width, toc-width-type (toc-width-px, toc-width-per), search-enabled (search-position, search-show-in-tab)',
      ],
      'Fixes': [
        'Fixed inconsistent loading behavior',
      ],
    },
  },
  {
    version: '1.3.0',
    date: '2026-05-09',
    changes: {
      'User Features': [
        'Improved visual design of the theme selection button in the project manager',
        'Added "Create New Project" option to the top File menu',
        'Added "Open Project" button in the project manager sidebar',
        'Added validation feedback for short names (Create/Rename Project, DocTheme, Language)',
        'Improved dropdown closing behavior',
        'Added overview modal',
      ],
      'Improvements': [
        'Improved drag and drop behavior for UI elements',
        'Extended dropdown system with support for submenus',
      ],
      'Fixes': [
        'Fixed visual issues in drag and drop interactions',
        'Fixed inconsistencies in dropdown menu behavior',
      ],
    },
  },
  {
    version: '1.2.0',
    date: '2026-04-27',
    changes: {
      'User Features': [
        'Added include theme button to project export',
        'Better project import dialog',
        'Added "Documentation Preview" label above preview area to clarify preview context',
        'Extended DocTheme settings: list-item-gap, table-cell-padding, blockquote-border-width, blockquote-radius, padding-content, scrollbar-size',
        'Added typography controls: line-height, code-line-height',
        'Added layout controls: sidebar-width, toc-width',
      ],
      'Improvements': [
        'Improved DocTheme schema structure and consistency',
      ],
      'Fixes': [
        'Fixed macOS titlebar behavior',
        'Minor stability fixes in theme system',
        'Theme select sidebar visibility',
        'HTML project export',
      ],
    },
  },
  {
    version: '1.1.0',
    date: '2026-04-23',
    changes: {
      'Fixes': [
        'Fixed issues when creating new DocThemes',
        'Fixed Release notes display in Update-dialog',
        'Fixed Saving/Loading',
      ],
    },
  },
  {
    version: '1.0.0',
    date: '2026-04-23',
    changes: {
      'User Features': [
        'Dynamic tab system: multiple tabs per project',
        'Split-view editor with live Markdown preview',
        'Markdown support (tables, lists, blockquotes, horizontal rules)',
        'Hierarchical project structure',
        'DocTheme system (fonts + colors)',
        'Drag-and-drop reordering',
        'Search and sorting for projects/themes',
        'Export tabs as HTML with sidebar',
        "Export project as '.dfproj'",
      ],
    },
  }
].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));

/**
 * @typedef {string | { text: string, items: string[] }} ChangeLogItem
 * @typedef {{ version: string, date: string, changes: Object<string, ChangeLogItem[]> }} ChangeLogEntry
 */

export async function getHTMLFormatedLatestChangeLog() {
  return getHTMLFormatedChangeLog(getLatestChangeLog()?.version);
}

export async function getHTMLFormatedChangeLog(version) {
  const entry = getChangeLog(version);
  if (!entry)
    return 'No changelog available';

  const markdown = getChangeLogGroups(entry)
    .map(({ group, items }) => `#### ${group}\n${items.map(_itemToMarkdown).join('\n')}`)
    .join('\n\n');
  return parseMarkdownAsync(markdown);
}

function _itemToMarkdown(item) {
  if (typeof item === 'string')
    return `- ${item}`;
  return [`- ${item.text}`, ...(item.items ?? []).map(sub => `  - ${sub}`)].join('\n');
}

/**
 * @param {ChangeLogEntry} entry
 * @returns {{ group: string, items: ChangeLogItem[] }[]} Non-empty groups in declaration order
 */
export function getChangeLogGroups(entry) {
  return Object.entries(entry?.changes ?? {})
    .filter(([, items]) => items?.length)
    .map(([group, items]) => ({ group, items }));
}

/** @returns {ChangeLogEntry[]} All changelog entries, newest version first */
export function getChangeLogs() {
  return APP_CHANGE_LOGS;
}

export function getLatestChangeLog() {
  return APP_CHANGE_LOGS[0];
}

export function getChangeLog(version) {
  return APP_CHANGE_LOGS.find(entry => entry.version === version) ?? null;
}
