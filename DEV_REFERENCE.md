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
import { getActiveProject } from '@data/ProjectManager.js';
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
state.load(data)      // apply a persisted snapshot - called internally by StorageManager
state.snapshot()      // shallow copy of the entire state object
state.reset()         // resets the state to its default value
```

### State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `storageVersion` | `number` | `1` | Save format version |
| `isFirstLaunch` | `bool` | `true` | Indicates whether the application is being launched for the first time after installation |
| `hasViewedOverview` | `bool` | `false` | Whether the user has dismissed the Overview modal at least once |
| `projects` | `Array` | `[]` | Array of Project objects |
| `docThemes` | `Array` | `[]` | Saved global DocTheme presets `{ id, name, variables }` |
| `languages` | `Array` | `[]` | Saved SyntaxDefinition objects `{ id, name, ... }` |
| `templates` | `Array` | `[]` | Saved project templates `{ id, name, project: <snapshot> }` |
| `isDarkMode` | `boolean` | `true` | App-level dark/light mode |
| `editorMode` | `string` | `'split'` | `'split'` \| `'editor'` \| `'preview'` |
| `projectSortAction` | `string` | `'none'` | Sorting action for the project list |
| `themeSortAction` | `string` | `'none'` | Sorting action for the theme list |

### Common Patterns

```js
// Toggle dark mode
state.set('isDarkMode', !state.get('isDarkMode'));

// Collapse a node in the tree
const collapsed = { ...state.get('collapsedNodes'), [nodeId]: true };
state.set('collapsedNodes', collapsed);

// Mutate a nested property and notify with sub-key
const projects = state.get('projects');
const project = projects.find(p => p.id === id);
const previousProject = { ...project };   // snapshot before mutation
project.name = 'New Name';
state.notify('projects', { value: project, previousValue: previousProject }, 'name');
// emits 'state:change:projects:name'

// vs. old full-replace (still valid, but triggers every projects subscriber)
state.set('projects', [...state.get('projects')]);
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
session.snapshot()       // shallow copy of the entire session state object
session.reset()          // resets the session state to its default value
```

### Session State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `isDev` | `bool` | `false` | Indicates whether the application is running in a development environment. This value is determined in bootstrap. |
| `activeSection` | `string\|null` | `null` | Active sidebar section (`'project'` / `'theme'`) |
| `activeProjectId` | `string\|null` | `null` | ID of selected project |
| `activeTabId` | `string\|null` | `null` | ID of selected tab within project |
| `activeNodeId` | `string\|null` | `null` | ID of selected node within tab |
| `collapsedNodes` | `Object` | `{}` | `{ [nodeId]: true }` - collapsed nodes in tree |
| `docThemePresets` | `Array` | `[]` | Runtime list of doc theme presets |
| `languagePresets` | `Array` | `[]` | Runtime list of language presets |
| `projectSearchQuery` | `string` | `''` | Sidebar search string for the project section |
| `projectThemeSearchQuery` | `string` | `''` | Sidebar search string for project-level themes |
| `themeSearchQuery` | `string` | `''` | Sidebar search string for the theme manager |
| `activeView` | `string\|null` | `null` | Name of the active view (set via ViewManager) |
| `isRightProjectEditorSidebarCollapsed` | `bool` | `false` | Doc Editor right sidebar collapsed |
| `themeManagerDisplay` | `string` | `'all'` | Theme manager display filter: `'all'` \| `'doc'` \| `'lang'` |

### Common Patterns

```js
// Switch project - always reset tab + node
session.set('activeProjectId', project.id);
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
```

---

## 4. Events

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.emit(event, payload)  // fire an event
eventBus.on(event, handler)    // returns an unsubscribe function
this.subscribe(event, handler) // inside Component/BaseView - auto-cleaned on destroy
```

### State Events
Emitted automatically by `state.set()` - never emit these manually.

| Event | Payload |
|---|---|
| `state:change` | `{ key, value, previousValue }` |
| `state:change:editorMode` | `{ value, previousValue }` |
| `state:change:projects` | `{ value, previousValue }` |
| `state:change:projects:name` | `{ project, preProject } - via notify()` |
| `state:change:projects:tabs` | `{ project, preProject } - via notify()` |
| `state:change:projects:tabs:name` | `{ project, preProject } - via notify()` |
| `state:change:projects:tabs:nodes:name` | `{ project, preProject } - via notify()` |
| `state:change:docThemes` | `{ value, previousValue }` |
| `state:change:templates` | `{ value, previousValue }` |
| `state:change:isDarkMode` | `{ value, previousValue }` |

### Session State Events
Emitted automatically by `session.set()` - never emit these manually.

