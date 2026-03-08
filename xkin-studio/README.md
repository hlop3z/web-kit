# Plan: Xkin Studio

## The Big Idea

A self-hosting, layered studio system **shipped as a separate plugin** that receives the `xkin` object as its only dependency. Xkin Core is the runtime; the Studio is a standalone tool built on top of it.

```
┌─────────────────────────────────────────────────────────────────┐
│  xkin-studio (separate package / plugin)                        │
│  Receives: xkin object only                                     │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Layer 3: Domain Apps                                     │  │
│  │  DAM · CMS · PIM · CRM · ERP · POS                        │  │
│  │  Pre-configured App Studio instances                      │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Layer 2: App Studio                                      │  │
│  │  Visual low-code builder — models, views, actions, menus  │  │
│  │  Builds domain apps without writing code                  │  │
│  ├───────────────────────────────────────────────────────────┤  │
│  │  Layer 1: Code Studio                                     │  │
│  │  Browser IDE — Monaco + files + workspace + DnD           │  │
│  │  Builds App Studio (and itself) with code                 │  │
│  └───────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Layer 0: Xkin Core (web-kit)                                   │
│  Preact · nanostores · Monaco · hooks · plugins · DnD · tools   │
│  The runtime primitives — standalone, no studio knowledge       │
└─────────────────────────────────────────────────────────────────┘
```

### Plugin Architecture — `xkin` Object as Single Entry Point

The Studio Stack is a **separate package** (`xkin-studio`) that depends on Xkin Core exclusively through the `xkin` object. It never imports from `web-kit` internals — it uses only the public API surface that any plugin receives.

```js
// xkin-studio/index.js — the entire studio is a plugin
export default function create_studio(xkin) {
  // xkin is the ONLY dependency — the full Xkin class instance
  // Everything the studio needs comes from this single object:
  //
  //   xkin.plugins     — register sub-plugins (Code Studio, App Studio panels)
  //   xkin.hooks        — hook into file/workspace/dnd events
  //   xkin.files        — virtual file system
  //   xkin.workspace    — workspace management
  //   xkin.keys         — keybinding registration
  //   xkin.ui           — UI slot contributions (sidebar, toolbar, panels)
  //   xkin.dnd          — drag-and-drop system
  //   xkin.commands     — command palette registration
  //   xkin.persistence  — save/load state
  //   xkin.store        — nanostores (atom, computed, map)
  //   xkin.engine       — Preact (h, Fragment, render, renderToString)
  //   xkin.$workspace, xkin.$files, xkin.$active_file, ...  — reactive atoms
  //   xkin.$document, xkin.$sections, xkin.$selection, ...  — DnD atoms
  //   xkin.editor()     — create Monaco editor instances
  //   xkin.tsx()        — transpile TSX
  //   xkin.format()     — format code (Prettier)
  //   xkin.sass()       — compile Sass
  //   xkin.css_modules()— CSS Modules
  //   xkin.markdown()   — render Markdown
  //   xkin.mdx()        — render MDX

  // Register the studio as a plugin tree
  xkin.plugins.register({
    id: "xkin-studio",
    name: "Xkin Studio Stack",
    version: "0.1.0",
    permissions: [
      "ui",
      "files",
      "keys",
      "hooks",
      "workspace",
      "tools",
      "editor",
      "commands",
      "store",
    ],
    activation: "on_load",

    async activate(ctx) {
      // Layer 1: Code Studio plugins
      register_code_studio(xkin, ctx);

      // Layer 2: App Studio plugins (built with Code Studio)
      register_app_studio(xkin, ctx);

      // Layer 3: Domain apps are loaded dynamically via App Studio
    },

    deactivate() {
      // Cleanup all sub-plugins
    },
  });
}

// Usage from the consumer side:
// import Xkin from "xkin";
// import create_studio from "xkin-studio";
//
// create_studio(Xkin);  // done — studio is live
```

**Why this matters:**

1. **Xkin Core stays clean** — no studio logic leaks into the runtime. Core is a general-purpose toolkit for building ANY browser application, not just studios.
2. **Testable in isolation** — the studio can be unit-tested by passing a mock `xkin` object.
3. **Replaceable** — someone can build a completely different studio on the same core, or use Xkin Core without any studio at all.
4. **Tree-shakeable** — if you only need Xkin Core (e.g., for a deployed app runtime), the studio code is never bundled.
5. **Same plugin contract** — the studio uses exactly the same `ctx.contribute()`, `ctx.hook()`, and permission system that any third-party plugin uses. No special privileges.

**The self-hosting property:** Code Studio is built with Xkin Core (via the `xkin` object). App Studio is built inside Code Studio as a set of sub-plugins. Domain Apps are assembled inside App Studio by configuring models, views, and actions. A developer can drop down to Code Studio at any layer to extend what App Studio can't express visually.

**Inspired by Odoo Studio** — Odoo's genius is that the Studio is just another module in the same system it customizes. Models, Views, Actions, and Menus are the four primitives. We adopt the same starting vocabulary but go further: our Code Studio means the studio itself is editable, and Preact+renderToString means everything produces real deployable HTML/JS.

---

## Design Axioms

Principles derived from auditing every major meta-platform (Odoo, Salesforce, Power Platform, OutSystems, Mendix) and foundational systems theory (Lisp, Smalltalk, category theory, FRP, "Worse is Better").

### Axiom 1: Self-description as litmus test

At every layer, ask: **"Can this layer describe itself?"** If Model can't store Model definitions, if View can't render the View editor, if Action can't orchestrate the Action builder — the abstraction leaks. We don't need full self-hosting on day one, but the _inability_ to self-host reveals gaps in our primitives.

### Axiom 2: Worse is better for shipping

Ship **Model + View** first (auto-generated CRUD). Add Action when someone needs a custom button. Add Menu when someone needs navigation. Add Workflow when someone needs approvals. Each primitive addition should be driven by user pain, not architectural elegance. The Unix/C/HTTP path that won every time: ship 50% that covers 90% of use cases.

### Axiom 3: Totality over Turing completeness

Each primitive's expression language should **always terminate** by construction. Models are schemas (finite). Views are templates (finite rendering). Actions are state machines (finite steps). Menus are graphs (finite navigation). The escape hatch to full JavaScript is the plugin system — we don't replicate it inside the visual layer.

### Axiom 4: Separate definition, storage, and history

Three concerns that must never be conflated:

- **Definitions** (schemas) are JSON documents — git-diffable, version-controlled
- **Instances** (user data) are relationally structured — queryable, indexable, generated from schemas
- **Changes** (audit trail) are events — captured by the hook system, enabling undo/redo

Conflating these produces either the EAV performance trap (WordPress `wp_postmeta`) or the document-model query trap.

### Axiom 5: The escape hatch is a first-class design element

Every layer has a ceiling. The ceiling is explicit, documented, and the escape hatch lands the user in a well-lit room:

```
Configurator  ← App Studio (visual, no code)
     ↓ escape hatch: ctx.contribute("widget", {...}) or custom action handler
Developer     ← Code Studio (code, full power)
     ↓ escape hatch: Xkin plugin API
Core Dev      ← Xkin Core (runtime primitives)
```

### Axiom 6: Primitives must compose without special cases

