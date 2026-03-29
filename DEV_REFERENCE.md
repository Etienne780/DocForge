# DocEditor - Developer Reference

Quick lookup for everything you need during development:
state keys, events, all exported functions, CSS variables, and data shapes.

---

## Table of Contents

1. [State](#1-state)
2. [Events](#2-events)
3. [Data - ProjectManager](#3-data--projectmanager)
4. [Core Modules](#4-core-modules)
5. [Component API](#5-component-api)
6. [Modal Builder](#6-modal-builder)
7. [Theme & CSS Variables](#7-theme--css-variables)
8. [Editor Helpers](#8-editor-helpers)
9. [Tree Helpers](#9-tree-helpers)
10. [Data Shapes](#10-data-shapes)

---

## 1. State

**Import:** `import { state } from './core/State.js'`

```js
state.get(key)        // read a value
state.set(key, value) // write a value - automatically fires events
state.load()          // restore from localStorage (call once on startup)
state.save()          // write to localStorage immediately
state.snapshot()      // returns a shallow copy of the entire state object
```

### State Keys

| Key | Type | Default | Valid Values |
|---|---|---|---|
| `projects` | `Array` | `[]` | Array of Project objects |
| `activeProjectId` | `string\|null` | `null` | Any project id, or `null` |
| `activeTab` | `string` | `'explanation'` | `'explanation'` `'examples'` `'reference'` |
| `activeNodeId` | `string\|null` | `null` | Any node id, or `null` |
| `isDarkMode` | `boolean` | `true` | `true` `false` |
| `collapsedNodes` | `Object` | `{}` | `{ [nodeId]: boolean }` |
| `theme` | `Object` | `{}` | `{ '--css-var': '#value', 'preview-font-size': 15 }` |
| `editorMode` | `string` | `'split'` | `'split'` `'editor'` `'preview'` |
| `searchQuery` | `string` | `''` | Any string |

### Common Patterns

```js
// Switch active project
state.set('activeProjectId', project.id);
state.set('activeNodeId', null); // always reset node when switching projects

// Switch tab
state.set('activeTab', 'examples');
state.set('activeNodeId', null);

// Select a node
state.set('activeNodeId', node.id);

// Toggle dark mode
state.set('isDarkMode', !state.get('isDarkMode'));

// Collapse / expand a node in the tree
const collapsed = { ...state.get('collapsedNodes'), [nodeId]: true };
state.set('collapsedNodes', collapsed);

// Trigger autosave after mutating a project's content directly
state.set('projects', [...state.get('projects')]);

// Update a single theme CSS variable
const theme = { ...state.get('theme'), '--accent-color': '#ff0000' };
state.set('theme', theme);
```

---

## 2. Events

**Import:** `import { eventBus } from './core/EventBus.js'`

```js
eventBus.emit(event, payload)       // fire an event
eventBus.on(event, handler)         // returns an unsubscribe function
this.subscribe(event, handler)      // inside a Component - auto-cleaned on destroy
```

### State Events
Emitted automatically by `state.set()` - never emit these manually.

| Event | Payload |
|---|---|
| `state:change` | `{ key, value, previousValue }` |
| `state:change:activeProjectId` | `{ value, previousValue }` |
| `state:change:activeTab` | `{ value, previousValue }` |
| `state:change:activeNodeId` | `{ value, previousValue }` |
| `state:change:editorMode` | `{ value, previousValue }` |
| `state:change:projects` | `{ value, previousValue }` |
| `state:change:collapsedNodes` | `{ value, previousValue }` |
| `state:change:searchQuery` | `{ value, previousValue }` |
| `state:change:isDarkMode` | `{ value, previousValue }` |
| `state:change:theme` | `{ value, previousValue }` |

### Application Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `save:request` | - | `TopBar`, `main.js` (Ctrl+S) | `Storage` |
| `save:complete` | - | `Storage` | `TopBar` |
| `editor:content-changed` | `{ markdown }` | `EditorArea` | `SidebarRight` |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` | `SidebarRight` |
| `toast:show` | `{ message, type }` | anywhere | `Toast` |

`toast:show` type values: `'success'` `'error'`

```js
// Show a toast from anywhere
eventBus.emit('toast:show', { message: 'Saved!', type: 'success' });
eventBus.emit('toast:show', { message: 'Something went wrong.', type: 'error' });

// Trigger a manual save
eventBus.emit('save:request');
```

---

## 3. Data - ProjectManager

**Import:** `import { ... } from './data/ProjectManager.js'`

### Creating Data

```js
generateId()
// → 'lf3k2abc9'  (short unique id)

createNode(name, content = '', children = [])
// → { id, name, content, children }

createProject(name)
// → { id, name, createdAt, tabs: { explanation, examples, reference } }
// each tab: { nodes: [] }

createDefaultProject()
// → pre-populated Project with sample CSS documentation content
```

### Reading Active Data

```js
getActiveProject()
// → Project object, or null if no project selected

getActiveTab()
// → Tab object { nodes: [] }, or null
// reads activeProjectId + activeTab from state automatically
```

### Finding Nodes

```js
findNode(nodeId)
// → Node object, or null
// searches the currently active tab's tree

findNodeContext(nodeId, nodes, parentNode = null)
// → { node, siblings, parentNode } or null
// useful when you need the sibling array to splice/reorder

getNodePath(nodeId)
// → [ancestorNode, ..., targetNode]  (root → target)
// returns null if not found

flattenNodes(nodes)
// → flat Array of all nodes (depth-first)
```

### Mutating Nodes

```js
removeNodeById(nodeId, nodes)
// removes node from the tree in-place - call state.set('projects', [...]) after

nodeMatchesSearch(node, query)
// → true if node.name contains query (case-insensitive)

deepClone(value)
// → deep copy of any JSON-serializable value
```

---

## 4. Core Modules

### ComponentLoader

**Import:** `import { componentLoader } from './core/ComponentLoader.js'`

```js
await componentLoader.load(componentName, container, props = {})
// Fetches HTML/CSS/JS for the component, injects into container, calls onLoad()
// → returns the component instance

componentLoader.destroy(instanceId)
// Calls onDestroy(), clears container, removes from instance registry

componentLoader.getInstance(instanceId)
// → component instance, or null
```

### Storage

**Import:** `import { storage } from './core/Storage.js'`

```js
storage.initialize()
// Wires autosave (debounced 800ms on state:change) and save:request listener
// Call once on startup

storage.saveNow()
// Immediately writes state to localStorage and emits save:complete
```

---

## 5. Component API

**Import:** `import { Component } from './core/Component.js'`

Every component extends this base class. All methods are available inside subclasses via `this`.

```js
// DOM access - scoped to this component's instance ID prefix
this.element('local-name')
// → document.getElementById('topbar-1__local-name')

this.elementId('local-name')
// → 'topbar-1__local-name'  (the full prefixed ID string)

this.query(selector)
// → this.container.querySelector(selector)

this.queryAll(selector)
// → this.container.querySelectorAll(selector)

// EventBus - subscription is automatically removed when the component is destroyed
this.subscribe(event, handler)
// → returns unsubscribe function

// Properties
this.instanceId   // 'topbar-1'
this.container    // the HTMLElement this component owns
this.props        // props passed from componentLoader.load()
```

### Template ID Syntax (in .html files)

```html
id="{{id:my-button}}"
<!-- rendered as: id="topbar-1__my-button" -->
<!-- accessed in JS: this.element('my-button') -->
```

### Lifecycle Hooks

```js
onLoad()            // called after HTML is injected - wire listeners here
onDestroy()         // called before removal - clean up body-appended elements
onUpdate(newProps)  // called when props change from outside
```

---

## 6. Modal Builder

**Import:** `import { ... } from './core/ModalBuilder.js'`

```js
// Low-level - full control over header/body/footer HTML
buildModal(overlayId, { headerHTML, bodyHTML, footerHTML, onPrimary, extraClass })

// Preset - title + Cancel + primary action button
buildStandardModal(overlayId, { title, bodyHTML, primaryLabel, secondaryLabel, onPrimary })

// Preset - title + single Done/close button (settings, info panels)
buildDoneModal(overlayId, { title, bodyHTML, doneLabel, wide })

// Preset - title + plain text message + Cancel + destructive confirm button
buildConfirmModal(overlayId, { title, message, confirmLabel, cancelLabel, onConfirm })

// Open / close
openModal(overlay)
closeModal(overlay)
```

All modals are appended to `document.body` automatically.
Call `overlay.remove()` in `onDestroy()` to clean up.

### Automatic Wiring (handled by buildModal internally)

| Attribute | Behavior |
|---|---|
| `data-modal-close` | Calls `closeModal` on click |
| `data-modal-primary` | Calls `onPrimary` on click |
| Backdrop click | Calls `closeModal` |

---

## 7. Theme & CSS Variables

**Import:** `import { ... } from './components/TopBar/helpers/ThemeHelper.js'`

```js
applyCSSVariable(variableName, value)
// Sets a CSS variable on :root and persists to state.theme
// variableName with or without '--' prefix both work

applyStoredTheme()
// Reads state.theme and applies all stored overrides - call on startup

applyDocFontSize(sizeInPixels)
// Sets font-size on all [data-preview-panel] elements and saves to state.theme

resetTheme()
// Clears all overrides from state.theme and removes inline styles from :root

getModeIconSVG(isDark)
// → SVG path string for the dark/light mode toggle icon

exportCurrentTabAsHTML()
// Generates a standalone HTML file of the current tab and triggers download
// → { success: boolean, message: string }
```

### CSS Variable Names

| JS key in state.theme | CSS variable | Default (dark) |
|---|---|---|
| `--background` | `--background` | `#0c0c12` |
| `--background-elevated` | `--background-elevated` | `#111119` |
| `--background-raised` | `--background-raised` | `#181826` |
| `--border-color` | `--border-color` | `#252538` |
| `--text-primary` | `--text-primary` | `#e0dbd0` |
| `--text-muted` | `--text-muted` | `#9898b0` |
| `--accent-color` | `--accent-color` | `#22d4a8` |
| `--link-color` | `--link-color` | `#78a8ff` |
| `--code-background` | `--code-background` | `#07070f` |
| `--code-text` | `--code-text` | `#80d89a` |
| `preview-font-size` | (inline style) | `15` (px) |

---

## 8. Editor Helpers

### MarkdownParser

**Import:** `import { parseMarkdown } from './components/EditorArea/helpers/MarkdownParser.js'`

```js
parseMarkdown(source)
// → HTML string
// Supports: # headings, **bold**, *italic*, `code`, ```blocks```,
//           - lists, 1. ordered, > blockquote, [text](url), | tables |, ---
```

### ToolbarHelper

**Import:** `import { ... } from './components/EditorArea/helpers/ToolbarHelper.js'`

All functions modify the textarea value directly and call `onChange(newValue)`.

```js
insertLinePrefix(textarea, prefix, onChange)
// Inserts prefix at the start of the current line
// e.g. prefix '# ' → turns current line into a heading

wrapSelection(textarea, before, after, onChange)
// Wraps selected text (or placeholder 'text') with before/after
// e.g. before '**', after '**' → bold

insertCodeBlock(textarea, onChange)
// Inserts ```javascript\n// code here\n``` at cursor

insertTable(textarea, onChange)
// Inserts a 3-column Markdown table template at cursor

insertLink(textarea, text, url, onChange)
// Inserts [text](url) at cursor

getSelectedText(textarea)
// → currently selected text, or '' if nothing selected

syncScrollPosition(editorElement, previewElement)
// Syncs preview scroll position to match the editor's scroll ratio
```

---

## 9. Tree Helpers

**Import:** `import { renderTree, setupDragAndDrop } from './components/SidebarLeft/helpers/TreeHelper.js'`

```js
renderTree(nodes, { activeNodeId, collapsedNodes, searchQuery, componentInstanceId })
// → HTML string for the full tree
// Uses data-action / data-node-id attributes for event delegation (no inline onclick)
// data-action values: 'select', 'toggle', 'add-child', 'rename', 'delete'

setupDragAndDrop(container, onReorder)
// Enables drag-and-drop reordering within the same sibling level
// onReorder(draggedId, targetId) - called when a drop completes
// → returns a cleanup function - call it before re-rendering the tree
```

---

## 10. Data Shapes

### Project

```js
{
  id: 'lf3k2abc9',
  name: 'CSS Documentation',
  createdAt: 1710000000000,       // Date.now() timestamp
  tabs: {
    explanation: { nodes: [] },
    examples:    { nodes: [] },
    reference:   { nodes: [] },
  }
}
```

### Node

```js
{
  id: 'lf3k2def4',
  name: 'display',
  content: '# display\n\nThe display property...',  // raw Markdown
  children: [/* Node, ... */]
}
```

### Theme (state.theme)

```js
{
  '--background':    '#0c0c12',
  '--accent-color':  '#ff0000',
  'preview-font-size': 16        // number, not string
}
// Only keys that differ from defaults are stored - missing keys = use CSS default
```