| Event | Payload |
|---|---|
| `session:change` | `{ key, value, previousValue }` |
| `session:change:activeProjectId` | `{ value, previousValue }` |
| `session:change:activeTabId` | `{ value, previousValue }` |
| `session:change:activeNodeId` | `{ value, previousValue }` |
| `session:change:activeSection` | `{ value, previousValue }` |
| `session:change:activeView` | `{ value, previousValue }` |
| `session:change:collapsedNodes` | `{ value, previousValue }` |
| `session:change:projectSearchQuery` | `{ value, previousValue }` |
| `session:change:projectThemeSearchQuery` | `{ value, previousValue }` |
| `session:change:themeSearchQuery` | `{ value, previousValue }` |
| `session:change:themeManagerDisplay` | `{ value, previousValue }` |
| `session:change:isRightDocEditorSidebarCollpased` | `{ value, previousValue }` |

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
| `zoom:changed` | `{ factor }` |
| `toast:show` | `{ message, type = 'success', durationMS = DEFAULT_TIME }` | anywhere | `Toast` |

### Navigation Events
Handled by `ViewManager` - emit to switch views.
Routes are defined in the `VIEW_ROUTES` object in `ViewManager.js`.
To add a new view, register it there.

| Event | Navigates to |
|---|---|
| `navigate:docEditor` | `DocEditorView` |
| `navigate:projectManager` | `ProjectManagerView` |
| `navigate:themeEditor` | `ThemeEditorView` |
| `navigate:themeManager` | `ThemeManagerView` |
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
eventBus.emit('navigate:projectManager');
```

---

## 5. Data - ProjectManager

**Import:** `import { ... } from '@data/ProjectManager.js'`

### Creating Data

```js
generateProjectId()
// -> 'project_lf3k2abc9'  (timestamp-based short unique ID)

generateTabId()
// -> 'tab_lf3k2abc9'  (timestamp-based short unique ID)

generateNodeId()
// -> 'node_lf3k2abc9'  (timestamp-based short unique ID)

createProject(name)
// -> { id, name, builtIn: false, createdAt, lastOpenedAt, docThemeId: null, settings: {}, tabs: [defaultTab] }

createDefaultProject()
// -> pre-populated Project with sample CSS documentation content

createTab(project, tabname)
// Adds a new tab to project.tabs and returns it
// -> { id, name: tabname, nodes: [] }

createDefaultTab()
// -> { id, name: 'Dokumentation', nodes: [] }

createNode(name, content = '', children = [])
// -> { id, name, content, children }
```

### Reading Active Data

```js
getActiveProject()
// -> Project object or null

getActiveTab()
// -> Tab object { id, name, nodes: [] } or null
// uses session.activeProjectId + session.activeTabId

getActiveDocTheme()
// -> project.docTheme map e.g. { '--doc-accent': '#ff0000' }
// falls back to {} if no project is active
```

### Finding Tabs

```js
findTab(tabID, tabs = null)
// -> Tab object or null
// tabs defaults to active project's tabs
```

### Removing Tabs

```js
removeTabById(tabID, project)
// Splices tab from project.tabs
// If removed tab was active, sets activeTabId to first remaining tab or null
// -> true if found and removed, false otherwise
// Remember to call state.set('projects', [...]) after
```

### Finding Nodes

```js
findNode(nodeId, nodes = null)
// -> Node object or null
// nodes defaults to active tab's nodes

findNodeContext(nodeId, nodes, parentNode = null)
// -> { node, parentNode, siblings } or null
// siblings = parentNode.children or root nodes array

getNodePath(nodeId, nodes = null, currentPath = [])
// -> [ancestorNode, ..., targetNode] (root -> target) or null

flattenNodes(nodes)
// -> flat Array of all nodes (depth-first)
```

### Mutating Nodes

```js
removeNodeById(nodeId, nodes)
// Removes node (and all descendants) in-place
// Call state.set('projects', [...]) after
// -> true if found, false otherwise

nodeMatchesSearch(node, query)
// -> true if node.name (or any descendant name) contains query (lowercase)

deepClone(value)
// -> deep copy via JSON.parse/JSON.stringify
```

---

## 6. Core Modules

### EventBus

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.on(event, handler)     // -> returns unsubscribe function
eventBus.off(event, handler)    // remove specific handler
eventBus.emit(event, data)      // dispatch to all handlers, errors are caught
eventBus.clearEvent(event)      // remove all handlers for one event
```

### StorageManager

**Import:** `import { storageManager } from '@core/storage/StorageManager.js'`

