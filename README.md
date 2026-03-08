# Xkin

Browser-ready bundles for Monaco Editor, Babel, Prettier, SASS, CSSO, Terser & Showdown.

## Install

```bash
npm install xkin
```

## Usage

```html
<script src="dist/xkin.editor.min.js"></script>
<script src="dist/xkin.tools.min.js"></script>
<script src="dist/xkin.styles.min.js"></script>
<script src="dist/xkin.engine.min.js"></script>
<script src="dist/xkin.min.js"></script>
```

---

## API Reference

All methods use `snake_case`.

### Editor

Creates a Monaco editor with sensible defaults (vs-dark, JSX/TSX enabled, no minimap).

```js
const editor = Xkin.editor({
  element: document.getElementById("container"),
  value: "console.log('hello');",
  language: "typescript",
  theme: "vs-dark",
  read_only: false,
  minimap: false,
  font_size: 14,
});
```

```js
Xkin.set_theme("vs");
Xkin.set_language(editor.getModel(), "javascript");
```

### Types

Inject global `.d.ts` type declarations into Monaco's TypeScript/JavaScript language service.

```js
Xkin.add_types([
  { path: "globals.d.ts", content: "declare const $router: Router;" },
  { path: "preact.d.ts", content: "declare function h(tag: any, ...args: any[]): any;" },
]);

Xkin.set_types([...]); // replace all
Xkin.get_types();      // read current

// Subscribe (nanostores)
Xkin.$types.subscribe((libs) => console.log("Types:", libs.length));
```

#### Xkin Autocompletion

A self-contained `xkin.d.ts` is included in `dist/`. Inject it so users get autocompletion for the `Xkin` API inside the editor:

```js
const types = await fetch("dist/xkin.d.ts").then((r) => r.text());
Xkin.add_types([{ path: "xkin.d.ts", content: types }]);
```

### Compiler

Configure TypeScript compiler options. Enum values accept readable strings or numeric values.

```js
Xkin.set_compiler({
  jsx: "React",
  jsxFactory: "h",
  jsxFragmentFactory: "Fragment",
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "NodeJs",
});
```

String values map to Monaco's TypeScript enums:

| Option             | Accepted strings                                                                     |
| ------------------ | ------------------------------------------------------------------------------------ |
| `jsx`              | `"None"`, `"Preserve"`, `"React"`, `"ReactNative"`, `"ReactJSX"`, `"ReactJSXDev"`   |
| `target`           | `"ES3"`, `"ES5"`, `"ES2015"` – `"ES2022"`, `"ESNext"`                               |
| `module`           | `"None"`, `"CommonJS"`, `"AMD"`, `"UMD"`, `"System"`, `"ES2015"`, `"ESNext"`, etc.   |
| `moduleResolution` | `"Classic"`, `"NodeJs"`, `"Node16"`, `"NodeNext"`, `"Bundler"`                       |

---

### Workspace

Project container management. Create, switch, snapshot, and persist entire workspaces.

```js
// Create a workspace (activates it by default)
Xkin.workspace.create("project-1", { name: "My Project" });

// Create without activating
Xkin.workspace.create("project-2", { name: "Other", activate: false });

// Switch between workspaces (snapshots current, restores target)
await Xkin.workspace.switch("project-2");

// Current workspace
Xkin.workspace.current(); // => { id, name, created_at, updated_at, meta }

// List all workspaces
const workspaces = await Xkin.workspace.list();

// Update metadata
Xkin.workspace.update("project-1", { name: "Renamed", meta: { version: 2 } });

// Delete a workspace
await Xkin.workspace.delete("project-2");
```

#### Snapshots

Capture and restore the complete workspace state (files, view states, open tabs).

```js
const snap = Xkin.workspace.snapshot();
// => { workspace, files, entries, view_states, active_file, open_files }

await Xkin.workspace.mount(snap); // restore from snapshot
```

#### Import / Export

```js
// Export workspace as a flat { path: content } map
const json = Xkin.workspace.to_json();

// Import from a file map
await Xkin.workspace.from_json(
  "imported",
  {
    "/src/App.tsx": "const App = () => <div />;",
    "/src/index.ts": "export { App } from './App';",
  },
  { name: "Imported Project" },
);
```

#### Persistence

```js
// Set up persistence (localStorage, IndexedDB, or remote)
Xkin.workspace.set_persistence(
  Xkin.persistence.local_storage({ prefix: "my_app" }),
);

// Save current workspace
await Xkin.workspace.save();

// Other adapters
Xkin.persistence.indexed_db({ db_name: "my_app" });
Xkin.persistence.remote({
  base_url: "/api",
  headers: { Authorization: "..." },
});
```

#### Format on Save

Automatically format dirty files before any save (manual or auto-save).

```js
// Enable — all dirty files get formatted before saving
Xkin.workspace.set_format_on_save(true);

// Check current setting
Xkin.workspace.get_format_on_save(); // => true

// Disable
Xkin.workspace.set_format_on_save(false);
```

#### Auto-Save

Automatically save dirty files on an interval. Only triggers when files are dirty, marks them clean after saving, and guards against overlapping saves.