If `View + View ≠ View` (you can't embed a list inside a form without special code), the algebra is broken. Every primitive must compose freely:

- Views embed other Views (dashboard embeds list, form embeds relation picker)
- Actions compose sequentially (save then navigate) and conditionally (if valid, save; else notify)
- Models reference other Models (relations are first-class, not bolted on)
- Menus are recursive (sub-menus are menus)

---

## What's Really Needed: The Full Primitive Set

The 4-primitive MVAM model (Model, View, Action, Menu) is the **core vocabulary** — proven by Odoo's 20+ years. But every platform that handles real business apps (Salesforce, Power Platform, OutSystems, Mendix) needed more. The research is unambiguous:

### Core Primitives (ship first)

| #   | Primitive | What it is                                                              | Ships in  |
| --- | --------- | ----------------------------------------------------------------------- | --------- |
| 1   | **Model** | Data schema — fields, types, relations, validations, computed fields    | Phase 1   |
| 2   | **View**  | Display layout — list, form, gallery, kanban, tree, dashboard, calendar | Phase 1-2 |

These two alone produce auto-generated CRUD applications. This is the MVP.

### Extended Primitives (ship when users need them)

| #   | Primitive     | What it is                                                                                            | Why "Action" doesn't cover it                                                                                                                                                                                                                          | Ships in |
| --- | ------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| 3   | **Action**    | Single-step behavior — CRUD, navigate, call API, UI feedback                                          | —                                                                                                                                                                                                                                                      | Phase 3  |
| 4   | **Menu**      | Navigation structure — sidebar, tabs, breadcrumbs                                                     | —                                                                                                                                                                                                                                                      | Phase 3  |
| 5   | **Workflow**  | Multi-step, conditional, stateful, long-running processes                                             | Actions are single operations. Workflows persist state across days/weeks, have timeouts, branching, escalation. Mendix added Workflows in v9 after microflows failed. Salesforce created Flow. Microsoft created Power Automate as a separate product. | Phase 5+ |
| 6   | **Security**  | Permissions — model-level CRUD, record-level rules, field-level visibility, role-based menu filtering | Cross-cuts everything. Can't be "just a field on the Model." Salesforce has 4 separate permission mechanisms. Odoo has `ir.model.access` + `ir.rule`.                                                                                                  | Phase 4  |
| 7   | **Connector** | Integration — auth management, retries, rate limiting, data mapping for external APIs                 | Without managed connectors, every plugin author re-implements auth/retry/error handling. Power Platform has 400+ managed connectors.                                                                                                                   | Phase 5+ |

### Infrastructure Concerns (not primitives, but designed in from day one)

| Concern               | How it's handled                                                                                                               | Not a primitive because...                                                                                                      |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| **Scheduling/Cron**   | Action with schedule trigger + scheduler infrastructure                                                                        | It's an Action execution mode, not a new data shape                                                                             |
| **Audit Trail**       | Hook-based event log (`action.after_*` writes to audit model)                                                                  | It's a Model + Hook pattern, not a new concept                                                                                  |
| **Notifications**     | Action subtype (`{ type: "notify" }`) + event bus for real-time push                                                           | Simple cases are Actions; complex cases (WebSocket push) are infrastructure                                                     |
| **i18n/Localization** | Model-level translatable field flag + View-level locale context                                                                | Field-level and view-level concern, not a separate primitive                                                                    |
| **Multi-tenancy**     | Data layer filter (every query scoped by tenant_id)                                                                            | Infrastructure constraint on the data layer, not a user-facing primitive                                                        |
| **Reporting**         | Dashboard View type + aggregation queries in data source interface. If this proves insufficient, promote to its own primitive. | Start as a View type. Odoo's pivot/graph views work for 80% of cases. Promote to separate primitive only if the 20% demands it. |

---

## Why This Works

Every business application — whether it manages products (PIM), media (DAM), content (CMS), customers (CRM), operations (ERP), or sales (POS) — is fundamentally the same thing:

**Records with fields, displayed in views, mutated by actions, organized by navigation.**

The only differences between a CRM and a DAM are:

- **Which models** (Contact vs Asset)
- **Which views** (Pipeline kanban vs Media gallery)
- **Which actions** (Log call vs Upload file)
- **Which navigation** (Sales pipeline vs Folder tree)

If you build excellent primitives for these concerns, you can assemble any of them.

---

## Layer 0: Xkin Core — `web-kit` (Exists)

The runtime foundation. Already built or planned. **This is the `xkin` object** that the studio plugin receives.

```
Xkin Core (web-kit package — the xkin object)
├── engine        Preact h/Fragment/render/renderToString
├── store         nanostores atom/computed/map
├── editor        Monaco Editor (code editing)
├── tools         Babel TSX, Prettier, Markdown, MDX
├── styles        Sass, CSS Modules
├── files         Virtual file system with Monaco models
├── workspace     Multi-workspace with persistence
├── keys          Keybinding manager
├── hooks         Action/filter hook system
├── plugins       Plugin registry with permissions, lifecycle, contributions
├── dnd           @dnd-kit/dom DnD (sections, blocks, palette)
└── commands      Command palette + contribution targets
```

Layer 0 knows **nothing** about studios, business domains, models, views, or actions. It provides reactive state (nanostores), rendering (Preact), code editing (Monaco), visual composition (DnD), and extensibility (plugins + hooks). The entire API surface is exposed through a single `Xkin` class — this is the object that plugins receive.

### The `xkin` Object Contract

Any plugin (including the studio) interacts with Xkin Core exclusively through this object:

```js
// What the xkin object exposes (from src/main.js)
xkin.store; // nanostores (atom, computed, map)
xkin.engine; // Preact (h, Fragment, render, renderToString)
xkin.plugins; // Plugin registry (register, activate, deactivate)
xkin.hooks; // Hook system (add, fire, has, list)
xkin.files; // File registry (create, open, close, save, delete)
xkin.workspace; // Workspace manager (open, save, list)
xkin.keys; // Keybinding manager (register, unregister)
xkin.ui; // UI slot manager (contribute to sidebar, toolbar, panels)
xkin.commands; // Command palette (register commands, run_command)
xkin.persistence; // Save/load state adapters
xkin.dnd; // DnD manager (sections, blocks, palette)
xkin.editor(opts); // Create Monaco editor instance
xkin.tsx(args); // Transpile TSX via Babel
xkin.format(args); // Format code via Prettier
xkin.markdown(args); // Render Markdown via Showdown
xkin.mdx(args); // Render MDX (Markdown + JSX)
xkin.sass(args); // Compile Sass
xkin.css_modules(args); // Process CSS Modules

// Reactive atoms (nanostores)
xkin.$workspace; // current workspace
xkin.$files; // virtual file system
xkin.$active_file; // currently focused file
xkin.$open_files; // open tabs
xkin.$file_tree; // computed tree structure
xkin.$is_dirty; // any file has unsaved changes
xkin.$dirty_files; // list of unsaved files
xkin.$document; // DnD page structure
xkin.$sections; // DnD section types
xkin.$selection; // DnD selection state
xkin.$drag_state; // DnD drag state
```

This is the **only** surface area that `xkin-studio` (or any plugin) touches. No reaching into internals, no direct module imports from `web-kit/src/*`.

---

## Layer 1: Code Studio (inside `xkin-studio`)

A browser-based IDE built entirely as sub-plugins of `xkin-studio`. This is where **developers** work — people who write code to create components, views, and App Studio extensions.

### What Code Studio Is

Think VS Code in the browser, but purpose-built for creating Xkin applications:

```
┌──────────────────────────────────────────────────────────────┐
│  [toolbar]  New | Save | Build | Preview | Deploy            │
├──────────┬───────────────────────────────┬───────────────────┤
│          │  [tabs] app.tsx | style.scss  │                   │
│ [side-   │  ┌───────────────────────┐    │ [side-            │
│  bar     │  │                       │    │  bar              │
│  left]   │  │    Monaco Editor      │    │  right]           │
│          │  │                       │    │                   │
│ Explorer │  │                       │    │ Properties        │
│ Search   │  └───────────────────────┘    │ Inspector         │
│ Plugins  │  ┌───────────────────────┐    │ Schema            │
│ DnD Page │  │  Preview / Console    │    │                   │
│ Builder  │  └───────────────────────┘    │                   │
├──────────┴───────────────────────────────┴───────────────────┤
│  [status_bar]  Workspace: my-app | JS | Ln 42 Col 8          │
└──────────────────────────────────────────────────────────────┘
```

### Code Studio = Sub-Plugins (all use `xkin` object)

Code Studio isn't a monolithic app — it's a **collection of sub-plugins** registered inside `xkin-studio`. Each sub-plugin receives the same `xkin` object and uses the standard plugin API. No special access.

```js
// xkin-studio/code-studio/index.js
export function register_code_studio(xkin, parent_ctx) {
  // Each part of Code Studio is a plugin — all use xkin object only
  xkin.plugins.register({
    id: "cs.explorer", // File tree sidebar
    permissions: ["ui", "files"],
    activate(ctx) {
      // Uses xkin.$files, xkin.$file_tree — standard reactive atoms
      const FileTree = create_file_tree(xkin);
      ctx.contribute("sidebar_left", {
        id: "cs.explorer",
        label: "Explorer",
        render: FileTree,
      });
    },
  });

  xkin.plugins.register({
    id: "cs.preview", // Live preview panel
    permissions: ["ui", "tools", "hooks"],
    activate(ctx) {
      // Uses xkin.tsx(), xkin.engine.render() — standard tool methods
      const Preview = create_preview(xkin);
      ctx.contribute("bottom_panel", {
        id: "cs.preview",
        label: "Preview",
        render: Preview,
      });
    },
  });

  xkin.plugins.register({
    id: "cs.page-builder", // DnD page builder mode
    permissions: ["ui", "hooks"],
    activate(ctx) {
      // Uses xkin.dnd, xkin.$document, xkin.$sections — standard DnD API
      const PageBuilder = create_page_builder(xkin);
      const PropertiesPanel = create_properties_panel(xkin);
      ctx.contribute("sidebar_left", {
        id: "cs.page-builder",
        label: "Page Builder",
        render: PageBuilder,
      });
      ctx.contribute("sidebar_right", {
        id: "cs.properties",
        label: "Properties",
        render: PropertiesPanel,
      });
    },
  });
}
```

**Key constraint:** Every `create_*` function receives `xkin` — the single object. Components build their UI with `xkin.engine` (Preact), read state from `xkin.$files` / `xkin.$document` (nanostores), and interact through `xkin.hooks` / `xkin.commands`. Zero direct imports from `web-kit/src/*`.

### Code Studio Capabilities

| Capability        | Powered by                            | Purpose                      |
| ----------------- | ------------------------------------- | ---------------------------- |
| Code editing      | Monaco + Xkin files/workspace         | Write JS/TS/TSX/SCSS         |
| Live preview      | Preact render + Babel TSX transform   | See components in real time  |
| Page building     | Xkin DnD (sections/blocks)            | Visually compose pages       |
| Component library | Plugin contribution targets           | Register reusable components |
| Build pipeline    | Xkin tools (TSX + Sass + CSS Modules) | Produce deployable output    |
| Theming           | Monaco themes + CSS variables         | Customize look and feel      |
| Persistence       | Xkin workspace + persistence adapters | Save/load/share projects     |

### What Developers Build with Code Studio

1. **Widgets** — Atomic UI components (inputs, buttons, tables, charts)
2. **View templates** — Layouts that render model data (list view, form view, kanban, gallery)
3. **Action handlers** — Functions that respond to events (save, delete, navigate, call API)
4. **App Studio extensions** — New model field types, view types, action types, validator functions

This is the escape hatch: anything App Studio can't express visually, a developer can code directly in Code Studio and register via `ctx.contribute()`.

---

## Layer 2: App Studio (inside `xkin-studio`)

A visual low-code builder for creating applications **without writing code**. Built inside `xkin-studio` as a set of sub-plugins that use the same `xkin` object. This is where **configurators** (power users, business analysts, citizen developers) work.

```js
// xkin-studio/app-studio/index.js
export function register_app_studio(xkin, parent_ctx) {
  const { atom, computed, map } = xkin.store;
  const { h, Fragment, render } = xkin.engine;

  // App Studio's own reactive state — built with xkin.store (nanostores)
  const $models = atom(new Map()); // Map<model_id, ModelDefinition>
  const $views = atom(new Map()); // Map<view_id, ViewDefinition>
  const $actions = atom(new Map()); // Map<action_id, ActionDefinition>
  const $menus = atom(new Map()); // Map<menu_id, MenuDefinition>
  const $widgets = atom(new Map()); // Map<widget_type, WidgetDefinition>
  const $data_sources = atom(new Map()); // Map<source_id, DataSourceAdapter>
  const $current_view = atom(null);
  const $current_record = atom(null);

  // Register App Studio sub-plugins — each uses xkin object only
  xkin.plugins.register({
    id: "as.model-editor",
    permissions: ["ui", "hooks"],
    activate(ctx) {
      const ModelEditor = create_model_editor(xkin, { $models });
      ctx.contribute("sidebar_left", {
        id: "as.models",
        label: "Models",
        render: ModelEditor,
      });
    },
  });

  xkin.plugins.register({
    id: "as.view-designer",
    permissions: ["ui", "hooks"],
    activate(ctx) {
      // Uses xkin.dnd for drag-and-drop field placement
      const ViewDesigner = create_view_designer(xkin, {
        $models,
        $views,
        $widgets,
      });
      ctx.contribute("editor_title", {
        id: "as.view-designer",
        label: "View Designer",
        render: ViewDesigner,
      });
    },
  });

  // ... more sub-plugins for action editor, menu editor, preview, etc.
}
```

### 2.1 Type System

The type system has **three layers**. Data types are the ground truth (from `data_types.json`). Field definitions add UI/domain concerns. Widgets render the result.

```
data_types.json          →  the actual type (validation, pattern, format, JSON wire type)
      ↓
field definition         →  references a data type + adds UI concerns (label, widget, options)
      ↓
widget                   →  renders the appropriate UI for that field
```

#### Data Types (from `data_types.json` — the backend contract)

These are the **real types** with standards, patterns, and JSON representations. They define what the data IS, not how it looks.

| Category      | Type        | Standard    | JSON      | Used for                              |
| ------------- | ----------- | ----------- | --------- | ------------------------------------- |
| **primitive** | `string`    | OpenAPI 3.0 | `string`  | Free text, names, titles              |
| **primitive** | `int32`     | OpenAPI 3.0 | `number`  | Counts, quantities, ages              |
| **primitive** | `int64`     | OpenAPI 3.0 | `string`  | Large IDs, timestamps                 |
| **primitive** | `float32`   | IEEE 754    | `number`  | Ratings, percentages, weights         |
| **primitive** | `float64`   | IEEE 754    | `string`  | Precise decimals, coordinates         |
| **primitive** | `boolean`   | JSON Schema | `boolean` | Flags, toggles                        |
| **primitive** | `void`      | JSON Schema | `null`    | Absence of value                      |
| **temporal**  | `date`      | ISO 8601    | `string`  | Birth date, due date                  |
| **temporal**  | `time`      | ISO 8601    | `string`  | Opening hours, schedule               |
| **temporal**  | `date_time` | RFC 3339    | `string`  | Created at, updated at                |
| **temporal**  | `timezone`  | IANA TZ DB  | `string`  | User timezone                         |
| **identity**  | `email`     | RFC 5322    | `string`  | Contact email                         |
| **identity**  | `phone`     | E.164       | `string`  | Contact phone                         |
| **identity**  | `uri`       | RFC 3986    | `string`  | Links, websites                       |
| **identity**  | `uuid`      | RFC 4122    | `string`  | Primary keys, references              |
| **identity**  | `hostname`  | RFC 1123    | `string`  | Server addresses                      |
| **identity**  | `ipv4`      | RFC 791     | `string`  | Network config                        |
| **identity**  | `ipv6`      | RFC 2460    | `string`  | Network config                        |
| **business**  | `money`     | ISO 4217    | `string`  | Prices, totals (int64 in minor units) |
| **business**  | `currency`  | ISO 4217    | `string`  | Currency codes (USD, EUR)             |
| **business**  | `country`   | ISO 3166-1  | `string`  | Country codes (US, DE)                |
| **business**  | `locale`    | BCP 47      | `string`  | Language tags (en-US)                 |
| **technical** | `file`      | OpenAPI 3.0 | `object`  | Uploaded files, media                 |
| **technical** | `secret`    | OpenAPI 3.0 | `string`  | Passwords, API keys                   |
| **technical** | `hex_color` | CSS Level 4 | `string`  | Theme colors, labels                  |
| **technical** | `base64`    | RFC 4648    | `string`  | Encoded binary data                   |
| **structure** | `object`    | JSON Schema | `object`  | Nested data, config, metadata         |
| **structure** | `array`     | JSON Schema | `array`   | Lists, collections                    |

#### GUI Field Types (App Studio layer — UI behavior on top of data types)

These are **not data types** — they are field-level concerns that control how a data type is presented and interacted with. They reference a data type and add widget behavior, options, and constraints.

| GUI Concern    | Underlying data type  | What it adds                                                                 | Example                    |
| -------------- | --------------------- | ---------------------------------------------------------------------------- | -------------------------- |
| `text`         | `string`              | Widget hint: use `textarea` or `rich_text` instead of single-line input      | Description, notes, body   |
| `select`       | `string` or `int32`   | Constrained `options` list, rendered as dropdown                             | Status, category, type     |
| `multi_select` | `array` (of `string`) | Constrained `options` list, rendered as multi-dropdown/chips                 | Roles, categories          |
| `tags`         | `array` (of `string`) | Free-form + autocomplete, rendered as tag input                              | Labels, keywords           |
| `relation`     | `uuid` or `int64`     | Foreign key — `target` model + `relation` type, rendered as record picker    | Folder, author, parent     |
| `computed`     | any                   | Not stored — `depends` + `compute` expression, rendered as read-only display | Thumbnail, total, is_image |

#### How it works in a field definition

```js
// The `type` is ALWAYS a real data type from data_types.json.
// GUI behavior is expressed through `widget`, `options`, `target`, `computed`, etc.

// Simple — data type alone determines the widget
{ type: "string",    label: "Name" }           // → text_input
{ type: "email",     label: "Email" }          // → email_input (auto from type)
{ type: "int32",     label: "Quantity" }        // → integer_input (step=1)
{ type: "float64",   label: "Weight (kg)" }     // → decimal_input
{ type: "boolean",   label: "Active" }          // → toggle
{ type: "date",      label: "Due Date" }        // → date_picker
{ type: "date_time", label: "Created" }         // → datetime_picker
{ type: "money",     label: "Price" }           // → currency_input
{ type: "hex_color", label: "Brand Color" }     // → color_picker
{ type: "file",      label: "Attachment" }      // → file_upload
{ type: "uri",       label: "Website" }         // → url_input
{ type: "phone",     label: "Phone" }           // → phone_input
{ type: "uuid",      label: "ID" }              // → read-only display
{ type: "secret",    label: "API Key" }         // → password_input (masked)
{ type: "object",    label: "Config" }          // → monaco_editor (JSON)
{ type: "country",   label: "Country" }         // → country_picker (ISO 3166 dropdown)
{ type: "currency",  label: "Currency" }        // → currency_code_picker (ISO 4217 dropdown)
{ type: "locale",    label: "Language" }        // → locale_picker (BCP 47 dropdown)
{ type: "timezone",  label: "Timezone" }        // → timezone_picker (IANA dropdown)

// GUI overrides — widget or behavior layered on top
{ type: "string",  label: "Description",  widget: "textarea" }           // long text
{ type: "string",  label: "Body",         widget: "rich_text" }          // rich text editor
{ type: "string",  label: "Status",       widget: "select",    options: ["draft", "review", "approved"] }
{ type: "int32",   label: "Priority",     widget: "select",    options: [1, 2, 3, 4, 5] }
{ type: "array",   label: "Tags",         widget: "tags",      items: { type: "string" } }
{ type: "array",   label: "Roles",        widget: "multi_select", options: ["admin", "editor", "viewer"] }
{ type: "uuid",    label: "Folder",       widget: "relation",  target: "folder", relation: "many_to_one" }
{ type: "uuid",    label: "Creator",      widget: "relation",  target: "user",   relation: "many_to_one" }
{ type: "int32",   label: "Rating",       widget: "star_rating" }        // custom widget
```

### 2.2 Model (Data Schema)

A Model defines an entity — its fields, types, validations, and relationships. Models are the single source of truth for data shape. Views read from models. Actions mutate model records.

```js
// Model definition — pure data, no code, always terminates (Axiom 3)
// Every `type` references a real data type from data_types.json
{
  id: "asset",
  label: "Asset",
  icon: "image",

  fields: {
    id:          { type: "uuid",      label: "ID",          readonly: true, auto: "uuid" },
    name:        { type: "string",    label: "Name",        required: true },
    description: { type: "string",    label: "Description", widget: "rich_text" },
    file_url:    { type: "file",      label: "File",        required: true, accept: "image/*,video/*,application/pdf" },
    file_type:   { type: "string",    label: "Type",        widget: "select", options: ["image", "video", "document", "audio"] },
    file_size:   { type: "int64",     label: "Size (bytes)", readonly: true },
    tags:        { type: "array",     label: "Tags",        widget: "tags", items: { type: "string" } },
    folder_id:   { type: "uuid",      label: "Folder",      widget: "relation", target: "folder", relation: "many_to_one" },
    created_by:  { type: "uuid",      label: "Creator",     widget: "relation", target: "user",   relation: "many_to_one", readonly: true },
    status:      { type: "string",    label: "Status",      widget: "select", options: ["draft", "review", "approved", "archived"], default: "draft" },
    created_at:  { type: "date_time", label: "Created",     readonly: true, auto: "create" },
    updated_at:  { type: "date_time", label: "Updated",     readonly: true, auto: "update" },
  },

  // Computed fields — pure expressions only, no side effects (Axiom 3)
  computed: {
    thumbnail: { type: "uri",     depends: ["file_url", "file_type"], compute: "thumbnail_from_url" },
    is_image:  { type: "boolean", depends: ["file_type"],             compute: "eq(file_type, 'image')" },
  },

  // Constraints
  constraints: {
    unique: ["name", "folder_id"],
  },

  // i18n — which fields are translatable
  translatable: ["name", "description"],
}
```

### 2.2 View (Display + Interaction)

A View defines **how** model records are displayed and interacted with. Views are declarative layouts that reference model fields. Views compose — a dashboard embeds list views, a form embeds relation pickers (Axiom 6).

**Seven view types** (the universal set):

#### List View

The data table. Every business app's primary view.

```js
{
  id: "asset-list",
  type: "list",
  model: "asset",
  label: "Assets",

  columns: [
    { field: "thumbnail", width: 60 },
    { field: "name", sortable: true, searchable: true },
    { field: "file_type", filterable: true },
    { field: "tags" },
    { field: "status", filterable: true },
    { field: "updated_at", sortable: true, format: "relative" },
  ],

  actions: ["create", "bulk_delete", "bulk_tag", "export"],
  default_sort: { field: "updated_at", direction: "desc" },
  on_row_click: { action: "navigate", view: "asset-form", params: { id: "$record.id" } },
  selectable: true,
}
```

#### Form View

The record editor. Auto-generated from model fields, customized via layout.

```js
{
  id: "asset-form",
  type: "form",
  model: "asset",
  label: "Asset",

  layout: [
    { group: "General", columns: 2, fields: [
      { field: "name", span: 2 },
      { field: "description", span: 2, widget: "rich_text" },
      { field: "file_url", span: 2, widget: "file_upload_preview" },
    ]},
    { group: "Classification", columns: 2, fields: [
      { field: "file_type" },
      { field: "status" },
      { field: "folder_id" },
      { field: "tags", span: 2 },
    ]},
    { group: "Metadata", columns: 3, collapsible: true, fields: [
      { field: "file_size", readonly: true },
      { field: "created_by", readonly: true },
      { field: "created_at", readonly: true },
      { field: "updated_at", readonly: true },
    ]},
  ],

  status_field: "status",
  status_colors: { draft: "gray", review: "yellow", approved: "green", archived: "red" },
  actions: ["save", "delete", "duplicate"],
}
```

#### Gallery View

Grid of visual cards. Essential for DAM, useful for PIM, CMS.

```js
{
  id: "asset-gallery",
  type: "gallery",
  model: "asset",
  label: "Media Library",

  card: {
    image: "thumbnail",
    title: "name",
    subtitle: "file_type",
    badge: "status",
  },

  sizes: ["small", "medium", "large"],
  default_size: "medium",
  sortable: true,
  droppable_targets: ["folder"],
}
```

#### Kanban View

Board with columns. Essential for CRM, useful for CMS editorial, PIM enrichment.

```js
{
  id: "asset-kanban",
  type: "kanban",
  model: "asset",
  label: "Asset Pipeline",

  group_by: "status",
  columns: [
    { value: "draft",    label: "Draft",    color: "gray" },
    { value: "review",   label: "In Review", color: "yellow" },
    { value: "approved", label: "Approved",  color: "green" },
    { value: "archived", label: "Archived",  color: "red" },
  ],

  card: {
    title: "name",
    image: "thumbnail",
    tags: "tags",
    footer: "updated_at",
  },
}
```

#### Tree View

Hierarchical navigation. Essential for DAM folders, PIM categories, CMS page trees.

```js
{
  id: "folder-tree",
  type: "tree",
  model: "folder",
  label: "Folders",

  parent_field: "parent_id",
  label_field: "name",
  icon_field: "icon",
  count: { model: "asset", foreign_key: "folder_id" },
  draggable: true,
  on_click: { action: "filter", view: "asset-list", params: { folder_id: "$record.id" } },
}
```

#### Dashboard View

KPI cards, charts, and summary widgets. Embeds other views (Axiom 6: composition).

```js
{
  id: "asset-dashboard",
  type: "dashboard",
  label: "Overview",

  widgets: [
    { type: "kpi",   label: "Total Assets",  query: "count(asset)" },
    { type: "kpi",   label: "Pending Review", query: "count(asset, status='review')", color: "yellow" },
    { type: "kpi",   label: "Approved",       query: "count(asset, status='approved')", color: "green" },
    { type: "chart", label: "By Type",        query: "group(asset, file_type)", chart: "pie" },
    { type: "chart", label: "Uploads / Week", query: "timeseries(asset, created_at, week)", chart: "bar" },
    { type: "list",  label: "Recent",         view: "asset-list", limit: 5, sort: "-created_at" },
  ],

  grid: "1fr 1fr 1fr / auto auto",
}
```

#### Calendar View

Time-based display. Useful for CMS publish scheduling, CRM activities, ERP deadlines.

```js
{
  id: "content-calendar",
  type: "calendar",
  model: "article",
  label: "Editorial Calendar",

  date_field: "publish_date",
  title_field: "title",
  color_field: "status",
  draggable: true,
}
```

### 2.3 Action (Behavior)

Actions define what happens on user interaction. They are single-step operations — the atom of behavior. Actions compose sequentially via `then` and conditionally via `if` (Axiom 6).

```js
// CRUD — built-in
{ type: "create" }
{ type: "save" }
{ type: "delete" }
{ type: "duplicate" }

// Navigation
{ type: "navigate", view: "asset-form", params: { id: "$record.id" } }
{ type: "back" }

// Filtering
{ type: "filter", view: "asset-list", params: { folder_id: "$record.id" } }

// Bulk
{ type: "bulk_update", fields: { status: "approved" } }
{ type: "bulk_delete" }

// API call
{ type: "api", method: "POST", url: "/api/assets/$record.id/process",
  on_success: { type: "reload" },
  on_error: { type: "notify", message: "Processing failed" } }

// Custom (escape hatch to Code Studio)
{ type: "custom", handler: "my_custom_action_function" }

// UI feedback
{ type: "notify", message: "Saved successfully", variant: "success" }
{ type: "confirm", message: "Delete this asset?", on_confirm: { type: "delete" } }
{ type: "modal", view: "tag-picker" }

// State transition (single step — NOT a workflow)
{ type: "transition", field: "status", from: "draft", to: "review",
  require: ["name", "file_url"],
  notify: ["reviewer_role"] }

// Composition — sequential (Axiom 6)
{ type: "sequence", steps: [
  { type: "save" },
  { type: "notify", message: "Saved!" },
  { type: "navigate", view: "asset-list" },
]}

// Composition — conditional (Axiom 6)
{ type: "if", condition: "$record.status === 'draft'",
  then: { type: "transition", field: "status", to: "review" },
  else: { type: "notify", message: "Already submitted", variant: "warning" } }
```

**Why Action is NOT Workflow:** An Action is a synchronous, single-step (or finite sequence of steps) operation that completes immediately. A Workflow is asynchronous, stateful, potentially long-running (days/weeks), with its own persistence. "Wait 3 days for manager approval, then escalate to director" is NOT an Action — it needs its own primitive (Phase 5+).

### 2.4 Menu (Navigation)

Menus organize views into a navigable application. A menu is a tree of entries. Menus compose recursively — a sub-menu is a menu (Axiom 6).

```js
{
  id: "dam-app",
  label: "Media Library",
  icon: "images",

  items: [
    { id: "dashboard", label: "Dashboard",  view: "asset-dashboard", icon: "layout-dashboard" },
    { id: "assets",    label: "All Assets",  view: "asset-list",      icon: "files" },
    { id: "gallery",   label: "Gallery",     view: "asset-gallery",   icon: "grid" },
    { id: "pipeline",  label: "Pipeline",    view: "asset-kanban",    icon: "columns" },
    { divider: true },
    { id: "folders",   label: "Folders",     view: "folder-tree",     icon: "folder" },
    { id: "tags",      label: "Tags",        view: "tag-list",        icon: "tags" },
    { divider: true },
    { id: "settings",  label: "Settings",    view: "dam-settings",    icon: "settings" },
  ],

  // Conditional visibility (Security integration point — Phase 4)
  // visibility: { "settings": { role: "admin" } },
}
```

---

### 2.5 Security (Phase 4 — designed in now, shipped later)

Security is a **cross-cutting concern** that touches every other primitive. We design the extension points now even though implementation ships later.

**Three levels:**

```js
// Level 1: Model-level — CRUD matrix per role
{
  id: "asset-access",
  model: "asset",
  rules: [
    { role: "viewer",  create: false, read: true,  update: false, delete: false },
    { role: "editor",  create: true,  read: true,  update: true,  delete: false },
    { role: "admin",   create: true,  read: true,  update: true,  delete: true },
  ],
}

// Level 2: Record-level — domain-based row filtering
{
  id: "asset-own-records",
  model: "asset",
  role: "editor",
  domain: "created_by === $user.id",   // editors see only their own assets
}

// Level 3: Field-level — visibility per role
{
  id: "asset-field-visibility",
  model: "asset",
  rules: {
    "internal_notes": { visible: ["admin"], editable: ["admin"] },
    "cost":           { visible: ["admin", "finance"], editable: ["finance"] },
  },
}
```

**How security integrates with each primitive:**

- **Model:** record-level filter applied to every data source query
- **View:** field-level visibility hides/disables fields based on role
- **Action:** action execution checks role permissions before running
- **Menu:** menu item visibility filtered by role

### 2.6 Workflow (Phase 5+ — designed in now, shipped when users need it)

A Workflow is a **stateful, multi-step, potentially long-running** process. It is NOT a sequence of Actions — it has its own persistence, timeouts, branching, and lifecycle.

```js
// Workflow definition
{
  id: "asset-approval",
  label: "Asset Approval",
  model: "asset",
  trigger: { type: "transition", field: "status", to: "review" },

  steps: [
    { id: "review",
      type: "approval",
      assignee: { role: "reviewer" },
      timeout: { days: 3, escalate_to: "manager" },
      on_approve: { next: "publish" },
      on_reject: { next: "revision", set: { status: "draft" } },
    },
    { id: "publish",
      type: "action",
      action: { type: "transition", field: "status", to: "approved" },
      then: "end",
    },
    { id: "revision",
      type: "notify",
      to: "$record.created_by",
      message: "Your asset was sent back for revision",
      then: "end",
    },
  ],
}
```

**Why this is separate from Action:** Workflows persist state in their own storage (`$workflow_instances` atom). An active workflow survives page refreshes, browser closes, and server restarts. Actions do not.

### 2.7 Connector (Phase 5+ — designed in now, shipped when users need it)

A Connector wraps an external API with managed authentication, retries, and data mapping.

```js
{
  id: "cloudinary",
  label: "Cloudinary",
  type: "rest",

  auth: {
    type: "api_key",
    fields: {
      cloud_name: { type: "string", required: true },
      api_key:    { type: "string", required: true },
      api_secret: { type: "string", required: true, secret: true },
    },
  },

  base_url: "https://api.cloudinary.com/v1_1/$auth.cloud_name",

  operations: {
    upload: {
      method: "POST",
      path: "/image/upload",
      params: { file: "file", upload_preset: "string?" },
      response: { url: "$.secure_url", public_id: "$.public_id" },
    },
    delete: {
      method: "POST",
      path: "/image/destroy",
      params: { public_id: "string" },
    },
  },

  retry: { max: 3, backoff: "exponential" },
  rate_limit: { requests: 500, per: "hour" },
}
```

---

## App Studio Visual Interface

App Studio itself is a set of sub-plugins inside `xkin-studio` that provide visual editors for the primitives. All use the `xkin` object exclusively:

```
┌──────────────────────────────────────────────────────────────┐
│  App Studio                                                  │
├──────────┬───────────────────────────────┬───────────────────┤
│          │                               │                   │
│ Models   │  ┌─────────────────────────┐  │ Field Properties  │
│ ─────    │  │                         │  │ ─────────────     │
│ • Asset  │  │   Visual Schema Editor  │  │ Label: ____       │
│ • Folder │  │                         │  │ Type:  [select]   │
│ • Tag    │  │   [name]     string  *  │  │ Required: [x]     │
│ • User   │  │   [desc]     text       │  │ Default: ____     │
│          │  │   [file_url] file    *  │  │ Validation: ____  │
│ Views    │  │   [status]   select     │  │                   │
│ ─────    │  │   [tags]     tags       │  │                   │
│ • List   │  │   [+ Add Field]         │  │                   │
│ • Form   │  │                         │  │                   │
│ • Gallery│  └─────────────────────────┘  │                   │
│ • Kanban │                               │                   │
│          │                               │                   │
│ Actions  │                               │                   │
│ Menus    │                               │                   │
├──────────┴───────────────────────────────┴───────────────────┤
│  Save | Preview | Export as Code | Deploy                    │
└──────────────────────────────────────────────────────────────┘
```

**Self-hosting test (Axiom 1):** App Studio's Model Editor is itself a View (form view editing a "model" model). The Model for "Model definitions" looks like:

```js
{
  id: "_model",      // meta-model
  label: "Model",
  fields: {
    id:     { type: "string", required: true },
    label:  { type: "string", required: true },
    icon:   { type: "string" },
    fields: { type: "json" },   // the field definitions themselves
  },
}
```

If this meta-model can be edited through the same form view that edits any other model, the abstraction is self-consistent.

### How App Studio Uses the DnD System

The DnD plan (plan-dnd.md) maps directly to App Studio's view designer:

| DnD Concept       | App Studio Usage                                                       |
| ----------------- | ---------------------------------------------------------------------- |
| **Section**       | A view layout group (e.g., "General", "Classification" in a form)      |
| **Block**         | A field widget placed inside a group                                   |
| **Palette**       | Available field types / widget types to drag onto the view             |
| **Constraints**   | Which field types are allowed in which view types                      |
| **Section types** | Layout section types (full-width, 2-column, 3-column, tabs)            |
| **Block types**   | Widget types (text input, select, file upload, relation picker, chart) |

---

## Data Layer

App Studio needs a data layer to connect models to actual storage. This is pluggable — the same app definition works with different backends (Axiom 4: separate definition from storage).

```js
// Data source interface — same contract regardless of backend
{
  // CRUD
  find(model, { filters, sort, limit, offset, page }),  // → { records, total, page?, pages? }
  find_one(model, id),                              // → Record | null
  create(model, data),                              // → Record
  update(model, id, data),                          // → Record
  delete(model, id),                                // → void

  // Aggregation (for dashboards and reporting)
  count(model, filters?),                           // → number
  group(model, field, filters?),                     // → { value, count }[]
  aggregate(model, field, op, filters?),             // → number

  // Reactive (for live updates)
  subscribe(model, filters?, callback),             // → Dispose
}

// Pagination: use `offset` OR `page` (not both)
//   offset-based:  { limit: 20, offset: 40 }         → skip 40, take 20
//   page-based:    { limit: 20, page: 3 }             → page 3 of 20-per-page
//
// Response always includes `total` for UI pagination controls.
// `page` and `pages` are included when page-based pagination is used.
//
// find("asset", { limit: 20, page: 2, sort: { field: "name", direction: "asc" } })
// → { records: [...], total: 243, page: 2, pages: 13 }
```

**Built-in adapters:**

| Adapter      | Storage       | Best for                            |
| ------------ | ------------- | ----------------------------------- |
| `memory`     | In-memory Map | Development, demos, prototyping     |
| `indexed_db` | IndexedDB     | Offline-first apps, larger datasets |
| `rest`       | REST API      | Connect to any backend              |
| `graphql`    | GraphQL API   | Connect to Hasura, Strapi, etc.     |

Each adapter implements the same interface. Switching from `memory` to `rest` requires zero view changes. The adapter generates actual typed storage (IndexedDB object stores, REST endpoints) from Model schemas — we do NOT stuff everything into a single JSON blob (Axiom 4).

---

## The Widget System

Widgets are the atomic UI components that views compose from. Each field type has a default widget, but views can override with alternatives.

### Widget Contract

```js
{
  type: "text_input",

  // Render for different contexts (Preact VNodes)
  render_edit(value, { field, record, on_change, h }),
  render_display(value, { field, record, h }),
  render_filter(value, { field, on_change, h }),

  // Optional
  validate(value, field),     // → string | null (error or null)
  parse(raw_value, field),    // → parsed value
  format(value, field),       // → display string
  default_value(field),       // → initial value
}
```

### Default Data Type → Widget Mapping

Widgets are resolved in two steps: first check `widget` override on the field, then fall back to the data type default.

#### By data type (automatic — no `widget` override needed)

| Data Type   | Edit Widget              | Display Widget             |
| ----------- | ------------------------ | -------------------------- |
| `string`    | `text_input`             | `text_display`             |
| `int32`     | `integer_input` (step=1) | `number_display`           |
| `int64`     | `integer_input` (step=1) | `number_display`           |
| `float32`   | `decimal_input`          | `number_display`           |
| `float64`   | `decimal_input`          | `number_display`           |
| `boolean`   | `toggle`                 | `badge` (yes/no)           |
| `date`      | `date_picker`            | `date_display`             |
| `time`      | `time_picker`            | `time_display`             |
| `date_time` | `datetime_picker`        | `relative_time`            |
| `timezone`  | `timezone_picker`        | `text_display`             |
| `email`     | `email_input`            | `email_link`               |
| `phone`     | `phone_input`            | `phone_link`               |
| `uri`       | `url_input`              | `link`                     |
| `uuid`      | `text_input` (readonly)  | `text_display` (truncated) |
| `money`     | `currency_input`         | `currency_display`         |
| `currency`  | `currency_code_picker`   | `badge`                    |
| `country`   | `country_picker`         | `flag_badge`               |
| `locale`    | `locale_picker`          | `text_display`             |
| `file`      | `file_upload`            | `file_preview`             |
| `secret`    | `password_input`         | `masked_display`           |
| `hex_color` | `color_picker`           | `color_swatch`             |
| `base64`    | `text_input` (readonly)  | `text_display` (truncated) |
| `object`    | `monaco_editor` (JSON)   | `json_preview`             |
| `array`     | `json_editor`            | `json_preview`             |

#### By `widget` override (explicit — set on the field definition)

| Widget Override | Compatible Types   | Edit Widget                | Display Widget             |
| --------------- | ------------------ | -------------------------- | -------------------------- |
| `textarea`      | `string`           | `textarea`                 | `text_display` (truncated) |
| `rich_text`     | `string`           | `rich_text_editor`         | `html_display`             |
| `select`        | `string`, `int32`  | `dropdown`                 | `badge` (colored)          |
| `multi_select`  | `array`            | `multi_dropdown`           | `chip_list`                |
| `tags`          | `array`            | `tag_input` (autocomplete) | `chip_list`                |
| `relation`      | `uuid`, `int64`    | `record_picker`            | `record_link`              |
| `star_rating`   | `int32`, `float32` | `star_rating`              | `star_display`             |

#### Computed fields

Computed fields use the display widget of their declared `type`, always in readonly mode.

### Registering Custom Widgets (Code Studio → App Studio)

```js
// Escape hatch: developer writes widget code in a plugin, configurator uses it visually.
// The plugin receives xkin — uses xkin.engine for Preact h().
function create_star_rating_plugin(xkin) {
  const { h } = xkin.engine;

  xkin.plugins.register({
    id: "widget.star-rating",
    permissions: ["tools"],
    activation: "on_load",
    activate(ctx) {
      ctx.contribute("widget", {
        type: "star_rating",
        field_types: ["int32", "float32"],

        render_edit(value, { on_change }) {
          return h(
            "div",
            { class: "star-rating" },
            [1, 2, 3, 4, 5].map((n) =>
              h(
                "span",
                {
                  class: n <= value ? "star filled" : "star",
                  onClick: () => on_change(n),
                },
                "★",
              ),
            ),
          );
        },

        render_display(value) {
          return h("span", null, "★".repeat(value) + "☆".repeat(5 - value));
        },
      });
    },
  });
}
```

**Note:** The widget plugin uses `xkin.engine` for `h()` and `ctx.contribute()` for registration — the same pattern every plugin follows. No special imports.

---

## Layer 3: Domain Apps (inside `xkin-studio` or standalone plugins)

Pre-configured App Studio instances. Each domain app is a **bundle of models + views + actions + menus** — a JSON configuration that can be loaded as a plugin receiving the `xkin` object.

```js
// A domain app is just a plugin that registers models/views/actions/menus
// It can live inside xkin-studio or as a completely separate package
function create_dam_app(xkin) {
  xkin.plugins.register({
    id: "app.dam",
    name: "Media Library",
    version: "1.0.0",
    permissions: ["ui", "hooks", "commands"],
    activation: "on_load",
    dependencies: { "as.model-editor": "*", "as.view-designer": "*" },

    activate(ctx) {
      // Load the DAM app definition (pure JSON — models, views, actions, menus)
      const app_def = load_dam_definition();
      // Register everything through the standard App Studio API
      register_app(xkin, app_def);
    },
  });
}
```

### Starting Point: DAM + CMS (Phase 6-7)

Phase 1 targets DAM and CMS because they share ~60% of primitives:

| Shared Primitive     | DAM                | CMS                 |
| -------------------- | ------------------ | ------------------- |
| Media gallery/grid   | Primary view       | Media library panel |
| File upload/preview  | Core feature       | Media management    |
| Folder/category tree | Folder navigation  | Page/category tree  |
| Tagging              | Asset tags         | Content tags        |
| Search + filters     | Asset search       | Entry search        |
| Status workflow      | Draft→Approved     | Draft→Published     |
| Version history      | Asset versions     | Entry revisions     |
| User permissions     | View/edit/download | View/edit/publish   |

**What makes CMS special:** Meta-modeling — users define content types (models) visually, then create entries (records) of those types. This is App Studio's model editor exposed as a CMS feature. The self-hosting loop in action (Axiom 1).

### Future Domains (Phase 8+)

| Domain  | Extends              | Key addition                                                         |
| ------- | -------------------- | -------------------------------------------------------------------- |
| **PIM** | CMS + DAM            | Product variants, attribute families, completeness scoring, channels |
| **CRM** | Base views + kanban  | Pipeline stages, activity timeline, email integration                |
| **ERP** | All views + Workflow | Multi-step document flows (quote→order→invoice→payment)              |
| **POS** | PIM products         | Touch-optimized grid, cart, payment, receipt                         |

---

## Reactive Architecture

Everything is nanostores atoms. Layer 0 atoms live on the `xkin` object. Layer 2 atoms are **created by `xkin-studio`** using `xkin.store` — they are local to the editor plugin, not part of Xkin Core.

```
Layer 0 atoms (Xkin Core — on the xkin object)
├── xkin.$workspace       current workspace
├── xkin.$files           virtual file system
├── xkin.$active_file     current editor file
├── xkin.$open_files      open tabs
├── xkin.$document        DnD page structure
├── xkin.$sections        registered section types
└── xkin.$selection       DnD selection state

Layer 2 atoms (App Studio — created inside xkin-studio using xkin.store)
├── $app_definition       the full app config
├── $models               Map<model_id, ModelDefinition>
├── $views                Map<view_id, ViewDefinition>
├── $actions              Map<action_id, ActionDefinition>
├── $menus                Map<menu_id, MenuDefinition>
├── $widgets              Map<widget_type, WidgetDefinition>
├── $data_sources         Map<source_id, DataSourceAdapter>
├── $current_view         active view being displayed
├── $current_record       record being edited (in form view)
├── $records              Map<model_id, Record[]> (cached query results)
├── $filters              active filters per view
└── $selection            selected records (for bulk actions)

// These are created with xkin.store.atom() — same API, owned by the plugin
const { atom, computed } = xkin.store;
const $models = atom(new Map());
const $active_model = computed($current_view, (view) => $models.get().get(view?.model));

Computed atoms (derived inside xkin-studio)
├── $active_model         model for current view
├── $visible_fields       fields visible in current view (respecting security)
├── $available_actions    actions available in current context
└── $nav_items            menu items for current user role
```

**Boundary:** Layer 0 atoms are provided. Layer 2 atoms are created. The editor plugin never mutates Layer 0 atoms directly — it goes through `xkin.files.create()`, `xkin.workspace.open()`, etc.

### Data Flow

```
User clicks "Approve" button in asset form view
       │
       ▼
Action definition: { type: "transition", field: "status", to: "approved" }
       │
       ▼
hooks.fire("action.before_transition", { model: "asset", record, field: "status", to: "approved" })
       │  ← plugins can validate, cancel, modify
       ▼
data_source.update("asset", record.id, { status: "approved" })
       │
       ▼
$records atom updates → all subscribed views re-render
       │
       ├──▶ List view: status badge changes color
       ├──▶ Kanban: card moves to "Approved" column
       └──▶ Dashboard: "Approved" count increments
       │
       ▼
hooks.fire("action.after_transition", { model: "asset", record, field: "status", to: "approved" })
       │  ← plugins notified (audit log, notifications, workflow triggers)
```

---

## Serialization & Portability

An App Studio application is fully serializable as JSON. The JSON is loaded by a plugin that receives `xkin`:

```js
// The app definition — pure JSON, no code
{
  version: "1.0",
  id: "my-dam",
  label: "Media Library",

  models: { /* all model definitions */ },
  views: { /* all view definitions */ },
  actions: { /* all action definitions */ },
  menus: { /* all menu definitions */ },

  // Optional extended primitives (when used)
  security: { /* role definitions, access rules */ },
  workflows: { /* workflow definitions */ },
  connectors: { /* integration configs (secrets redacted) */ },

  // Custom code references (plugins that also receive xkin)
  extensions: {
    widgets: ["star_rating", "file_preview_3d"],
    actions: ["custom_watermark"],
    validators: ["unique_slug"],
  },

  data_source: { type: "rest", base_url: "/api" },
}

// Loading an app definition — the plugin pattern
function load_app(xkin, app_json) {
  // Register models, views, actions, menus through xkin-studio's App Studio API
  // Each extension is itself a plugin that receives xkin
  for (const widget_id of app_json.extensions?.widgets || []) {
    xkin.plugins.activate(widget_id);  // widget plugins already registered, just activate
  }
}
```

This JSON can be saved, exported, imported, version-controlled in git, or deployed as a standalone app. The runtime only needs `xkin` (Layer 0) + `xkin-studio` (the plugin) to hydrate it.

---

## Implementation Phases

Ordered by "Worse is Better" (Axiom 2) — ship the smallest useful thing first, expand when users demand it.

### Phase 1: Model + Auto-Generated Views (the MVP)

**Goal:** Define a model, get a working CRUD app automatically. No Action or Menu primitives yet — defaults only.

- Model runtime (field validation, computed fields, constraints)
- Data source interface + memory adapter + IndexedDB adapter
- Widget registry + built-in widgets for all 18 field types
- **Auto-generated list view** from model (all fields as columns, default sort)
- **Auto-generated form view** from model (all fields in a single group)
- Default navigation (model list → click → form → back)
- Hook integration for all data operations
- Unit tests (vitest)

**What you can build after Phase 1:** Any single-model CRUD app. A contact list. An asset database. A product catalog. A tag manager. No visual builder yet — just JSON model definitions → working app.

### Phase 2: View Customization + Gallery + Kanban

**Goal:** Customize how data is displayed beyond the auto-generated defaults.

- Custom list view definitions (column selection, sort, filters, row click actions)
- Custom form view definitions (grouped fields, column layout, widget overrides)
- Gallery view renderer (card grid, size toggle)
- Kanban view renderer (grouped by select field, DnD card transfer via plan-dnd.md)
- View switcher (toggle between list/gallery/kanban for same model)
- Filter bar component (structured filters from model field types)

### Phase 3: Action + Menu + Tree + Dashboard

**Goal:** Custom behavior and navigation. The app becomes multi-page.

- Action primitive (CRUD, navigate, filter, bulk, API call, notify, confirm, sequence, conditional)
- Menu primitive (sidebar navigation with icons, dividers, sub-menus)
- Tree view renderer (hierarchical navigation, DnD reparent)
- Dashboard view renderer (KPI cards, embedded list views)
- Calendar view renderer
- Aggregation queries in data source interface
- Chart widget (bar, line, pie)

### Phase 4: Security + REST Adapter

**Goal:** Multi-user apps with permissions and real backend connectivity.

- Security rules (model-level CRUD matrix, record-level domain filters, field-level visibility)
- Role system ($current_user, role checking in views/actions/menus)
- REST data source adapter (connect to any backend)
- GraphQL data source adapter
- Audit trail (hook-based event log writing to an audit model)

### Phase 5: App Studio Visual Editors + Workflow + Connectors

**Goal:** The low-code builder UI. Non-developers can build apps.

- Model editor plugin (visual schema designer with DnD field reorder)
- View designer plugin (DnD layout builder — plan-dnd.md sections/blocks)
- Action editor plugin (event → action wiring)
- Menu editor plugin (tree editor with DnD)
- App preview plugin (live rendered app in panel)
- Export / import app definitions as JSON
- Workflow primitive (stateful, multi-step, long-running processes)
- Connector primitive (managed API integrations with auth, retry, rate limiting)
- Scheduler infrastructure (cron-like execution for actions/workflows)

### Phase 6: DAM Domain App

- DAM-specific models (Asset, Folder, Collection, Tag, Version)
- DAM-specific views (media gallery, upload dropzone, folder tree, asset detail with preview)
- DAM-specific actions (upload, tag, move, approve, download, share, version)
- DAM-specific widgets (file preview, thumbnail, upload progress)
- Cloudinary/S3 connector for file storage

### Phase 7: CMS Domain App

- CMS-specific models (ContentType, Entry, Page, Category)
- CMS meta-modeling (content type builder = model editor exposed to end users)
- CMS-specific actions (publish, schedule, localize, preview)
- Template rendering (entry data → Preact → HTML via renderToString)
- Multi-locale support (translatable fields, locale switcher)
- Auto-generated API (REST endpoints from content type definitions)

### Phase 8+: Additional Domains

- PIM → CRM → ERP → POS, each extending the shared primitive set

---

## Key Design Decisions

1. **The studio is a plugin, not the core.** The entire Studio Stack (`xkin-studio`) receives the `xkin` object as its only dependency. Xkin Core knows nothing about studios, models, views, or business logic. This keeps the core general-purpose and the studio replaceable/tree-shakeable. Same plugin contract as any third-party extension — no special privileges.

2. **Ship Model + View first, everything else later** (Axiom 2). Two primitives that auto-generate CRUD cover 80% of use cases. Resist the urge to build the complete algebra before shipping.

3. **Seven primitives total, not four** — Model, View, Action, Menu are the core. Security, Workflow, Connector are extended primitives that ship when users need them. Every platform that tried to avoid Workflow/Security as primitives eventually added them.

4. **Totality by construction** (Axiom 3). Model schemas are finite. View templates iterate over finite data. Actions are finite state machines. No general recursion in the visual layer. The escape hatch to full JS is the plugin system.

5. **Self-description as architecture test** (Axiom 1). App Studio's own editors must be describable using the same primitives they edit. If the model editor can't be expressed as a Model + View, the abstraction leaks.

6. **Separate definition, storage, and history** (Axiom 4). Model definitions are JSON documents (git-diffable). Model instances are generated storage (IndexedDB/REST). Model changes are hook events (auditable, undoable).

7. **Composition without special cases** (Axiom 6). Views embed Views. Actions compose sequentially and conditionally. Models reference Models. Menus contain Menus.

8. **The escape hatch is the product** (Axiom 5). Code Studio IS the escape hatch from App Studio. Every custom widget, action handler, and validator is a bridge between "what configurators can do visually" and "what developers can do with code."

9. **Reporting starts as a View type, may become its own primitive.** Dashboard View + aggregation queries handle 80% of reporting. If users demand pivot tables, cross-model joins, and drill-down — promote Reporting to its own primitive. Don't build it prematurely, but design the data source interface to support it.

---

## Known Risks

| Risk                                                                                      | Mitigation                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Inner Platform Effect** — rebuilding a worse database/UI framework/programming language | The litmus test: can a non-programmer build a useful app? If only programmers use it, we've built a worse programming language.            |
| **80/20 wall** — easy 80% then users hit a wall                                           | The escape hatch (Code Studio) IS the mitigation. Document where the wall is and make the transition smooth.                               |
| **Performance at scale** — 1M+ records, 100+ models                                       | Generate actual typed storage from schemas (IndexedDB object stores, SQL tables), not EAV. Data source adapters handle query optimization. |
| **Scope creep** — trying to build everything before shipping                              | Axiom 2 (Worse is Better). Phase 1 is Model + auto-generated Views. Ship that, get feedback, iterate.                                      |
| **Vendor lock-in** — users can't leave                                                    | App definitions are JSON. Views render to standard HTML via Preact. "Export as standalone HTML" is a Phase 5 feature.                      |