```js
storageManager.init()
// Wires autosave (debounced 800ms) on state:change
// Wires save:request listener -> saveNow()
// Call once during bootstrap (via initStorage())

storageManager.subscribe(key, { save, load, reset })
// Registers a module for managed persistence
// key: colon-separated storage path e.g. 'settings', 'saves:autosave'
// save()       -> returns a JSON-serialisable snapshot
// load(data)   -> applies a deserialised snapshot to in-memory state
// reset()      -> restores in-memory defaults
// Also registers a save:request:<key> listener automatically

storageManager.unsubscribe(key)
// Unregisters a module and removes its save:request:<key> listener

storageManager.saveNow(key = null)
// Immediate save, cancels any pending autosave timer
// Pass key to save only that slot, or omit to flush all
// Emits save:complete (or save:complete:<key>)

storageManager.loadNow(key = null)
// Immediate load from storage
// Pass key to restore only that slot, or omit to restore all

storageManager.reset(key = null)
// Resets one or all modules to defaults and clears their storage slots
// Emits reset:complete (or reset:complete:<key>)

storageManager.saveOnce(key, data)
// One-shot save without registration - for temporary/dynamic data

storageManager.loadOnce(key)
// One-shot load without registration -> returns snapshot or null

storageManager.clearOnce(key)
// One-shot clear of an unregistered slot
```

### ResizeController

**Import:** `import { ResizeController } from '@core/ResizeController.js'`

```js
const resize = new ResizeController(containerEl, {
  direction:       'left',   // 'left' | 'right' | 'top' | 'bottom' (required)
  initialSize:     200,      // px - size on first render
  minSize:         100,      // px - minimum drag size
  maxSize:         500,      // px - maximum drag size
  stateName:       null,     // state key for persistence (e.g. 'sidebarSize')
  keepRatio:       true,     // scale with window resize
  resetOnDblClick: true,     // double-click handle resets to initialSize
  onResizeStart:   () => {},
  onResize:        () => {},
  onResizeEnd:     () => {},
});

resize.enable()         // re-enables dragging
resize.disable()        // disables dragging
resize.getSize()        // -> current size in px
resize.setSize(px)      // set size programmatically (saves to state if stateName set)
resize.destroy()        // removes DOM handle + window resize listener - call in onDestroy()
```

> If `stateName` is set, the size is persisted to `state` and restored on init.
> Call `resize.destroy()` in the component's `onDestroy()`.

### ComponentLoader

**Import:** `import { componentLoader } from '@core/ComponentLoader.js'`

```js
await componentLoader.load(componentPath, container, props = {})
// -> loads CSS once, fetches HTML, processes {{id:}} templates, imports JS, calls onLoad()
// -> returns the component instance

componentLoader.destroy(instanceId)
// calls onDestroy(), clears container HTML, removes from instance registry

componentLoader.getInstance(instanceId)
// -> component instance or null
```

**Component path formats:**

```js
// Short path - looks in renderer/common/components/<name>/
await componentLoader.load('Toast', container);

// Full path - looks in renderer/views/...
await componentLoader.load('views/editor/components/editorArea/EditorArea', container);
```

> Components are registered via `ComponentRegistry.js` using Vite `import.meta.glob`.
> Common components: `renderer/common/components/<Name>/<Name>.{js,html,css}`
> View components: `renderer/views/**/<Name>.<ext>` (helpers excluded)

---

## 7. View System

### ViewManager

**Import:** `import { viewManager } from '@core/ViewManager.js'`

```js
viewManager.init(container)
// Call once with the root #app element
// Registers all navigate:* event routes

await viewManager.switchTo(ViewClass, props = {})
// Mounts new view while old one is still visible, then crossfades (220ms)
// ViewClass must extend BaseView
```

Navigation is event-driven - do not call `switchTo()` directly outside bootstrap:

```js
eventBus.emit('navigate:docEditor');
eventBus.emit('navigate:projectManager');
eventBus.emit('navigate:themeEditor');
```

### BaseView

Views extend `BaseView` and live in `renderer/views/<name>/`.

```js
class MyView extends BaseView {
  _viewPath() {
    return 'views/myView/MyView'; // relative to renderer/ - no extension
  }

  async mount(componentLoader) {
    // Called after HTML/CSS are loaded. Wire components and listeners here.
    await componentLoader.load('views/editor/components/...', this.slot('my-slot'));
    this.subscribe('state:change:activeTabId', ({ value }) => this._refresh(value));
  }

  onDestroy() {
    // Extra cleanup if needed (rarely necessary - subscribe() is auto-cleaned)
  }
}
```

**BaseView API (available via `this`):**

```js
this.container   // the view's root HTMLElement
this.props       // props passed from the navigate:* event

this.slot(name)  // -> el.querySelector('[data-slot="name"]')
this.subscribe(event, handler)  // auto-cleaned on destroy
```

**HTML structure convention:** Use `data-slot="name"` to mark component mount points.
```html
<div data-slot="sidebar-left"></div>
<div data-slot="editor-area"></div>
```

---

## 8. Component API

**Import:** `import { Component } from '@core/Component.js'`

