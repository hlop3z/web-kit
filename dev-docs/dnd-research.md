# Drag-and-Drop Research

Comprehensive research covering page builders, design tools, node editors, timelines, 3D editors, spreadsheets, and OS-level DnD — distilled into patterns and primitives for the Xkin DnD system.

---

## Table of Contents

1. [Page Builders](#1-page-builders)
2. [Design Tools](#2-design-tools)
3. [Node Editors](#3-node-editors)
4. [Timeline / Sequencer](#4-timeline--sequencer)
5. [Spreadsheets / Data Grids](#5-spreadsheets--data-grids)
6. [3D Editors](#6-3d-editors)
7. [File Managers / OS-Level](#7-file-managers--os-level)
8. [Kanban / Project Management](#8-kanban--project-management)
9. [Open-Source DnD Libraries](#9-open-source-dnd-libraries)
10. [Universal Primitives](#10-universal-primitives)
11. [Minimal Abstraction Layers](#11-minimal-abstraction-layers)
12. [Runtime Flow](#runtime-flow)

---

## 1. Page Builders

### Shopify (Section + Block Architecture)

- Pages are a vertical stack of **Sections** (max 25). Each section contains **Blocks** (max 50).
- Reordering happens in a **sidebar list**, not on the canvas. The sidebar mirrors the page structure.
- Sections are Liquid files with a `{% schema %}` tag defining settings, block types, and presets.
- Three block types: **Theme Blocks** (reusable, support nesting), **Section Blocks** (inline, no nesting), **App Blocks** (from Shopify apps).
- **JSON Templates** store section order and block order. Editor re-renders HTML without full page reloads.
- Schema-driven: each section/block declares what it accepts via JSON schema.

**Key pattern:** Sidebar-list reordering with strict hierarchy (Page > Section > Block). Schema declares constraints.

### WordPress Gutenberg

- Block editor where content is a flat or nested list of blocks in vertical document flow.
- Each block has a `block.json` metadata file (name, attributes, supports, category).
- **InnerBlocks** enables nesting — a block can contain other blocks (e.g., Columns > Column).
- Uses its own **custom `Draggable` component** wrapping the **native HTML5 Drag and Drop API**. Creates a cloned drag image.
- **BlockMover** provides up/down arrows and drag handle.
- Drop zones detect insertion points between blocks.
- Serialized as annotated HTML: `<!-- wp:blockname {...attributes} -->`.

**Key pattern:** Native HTML5 DnD with custom drag image cloning. Comment-delimited serialization. InnerBlocks for nesting with `allowedBlocks` constraints.

### GrapesJS (Open Source)

- Framework for building visual page editors. Renders an **iframe canvas**.
- **Components** are the core abstraction: each has a **Model** (source of truth) and **View** (canvas rendering).
- **Blocks** panel: users drag pre-built HTML snippets onto the canvas.
- **Component Type Stack**: ordered array of types. When HTML is dropped, GrapesJS walks the stack to determine the component type.
- Components declare `draggable` (where they can be placed) and `droppable` (whether they accept children).
- Layers Manager (tree view), Style Manager (CSS editor), Trait Manager (attribute editor).
- Plugin architecture. Commands system with before/after hooks.

**Key pattern:** Model/View separation (canvas view is independent from exported code). Type Stack for component recognition. `draggable`/`droppable` constraints.

### Craft.js (Open Source React)

- Creates a **Node Tree** where each React element becomes a Node with metadata.
- `<Editor>` wraps the editing environment. `<Frame>` is the editable area. `<Element canvas>` marks droppable regions.
- Connector pattern: `drag(ref)` makes an element a drag handle, `connect(ref)` marks the DOM element for the node.
- Canvas Nodes are droppable, their children are automatically draggable. Non-Canvas nodes are static.
- Full serialization: `query.serialize()` exports editor state as JSON, `resolver` maps types back to components.

**Key pattern:** Canvas vs non-Canvas nodes (explicit opt-in for droppable). Connector pattern for binding DnD to DOM. Serializable state.

---

## 2. Design Tools

### Figma

- Custom **WebGL-based tile rendering engine** compiled from C++ via Emscripten. Bypasses browser DOM entirely.
- Full control over coordinate transforms, hit testing, and rendering.

**Multiplayer DnD:**

- Custom system inspired by CRDTs but not a true CRDT. Server is central authority (last-writer-wins).
- Document is a flat map: `Map<ObjectID, Map<Property, Value>>`. Changes are atomic at the property level.
- Unacknowledged client changes take precedence over incoming server updates (optimistic local-first rendering).

**Tree Ordering:**

- Uses **fractional indexing** — child ordering uses fractions between 0 and 1. Insert between items A and B by averaging their positions. No reindexing needed.
- Parent links and positions are stored as a single atomic property.

**Reparenting:**

- Hardest problem. Concurrent reparenting can create cycles. Server rejects parent updates that would cause cycles. Clients temporarily remove conflicting objects until server resolves.

**Undo in Multiplayer:**

- Undo modifies redo history at the time of the undo, preventing redo from overwriting collaborators' subsequent changes.

**DnD Interactions:** Move on canvas, resize (drag handles), reorder layers (layer panel), drag from assets panel, reorder within auto-layout frames, create selection rectangles, pan canvas.

**Coordinate Systems:** Screen space (browser viewport) -> Canvas space (infinite 2D plane with zoom/pan) -> Local space (relative to parent frame). All drag deltas transform from screen to canvas accounting for zoom.

**Auto-Layout:** Frames with auto-layout arrange children in horizontal/vertical/grid flows. Dragging within auto-layout reorders (list behavior). Dragging out detaches. Children can be absolute-positioned within auto-layout.

### Adobe Photoshop / Illustrator

- Layer drag reordering in layers panel.
- Drag objects on canvas to move, drag handles to resize/transform.
- Drag between open documents (cross-document DnD).
- Drag from library panels.
- Artboard drag to reposition.
- Illustrator supports multiple artboards each with their own coordinate origin.

---

## 3. Node Editors

### React Flow (xyflow)

- Nodes positioned via `{x, y}` in "flow space." Viewport has `{x, y, zoom}` transform.
- Screen coordinates must be converted to flow coordinates for all operations.

**DnD Types:**

- **Node drag**: `onNodeDragStart`, `onNodeDrag`, `onNodeDragStop` with configurable `nodeDragThreshold`
- **Connection drag**: Drag from Handle to Handle to create an edge. Line types: bezier, smoothstep, step, straight
- **Selection drag**: Shift+drag for marquee selection, then drag the group
- **Pan**: Click+drag on empty canvas. `panOnDrag` restricts to specific mouse buttons
- **Auto-pan**: When dragging near viewport edges, viewport pans automatically

**Snapping:** `snapToGrid` + `snapGrid` for grid snapping during node drag.

**Coordinate Conversion:** `screenToFlowPosition()` and `flowToScreenPosition()` utilities. Transform: `translate(x, y) scale(zoom)`.

### LiteGraph.js (Powers ComfyUI)

- Canvas2D-based rendering. Supports zoom/pan.
- `LGraph` contains nodes with `pos: [x, y]`. Nodes have typed input/output slots.
- Connections link output slot indices to input slot indices.
- DnD: node reposition, drag between sockets to connect (creating "noodles"), drag to pan, multi-select and drag, context menu for creation.

### Rete.js

- Framework-agnostic (React, Vue, Angular, Svelte). Plugin system with "area" plugin for viewport.
- Supports both dataflow and control flow graph processing. TypeScript-first.

### Shared Node Editor Patterns

All node editors share these DnD primitives:

1. **Node drag** — move nodes in graph space
2. **Connection drag** — drag from port/socket to create wire
3. **Canvas pan** — drag empty space to move viewport
4. **Marquee select** — drag to draw selection rectangle
5. **Group drag** — multi-select then drag together

---

## 4. Timeline / Sequencer

### Video Editors (Premiere Pro, DaVinci Resolve)

**Seven edit modes in DaVinci Resolve:**

- **Insert**: pushes everything after
- **Overwrite**: replaces existing content
- **Replace**: swaps clips of same length
- **Fit to Fill**: speed-adjusts to fill gap
- **Place on Top**: puts on next available track
- **Append at End**: always adds after last clip
- **Ripple Overwrite**: replaces and adjusts surrounding

**Four trim types (context-sensitive on cursor position):**

- **Ripple**: drag edge, pushing adjacent content
- **Roll**: drag cut point between two clips, affecting both
- **Slip**: drag within clip to change visible portion (duration unchanged)
- **Slide**: drag clip left/right, adjusting neighbors to compensate

**Coordinate System:** One-dimensional primary axis (time) + secondary axis (track number). Timeline has zoom (time scale) and scroll position. Drag deltas convert from pixels to time units.

**Snapping:** Clips snap to playhead, other clip edges, markers. Magnetic within a pixel threshold.

### Audio DAWs (Ableton, FL Studio)

- Drag audio/MIDI clips in arrangement view
- Drag samples from browser to tracks
- Drag automation points (control-point curves)
- Drag piano roll notes (2D: pitch Y, time X)
- Drag to resize clips, drag loop points
- Grid quantization (snap to beat divisions)

### Animation Tools (After Effects, Rive)

- Keyframe drag on timeline (move in time)
- Drag easing handles (bezier control points for animation curves)
- Layer reordering
- Property drag (position, rotation, scale as draggable keyframes)

---

## 5. Spreadsheets / Data Grids

### Excel / Google Sheets

- **Cell range selection drag**: click and drag to select range
- **Fill handle drag**: small square at bottom-right, drag to auto-fill series
- **Column/row resize**: drag border between headers
- **Move cells**: select range, drag the border to move
- **Column reorder**: drag column headers

**Coordinate System:** Grid coordinates (row, column) mapped to pixels via variable column widths and row heights. Frozen rows/columns create split viewports.

**Constraints:** Cells snap to grid boundaries. Fill handle constrained to horizontal or vertical axis.

---

## 6. 3D Editors

### Unity

**Transform Gizmos:** Five modes — Move (W), Rotate (E), Scale (R), RectTransform (T), Unified (Y). Each has axis handles (red/green/blue for X/Y/Z) and plane handles for two-axis movement.

**Coordinate Systems:**

- World space vs Local space (toggled for gizmo orientation)
- Pivot vs Center (toggled for gizmo position)
- Screen-space mode (Shift key) for drag relative to camera

**Snapping:**

- Grid snapping (world grid along X/Y/Z)
- Surface snapping (Shift+Ctrl to snap colliders to surfaces)
- Vertex snapping (V key to align mesh vertices)

**Viewport Navigation (modifier keys disambiguate):**

- Middle mouse drag = pan
- Alt+left drag = orbit
- Alt+right drag = zoom
- Right click hold = flythrough (WASD + mouse look)
- Q = view tool (camera only)

### Blender

- Node Editor: drag nodes to reposition, drag between sockets to connect, Ctrl+right-click drag to cut links, drag to pan, box select.
- Scene Hierarchy: drag objects in outliner to reparent. Drag from asset browser to viewport.
- Gizmo System: translate/rotate/scale gizmos with axis and plane handles.

---

## 7. File Managers / OS-Level

### Windows OLE DnD Protocol

Three-component architecture:

- **IDropSource**: implemented by source app. Provides source and pointer feedback.
- **IDropTarget**: implemented by receiving app. Provides target feedback.
- **DoDragDrop()**: OLE function implementing the drag loop.

Three feedback types: source feedback (highlight), pointer feedback (cursor based on `dropEffect`), target feedback (drop zone indication).

Drop effects: `DROPEFFECT_COPY`, `DROPEFFECT_MOVE`, `DROPEFFECT_LINK`, `DROPEFFECT_NONE`. Modified by Ctrl (copy), Shift (move), Ctrl+Shift (link).

### HTML Drag and Drop API (Browser-OS Bridge)

**Event lifecycle:** `dragstart` -> `drag` (repeated) -> `dragenter` -> `dragover` (repeated) -> `dragleave` -> `drop` -> `dragend`

**DataTransfer object:** Data set as MIME-typed strings. Data only writable during `dragstart`, only readable during `drop`. This serialization constraint enables cross-application drag.

**effectAllowed** (source): `none`, `copy`, `move`, `link`, `copyMove`, `copyLink`, `linkMove`, `all`
**dropEffect** (target): `copy`, `move`, `link`, `none`. Must be set in every `dragover`.

**setDragImage()**: custom preview using any element, img, or canvas.

**Critical:** drop targets must call `preventDefault()` on `dragover` to accept drops. Files from OS appear via `DataTransfer.files`.

### Electron Bridge

`webContents.startDrag(item)` bridges web content to OS-native drag via IPC between renderer and main process.

---

## 8. Kanban / Project Management

### Pragmatic Drag and Drop (Atlassian — Powers Trello, Jira, Confluence)

~4.7kB core. Built on native HTML5 DnD API.

**Three adapters:**

1. **Element adapter**: `draggable()`, `dropTargetForElements()`, `monitorForElements()`
2. **Text selection adapter**: dragging selected text
3. **External adapter**: files/content from outside the browser

**Core Types:**

- **Input**: `{altKey, button, buttons, ctrlKey, metaKey, shiftKey, clientX, clientY, pageX, pageY}`
- **DragLocation**: `{input, dropTargets[]}` — position and bubble-ordered active drop targets
- **DragLocationHistory**: `{initial, current, previous}` — three snapshots for change detection
- **DropTargetRecord**: `{element, data, dropEffect, isActiveDueToStickiness}`

**Event flow:** `onGenerateDragPreview` -> `onDragStart` -> `onDrag` (repeated) -> `onDropTargetChange` -> `onDrop`. Targets also get `onDragEnter` / `onDragLeave`.

**Monitors:** global observers watching all drag operations. Gated with `canMonitor()`.

**Data model:** `getData()` called lazily on drop targets — enables dynamic data based on drag position.

### Notion / Linear / Trello

- Block drag to reorder, drag between columns (status change), drag in sidebar to nest pages.
- Ordering uses **fractional indexing** for conflict-free collaborative reordering.

---

## 9. Open-Source DnD Libraries

### @dnd-kit/dom

Modular, framework-agnostic. First-class React, Vue, Svelte, Solid, vanilla JS support.

**Core API:**

| Primitive         | Purpose                                                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| `DragDropManager` | Central orchestrator. Accepts `{ sensors, plugins, modifiers }`                                 |
| `Draggable`       | `{ id, element, handle, type, disabled, data, feedback, modifiers, sensors, plugins, effects }` |
| `Droppable`       | `{ id, element, accepts, collisionDetector, collisionPriority, disabled, data, effects }`       |
| `Sortable`        | Combines Draggable + Droppable. `{ id, index, element, group, handle, target, transition }`     |

**Manager Events:** `beforedragstart` (preventable), `dragstart`, `dragmove` (with `to`/`by` delta), `dragover`, `collision`, `dragend` (with `canceled`)

**Manager Properties:** `registry` (maps of draggables, droppables, plugins, sensors, modifiers), `dragOperation` (source, target, position, status, canceled), `monitor` (addEventListener/removeEventListener)

**Collision Detection Algorithms:**

- `shapeIntersection` (default) — rectangle overlap
- `pointerIntersection` — pointer position
- `closestCenter` — distance between centers
- `directionBiased` — considers drag direction (ideal for sortable)

**Sensors:**

- `PointerSensor`: mouse/touch/pen. Activation: `Distance({ value, tolerance })`, `Delay({ value, tolerance })`
- `KeyboardSensor`: arrow keys (10px default, 50px with Shift)

**Modifiers:** `RestrictToHorizontalAxis`, `RestrictToVerticalAxis`, `RestrictToWindow`, `RestrictToElement`, `Snap.configure({ size: { x, y } })`

**Plugins:** `Accessibility` (ARIA), `AutoScroller` (edge scrolling), `Cursor` (cursor changes), `Feedback` (preview, drop animations), `Debug` (visualize shapes/zones), `StyleInjector` (CSP-compliant styles)

**Feedback Modes:** `'default'`, `'clone'`, `'move'`, `'none'`

**Sortable Features:**

- `OptimisticSortingPlugin` (default): reorders DOM during drag without framework re-renders
- Cross-container sorting via `group` identifier
- Type guards: `isSortable()`, `isSortableOperation()`

### Pragmatic Drag and Drop (Atlassian)

See [Kanban section](#8-kanban--project-management). ~4.7kB, native HTML5 DnD wrapper, adapter pattern.

### SortableJS

Simplest API. One constructor call:

```js
new Sortable(element, {
  sort: true,
  animation: 150,
  handle: ".handle",
  filter: ".no-drag",
  group: {
    name: "shared",
    pull: true | false | "clone",
    put: true | false | ["group"],
  },
  ghostClass: "ghost",
  chosenClass: "chosen",
  dragClass: "drag",
  swapThreshold: 1,
  fallbackOnBody: true, // needed for nested
  onStart,
  onEnd,
  onAdd,
  onRemove,
  onUpdate,
  onSort,
  onChange,
});
```

Plugins: **MultiDrag** (select and drag multiple), **Swap** (exchange positions).

Cross-container: same group name = items move between lists. `pull: 'clone'` for palette-to-canvas.

---

## 10. Universal Primitives

After analyzing all systems — from Figma to Premiere Pro to Unity to spreadsheets — these are the primitives **every** professional DnD system shares:

### 10.1 Drag Lifecycle (State Machine)

```
IDLE -> [activation threshold] -> DRAGGING -> [release | cancel] -> IDLE
```

Events: `dragStart`, `dragMove`, `dragEnd`, `dragCancel`

The activation threshold (distance, delay, or both) is universal — it disambiguates click/tap from drag intent.

### 10.2 Coordinate Spaces and Transforms

Every system beyond simple lists deals with multiple spaces:

- **Screen/viewport space** — pixels from pointer events
- **Canvas/world/document space** — the infinite coordinate plane
- **Local/parent space** — relative to a container

Universal operation: `screenToWorld(screenPoint, viewportTransform) -> worldPoint`
Where `viewportTransform = { translateX, translateY, scale }`

### 10.3 Hit Testing / Collision Detection

Determining what is "under" the dragged item:

- Point-in-rectangle (most common)
- Rectangle intersection (area-based)
- Closest center/corner (sortable lists)
- Custom (node editor sockets, timeline snap points)

### 10.4 Drop Target Resolution

When multiple targets overlap (nested containers):

- **Bubble-ordered list** of targets (innermost to outermost)
- **Stickiness** — staying "in" a target after pointer briefly leaves
- **canDrop** predicates — type checking

### 10.5 Visual Feedback

Every system provides:

- **Drag preview/ghost** — what follows the cursor
- **Drop indicator** — where the item will land (line, highlight, placeholder gap)
- **Cursor change** — grab, grabbing, not-allowed, copy, move

### 10.6 Data Transfer Model

Two paradigms:

- **Reference-based** (internal): carry ID/reference. Drop handler looks it up.
- **Serialized** (external): MIME-typed strings via DataTransfer. Required for cross-application.

### 10.7 Operation Types

The universal set:

| Operation    | Description                       | Examples                                 |
| ------------ | --------------------------------- | ---------------------------------------- |
| **Move**     | Remove from source, add to target | File manager, kanban                     |
| **Copy**     | Keep at source, add to target     | Alt+drag in Figma, Ctrl+drag in Explorer |
| **Link**     | Create reference                  | OS shortcuts, spreadsheet references     |
| **Reorder**  | Change position in same container | List sorting, layer reordering           |
| **Transfer** | Move between containers           | Kanban columns, cross-list sortable      |
| **Resize**   | Change dimensions                 | Drag handle/edge in any editor           |
| **Connect**  | Create relationship               | Node editor wires                        |
| **Select**   | Define region                     | Marquee/lasso selection                  |
| **Pan**      | Move viewport                     | Drag empty space in canvas tools         |
| **Draw**     | Create new content                | Freeform drawing, rectangle tool         |
| **Trim**     | Adjust boundaries                 | Timeline clip edges                      |

### 10.8 Constraints

- **Axis locking** — restrict to horizontal or vertical
- **Grid snapping** — quantize to grid intervals
- **Guide snapping** — snap to alignment guides, other object edges
- **Containment** — keep within parent bounds
- **Collision avoidance** — prevent overlap

### 10.9 Multi-Element Operations

- **Multi-select then drag** — all selected items move together, maintaining relative positions
- **Modifier keys** — Shift (constrain axis), Alt (duplicate), Ctrl/Cmd (copy vs move)
- **Group drag** — drag a group moves all children

### 10.10 Undo/Redo Integration

- Drag completion generates an undoable command
- Command captures before-state and after-state
- Collaborative: undo scoped to local user, not global

### 10.11 Ordering (Collaborative)

**Fractional indexing** — used by Figma, Notion, Linear, Trello:

- Assigns string keys that sort lexicographically
- Insert between A and B by generating a key that sorts between them
- No reindexing needed. Conflict-free under concurrent edits

---

## 11. Minimal Abstraction Layers

A system that could support all of the above needs these layers:

### Layer 1 — Input (Sensors)

Abstract pointer/touch/keyboard into unified `{ position, modifiers, pointerId }` events. Handle activation thresholds (distance, delay). Use `setPointerCapture()` for reliable tracking.

### Layer 2 — Coordinate Transform Pipeline

```
screenPosition
  -> viewportTransform(pan, zoom)
    -> worldPosition
      -> parentTransform(position, rotation, scale)
        -> localPosition
```

Invertible at every step.

### Layer 3 — Drag State Machine

`idle` -> `pending` (threshold not met) -> `dragging` -> `dropped` | `cancelled`

Carries: source data, current position (all coordinate spaces), location history (initial, previous, current), active drop targets (bubble-ordered).

### Layer 4 — Hit Testing / Drop Target Registry

Registry of drop targets with bounding shapes. Pluggable collision detection function. Returns ordered list of intersecting targets. Supports `canDrop` predicates.

### Layer 5 — Constraint Pipeline

Ordered list of constraint functions applied to drag position:

```
constrainToAxis() -> snapToGrid() -> snapToGuides() -> constrainToBounds()
```

Each receives the proposed position and returns the constrained position.

### Layer 6 — Visual Feedback

Drag preview renderer (follows cursor), drop indicator renderer (shows landing zone), cursor manager. All receive current drag state and render accordingly.

### Layer 7 — Data Transfer

Internal: typed source/target data objects (reference-based).
External: MIME-typed serialized strings via DataTransfer API.

### Layer 8 — Operation Executor

Receives the completed drag (source, target, operation type, final position) and performs the actual state mutation. Generates undo/redo commands. In collaborative systems, broadcasts the change.

---

## Key Architectural Insight

The most important insight across all systems is the **separation of concerns**:

1. Input handling is separate from coordinate transformation
2. Hit testing is separate from visual feedback
3. Drag tracking is separate from state mutation
4. Constraints are a composable pipeline, not hardcoded logic

Every professional system that scales well follows this separation. Systems that conflate these concerns inevitably hit walls when trying to support zoom, multi-select, collaborative editing, or undo/redo.

The HTML5 DnD API is limited because it conflates input handling with data transfer and gives almost no control over visual feedback, coordinate transforms, or hit testing. That's why every serious application (Figma, Trello, Linear, video editors, node editors) either builds custom DnD on Pointer Events or uses a library that does.

---

## Runtime Flow

The full pipeline and how the layers connect at runtime:

```
Pointer Events                    <- raw browser input
     |
Input Interpreter (Sensors)       <- disambiguate click vs drag, normalize pointer/touch/keyboard
     |
Interaction Controller            <- state machine (idle -> pending -> dragging -> dropped/cancelled)
     |
     |--- Hit Testing Engine      <- what's under the pointer? (collision detection, drop target resolution)
     |         |
     |         v
     |--- Constraint Solver       <- snap, axis lock, containment, guides (transforms the position)
     |         |
     |         v
     |--- Preview Renderer        <- ghost, drop indicator, cursor (visual feedback, no state mutation)
     |
     v
Command System                    <- on drop: create undoable command (move, copy, reorder, connect, resize...)
     |
Document State                    <- apply command, update the model, notify subscribers
```

**During a drag** — Hit Testing, Constraint Solver, and Preview Renderer all run on every pointer move. They are parallel concerns orchestrated by the Interaction Controller on each frame. Only the Command System runs once at the end (on drop).

```
each pointer move:
  1. Sensor normalizes input -> position + modifiers
  2. Controller updates drag state
  3. Hit Testing resolves targets at current position
  4. Constraint Solver adjusts position (snap, axis, bounds)
  5. Preview Renderer updates visuals

on release:
  6. Command System creates operation from (source, target, final position, operation type)
  7. Document State applies it (with undo/redo)
```
