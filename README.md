# Xkin

Browser-ready bundles for Monaco Editor, Babel, Prettier, SASS, CSSO, Terser & Showdown.

## Bundles

| Bundle   | Global       | Size    | Contents                             |
| -------- | ------------ | ------- | ------------------------------------ |
| `editor` | `XkinEditor` | ~23 MB  | Monaco Editor + workers              |
| `tools`  | `XkinTools`  | ~5.4 MB | Babel + Terser + Prettier + Showdown |
| `styles` | `XkinStyles` | ~4.4 MB | SASS + CSSO + CSS Modules            |
| `engine` | `XkinEngine` | ~50 KB  | Preact + preact-render-to-string     |
| `main`   | `Xkin`       | ~2.6 KB | Unified API + Nanostores             |

## Install

```bash
npm install xkin
```

## Build from Source

```bash
pnpm install
pnpm run build            # all bundles (sequential)
pnpm run build:editor     # monaco only
pnpm run build:tools      # babel + terser + prettier + showdown only
pnpm run build:styles     # sass + csso + css modules only
pnpm run build:engine     # preact only
pnpm run build:main       # unified Xkin API only
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

### Compiler

```js
Xkin.set_compiler({
  jsx: 2, // JsxEmit.React
  jsxFactory: "h",
  jsxFragmentFactory: "Fragment",
  target: 99, // ScriptTarget.ESNext
});
```

---

### Files (Virtual File System)

CRUD system for managing Monaco models as a virtual file system with cross-file imports, formatting, and merge support.

#### Create / Read / Update / Delete

```js
// Create a file (returns Monaco model)
Xkin.files.create("app.tsx", "const App = () => <div />;", { main: true });
Xkin.files.create(
  "utils.tsx",
  "export const add = (a: number, b: number) => a + b;",
);

// Read content as string
const source = Xkin.files.read("app.tsx");

// Update content
Xkin.files.update("app.tsx", "const App = () => <span />;");

// Delete file (disposes Monaco model)
Xkin.files.delete("utils.tsx");
```

#### List / Get / Rename

```js
// List all files
const entries = Xkin.files.list();
// => [{ name: "app.tsx", main: true, language: "typescript" }, ...]

// Get raw Monaco model (for editor.setModel)
const model = Xkin.files.get("app.tsx");
editor.setModel(model);

// Rename (preserves content + options)
Xkin.files.rename("utils.tsx", "helpers.tsx");
```

#### Merge

Merge all files into a single source string. Non-main files come first, main files last.

```js
const merged = Xkin.files.merge();
// With options:
const merged = Xkin.files.merge({ strip_imports: true, separator: "\n\n" });
```

#### Format

Format files with Prettier (auto-detects parser from extension).

```js
await Xkin.files.format("app.tsx");
await Xkin.files.format("app.tsx", { tabWidth: 4, singleQuote: true });

// Format all files
await Xkin.files.format_all();
```

#### Clear / Subscribe

```js
Xkin.files.clear(); // delete all files

// Subscribe to file changes (nanostores)
Xkin.$files.subscribe((files) => console.log("Files:", files.length));
```

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