```js
// DOM - scoped to this instance's ID prefix
this.element('local-name')    // -> document.getElementById('topbar-1__local-name')
this.elementId('local-name')  // -> 'topbar-1__local-name'
this.query(selector)          // -> this.container.querySelector(selector)
this.queryAll(selector)       // -> this.container.querySelectorAll(selector)

// EventBus - auto-unsubscribed on destroy
this.subscribe(event, handler)

// Properties
this.instanceId   // e.g. 'topbar-1'
this.container    // the HTMLElement this component owns
this.props        // props from componentLoader.load()
```

### Template ID Syntax (in .html files)

```html
id="{{id:my-button}}"
<!-- rendered as: id="topbar-1__my-button" -->
<!-- accessed in JS: this.element('my-button') -->

data-id="{{instanceId}}"
<!-- rendered as: data-id="topbar-1" -->
```

### Lifecycle Hooks

```js
onLoad()              // after HTML is injected - wire event listeners here
onDestroy()           // before removal - clean up body-appended elements (modals, overlays)
onUpdate(newProps)    // when props change from outside (rarely used)
```

---

## 9. Modal Builder

**Import:** `import { ... } from '@core/ModalBuilder.js'`

```js
// Presets - use these 95% of the time
buildStandardModal(overlayId, { title, bodyHTML, primaryLabel, secondaryLabel, wide, onPrimary })
// title + Cancel + primary action button. Use for: rename, create, edit.

buildDoneModal(overlayId, { title, bodyHTML, doneLabel, wide, doneCallback })
// title + single Done button. Use for: settings, info panels.

buildConfirmModal(overlayId, { title, message, confirmLabel, cancelLabel, wide, onConfirm })
// title + message + Cancel + destructive confirm. Use for: delete confirmations.

// Low-level - full control over all HTML sections
buildModal(overlayId, { headerHTML, bodyHTML, footerHTML, onPrimary, extraClass })

// Open / close
openModal(overlay)
closeModal(overlay)
```

All modals are appended to `document.body`. Call `overlay.remove()` in `onDestroy()`.
Escape key auto-closes all open modals (wired in `main.js`).

### Auto-wiring (handled inside buildModal)

| Attribute | Behavior |
|---|---|
| `data-modal-close` | Calls `closeModal` on click |
| `data-modal-primary` | Calls `onPrimary` on click |
| Backdrop click | Calls `closeModal` |

---

## 10. DocTheme System

