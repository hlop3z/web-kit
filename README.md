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

#### set_content

Update editor content without losing undo history (e.g. after formatting).

```js
const formatted = await Xkin.format({ source: editor.getValue() });
Xkin.set_content(editor, formatted);
// Ctrl+Z still works
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

| Option             | Accepted strings                                                                   |
| ------------------ | ---------------------------------------------------------------------------------- |
| `jsx`              | `"None"`, `"Preserve"`, `"React"`, `"ReactNative"`, `"ReactJSX"`, `"ReactJSXDev"`  |
| `target`           | `"ES3"`, `"ES5"`, `"ES2015"` – `"ES2022"`, `"ESNext"`                              |
| `module`           | `"None"`, `"CommonJS"`, `"AMD"`, `"UMD"`, `"System"`, `"ES2015"`, `"ESNext"`, etc. |
| `moduleResolution` | `"Classic"`, `"NodeJs"`, `"Node16"`, `"NodeNext"`, `"Bundler"`                     |

---

### Models

Low-level Monaco model management (virtual file URIs).

```js
Xkin.create_model(
  "/lib/utils.ts",
  "export const add = (a: number, b: number) => a + b;",
);
Xkin.get_model("/lib/utils.ts");
Xkin.delete_model("/lib/utils.ts");
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