```js
// Auto-save every 30 seconds (default) using the persistence adapter
const stop = Xkin.workspace.auto_save();

// Custom interval and callback
const stop = Xkin.workspace.auto_save({
  interval: 60_000, // every 60 seconds
  on_save: async (ws) => {
    console.log("Saving workspace:", ws.current()?.name);
  },
});

// Stop auto-saving
stop();
```

#### Events

```js
Xkin.workspace.on("switch", ({ workspace }) => {
  console.log("Switched to:", workspace.name);
});
// event types: "create" | "switch" | "mount" | "delete" | "auto_save" | "*"
```

#### Reactive Store

```js
Xkin.$workspace.subscribe((ws) => console.log("Workspace:", ws?.name));
```

---

### Files (Virtual File System)

CRUD operations within the active workspace. Paths support directories (e.g. `"/src/App.tsx"`). All edits use `pushEditOperations` to preserve undo/redo history.

#### Create / Read / Update / Delete

```js
// Create a file (returns Monaco model)
Xkin.files.create("/src/App.tsx", "const App = () => <div />;", { main: true });
Xkin.files.create(
  "/src/utils.ts",
  "export const add = (a: number, b: number) => a + b;",
);

// Read content as string
const source = Xkin.files.read("/src/App.tsx");

// Update content (undo-safe)
Xkin.files.update("/src/App.tsx", "const App = () => <span />;");

// Delete file (disposes Monaco model)
Xkin.files.delete("/src/utils.ts");
```

#### Get / Entry / Meta

```js
// Get raw Monaco model
const model = Xkin.files.get("/src/App.tsx");

// Get file entry (metadata)
const entry = Xkin.files.entry("/src/App.tsx");
// => { path, language, main, dirty, created_at, updated_at, meta }

// Update metadata
Xkin.files.set_meta("/src/App.tsx", { description: "Main component" });
```

#### Rename / Move

```js
Xkin.files.rename("/src/utils.ts", "/src/helpers.ts");
Xkin.files.move("/src/old.ts", "/lib/new.ts"); // alias for rename
```

#### Directory Operations

Derived from the flat path list — no real directories to manage.

```js
// List files (optionally filtered by directory and depth)
Xkin.files.list(); // all files
Xkin.files.list("/src"); // files under /src
Xkin.files.list("/src", { depth: 1 }); // direct children only

// List directories
Xkin.files.dirs(); // => ["/src", "/src/components", ...]
Xkin.files.dirs("/src"); // => ["/src/components"]

// Delete/rename entire directories
Xkin.files.delete_dir("/src/old");
Xkin.files.rename_dir("/src/old", "/src/new");
```

#### Dirty Tracking

```js
Xkin.files.is_dirty("/src/App.tsx"); // => true/false
Xkin.files.mark_clean("/src/App.tsx");
Xkin.files.mark_all_clean();

// Reactive stores
Xkin.$is_dirty.get(); // => boolean (any file dirty?)
Xkin.$dirty_files.get(); // => FileEntry[]
```

#### View State (Cursor / Scroll Preservation)

```js
// Save before switching files
Xkin.files.save_view_state("/src/App.tsx", editor);

// Restore when switching back
Xkin.files.restore_view_state("/src/App.tsx", editor);
```

#### Tabs (Editor State)

```js
// Set active file (saves previous view state, sets model, restores view state)
Xkin.files.set_active("/src/App.tsx", editor);

// Open/close tabs
Xkin.files.open("/src/App.tsx");
Xkin.files.close("/src/App.tsx", editor);

// Reactive stores
Xkin.$active_file.get(); // => "/src/App.tsx" | null
Xkin.$open_files.get(); // => ["/src/App.tsx", "/src/index.ts"]
Xkin.$active_entry.get(); // => FileEntry | null
```

#### Merge

Merge all files into a single source string. Non-main files come first, main files last.

```js
const merged = Xkin.files.merge();
const merged = Xkin.files.merge({
  strip_imports: true,
  separator: "\n\n",
  filter: (entry) => entry.path.endsWith(".ts"),
});
```

#### Format

Format files with Prettier (undo-safe — Ctrl+Z reverts the format).

```js
await Xkin.files.format("/src/App.tsx");
await Xkin.files.format("/src/App.tsx", { tabWidth: 4, singleQuote: true });

// Format all files
await Xkin.files.format_all();
await Xkin.files.format_all({}, { filter: (e) => e.language === "typescript" });
```

#### Events

```js
Xkin.files.on("create", ({ path, entry }) => console.log("Created:", path));
Xkin.files.on("update", ({ path }) => console.log("Updated:", path));
Xkin.files.on("delete", ({ path }) => console.log("Deleted:", path));
Xkin.files.on("rename", ({ old_path, new_path }) =>
  console.log("Renamed:", old_path, "->", new_path),
);
Xkin.files.on("*", (event) => console.log("Any event:", event));
```

#### Clear / File Tree

```js
Xkin.files.clear(); // delete all files

// Nested tree structure for UI (computed from flat file list)
Xkin.$file_tree.get();
// => [{ name: "src", type: "directory", children: [...] }, { name: "README.md", type: "file", entry }]
```