DocThemes are global presets stored in `state.docThemes` (see [Data Shapes](#14-data-shapes)).
A project references one via `project.docThemeId` - there is no per-project inline
override map anymore (`project.docTheme` no longer exists).

Every theme's actual values live in `theme.settings.entries`, a flat array of
`{ name, type, value, active, group? }` objects. The canonical list of allowed
entries (their type, default value, min/max, select options, ...) is the
**theme schema**, built once by `_buildThemeSchema()` and cached in `THEME_SCHEMA`.

**Import:** `import { ... } from '@data/DocThemeManager.js'`

### Creating & Cloning

```js
generateDocThemeId()
// -> 'docTheme_lf3k2abc9'

createDocTheme(name, entries = null)
// -> { id, name, builtIn: false, createdAt, lastOpenedAt,
//     settings: { entries: entries ?? createDefaultDocThemeEntries(), langStyleIds: {} } }

createBuiltInTheme(name, overrides = {})
// Like createDocTheme, but id = 'theme_' + name, builtIn: true, createdAt = 0
// overrides: { [entryName]: value } applied on top of the default entries

createDefaultDocThemeEntries()
// -> entries array built fresh from THEME_SCHEMA (name, value, active per entry)
```

### Reading & Writing Values

```js
getThemeValue(theme, key)
// -> the entry's value, or null if the entry is inactive or missing
// (this is the function views should use to resolve "what should render")

getStoredEntry(theme, key)
// -> the raw stored entry { name, value, active } from theme.settings.entries, or null

getSchemaEntry(name)
// -> the schema definition { name, type, value, active, min/max/options/group }, or null

getEntry(theme, key)
// -> merged { ...schema, ...stored } - schema metadata + the theme's current value

getThemeGroup(theme, group)
// -> all stored entries whose schema `group` matches (e.g. 'background', 'text', 'accent', 'code')

modifyThemeValue(theme, key, { value = null, active = null })
// Validates `value` against the entry's schema (clamped for 'number', checked
// against `options` for 'select', ...) and writes it to the stored entry.
// Pass `active` to toggle the entry on/off without changing its value.
// -> the (possibly clamped) value that was written, or null if the key is unknown
// Caller is responsible for state.set('docThemes', [...]) / eventBus save afterwards
// where not already handled by the calling helper.

resetThemeSettings(theme, resetParams = null)
// Resets entries back to schema defaults.
// resetParams: optional array of entry names to limit the reset to.
// Always triggers state.set('docThemes', [...]).

mergeDocThemeEntries(defaultEntries, oldEntries)
// Reconciles a schema-derived entries array with previously stored entries -
// used when the schema changes between app versions so old themes gain new
// entries (at defaults) and drop removed ones. See State.js load-migration path.

cleanDocTheme(docTheme)
// -> shallow copy with id / builtIn / createdAt / lastOpenedAt / isPreset stripped
// Use before exporting a theme.

updateDocTheme(id, changes)
// Object.assign(theme, changes) + state.set('docThemes', [...])
// -> true if the theme was found, false otherwise
```

### Language Styles

Each theme can pin a specific syntax-highlighting style per language.

```js
getLanguageStyle(theme, languageDefinition)
getLanguageStyleId(theme, languageDefinition)
// -> the style object / id the theme uses for that language
// Falls back to languageDefinition.styles[0] if nothing is stored

getLanguageStyleByLangName(theme, langName)
getLanguageStyleIdByLangName(theme, langName)
// Same as above, but looks the SyntaxDefinition up by name first

setLanguageStyleId(theme, langId, styleId)
// Writes theme.settings.langStyleIds[langId] = styleId
// Triggers state.set('docThemes', [...])
```

### Accessors

```js
getDocThemes()              // -> state.get('docThemes') ?? []
getPresetDocThemes()        // -> session.get('docThemePresets') ?? [] (built-in themes)
findDocTheme(id, list?)     // -> theme or null
findDocThemeByName(name, list?)  // -> theme or null (case-insensitive)
addDocTheme(theme)          // pushes + state.set('docThemes', [...])
removeDocThemeById(id)      // also clears docThemeId on any project using it, revokes theme cache
docThemeMatchesSearch(theme, query)  // name match, plus 'builtin' / 'built in' as a special query
openDocThemeEditor(theme)   // bumps lastOpenedAt, saves, emits navigate:themeEditor {themeId}
```

### Theme Schema Groups & Entries (current)

Entry names are used as-is (no `--doc-` prefix in the schema/storage layer - that
prefixing, if any, happens at the CSS-variable application layer, e.g. in
`HtmlBuilder.js` / `DocThemePreview.js`). Types: `color`, `number`, `select`, `toggle`.

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
| *(sidebar width, ungrouped)* | `sidebar-width-type` (`pixels`\|`fit-content`\|`percent`), `sidebar-width-px`, `sidebar-width-per`, `sidebar-min-width` |
| *(toc width, ungrouped)* | `toc-width-type` (`pixels`\|`fit-content`\|`percent`), `toc-width-px`, `toc-width-per`, `toc-min-width` |
| *(search, ungrouped)* | `search-enabled` (toggle), `search-position` (`header`\|`tab-nav`), `search-show-in-tab` (toggle) |

> To add a new theme setting: add one `e(...)` entry in `_buildThemeSchema()`
> (`renderer/data/DocThemeManager.js`), then wire a control for it in the
> relevant `themeEditor/components/sidebarLeft/components/*` panel (e.g.
> `contentLayout`, `contentSpacing`, `contentAppearance`) using `ThemeContentHelper.js`.
> Existing themes are migrated automatically via `mergeDocThemeEntries()` on load.

---

## 11. Editor Helpers

### MarkdownParser

**Import:** `import { parseMarkdown } from '@common/MarkdownParser.js'`

```js
parseMarkdown(source)
// -> HTML string
// Supports: # headings (h1–h4), **bold**, *italic*, ***bold-italic***,
//           `inline code`, ```lang\n...\n``` blocks,
//           - unordered lists, 1. ordered lists,
//           > blockquote, [text](url), | tables |, ---
```

### ToolbarHelper

**Import:** `import { ... } from 'renderer/views/docEditor/components/editorArea/helpers/ToolbarHelper.js'`

All functions modify textarea value and call `onChange(newValue)`.

```js
insertLinePrefix(textarea, prefix, onChange)
// Inserts prefix at current line start. e.g. '# ' -> heading

wrapSelection(textarea, before, after, onChange)
// Wraps selection (or 'text' placeholder) with before/after
// e.g. ('**', '**') -> bold

insertCodeBlock(textarea, onChange)
// Inserts ```javascript\n// code here\n``` at cursor

insertTable(textarea, onChange)
// Inserts a 3-column Markdown table at cursor

insertLink(textarea, text, url, onChange)
// Inserts [text](url) at cursor

getSelectedText(textarea)
// -> currently selected text string

syncScrollPosition(editorElement, previewElement)
// Syncs preview scroll to match editor scroll ratio
```

---

## 12. Tree, Tabs & DragDrop

### TreeHelper

**Import:** `import { renderTree, setupDragAndDrop } from 'renderer/views/docEditor/components/sidebarLeft/helpers/TreeHelper.js'`

```js
renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })
// -> HTML string for the full tree
// Uses data-action / data-node-id attributes for event delegation

