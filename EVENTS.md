# Event Reference

All cross-component communication in DocEditor goes through the `EventBus` singleton.
No component imports or calls another component directly — they only emit and subscribe to events.

Use `eventBus.emit(event, payload)` to fire and `this.subscribe(event, handler)` inside a component
(or `eventBus.on(event, handler)` outside a component) to listen.

---

## State Events

Emitted automatically by `State.set(key, value)` — never emit these manually.

| Event | Payload | Description |
|---|---|---|
| `state:change` | `{ key, value, previousValue }` | Fired on every state change. Use the specific variants below instead where possible. |
| `state:change:activeProjectId` | `{ value, previousValue }` | The active project was switched. |
| `state:change:activeTab` | `{ value, previousValue }` | Tab switched — `'explanation'`, `'examples'`, or `'reference'`. |
| `state:change:activeNodeId` | `{ value, previousValue }` | Selected node changed. `value` is `null` when nothing is selected. |
| `state:change:editorMode` | `{ value, previousValue }` | Editor view mode changed — `'split'`, `'editor'`, or `'preview'`. |
| `state:change:projects` | `{ value, previousValue }` | Project list mutated (node added/removed/renamed, project created). |
| `state:change:collapsedNodes` | `{ value, previousValue }` | A node was collapsed or expanded in the sidebar tree. |
| `state:change:searchQuery` | `{ value, previousValue }` | The search input value changed. |
| `state:change:isDarkMode` | `{ value, previousValue }` | Dark / light mode toggled. |
| `state:change:theme` | `{ value, previousValue }` | Theme object updated (CSS variable overrides, font size). |

---

## Save Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `save:request` | — | `TopBar` (Save button), `main.js` (Ctrl+S, first launch seed) | `Storage` |
| `save:complete` | — | `Storage` (after writing to localStorage) | `TopBar` (flashes autosave indicator) |

---

## Editor Events

Emitted by `EditorArea` whenever the content or statistics change.

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `editor:content-changed` | `{ markdown }` | `EditorArea` (on every keystroke) | `SidebarRight` (rebuilds TOC) |
| `editor:stats-updated` | `{ wordCount, charCount }` | `EditorArea` (on every keystroke) | `SidebarRight` (updates word/char count badges) |

---

## UI Events

| Event | Payload | Emitted by | Received by |
|---|---|---|---|
| `toast:show` | `{ message, type }` | `TopBar`, `SidebarLeft`, `EditorArea`, `main.js` | `Toast` |

`type` is either `'success'` or `'error'`.

---

## Full Subscriber Map

Who listens to what:

| Subscriber | Events |
|---|---|
| `Storage` | `state:change`, `save:request` |
| `TopBar` | `state:change:activeTab`, `save:complete` |
| `SidebarLeft` | `state:change:activeProjectId`, `state:change:activeTab`, `state:change:activeNodeId`, `state:change:searchQuery`, `state:change:collapsedNodes`, `state:change:projects` |
| `EditorArea` | `state:change:activeNodeId`, `state:change:activeProjectId`, `state:change:activeTab`, `state:change:editorMode` |
| `SidebarRight` | `editor:content-changed`, `editor:stats-updated`, `state:change:activeNodeId` |
| `Toast` | `toast:show` |

---

## Flow Examples

**User selects a node in the sidebar:**
```
SidebarLeft         state.set('activeNodeId', id)
State               → emits state:change:activeNodeId
EditorArea          → loads node content into textarea, updates breadcrumb
SidebarRight        → rebuilds TOC from node content
```

**User types in the editor:**
```
EditorArea          → updates node.content directly, calls state.set('projects', [...])
State               → emits state:change (triggers debounced autosave in Storage)
EditorArea          → emits editor:content-changed, editor:stats-updated
SidebarRight        → rebuilds TOC, updates word/char count
```

**User presses Ctrl+S:**
```
main.js             → emits save:request
Storage             → saves state to localStorage, emits save:complete
TopBar              → flashes "● Saved" autosave indicator
```