#### Reactive Stores

```js
Xkin.$files.subscribe((files) => console.log("Files:", files.length));
Xkin.$file_tree.subscribe((tree) => render_tree(tree));
Xkin.$is_dirty.subscribe((dirty) => update_save_button(dirty));
```

---

### Keys (Keybindings)

Register keyboard shortcuts with human-readable strings. `ctrl` auto-maps to `Cmd` on macOS.

```js
const editor = Xkin.editor({ element: container });

// Register a keybinding
Xkin.keys.add({
  id: "save",
  label: "Save File",
  keys: "ctrl+s",
  when: "editorTextFocus",
  run: () => Xkin.workspace.save(),
});

// Register multiple at once (returns single dispose)
const dispose = Xkin.keys.add_all([
  { id: "save", keys: "ctrl+s", run: () => Xkin.workspace.save() },
  {
    id: "format",
    keys: "shift+alt+f",
    run: () => Xkin.files.format(Xkin.$active_file.get()),
  },
  { id: "build", keys: "ctrl+shift+b", run: () => build_project() },
  {
    id: "close",
    keys: "ctrl+w",
    run: (ed) => Xkin.files.close(Xkin.$active_file.get(), ed),
  },
]);

// Remove / override
Xkin.keys.remove("save");
Xkin.keys.override("save", { keys: "ctrl+shift+s", run: save_as });

// Disable a built-in Monaco keybinding
Xkin.keys.unbind("editor.action.addSelectionToNextFindMatch"); // Ctrl+D

// List all registered
Xkin.keys.list();
```

#### Chords

Two-step shortcuts (like VS Code's `Ctrl+K Ctrl+C`):

```js
Xkin.keys.add({
  id: "toggle_comment",
  keys: "ctrl+k ctrl+c",
  run: on_toggle_comment,
});
```

#### Context Keys

Custom conditions for `when` clauses:

```js
const is_preview = Xkin.keys.context("is_preview_mode", false);
is_preview.set(true);

Xkin.keys.add({
  id: "exit_preview",
  keys: "escape",
  when: "is_preview_mode",
  run: () => {
    is_preview.set(false);
    exit_preview();
  },
});
```

#### Key String Format

| String            | Result                    |
| ----------------- | ------------------------- |
| `"ctrl+s"`        | Ctrl/Cmd + S              |
| `"shift+alt+f"`   | Shift + Alt + F           |
| `"ctrl+shift+k"`  | Ctrl/Cmd + Shift + K      |
| `"ctrl+k ctrl+c"` | Chord: Ctrl+K then Ctrl+C |
| `"escape"`        | Escape                    |
| `"f5"`            | F5                        |
| `"winctrl+s"`     | Ctrl (not Cmd) on macOS   |

---

### Tools

#### tsx

Transform TypeScript/JSX to JavaScript via Babel.

```js
const { code } = await Xkin.tsx({
  source: "const App = () => <div>Hello</div>;",
  compress: true,
  mangle: true,
});
```

#### format

Format code with Prettier.

```js
const formatted = await Xkin.format({
  source: "const x=1;const y=2;",
  parser: "babel",
  tabWidth: 2,
  printWidth: 80,
  semi: true,
  singleQuote: false,
});
```

<details>
<summary>Prettier Parsers</summary>

| Parser           | Languages              |
| ---------------- | ---------------------- |
| `babel`          | JavaScript, JSX        |
| `babel-ts`       | TypeScript, TSX        |
| `typescript`     | TypeScript (native)    |
| `css`            | CSS                    |
| `scss`           | SCSS                   |
| `less`           | Less                   |
| `html`           | HTML                   |
| `vue`            | Vue SFC                |
| `angular`        | Angular templates      |
| `markdown`       | Markdown               |
| `mdx`            | MDX                    |
| `graphql`        | GraphQL                |
| `yaml`           | YAML                   |
| `json`           | JSON                   |
| `json-stringify` | JSON (stringify style) |

</details>

#### markdown

Convert Markdown to HTML via Showdown.

```js
const html = Xkin.markdown({
  source: "# Hello\n\nThis is **bold** text.",
  options: { tables: true, ghCodeBlocks: true },
});
```

---

### Styles

#### sass

Compile SCSS to CSS (optionally minified with CSSO).

```js
const { css } = await Xkin.sass({
  source: "$color: red; .box { color: $color; }",
  compressed: true,
});
```

#### css_modules

Scope CSS class names (accepts SCSS input). Uses FNV-1a hashing with `__` separator.

```js
const { css, tokens } = await Xkin.css_modules({
  source: "$color: red; .title { color: $color; }",
  namespace: "app",
  idSize: 8,
});
// tokens => { title: "app__title__a1b2c3d4" }
```

---

### Engine

Access the Preact runtime.

```js
const { h, render } = Xkin.engine;
```

### Store

Re-exported [Nanostores](https://github.com/nanostores/nanostores) for reactive state.

```js
const { atom, computed } = Xkin.store;
const $count = atom(0);
```

## License

MIT