// data-action values: 'select', 'toggle', 'add-child', 'rename', 'delete'
```

```js
const cleanup = setupDragAndDrop(container, onReorder)
// Enables drag-and-drop within the same sibling level
// onReorder(fromIndex, toIndex, fromId, toId)
// -> call cleanup() before re-rendering the tree
```

### TabManager

**Import:** `import { TabManager } from 'renderer/views/docEditor/components/sidebarLeft/helpers/TabManagerHelper.js'`

Class-based helper for rendering and managing the tab bar.

```js
const tabManager = new TabManager(containerEl, {
  onRenameTab: (tabId) => { /* open rename modal */ },
  onDeleteTab:  (tabId) => { /* open confirm modal */ },
});

tabManager.render()   // re-renders the tab list (call after any tab state change)
tabManager.destroy()  // removes event listeners, destroys DnD
```

Internally: clicking a tab calls `session.set('activeTabId', id)` and `session.set('activeNodeId', null)`. Drag-and-drop reorders `project.tabs` and calls `state.set('projects', [...])`.

### DragDropHelper

**Import:** `import { DragDropHelper } from '@common/DragDropHelper.js'`

Generic drag-and-drop reorder utility used by both TreeHelper and TabManager.

```js
const dnd = new DragDropHelper(containerEl, {
  itemSelector:     '.my-item[data-item-id]', // draggable items
  handleSelector:   '.my-item__handle',       // drag handle (or same as item)
  idAttribute:      'itemId',                 // dataset key -> dataset.itemId
  placeHolderClass: 'my-placeholder',         // optional
  onReorder: (fromIndex, toIndex, fromId, toId) => {
    // Mutate your data array here, then re-render
  },
});

dnd.destroy(); // removes all event listeners
```

---

## 13. Export

**Import:** `import { exportCurrentTabAsHTML } from '@common/ExportHelper.js'`

```js
exportCurrentTabAsHTML()
// Generates a self-contained HTML file from the current tab's node tree
// Triggers browser download
// -> { success: boolean, message: string }
```

The export uses `parseMarkdown` to render content and `buildExportNavigation` / `buildExportContent` internally to produce a navigable, styled HTML document.

---

## 14. Data Shapes

### Project

```js
{
  id:           'lf3k2abc9',
  name:         'My Project',
  builtIn:      false,             // runtime flag - stripped on export
  createdAt:    1710000000000,     // Date.now() timestamp
  lastOpenedAt: 1710000000000,     // Date.now() timestamp
  docThemeId:   null,              // ref to a saved global DocTheme (state.docThemes)
  settings:     {},                // reserved for future project settings
  tabs: [
    { id: 'lf3k2tab1', name: 'Dokumentation', nodes: [] },
    // ... dynamic, user-created tabs
  ]
}
```

### Tab

```js
{
  id:    'lf3k2tab1',
  name:  'Dokumentation',
  nodes: [ /* Node, ... */ ]
}
```

### Node

```js
{
  id:       'lf3k2def4',
  name:     'display',
  content:  '# display\n\nThe display property...',  // raw Markdown
  children: [ /* Node, ... */ ]
}
```

### DocTheme (global preset, in state.docThemes)

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
      // [languageDefinitionId]: styleId
    }
  }
}
```

> `entries` only stores `{ name, value, active }` - type, min/max, and select
> `options` live in the schema and are merged in on read via `getEntry()`.
> A `Project` references a theme via `project.docThemeId`; there is no
> per-project inline theme map.

### Template (in state.templates)

```js
{
  id:      'lf3k2tpl1',
  name:    'API Reference',
  project: { /* deep clone of a Project snapshot */ }
}
```

---

## 15. Electron / IPC

### Preload - `window.electronAPI`

Exposed to the renderer via `contextBridge` (`preload/preload.js`). Available
anywhere in renderer code when running inside Electron.

