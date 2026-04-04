# DocForge — Developer Reference

Quick lookup for state keys, events, data shapes, and all exported APIs.
Written for day-to-day use during development — structural overview, not a tutorial.

---

## Table of Contents

1. [Path Aliases](#1-path-aliases)
2. [State](#2-state)
3. [Session State](#3-session-state)
4. [Events](#4-events)
5. [Data — ProjectManager](#5-data--projectmanager)
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
state.load()          // restore from localStorage — call once on startup
state.save()          // write to localStorage immediately
state.snapshot()      // shallow copy of the entire state object
state.reset()         // resets the state to its default value
```

### State Keys

| Key | Type | Default | Notes |
|---|---|---|---|
| `storageVersion` | `number` | `1` | Save format version |
| `projects` | `Array` | `[]` | Array of Project objects |
| `docThemes` | `Array` | `[]` | Saved global DocTheme presets `{ id, name, variables }` |
| `templates` | `Array` | `[]` | Saved project templates `{ id, name, project: <snapshot> }` |
| `isDarkMode` | `boolean` | `true` | App-level dark/light mode |
| `editorMode` | `string` | `'split'` | `'split'` \| `'editor'` \| `'preview'` |

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
| `activeProjectId` | `string\|null` | `null` | ID of selected project |
| `activeTabId` | `string\|null` | `null` | ID of selected tab within project |
| `activeNodeId` | `string\|null` | `null` | ID of selected node within tab |
| `collapsedNodes` | `Object` | `{}` | `{ [nodeId]: true }` — collapsed nodes in tree |
| `searchQuery` | `string` | `''` | Sidebar search string |
| `activeView` | `string\|null` | `null` | name of the active view (gets the via ViewManager) |
| `projectSortAction` | `string` | `'none'` | name of the sorting action in the projectManager |
| `isRightEditorSidebarCollpased` | `bool` | `false` | Editor right sidebar collapsed |

### Common Patterns

```js
// Switch project — always reset tab + node
session.set('activeProjectId', project.id);
session.set('activeTabId', null);
session.set('activeNodeId', null);

// Switch tab — always reset node
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
this.subscribe(event, handler) // inside Component/BaseView — auto-cleaned on destroy
```

### State Events
Emitted automatically by `state.set()` — never emit these manually.

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
Emitted automatically by `session.set()` — never emit these manually.

| Event | Payload |
|---|---|
| `session:change` | `{ key, value, previousValue }` |
| `session:change:activeProjectId` | `{ value, previousValue }` |
| `session:change:activeTabId` | `{ value, previousValue }` |
| `session:change:activeNodeId` | `{ value, previousValue }` |
| `session:change:collapsedNodes` | `{ value, previousValue }` |
| `session:change:searchQuery` | `{ value, previousValue }` |
| `session:change:isEditorSidbarCollpased` | `{ value, previousValue }` |

### Application Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `save:request` | — | `TopBar`, `main.js` (Ctrl+S) | `Storage` |
| `save:complete` | — | `Storage` | `TopBar` |
| `editor:content-changed` | `{ markdown }` | `EditorArea` | `SidebarRight` |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` | `SidebarRight` |
| `zoom:changed` | `{ factor }` |
| `toast:show` | `{ message, type = 'success', durationMS = DEFAULT_TIME }` | anywhere | `Toast` |

### Navigation Events
Handled by `ViewManager` — emit to switch views.
Routes are defined in the `VIEW_ROUTES` object in `ViewManager.js`.
To add a new view, register it there.

| Event | Navigates to |
|---|---|
| `navigate:editor` | `EditorView` |
| `navigate:projectManager` | `ProjectManagerView` |
| `navigate:themeEditor` | `ThemeEditorView` |

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

## 5. Data — ProjectManager

**Import:** `import { ... } from '@data/ProjectManager.js'`

### Creating Data

```js
generateId()
// → 'lf3k2abc9'  (timestamp-based short unique ID)

createProject(name)
// → { id, name, createdAt, docTheme: {}, themeId: null, settings: {}, tabs: [defaultTab, otherTab] }

createDefaultProject()
// → pre-populated Project with sample CSS documentation content

createTab(project, tabname)
// Adds a new tab to project.tabs and returns it
// → { id, name: tabname, nodes: [] }

createDefaultTab()
// → { id, name: 'Dokumentation', nodes: [] }

createNode(name, content = '', children = [])
// → { id, name, content, children }
```

### Reading Active Data

```js
getActiveProject()
// → Project object or null

getActiveTab()
// → Tab object { id, name, nodes: [] } or null
// uses state.activeProjectId + state.activeTabId

getActiveDocTheme()
// → project.docTheme map e.g. { '--doc-accent': '#ff0000' }
// falls back to {} if no project is active
```

### Finding Tabs

```js
findTab(tabID, tabs = null)
// → Tab object or null
// tabs defaults to active project's tabs
```

### Removing Tabs

```js
removeTabById(tabID, project)
// Splices tab from project.tabs
// If removed tab was active, sets activeTabId to first remaining tab or null
// → true if found and removed, false otherwise
// Remember to call state.set('projects', [...]) after
```

### Finding Nodes

```js
findNode(nodeId, nodes = null)
// → Node object or null
// nodes defaults to active tab's nodes

findNodeContext(nodeId, nodes, parentNode = null)
// → { node, parentNode, siblings } or null
// siblings = parentNode.children or root nodes array

getNodePath(nodeId, nodes = null, currentPath = [])
// → [ancestorNode, ..., targetNode] (root → target) or null

flattenNodes(nodes)
// → flat Array of all nodes (depth-first)
```

### Mutating Nodes

```js
removeNodeById(nodeId, nodes)
// Removes node (and all descendants) in-place
// Call state.set('projects', [...]) after
// → true if found, false otherwise

nodeMatchesSearch(node, query)
// → true if node.name (or any descendant name) contains query (lowercase)

deepClone(value)
// → deep copy via JSON.parse/JSON.stringify
```

---

## 6. Core Modules

### EventBus

**Import:** `import { eventBus } from '@core/EventBus.js'`

```js
eventBus.on(event, handler)     // → returns unsubscribe function
eventBus.off(event, handler)    // remove specific handler
eventBus.emit(event, data)      // dispatch to all handlers, errors are caught
eventBus.clearEvent(event)      // remove all handlers for one event
```

### StorageManager

**Import:** `import { storageManager } from '@core/storage/Storage.js'`

```js
storageManager.init()
// Wires autosave (debounced 800ms) on state:change
// Wires save:request listener → saveNow()
// Call once during bootstrap

storageManager.saveNow()
// Immediate save, cancels any pending autosave timer
// Emits save:complete after saving
```

### ComponentLoader

**Import:** `import { componentLoader } from '@core/ComponentLoader.js'`

```js
await componentLoader.load(componentPath, container, props = {})
// → loads CSS once, fetches HTML, processes {{id:}} templates, imports JS, calls onLoad()
// → returns the component instance

componentLoader.destroy(instanceId)
// calls onDestroy(), clears container HTML, removes from instance registry

componentLoader.getInstance(instanceId)
// → component instance or null
```

**Component path formats:**

```js
// Short path — looks in renderer/common/components/<name>/
await componentLoader.load('Toast', container);

// Full path — looks in renderer/views/...
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

Navigation is event-driven — do not call `switchTo()` directly outside bootstrap:

```js
eventBus.emit('navigate:editor');
eventBus.emit('navigate:projectManager');
eventBus.emit('navigate:themeEditor');
```

### BaseView

Views extend `BaseView` and live in `renderer/views/<name>/`.

```js
class MyView extends BaseView {
  _viewPath() {
    return 'views/myView/MyView'; // relative to renderer/ — no extension
  }

  async mount(componentLoader) {
    // Called after HTML/CSS are loaded. Wire components and listeners here.
    await componentLoader.load('views/editor/components/...', this.slot('my-slot'));
    this.subscribe('state:change:activeTabId', ({ value }) => this._refresh(value));
  }

  onDestroy() {
    // Extra cleanup if needed (rarely necessary — subscribe() is auto-cleaned)
  }
}
```

**BaseView API (available via `this`):**

```js
this.el          // the view's root HTMLElement
this.props       // props passed from the navigate:* event

this.slot(name)  // → el.querySelector('[data-slot="name"]')
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
// DOM — scoped to this instance's ID prefix
this.element('local-name')    // → document.getElementById('topbar-1__local-name')
this.elementId('local-name')  // → 'topbar-1__local-name'
this.query(selector)          // → this.container.querySelector(selector)
this.queryAll(selector)       // → this.container.querySelectorAll(selector)

// EventBus — auto-unsubscribed on destroy
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
onLoad()              // after HTML is injected — wire event listeners here
onDestroy()           // before removal — clean up body-appended elements (modals, overlays)
onUpdate(newProps)    // when props change from outside (rarely used)
```

---

## 9. Modal Builder

**Import:** `import { ... } from '@core/ModalBuilder.js'`

```js
// Presets — use these 95% of the time
buildStandardModal(overlayId, { title, bodyHTML, primaryLabel, secondaryLabel, wide, onPrimary })
// title + Cancel + primary action button. Use for: rename, create, edit.

buildDoneModal(overlayId, { title, bodyHTML, doneLabel, wide, doneCallback })
// title + single Done button. Use for: settings, info panels.

buildConfirmModal(overlayId, { title, message, confirmLabel, cancelLabel, wide, onConfirm })
// title + message + Cancel + destructive confirm. Use for: delete confirmations.

// Low-level — full control over all HTML sections
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

Each project stores its own theme overrides in `project.docTheme`.
Themes are applied as inline CSS variables on `.preview-pane` elements.

**Import:** `import { ... } from '@common/DocThemeHelper.js'`

```js
applyDocCSSVariable(variableName, value)
// Sets CSS var on all .preview-pane elements + persists to project.docTheme
// Triggers state.set('projects', [...]) automatically

applyStoredDocTheme()
// Reads active project.docTheme and re-applies all stored overrides
// Call after switching active project (handled in main.js)

applyDocFontSize(sizeInPixels)
// Sets font-size on all [data-preview-panel] elements
// Saves as 'font-size' key in project.docTheme

resetDocTheme()
// Clears project.docTheme, removes inline styles from .preview-pane
```

### CSS Variable Convention

All doc theme variables are prefixed with `--doc-`:

```js
applyDocCSSVariable('--doc-accent', '#ff0000');
applyDocCSSVariable('--doc-font-size', '16px');
```

```js
// project.docTheme shape
{
  '--doc-accent':    '#22d4a8',
  '--doc-font-size': '16px',
  'font-size':       16        // legacy key from applyDocFontSize (number)
}
// Only overridden keys are stored — missing keys fall back to CSS defaults
```

---

## 11. Editor Helpers

### MarkdownParser

**Import:** `import { parseMarkdown } from '@common/MarkdownParser.js'`

```js
parseMarkdown(source)
// → HTML string
// Supports: # headings (h1–h4), **bold**, *italic*, ***bold-italic***,
//           `inline code`, ```lang\n...\n``` blocks,
//           - unordered lists, 1. ordered lists,
//           > blockquote, [text](url), | tables |, ---
```

### ToolbarHelper

**Import:** `import { ... } from 'renderer/views/editor/components/editorArea/helpers/ToolbarHelper.js'`

All functions modify textarea value and call `onChange(newValue)`.

```js
insertLinePrefix(textarea, prefix, onChange)
// Inserts prefix at current line start. e.g. '# ' → heading

wrapSelection(textarea, before, after, onChange)
// Wraps selection (or 'text' placeholder) with before/after
// e.g. ('**', '**') → bold

insertCodeBlock(textarea, onChange)
// Inserts ```javascript\n// code here\n``` at cursor

insertTable(textarea, onChange)
// Inserts a 3-column Markdown table at cursor

insertLink(textarea, text, url, onChange)
// Inserts [text](url) at cursor

getSelectedText(textarea)
// → currently selected text string

syncScrollPosition(editorElement, previewElement)
// Syncs preview scroll to match editor scroll ratio
```

---

## 12. Tree, Tabs & DragDrop

### TreeHelper

**Import:** `import { renderTree, setupDragAndDrop } from 'renderer/views/editor/components/sidebarLeft/helpers/TreeHelper.js'`

```js
renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })
// → HTML string for the full tree
// Uses data-action / data-node-id attributes for event delegation

// data-action values: 'select', 'toggle', 'add-child', 'rename', 'delete'
```

```js
const cleanup = setupDragAndDrop(container, onReorder)
// Enables drag-and-drop within the same sibling level
// onReorder(fromIndex, toIndex, fromId, toId)
// → call cleanup() before re-rendering the tree
```

### TabManager

**Import:** `import { TabManager } from 'renderer/views/editor/components/sidebarLeft/helpers/TabManagerHelper.js'`

Class-based helper for rendering and managing the tab bar.

```js
const tabManager = new TabManager(containerEl, {
  onRenameTab: (tabId) => { /* open rename modal */ },
  onDeleteTab:  (tabId) => { /* open confirm modal */ },
});

tabManager.render()   // re-renders the tab list (call after any tab state change)
tabManager.destroy()  // removes event listeners, destroys DnD
```

Internally: clicking a tab calls `state.set('activeTabId', id)`. Drag-and-drop reorders `project.tabs` and calls `state.set('projects', [...])`.

### DragDropHelper

**Import:** `import { DragDropHelper } from '@common/DragDropHelper.js'`

Generic drag-and-drop reorder utility used by both TreeHelper and TabManager.

```js
const dnd = new DragDropHelper(containerEl, {
  itemSelector:     '.my-item[data-item-id]', // draggable items
  handleSelector:   '.my-item__handle',       // drag handle (or same as item)
  idAttribute:      'itemId',                 // dataset key → dataset.itemId
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
// → { success: boolean, message: string }
```

The export uses `parseMarkdown` to render content and `buildExportNavigation` / `buildExportContent` internally to produce a navigable, styled HTML document.

---

## 14. Data Shapes

### Project

```js
{
  id:        'lf3k2abc9',
  name:      'My Project',
  createdAt: 1710000000000,    // Date.now() timestamp
  lastOpenedAt: 1710000000000, // Date.now() timestamp
  docThemeId:   null,          // ref to a saved global DocTheme (state.docThemes)
  settings:  {},               // reserved for future project settings
  tabs: [
    { id: 'lf3k2tab1', name: 'Dokumentation', nodes: [] },
    { id: 'lf3k2tab2', name: 'Other',          nodes: [] },
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
  id:        'lf3k2thm1',
  name:      'Dark Teal',
  variables: {
    '--doc-accent': '#22d4a8',
    '--doc-font-size': '16px'
  }
}
```

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

### Preload — `window.electronAPI`

Exposed to the renderer via `contextBridge`. Available anywhere in renderer code.

```js
window.electronAPI.getPlatform()   // → 'win' | 'macOS' | 'linux' | 'unknown'
window.electronAPI.getVersions()   // → { node, chrome, electron }
window.electronAPI.ping()          // → 'pong' (async)

// Window controls
window.electronAPI.minimize()
window.electronAPI.maximize()      // toggles maximize/restore
window.electronAPI.close()

// Generic IPC (use sparingly — prefer typed handles)
window.electronAPI.send(channel, data)
window.electronAPI.receive(channel, callback)
```

```js
// In renderer — detect environment
import { getPlatform } from './main.js';
const platform = getPlatform(); // 'web' if not in Electron
```

### IPC Handlers (main process)

Registered in `main/ipc/handlers.js` via `ipcMain.handle`.

| Channel | Action |
|---|---|
| `ping` | Returns `'pong'` |
| `window:minimize` | Minimizes focused window |
| `window:maximize` | Toggles maximize on focused window |
| `window:close` | Closes focused window |

To add a new handler:
```js
// In main/ipc/handlers.js
ipcMain.handle('my:action', async (event, payload) => {
  return result;
});

// In preload/preload.js — expose to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  // ...existing,
  myAction: (payload) => ipcRenderer.invoke('my:action', payload),
});
```
