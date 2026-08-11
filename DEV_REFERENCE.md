# DocForge - Developer Reference

Quick lookup for state keys, events, data shapes, and all exported APIs.
Written for day-to-day use during development - structural overview, not a tutorial.

---

## Table of Contents

1. [Path Aliases](#1-path-aliases)
2. [State](#2-state)
3. [Session State](#3-session-state)
4. [Events](#4-events)
5. [Data - ProjectManager](#5-data--projectmanager)
6. [Core Modules](#6-core-modules)
7. [View System](#7-view-system)
7.1 [Navbar Component & navContext](#71-navbar-component--navcontext)
8. [Component API](#8-component-api)
9. [Modal Builder](#9-modal-builder)
10. [DocTheme System](#10-doctheme-system)
11. [Editor Helpers](#11-editor-helpers)
12. [Tree, Tabs & DragDrop](#12-tree-tabs--dragdrop)
13. [Export](#13-export)
14. [Data Shapes](#14-data-shapes)
15. [Electron / IPC](#15-electron--ipc)
16. [UI Utilities](#16-ui-utilities)
17. [Validation](#17-validation)
18. [Publishing a Release](#18-publishing-a-release)

---

## 1. Path Aliases

Configured in `vite.config.js`. Use these everywhere inside `renderer/`.

| Alias | Resolves to |
|---|---|
| `@core` | `renderer/core/` |
| `@common` | `renderer/common/` |
| `@data` | `renderer/data/` |
| `@views` | `renderer/views/` |
| `@ui` | `renderer/ui/` |

```js
import { state }           from '@core/State.js';
import { eventBus }        from '@core/EventBus.js';
import { componentLoader } from '@core/ComponentLoader.js';
import { parseMarkdown }   from '@common/MarkdownParser.js';
import { getOpenProject }  from '@data/ProjectManager.js';
```

---

## 2. State

**Import:** `import { state } from '@core/State.js'`

```js
state.get(key)        // read a value
state.set(key, value) // write + fires state:change and state:change:<key>
state.notify(key, {   // fire change events without writing to state
  value,              // use when you mutate a nested object directly
  previousValue 
}, extension?)
state.load(data)      // merges a persisted UI-state snapshot with defaults - called internally by StorageManager
state.snapshot()      // shallow copy of the entire state object
state.reset()         // resets the state to its default value
```

### State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `storageVersion` | `number` | `1` | Save format version |
| `isFirstLaunch` | `bool` | `true` | Indicates whether the application is being launched for the first time after installation |
| `hasViewedOverview` | `bool` | `false` | Whether the user has dismissed the Overview modal at least once |
| `recentProjects` | `Array` | `[]` | Recently opened projects. On desktop: `{ id, name, lastOpenedAt, sourcePath, sourceKind }`. On web: `{ id, name, lastOpenedAt, project }` (full snapshot, since there's no file on disk) |
| `projectPresets` | `Array` | `[]` | User-defined project templates: `{ id, name, description, project: <Project snapshot> }` |
| `themePresets` | `Array` | `[]` | User-defined theme templates (structure mirrors `DocTheme`, see §10) |
| `isDarkMode` | `boolean` | `true` | App-level dark/light mode |
| `projectEditorMode` | `string` | `'split'` | `'split'` \| `'editor'` \| `'preview'` |
| `hideWebProjectLimitWarn` | `boolean` | `false` | Web-only: hides the warning shown when opening a project would exceed `MAX_NUMBER_OF_RECENT_PROJECTS` |

Only `isFirstLaunch`, `hasViewedOverview`, `isDarkMode`, `projectEditorMode` are
in `PERSISTED_KEYS` (saved via `state.uiStateSnapshot()`). `recentProjects`,
`projectPresets`, and `themePresets` are persisted separately through their
own `StorageManager` slots (`state.recentProjectsSnapshot()` /
`projectPresetsSnapshot()` / `themePresetsSnapshot()`).

### Common Patterns

```js
// Toggle dark mode
state.set('isDarkMode', !state.get('isDarkMode'));

// Add/replace the recent-projects list (always a full array replace)
state.set('recentProjects', [...state.get('recentProjects'), entry]);
```

---

## 3. Session State

**Import:** `import { session } from '@core/SessionState.js'`

```js
session.get(key)         // read a value
session.set(key, value)  // write + fires session:change and session:change:<key>
session.notify(key, {    // fire change events without writing to state
  value, previousValue   // use when you mutate a nested object directly
}, extension?)
session.snapshot()          // shallow copy of the entire session state object
session.openProjectSnapshot() // shallow copy of just the open project
session.reset()             // resets the session state to its default value
```

### Session State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `isDev` | `bool` | `null` | Whether the app is running in a dev environment - set once in bootstrap |
| `openProject` | `Object\|null` | `null` | The single currently-open Project object (see §14). |
| `activeTabId` | `string\|null` | `null` | ID of selected tab within `openProject` |
| `activeNodeId` | `string\|null` | `null` | ID of selected node within the active tab |
| `collapsedNodes` | `Object` | `{}` | `{ [nodeId]: true }` - collapsed nodes in tree |
| `docThemePresets` | `Array` | `[]` | Runtime list of built-in doc theme presets (offered when picking/creating a project's theme) |
| `languagePresets` | `Array` | `[]` | Runtime list of built-in language presets (offered when adding a language to a project) |
| `projectHubSearchQuery` | `string` | `''` | Search string on the Project Hub's recent-projects list |
| `activeView` | `string\|null` | `null` | Name of the active view (set via `ViewManager`) |
| `isRightProjectEditorSidebarCollapsed` | `bool` | `false` | Doc Editor right sidebar (TOC) collapsed |
| `navContext` | `Object\|null` | `null` | Breadcrumb override for non-`docEditor` views. `{ path: [{ label, event?, props? }, ...] }` - set by `ThemeEditorView` / `LanguageEditorView` / etc. in `mount()`, read by `Navbar`. See [§7.1](#71-navbar-component--navcontext). |

### Common Patterns

```js
// Open a project (see also ProjectManager.openProject())
session.set('openProject', project);
session.set('activeTabId', null);
session.set('activeNodeId', null);

// Switch tab - always reset node
session.set('activeTabId', tab.id);
session.set('activeNodeId', null);

// Select a node
session.set('activeNodeId', node.id);

// Collapse a node in the tree
const collapsed = { ...session.get('collapsedNodes'), [nodeId]: true };
session.set('collapsedNodes', collapsed);

// Mutate the open project in place and notify listeners
notifyProjectChange(project => {
  project.name = 'New Name';
}, 'name');
// Emits: session:change:openProject:name
```

---

## 4. Events

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.emit(event, payload)  // fire an event
eventBus.on(event, handler)    // returns an unsubscribe function
eventBus.off(event, handler)   // remove specific handler
eventBus.clearEvent(event)     // remove all handlers for one event
this.subscribe(event, handler) // inside Component/BaseView - auto-cleaned on destroy
```

### State Events
Emitted automatically by `state.set()` - never emit these manually.

| Event | Payload |
|---|---|
| `state:change` | `{ key, value, previousValue }` |
| `state:change:isDarkMode` | `{ value, previousValue }` |
| `state:change:projectEditorMode` | `{ value, previousValue }` |
| `state:change:recentProjects` | `{ value, previousValue }` |
| `state:change:projectPresets` | `{ value, previousValue }` |
| `state:change:themePresets` | `{ value, previousValue }` |

### Session State Events
Emitted automatically by `session.set()` (or manually via `session.notify()` after
an in-place mutation, e.g. `notifyProjectChange()`) - don't call `session.set()`
directly for `openProject` mutations, use `notifyProjectChange()` instead.

| Event | Payload |
|---|---|
| `session:change` | `{ key, value, previousValue }` |
| `session:change:openProject` | `{ value, previousValue }` |
| `session:change:openProject:<extension>` | e.g. `session:change:openProject:tabs`, `:name` - fired by helpers that mutate a sub-part of the project |
| `session:change:activeTabId` | `{ value, previousValue }` |
| `session:change:activeNodeId` | `{ value, previousValue }` |
| `session:change:activeView` | `{ value, previousValue }` |
| `session:change:collapsedNodes` | `{ value, previousValue }` |
| `session:change:navContext` | `{ value, previousValue }` |
| `session:change:projectHubSearchQuery` | `{ value, previousValue }` |

### Application Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `save:request` | - | `TopBar`, `main.js` (Ctrl+S) | `Storage` |
| `save:request:<key>` | - | anywhere | `Storage` (saves one module slot) |
| `save:complete` | - | `Storage` | `TopBar` |
| `save:complete:<key>` | - | `Storage` | (single slot saved) |
| `reset:complete` | - | `Storage` | (all slots reset) |
| `reset:complete:<key>` | - | `Storage` | (single slot reset) |
| `editor:content-changed` | `{ markdown }` | `EditorArea` | `SidebarRight` |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` | `SidebarRight` |
| `zoom:changed` | `{ factor }` | | |
| `toast:show` | `{ message, type = 'success', durationMS = DEFAULT_TIME }` | anywhere | `Toast` |

### Navigation Events
Handled by `ViewManager` - emit to switch views.
Routes are defined in the `VIEW_ROUTES` object in `ViewManager.js`.
To add a new view, register it there.

| Event | Navigates to |
|---|---|
| `navigate:projectHub` | `ProjectHubView` |
| `navigate:docEditor` | `DocEditorView` |
| `navigate:appearanceManager` | `AppearanceManagerView` (currently a full gallery view - candidate for becoming an embeddable preset picker, see §7.1) |
| `navigate:themeEditor` | `ThemeEditorView` |
| `navigate:languageEditor` | `LanguageEditorView` |

### Modal Events

| Event | Payload | Opens |
|---|---|---|
| `show:modal:createProject` | - | Create / Import Project dialog |
| `show:modal:info` | - | Info dialog |
| `show:modal:overview` | - | Overview dialog |
| `show:modal:update` | `info` (update info object) | Update dialog |

```js
// Show a toast
eventBus.emit('toast:show', { message: 'Saved!', type: 'success' });
eventBus.emit('toast:show', { message: 'Error.', type: 'error' });

// Trigger save
eventBus.emit('save:request');

// Navigate to a different view
eventBus.emit('navigate:docEditor');
```

---

## 5. Data - ProjectManager

**Import:** `import { ... } from '@data/ProjectManager.js'`

```js
export const MAX_NUMBER_OF_RECENT_PROJECTS = 10;
```

### Creating Data

```js
generateProjectId()  // -> 'project_lf3k2abc9'
generateTabId()       // -> 'tab_lf3k2abc9'
generateNodeId()      // -> 'node_lf3k2abc9'

createProject(name)
// -> { id, name, builtIn: false, createdAt, lastOpenedAt, tabs: [defaultTab],
//      theme: null, languages: [], settings: {}, codeBlockCache: new Map(),
//      sourcePath: null, sourceKind: null, isDirty: false }
// Note: theme starts out null - there is no UI yet in the project editor
// for picking a preset or creating one (planned). Same for languages: the
// array exists on the model and round-trips through save/load (incl. the
// folder format's languages/*.dflang files, see §14), but there is no
// project-editor UI yet for adding a project-specific language.

createDefaultTab()
// -> { id, name: 'Dokumentation', nodes: [] }

createTab(tabname, project = null)
// Creates a tab, pushes it onto project.tabs if project is given, returns it

createNode(name, content = '', children = [])
// -> { id, name, content, children }
```

### Opening / Cleaning / Recents

```js
openProject(project, options = { addToRecents: true })
// session.set('openProject', project), optionally addRecentProject(project),
// then eventBus.emit('navigate:docEditor')
// Shows an error toast and returns early if project is falsy.

cleanProject(project)
// -> export-safe copy: strips id/builtIn/createdAt/lastOpenedAt/isDirty/
//    codeBlockCache/sourcePath/sourceKind, deep-cleans tabs and node ids.
// Note: does NOT strip `theme` - it stays inline in the exported project.

addRecentProject(project)   // pushes to state.recentProjects, evicts oldest if over MAX_NUMBER_OF_RECENT_PROJECTS
removeRecentProject(id)     // removes by id from state.recentProjects

getAllProjectPresets()
// -> [...builtInPresets (PROJECT_PRESETS, builtIn: true), ...userPresets (state.projectPresets, builtIn: false)]
// Each entry: { id, name, description, builtIn, factory: () => Project }
```

### Reading Active Data

```js
getOpenProject()
// -> the current session.openProject, or null

getOpenProjectTheme()
// -> project.theme, or null if no project / no theme set

getActiveTab()
// -> Tab object { id, name, nodes: [] } or null
// uses getOpenProject() + session.activeTabId
```

### Mutating the Open Project

```js
notifyProjectChange(mutateFn, extension = null)
// mutateFn(project) - mutate the open project in place, then this fires
// session:change:openProject(:extension) for you.
// -> false if no project is open (mutateFn is not called), true otherwise
// PREFER THIS over `session.set('openProject', project)` for in-place edits.
```

### Tabs

```js
findTab(tabID, tabs = null)
// -> Tab or null. tabs defaults to the open project's tabs.

removeTabById(tabID, project)
// Splices the tab from project.tabs. If it was active, reassigns
// activeTabId to another tab or null. Emits session:change:openProject:tabs.
// -> true if found and removed, false otherwise
```

### Node Tree Operations

```js
findNodeContext(nodeId, nodes, parentNode = null)
// -> { node, parentNode, siblings } or null

findNode(nodeId, nodes = null)
// -> Node or null. nodes defaults to the active tab's nodes.

getNodePath(nodeId, nodes = null, currentPath = [])
// -> [ancestorNode, ..., targetNode] (root -> target) or null

nodeMatchesSearch(node, query)
// -> true if node.name (or any descendant's name) contains query (lowercase)

removeNodeById(nodeId, nodes)
// Removes the node (and descendants) in-place from `nodes`.
// -> true if found and removed, false otherwise
//    Only re-notifies session on the not-found path currently
//   (`session.set('openProject', [...session.get('openProject')])` at the
//   bottom of the function is very likely a bug - spreading an object as an
//   array - flag this if you touch this function).

flattenNodes(nodes)
// -> flat Array of all nodes, depth-first (for export)

deepClone(value)
// -> deep copy via JSON.parse/JSON.stringify
```

### Search & Migration

```js
projectMatchesSearch(project, query)  // -> project.name includes query

migrateProjects(project)  // merges a raw/older project with createProject() defaults
migrateTab(tab)            // merges a raw/older tab with createDefaultTab() defaults, migrates nodes
migrateNode(node)          // merges a raw/older node with createNode() defaults, migrates children
```

---

## 6. Core Modules

### EventBus

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.on(event, handler)     // -> returns unsubscribe function
eventBus.off(event, handler)    // remove specific handler
eventBus.emit(event, data)      // dispatch to all handlers, errors are caught and logged
eventBus.clearEvent(event)      // remove all handlers for one event
```

### StorageManager

**Import:** `import { storageManager } from '@core/storage/StorageManager.js'`

```js
storageManager.init()
storageManager.subscribe(key, { save, load, reset })
storageManager.unsubscribe(key)
storageManager.saveNow(key = null)
storageManager.loadNow(key = null)
storageManager.reset(key = null)
storageManager.saveOnce(key, data)
storageManager.loadOnce(key)
storageManager.clearOnce(key)
```

### ResizeController

**Import:** `import { ResizeController } from '@core/ResizeController.js'`

```js
const resize = new ResizeController(containerEl, {
  direction, initialSize, minSize, maxSize, stateName,
  keepRatio, resetOnDblClick, onResizeStart, onResize, onResizeEnd,
});
resize.enable() / disable() / getSize() / setSize(px) / destroy()
```

### ComponentLoader

**Import:** `import { componentLoader } from '@core/ComponentLoader.js'`

```js
await componentLoader.load(componentPath, container, props = {})
componentLoader.destroy(instanceId)
componentLoader.getInstance(instanceId)
```

---

## 7. View System

### ViewManager

**Import:** `import { viewManager } from '@core/ViewManager.js'`

```js
viewManager.init(container)
await viewManager.switchTo(ViewClass, props = {})
```

Navigation is event-driven - emit, don't call `switchTo()` directly outside bootstrap:

```js
eventBus.emit('navigate:docEditor');
eventBus.emit('navigate:projectHub');
eventBus.emit('navigate:themeEditor', { project, themeId: project.theme?.id ?? null });
```

### BaseView

```js
class MyView extends BaseView {
  static viewId = 'myView';

  _viewPath() { return 'views/myView/MyView'; }

  async mount(componentLoader) {
    await componentLoader.load('...', this.slot('my-slot'));
    this.subscribe('session:change:activeTabId', ({ value }) => this._refresh(value));
  }

  onDestroy() {}
}
```

**BaseView API:** `this.container`, `this.props`, `this.slot(name)`, `this.subscribe(event, handler)`.

---

## 7.1 Navbar Component & navContext

Because sub-resources (`ThemeEditorView`, `LanguageEditorView`, and eventually
a `LanguageStyleEditorView`) are now full `ViewManager` crossfades - not modal
overlays or sidebar toggles - the app shell has a single persistent **Navbar**
component (`common/components/Navbar/`) mounted above the view container that
renders a breadcrumb + contextual quick actions for whichever view is active.
It reacts purely to session state, so views don't need to talk to it directly
except by setting `navContext`.

```js
// common/components/Navbar/Navbar.js
export default class Navbar extends Component { /* ... */ }
```

**How each view is represented:**

| `session.activeView` | Segments shown |
|---|---|
| `projectHub` / no project | `Hub` |
| `docEditor` | `Hub › ProjectName › TabName › Node › ... (path via getNodePath)` |
| anything else (`themeEditor`, `languageEditor`, future `languageStyleEditor`) | `Hub › ProjectName › <navContext.path>` |

- `Hub` is always the first segment (`navigate:projectHub`).
- For `docEditor`, segments are derived purely from `getActiveTab()` /
  `getNodePath()` - no extra session state needed.
- For every other view, the Navbar cannot know its own breadcrumb label or
  where "back" should go, since it's a global component with no view props.
  Instead, **the view itself sets `session.navContext` in `mount()`**:

```js
// ThemeEditorView.mount()
session.set('navContext', {
  path: [{ label: this._activeTheme?.name ?? 'Theme' }],
});
```

```js
// LanguageStyleEditorView.mount() - opened FROM the theme editor,
// so "back" should return to the theme, not straight to docEditor.
session.set('navContext', {
  path: [
    { label: 'Theme', event: this.props.returnTo?.event ?? 'navigate:themeEditor', props: this.props.returnTo?.props },
    { label: this._style?.name ?? 'Style' },
  ],
});
```

Clicking any non-current segment emits its `event` with `props` (same
click-to-navigate convention as the existing node breadcrumb) - there is no
separate back-arrow button.

**Quick actions:** only rendered while `activeView === 'docEditor'` - `Theme`
and `Language` buttons that `eventBus.emit('navigate:themeEditor', ...)` /
`eventBus.emit('navigate:languageEditor', ...)`. This is currently the only
entry point into those editors from the project - there is still no "pick an
existing preset vs. create new" UI backing those buttons (see the open TODO
in `createProject()` above: `theme: null` with nothing in the project editor
to fill it in yet).

---

## 8. Component API

```js
this.element('local-name')
this.elementId('local-name')
this.query(selector)
this.queryAll(selector)
this.subscribe(event, handler)
this.instanceId / this.container / this.props
```

Template ID syntax: `id="{{id:my-button}}"` -> `this.element('my-button')`.
Lifecycle: `onLoad()`, `onDestroy()`, `onUpdate(newProps)`.

---

## 9. Modal Builder

```js
buildStandardModal(overlayId, { title, bodyHTML, primaryLabel, secondaryLabel, wide, onPrimary })
buildDoneModal(overlayId, { title, bodyHTML, doneLabel, wide, doneCallback })
buildConfirmModal(overlayId, { title, message, confirmLabel, cancelLabel, wide, onConfirm })
buildModal(overlayId, { headerHTML, bodyHTML, footerHTML, onPrimary, extraClass })
openModal(overlay) / closeModal(overlay)
```

---

## 10. DocTheme System

A DocTheme embedded at `project.theme`. There is only `session.docThemePresets` (built-in) and
`state.themePresets` (user-saved) exist as *starting points* to copy from
when creating a project's theme.

Every theme's actual values still live in `theme.settings.entries`, a flat
array of `{ name, type, value, active, group? }`. The canonical schema is
`THEME_SCHEMA`, built by `_buildThemeSchema()`.

**Import:** `import { ... } from '@data/DocThemeManager.js'`

### Creating & Cloning

```js
generateDocThemeId()  // -> 'docTheme_lf3k2abc9'

createDocTheme(name, entries = null)
// -> { id, name, builtIn: false, createdAt, lastOpenedAt,
//     settings: { entries: entries ?? createDefaultDocThemeEntries(), langStyleIds: {} } }

createBuiltInTheme(name, overrides = {})
createDefaultDocThemeEntries()
```

### Reading & Writing Values

```js
getThemeValue(theme, key)     // resolved value, or null if inactive/missing
getStoredEntry(theme, key)    // raw { name, value, active } from theme.settings.entries
getSchemaEntry(name)          // schema definition { name, type, value, active, min/max/options/group }
getEntry(theme, key)          // merged { ...schema, ...stored }
getThemeGroup(theme, group)   // all stored entries whose schema group matches
modifyThemeValue(theme, key, { value = null, active = null })
resetThemeSettings(theme, resetParams = null)
mergeDocThemeEntries(defaultEntries, oldEntries)
cleanDocTheme(docTheme)       // strips id/builtIn/createdAt/lastOpenedAt/builtIn for export
```

### Language Styles

```js
getLanguageStyle(theme, languageDefinition)
getLanguageStyleId(theme, languageDefinition)
getLanguageStyleByLangName(theme, langName)
getLanguageStyleIdByLangName(theme, langName)
setLanguageStyleId(theme, langId, styleId)
// Writes theme.settings.langStyleIds[langId] = { id: styleId, isbuiltIn: bool }
```

### Accessors —    stale, not yet migrated

```js
getDocThemes(project)
getPresetDocThemes()      // session.get('docThemePresets') ?? []
findDocTheme(id, list?)
findDocThemeByName(name, list?)
addDocTheme(project, theme)
removeDocThemeById(id)
docThemeMatchesSearch(theme, query)
openDocThemeEditor(theme) // emits navigate:themeEditor { themeId }
updateDocTheme(id, changes) // state.set('docThemes', ...)
```

**These functions still read/write `state.docThemes` and `state.projects`,
neither of which exist in `DEFAULT_STATE` anymore** (see §2) - they're dead
code left over from the pre-restructure model and will silently no-op /
return `undefined` if called. Don't build new UI on top of this accessor
group until it's migrated to operate on `getOpenProject().theme` +
`state.themePresets` instead. `getThemeValue` / `modifyThemeValue` /
`getLanguageStyle*` etc. above are safe - they take a `theme` object directly
and don't touch the stale global list.

### Theme Schema Groups & Entries

| Group | Entries |
|---|---|
| `background` | `background`, `background-surface`, `background-elevated` |
| `text` | `text-primary`, `text-secondary`, `text-muted` |
| `accent` | `accent`, `accent-hover`, `link`, `link-underline` |
| `border` | `border` |
| `code` | `code-background`, `code-border`, `code-text`, `code-tag-text`, `code-radius`, `font-size-code`, `code-line-height`, `code-block-gap` |
| `heading` | `heading`, `heading-h1`–`heading-h4` |
| *(spacing, ungrouped)* | `gap-paragraph`, `gap-heading`, `list-item-gap`, `table-cell-padding`, `blockquote-border-width`, `blockquote-radius`, `padding-content`, `scrollbar-size` |
| *(typography, ungrouped)* | `font-size`, `line-height`, `typography-heading`, `typography-body` |
| *(layout / behavior, ungrouped)* | `header-show`, `header-style`, `header-height`, `toc-show`, `toc-position`, `content-max-width`, `content-show-nav` |
| *(sidebar width, ungrouped)* | `sidebar-width-type`, `sidebar-width-px`, `sidebar-width-per`, `sidebar-min-width` |
| *(toc width, ungrouped)* | `toc-width-type`, `toc-width-px`, `toc-width-per`, `toc-min-width` |
| *(search, ungrouped)* | `search-enabled`, `search-position`, `search-show-in-tab` |

---

## 11. Editor Helpers

```js
parseMarkdown(source) // from @common/MarkdownParser.js
insertLinePrefix(textarea, prefix, onChange)
wrapSelection(textarea, before, after, onChange)
insertCodeBlock(textarea, onChange)
insertTable(textarea, onChange)
insertLink(textarea, text, url, onChange)
getSelectedText(textarea)
syncScrollPosition(editorElement, previewElement)
```

---

## 12. Tree, Tabs & DragDrop

```js
renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })
setupDragAndDrop(container, onReorder)

const tabManager = new TabManager(containerEl, { onRenameTab, onDeleteTab });
tabManager.render() / tabManager.destroy()
// clicking a tab: session.set('activeTabId', id); session.set('activeNodeId', null)

const dnd = new DragDropHelper(containerEl, { itemSelector, handleSelector, idAttribute, placeHolderClass, onReorder });
dnd.destroy()
```

---

## 13. Export

```js
exportCurrentTabAsHTML()
// -> { success: boolean, message: string }
```

---

## 14. Data Shapes

### Project

```js
{
  id:             'project_lf3k2abc9',
  name:           'My Project',
  builtIn:        false,
  createdAt:      1710000000000,
  lastOpenedAt:   1710000000000,
  tabs: [
    { id: 'tab_lf3k2tab1', name: 'Dokumentation', nodes: [] },
  ],
  theme:          null,   // ← embedded DocTheme (was: docThemeId reference)
  languages:      [],     // project-specific SyntaxDefinitions, see SyntaxDefinitionManager.js
  settings:       {},     // reserved for future project settings
  codeBlockCache: new Map(),

  sourcePath:     null,   // absolute path, null on web
  sourceKind:     null,   // 'file' | 'folder' | null
  isDirty:        false,  // changed since last save
}
```

### Folder-Project Layout (`sourceKind === 'folder'`)

**Import:** `import { ... } from '@core/AppMeta.js'` for the constants below.

Unlike `sourceKind === 'file'` (one `.dfproj` JSON document, identical to the
export format, see `serializeProject()` in `@data/DocumentManager.js`), a
`'folder'` project is split across several files so it's diffable/editable by
hand:

```
<projectFolder>/
  docforge.config.json   <- FILE_EXTENSION_PROJECT_CONFIG - project meta +
                             tab/node hierarchy (ids, names, nesting) - no content
  theme.dftheme          <- PROJECT_THEME_FILE - embedded DocTheme, only
                             written if the project actually has one
  languages/              <- PROJECT_LANGUAGES_DIR, only written if the
                             project has custom languages
    <langId>.dflang        one file per project.languages[] entry
  tabs/                    <- PROJECT_TABS_DIR
    <tabId>/                 one folder per tab - folder name === tab.id
      <nodeId>.md             flat, one file per node regardless of tree depth;
                               frontmatter carries `id` + `name`, e.g.:
                               ---
                               id: node_lf3k2def4
                               name: display
                               ---

                               # display
                               ...
    <tabId>/
      ...
```

**Loading is folder-structure-driven, not config-path-driven** - see
`ElectronDocumentIOAdapter._readFolder()` /
`DocumentManager._reconcileFolderProject()`:
- `docforge.config.json` only supplies the *hierarchy* (which node is a
  child of which) and display names - it is reconciled against what's
  actually on disk, never trusted blindly.
- Any `.md` file inside a tab folder that isn't referenced anywhere in that
  tab's node tree is appended flat at the **root of that tab**.
- Any subfolder of `tabs/` that isn't a tab known from the config file
  becomes a **new tab** - folder name used as both `id` and `name` - so
  manually creating a folder under `tabs/` and adding `.md` files into it is
  enough to get a new tab on next open.
- `languages/*.dflang` files are picked up in full regardless of the config
  file - there is no per-language config reference at all, dropping a
  `.dflang` file into the folder is enough.
- `theme.dftheme` is read as-is; a missing file means `project.theme = null`.

**Saving** (`ElectronDocumentIOAdapter._writeTabFolders/_writeLanguages/_writeTheme`)
reconciles the other way: it (re)writes everything currently in the project,
then removes orphaned `.md`/`.dflang` files and orphaned tab folders that no
longer correspond to anything in the project (same "rewrite + cleanup" pattern
as the old flat `nodes/` folder used before this restructure).

### Tab

```js
{ id: 'tab_lf3k2tab1', name: 'Dokumentation', nodes: [ /* Node, ... */ ] }
```

### Node

```js
{
  id:       'node_lf3k2def4',
  name:     'display',
  content:  '# display\n\nThe display property...',
  children: [ /* Node, ... */ ],
}
```

### DocTheme (embedded on `project.theme`)

```js
{
  id:           'docTheme_lf3k2thm1',
  name:         'Dark Teal',
  builtIn:      false,
  createdAt:    1710000000000,
  lastOpenedAt: 1710000000000,
  settings: {
    entries: [
      { name: 'accent', value: '#22d4a8', active: true },
      { name: 'font-size', value: 15, active: true },
      // ... one entry per THEME_SCHEMA definition, see §10
    ],
    langStyleIds: {
      // [languageDefinitionId]: { id: styleId, isbuiltIn: bool }
    },
  },
}
```

### Project Preset (in `state.projectPresets`)

```js
{ id: 'lf3k2tpl1', name: 'API Reference', description: '...', project: { /* Project snapshot */ } }
```

---

## 15. Electron / IPC

```js
window.electronAPI.getPlatform() / getVersions() / ping()
window.electronAPI.minimize() / maximize() / close() / toggleDevTools()
window.electronAPI.onZoomChanged(cb)
window.electronAPI.onBeforeClose(cb) / confirmSaveComplete()
window.electronAPI.updater.checkForUpdates() / installNow() / onChecking(cb) / onAvailable(cb) / onNotAvailable(cb) / onProgress(cb) / onDownloaded(cb) / onError(cb)
window.electronAPI.getUserDataPath() / getExePath() / joinPath(...segments)
window.electronAPI.writeFile(path, data) / readFile(path) / deleteFile(path)
window.electronAPI.openDialog(options) / openFolder(path) / showInFolder(path)
window.electronAPI.send(channel, data) / receive(channel, callback)
```

IPC handlers registered in `main/ipc/Handlers.js` - see original table
(`ping`, `app:save-complete`, `updater:*`, `window:*`, `path:*`, `fs:*`,
`dialog:open`, `folder:open`, `folder:show`).

---

## 16. UI Utilities

```js
createDropDownItem(name, { description, shortcut, shortcutContext })
createDropDownGroup(name)
openMenuItem(el) / closeMenuItem(el) / openGroup(el) / closeGroup(el)
closeAllDropDowns(selector)
addDropdownEventListener(item, cb) / removeDropdownEventListener(item, cb) / dropdownItemClick(item, e)
deselectAllTabs({ element, isParent, condition }) / selectTab({ element, tabAction, isParent })
addCheckboxEventListener / removeCheckboxEventListener / isCheckedBoxActive / toggleCheckBox / setCheckBox / setCheckboxDisabled
addTabIndenting(input) / addLineBreakIndenting(input)
```

---

## 17. Validation

```js
getValidation(type, rule)      // type: 'PROJECT' | 'THEME' | 'LANGUAGE'
getValidationError(type, rule)
```

| Type | Rule | Value |
|---|---|---|
| `PROJECT` | `NAME_MIN_LENGTH` | `3` |
| `THEME` | `NAME_MIN_LENGTH` | `3` |
| `LANGUAGE` | `NAME_MIN_LENGTH` | `2` |

---

## 18. Publishing a Release

1. Bump `version` in `package.json`.
2. Finalize `CHANGELOG.md` date.
3. Commit, then tag: `git tag v1.4.0 && git push origin v1.4.0`.
4. Workflow builds win/mac/linux, publishes a **draft** GitHub Release.
5. Review the draft, verify artifacts, publish manually.
6. Existing installs pick it up via `electron-updater`.

```bash
npm run build
npm run dist:win   # or dist:mac / dist:linux / dist
```