```js
window.electronAPI.getPlatform()   // -> 'win' | 'macOS' | 'linux' | 'unknown'
window.electronAPI.getVersions()   // -> { node, chrome, electron }
window.electronAPI.ping()          // -> 'pong' (async)

// Window controls
window.electronAPI.minimize()
window.electronAPI.maximize()          // toggles maximize/restore
window.electronAPI.close()
window.electronAPI.toggleDevTools()

window.electronAPI.onZoomChanged(cb)   // cb(factor) - see SetupZoom.js

// Close/save handshake - used so the main process waits for a final
// autosave before the window actually closes
window.electronAPI.onBeforeClose(cb)       // cb() when main asked to close
window.electronAPI.confirmSaveComplete()   // renderer -> main: save finished, ok to close

// Auto-updater (electron-updater), see main/SetupAutoUpdater.js
window.electronAPI.updater.checkForUpdates()   // invoke -> triggers autoUpdater.checkForUpdates()
window.electronAPI.updater.installNow()        // invoke -> quits and installs the downloaded update
window.electronAPI.updater.onChecking(cb)      // cb()
window.electronAPI.updater.onAvailable(cb)     // cb(info)
window.electronAPI.updater.onNotAvailable(cb)  // cb(info)
window.electronAPI.updater.onProgress(cb)      // cb(progress)
window.electronAPI.updater.onDownloaded(cb)    // cb(info)
window.electronAPI.updater.onError(cb)         // cb({ message })

// Paths
window.electronAPI.getUserDataPath()   // -> invoke, e.g. %APPDATA%/DocForge on Windows
window.electronAPI.getExePath()        // -> invoke, absolute path to the running executable
window.electronAPI.joinPath(...segments)  // -> invoke, platform-correct path join

// File system (absolute paths only)
window.electronAPI.writeFile(absolutePath, data)   // -> { ok, error }
window.electronAPI.readFile(absolutePath)          // -> { ok, data, error }
window.electronAPI.deleteFile(absolutePath)        // -> { ok, error }

// Native dialogs
window.electronAPI.openDialog(options)
// options: { type: 'file'|'folder'|'both', title, message, buttonLabel,
//            multiselect, defaultPath, filters, showHiddenFiles, ... }
// -> { canceled, filePaths }

window.electronAPI.openFolder(folderPath)     // opens a folder in the OS file explorer
window.electronAPI.showInFolder(targetPath)   // reveals a file, selected, in the OS file explorer

// Generic IPC (use sparingly - prefer the typed handles above)
window.electronAPI.send(channel, data)
window.electronAPI.receive(channel, callback)
```

```js
// In renderer - detect environment
import { getPlatform } from './main.js';
const platform = getPlatform(); // 'web' if not in Electron
```

### IPC Handlers (main process)

Registered in `main/ipc/Handlers.js` via `ipcMain.handle` (`ipcMain.on` for the
one fire-and-forget channel).

| Channel | Action |
|---|---|
| `ping` | Returns `'pong'` |
| `app:save-complete` | *(`ipcMain.on`, no reply)* Renderer confirms the pre-close autosave finished; unblocks the pending window close in `WindowState.js` |
| `updater:checkForUpdates` | Triggers `autoUpdater.checkForUpdates()` |
| `updater:installNow` | Quits and installs the downloaded update |
| `window:minimize` | Minimizes the focused window |
| `window:maximize` | Toggles maximize/restore on the focused window |
| `window:close` | Closes the focused window |
| `window:toggleDevTools` | Toggles DevTools on the focused window |
| `path:userData` | Returns `app.getPath('userData')` |
| `path:exe` | Returns `app.getPath('exe')` |
| `path:join` | Joins path segments with `path.join(...)` |
| `fs:write` | Writes a string to an absolute path -> `{ ok, error }` |
| `fs:read` | Reads a file from an absolute path -> `{ ok, data, error }` |
| `fs:delete` | Deletes a file at an absolute path -> `{ ok, error }` |
| `dialog:open` | Native open dialog (file/folder/both) -> `{ canceled, filePaths }` |
| `folder:open` | Opens a folder in the OS file explorer |
| `folder:show` | Reveals a path, selected, in the OS file explorer |

Update-related events pushed from main -> renderer (via `SetupAutoUpdater.js`,
consumed through `window.electronAPI.updater.on*`): `updater:checking`,
`updater:available`, `updater:notAvailable`, `updater:progress`,
`updater:downloaded`, `updater:error`.

To add a new handler:
```js
// In main/ipc/Handlers.js
ipcMain.handle('my:action', async (event, payload) => {
  return result;
});

// In preload/preload.js - expose to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // ...existing,
  myAction: (payload) => ipcRenderer.invoke('my:action', payload),
});
```
---

## 16. UI Utilities

**Import:** `import { ... } from '@common/UIUtils.js'`

Shared low-level helpers for dropdowns/menus, tab selection, and checkboxes,
used across the top bar, sidebars, and settings panels.

### Dropdowns & Menus

```js
createDropDownItem(name, { description, shortcut, shortcutContext = 'global' })
// -> HTMLElement for one dropdown row (label + optional shortcut hint)

createDropDownGroup(name)
// -> HTMLElement for a submenu group (label + arrow + nested .dropdown-submenu)
// Wires hover-open/close with built-in delays (open: 300ms, close: 500ms)

openMenuItem(menuItem) / closeMenuItem(menuItem)
// Adds/removes the 'open' class on a top-level menu item

openGroup(groupEl) / closeGroup(groupEl)
// Adds/removes the 'open' class on a dropdown submenu group

closeAllDropDowns(selector = '.menu-item.open')
// Closes every open menu item matching selector, and every open dropdown group

addDropdownEventListener(dropdownItem, callback) // -> unsubscribe function
removeDropdownEventListener(dropdownItem, callback) // -> boolean, was it removed
dropdownItemClick(dropdownItem, event)
// Internal registry so a dropdown item can carry multiple click callbacks
// without stacking raw DOM listeners; used by the submenu system.
```

### Tabs

```js
deselectAllTabs({ element = null, isParent = false, condition = () => true })
// Removes 'active' from all '.tab-element' under element (or document)
// where condition(tabEl) is true

selectTab({ element = null, tabAction, isParent = false })
// Selects a tab element, running the given tabAction callback
```

### Checkboxes

```js
addCheckboxEventListener(checkbox, callback)
removeCheckboxEventListener(checkbox, callback)
isCheckedBoxActive(checkbox)   // -> boolean
toggleCheckBox(checkbox)
setCheckBox(checkbox, value = true)
setCheckboxDisabled(checkbox, disabled)
```

### Indenting Helpers

```js
addTabIndenting(htmlInput)        // Tab key inserts indentation instead of moving focus
addLineBreakIndenting(htmlInput)  // Enter continues the previous line's indentation
```

---

## 17. Validation

**Import:** `import { getValidation, getValidationError } from '@common/Validations.js'`

Central place for input validation rules (e.g. minimum name lengths) used by
Create/Rename dialogs across Projects, DocThemes, and Languages. Adjust rules
here to change validation app-wide instead of hardcoding limits per form.

```js
getValidation(type, rule)
// type: 'PROJECT' | 'THEME' | 'LANGUAGE'
// rule: e.g. 'NAME_MIN_LENGTH'
// -> the configured value (e.g. 3), or undefined + console.error if unknown

getValidationError(type, rule)
// -> a formatted message for the rule, e.g. "Value must be at least 3 characters long"
```

Current rules:

| Type | Rule | Value |
|---|---|---|
| `PROJECT` | `NAME_MIN_LENGTH` | `3` |
| `THEME` | `NAME_MIN_LENGTH` | `3` |
| `LANGUAGE` | `NAME_MIN_LENGTH` | `2` |

To add a new rule, add it to `VALIDATION_RULES` (and, if it needs a custom
message, a generator in `VALIDATION_ERRORS`) in `renderer/common/Validations.js`.

---

## 18. Publishing a Release

Releases are built and published automatically by GitHub Actions
(`.github/workflows/release.yml`) whenever a tag matching `v*` is pushed.
Packaging is done with **electron-builder** (config lives in the `build` key
of `package.json`), not electron-forge - `forge.config.cjs` is present in the
repo but is not invoked by any npm script or by the workflow, so treat it as
legacy/unused unless that changes.

### Release checklist

1. **Bump the version** in `package.json` (`"version"`) to match the release,
   e.g. `1.4.0`.
2. **Finalize `CHANGELOG.md`** - replace the `xx-xx` placeholder date on the
   top entry with the actual release date (`YYYY-MM-DD`).
3. **Commit** these changes to the default branch.
4. **Tag the commit** with a `v`-prefixed version and push the tag:
   ```bash
   git tag v1.4.0
   git push origin v1.4.0
   ```
5. Pushing the tag triggers the `Release` workflow, which for each of
   `windows-latest`, `macos-latest`, and `ubuntu-latest`:
   - checks out the code and installs Node 22,
   - runs `npm ci`,
   - runs `npm run build` (Vite renderer build -> `renderer/dist`),
   - (Linux only) installs `libarchive-tools`,
   - runs the platform-specific packaging script - `npm run dist:win`,
     `npm run dist:mac`, or `npm run dist:linux` (all wrap `electron-builder`).
6. electron-builder publishes the built artifacts to a **GitHub Release as a
   draft** (`"publish": [{ "provider": "github", "releaseType": "draft" }]`
   in `package.json`), using the workflow's built-in `GITHUB_TOKEN`.
7. Once all three OS jobs finish, open the repo's **Releases** page, review
   the draft (edit release notes from `CHANGELOG.md` if desired, verify all
   artifacts are attached - `.exe`/NSIS installer, `.dmg`/`.zip` for both Mac
   architectures, `.AppImage`), and **publish** it manually.
8. Existing installations pick up the new version via `electron-updater`
   (`main/SetupAutoUpdater.js` -> `autoUpdater.checkForUpdates()`, wired to
   the `updater:*` IPC events documented in §15).

### Building/publishing manually (without CI)

```bash
npm run build           # build the renderer (renderer/dist)
npm run dist:win         # or dist:mac / dist:linux / dist (current platform)
```

Running `electron-builder` directly against a GitHub `publish` target
requires a `GH_TOKEN` (or `GITHUB_TOKEN`) environment variable with `repo`
scope, e.g. `GH_TOKEN=xxxx npm run dist:win`. This is normally unnecessary -
prefer tagging and letting the workflow do it, since it already builds all
three platforms consistently.

### Local build without publishing

Run the `dist*` scripts without a `GH_TOKEN`/`GITHUB_TOKEN` set -
electron-builder still produces the platform artifacts locally but skips the
publish step.