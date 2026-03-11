import * as nano from "nanostores";
import { atom } from "nanostores";
import {
  create_file_registry,
  $workspace,
  $files,
  $active_file,
  $open_files,
  $file_tree,
  $is_dirty,
  $dirty_files,
  $active_entry,
} from "./files.js";
import { create_workspace_manager } from "./workspace.js";
import persistence from "./persistence.js";
import { create_keys_manager } from "./keys.js";
import { create_hook_system } from "./hooks.js";
import { create_plugin_registry } from "./plugins.js";
import { register_contribution_handlers } from "./contributions.js";
import { create_ui_slot_manager } from "./ui_slots.js";
import { create_dnd, $document, $sections, $selection, $drag_state } from "./dnd.js";

const get_editor = () => globalThis.XkinEditor;
const get_tools = () => globalThis.XkinTools;
const get_styles = () => globalThis.XkinStyles;
const get_engine = () => globalThis.XkinEngine;

const $types = atom([]);

const to_file_uri = (p) => {
  if (p.startsWith("file:///")) return p;
  if (p.includes(":")) return p;
  return `file:///${p.replace(/^\/+/, "")}`;
};

const sync_types = (libs) => {
  const monaco = get_editor();
  if (!monaco) return;

  const mapped = libs.map(({ path, content }) => ({
    filePath: to_file_uri(path),
    content,
  }));

  monaco.languages.typescript.typescriptDefaults.setExtraLibs(mapped);
  monaco.languages.typescript.javascriptDefaults.setExtraLibs(mapped);

  for (const { filePath, content } of mapped) {
    const uri = monaco.Uri.parse(filePath);
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      existing.setValue(content);
    } else {
      monaco.editor.createModel(content, "typescript", uri);
    }
  }
};

/* ── Initialize modules ───────────────────────────── */

const hook_system = create_hook_system();
const file_registry = create_file_registry(hook_system);
const workspace_manager = create_workspace_manager(file_registry, hook_system);
const keys_manager = create_keys_manager();
const ui_slot_manager = create_ui_slot_manager();
const plugin_registry = create_plugin_registry(hook_system, ui_slot_manager);
const contribution_targets = register_contribution_handlers(plugin_registry, keys_manager, hook_system, ui_slot_manager);
const dnd_manager = create_dnd(hook_system, plugin_registry);

/* ── Lazy on_language activation via file hooks ────── */

const LANG_EXT_MAP = {
  ".js": "javascript", ".jsx": "javascript", ".mjs": "javascript",
  ".ts": "typescript", ".tsx": "typescript",
  ".css": "css", ".scss": "scss", ".sass": "scss",
  ".html": "html", ".htm": "html",
  ".json": "json", ".md": "markdown", ".py": "python",
  ".rs": "rust", ".go": "go", ".java": "java",
  ".rb": "ruby", ".php": "php", ".c": "c", ".cpp": "cpp",
  ".yaml": "yaml", ".yml": "yaml", ".toml": "toml",
  ".xml": "xml", ".svg": "svg", ".sql": "sql",
};

const detect_language = (path) => {
  if (!path) return null;
  const dot = path.lastIndexOf(".");
  if (dot < 0) return null;
  return LANG_EXT_MAP[path.slice(dot).toLowerCase()] || null;
};

hook_system.add("file.after_create", (file) => {
  const lang = detect_language(file?.path);
  if (lang) plugin_registry.trigger_activation("on_language", lang);
}, 100); // Low priority — runs after other hooks

/* ── JSX Monarch Tokenizer ───────────────────────── */

const _register_jsx_tokenizer = (monaco) => {
  // Build a tokenizer that extends the default TypeScript one with JSX states.
  // Based on Monaco's built-in TS tokenizer + JSX tag/attribute/expression rules.

  const keywords = [
    "abstract", "any", "as", "asserts", "bigint", "boolean", "break", "case",
    "catch", "class", "continue", "const", "constructor", "debugger", "declare",
    "default", "delete", "do", "else", "enum", "export", "extends", "false",
    "finally", "for", "from", "function", "get", "if", "implements", "import",
    "in", "infer", "instanceof", "interface", "is", "keyof", "let", "module",
    "namespace", "never", "new", "null", "number", "object", "out", "package",
    "private", "protected", "public", "override", "readonly", "require", "global",
    "return", "satisfies", "set", "static", "string", "super", "switch", "symbol",
    "this", "throw", "true", "try", "type", "typeof", "undefined", "unique",
    "unknown", "var", "void", "while", "with", "yield", "async", "await", "of",
  ];

  const jsxLang = {
    defaultToken: "invalid",
    tokenPostfix: ".ts",
    keywords,
    operators: [
      "<=", ">=", "==", "!=", "===", "!==", "=>", "+", "-", "**", "*", "/",
      "%", "++", "--", "<<", "</", ">>", ">>>", "&", "|", "^", "!", "~",
      "&&", "||", "??", "?", ":", "=", "+=", "-=", "*=", "**=", "/=", "%=",
      "<<=", ">>=", ">>>=", "&=", "|=", "^=", "@",
    ],
    symbols: /[=><!~?:&|+\-*\/\^%]+/,
    escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
    digits: /\d+(_+\d+)*/,
    octaldigits: /[0-7]+(_+[0-7]+)*/,
    binarydigits: /[0-1]+(_+[0-1]+)*/,
    hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,
    regexpctl: /[(){}\[\]\$\^|\-*+?\.]/,
    regexpesc: /\\(?:[bBdDfnrstvwWn0\\\/]|@regexpctl|c[A-Z]|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/,

    tokenizer: {
      root: [[/[{}]/, "delimiter.bracket"], { include: "common" }],

      common: [
        // JSX: self-closing tag  <Component />  or  <div />
        [/(<)([\w$.-]+)(\s*)(\/)(>)/, ["delimiter", "tag", "", "delimiter", "delimiter"]],
        // JSX: opening tag start  <Component  or  <div
        [/(<)([\w$.-]+)/, ["delimiter", { token: "tag", next: "@jsxTag" }]],
        // JSX: closing tag  </Component>  or  </div>
        [/(<\/)([\w$.-]+)(\s*)(>)/, ["delimiter", "tag", "", "delimiter"]],

        // identifiers and keywords
        [/#?[a-z_$][\w$]*/, { cases: { "@keywords": "keyword", "@default": "identifier" } }],
        [/[A-Z][\w\$]*/, "type.identifier"],
        { include: "@whitespace" },
        // regexp
        [/\/(?=([^\\\/]|\\.)+\/([dgimsuy]*)(\s*)(\.|;|,|\)|\]|\}|$))/, { token: "regexp", bracket: "@open", next: "@regexp" }],
        // delimiters and operators
        [/[()\[\]]/, "@brackets"],
        [/[<>](?!@symbols)/, "@brackets"],
        [/!(?=([^=]|$))/, "delimiter"],
        [/@symbols/, { cases: { "@operators": "delimiter", "@default": "" } }],
        // numbers
        [/(@digits)[eE]([\-+]?(@digits))?/, "number.float"],
        [/(@digits)\.(@digits)([eE][\-+]?(@digits))?/, "number.float"],
        [/0[xX](@hexdigits)n?/, "number.hex"],
        [/0[oO]?(@octaldigits)n?/, "number.octal"],
        [/0[bB](@binarydigits)n?/, "number.binary"],
        [/(@digits)n?/, "number"],
        [/[;,.]/, "delimiter"],
        // strings
        [/"([^"\\]|\\.)*$/, "string.invalid"],
        [/'([^'\\]|\\.)*$/, "string.invalid"],
        [/"/, "string", "@string_double"],
        [/'/, "string", "@string_single"],
        [/`/, "string", "@string_backtick"],
      ],

      // JSX tag attributes:  <div className="foo" onClick={handler}>
      jsxTag: [
        [/\s+/, ""],
        [/([\w$.-]+)(\s*)(=)/, ["attribute.name", "", "delimiter"]],
        [/"[^"]*"/, "attribute.value"],
        [/'[^']*'/, "attribute.value"],
        [/\{/, { token: "delimiter.bracket", next: "@jsxExpr" }],
        [/\/\s*>/, { token: "delimiter", next: "@pop" }],          // self-close
        [/>/, { token: "delimiter", next: "@jsxContent" }],         // open → content
        [/[\w$.-]+/, "attribute.name"],
      ],

      // JSX expression:  {expression}
      jsxExpr: [
        [/\{/, "delimiter.bracket", "@jsxExpr"],
        [/\}/, "delimiter.bracket", "@pop"],
        { include: "common" },
      ],

      // JSX content between tags:  <div>...content...</div>
      jsxContent: [
        // Nested opening tag
        [/(<)([\w$.-]+)/, ["delimiter", { token: "tag", next: "@jsxTag" }]],
        // Closing tag — pop back out
        [/(<\/)([\w$.-]+)(\s*)(>)/, ["delimiter", "tag", "", { token: "delimiter", next: "@pop" }]],
        // Expression in content  {expr}
        [/\{/, { token: "delimiter.bracket", next: "@jsxExpr" }],
        // Text content
        [/[^<{]+/, ""],
      ],

      whitespace: [
        [/[ \t\r\n]+/, ""],
        [/\/\*\*(?!\/)/, "comment.doc", "@jsdoc"],
        [/\/\*/, "comment", "@comment"],
        [/\/\/.*$/, "comment"],
      ],
      comment: [
        [/[^\/*]+/, "comment"],
        [/\*\//, "comment", "@pop"],
        [/[\/*]/, "comment"],
      ],
      jsdoc: [
        [/[^\/*]+/, "comment.doc"],
        [/\*\//, "comment.doc", "@pop"],
        [/[\/*]/, "comment.doc"],
      ],
      regexp: [
        [/(\{)(\d+(?:,\d*)?)(\})/, ["regexp.escape.control", "regexp.escape.control", "regexp.escape.control"]],
        [/(\[)(\^?)(?=(?:[^\]\\\/]|\\.)+)/, ["regexp.escape.control", { token: "regexp.escape.control", next: "@regexrange" }]],
        [/(\()(\?:|\?=|\?!)/, ["regexp.escape.control", "regexp.escape.control"]],
        [/[()]/, "regexp.escape.control"],
        [/@regexpctl/, "regexp.escape.control"],
        [/[^\\\/]/, "regexp"],
        [/@regexpesc/, "regexp.escape"],
        [/\\\./, "regexp.invalid"],
        [/(\/)([dgimsuy]*)/, [{ token: "regexp", bracket: "@close", next: "@pop" }, "keyword.other"]],
      ],
      regexrange: [
        [/-/, "regexp.escape.control"],
        [/\^/, "regexp.invalid"],
        [/@regexpesc/, "regexp.escape"],
        [/[^\]]/, "regexp"],
        [/\]/, { token: "regexp.escape.control", next: "@pop", bracket: "@close" }],
      ],
      string_double: [
        [/[^\\"]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/"/, "string", "@pop"],
      ],
      string_single: [
        [/[^\\']+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/'/, "string", "@pop"],
      ],
      string_backtick: [
        [/\$\{/, { token: "delimiter.bracket", next: "@bracketCounting" }],
        [/[^\\`$]+/, "string"],
        [/@escapes/, "string.escape"],
        [/\\./, "string.escape.invalid"],
        [/`/, "string", "@pop"],
      ],
      bracketCounting: [
        [/\{/, "delimiter.bracket", "@bracketCounting"],
        [/\}/, "delimiter.bracket", "@pop"],
        { include: "common" },
      ],
    },
  };

  // Monaco's built-in TS/JS uses a semantic tokenizer that overrides Monarch.
  // We override it by registering our Monarch tokenizer for TS/JS and telling
  // the editor to prefer Monarch via "semanticHighlighting.enabled": false.
  monaco.languages.setMonarchTokensProvider("typescript", jsxLang);
  monaco.languages.setMonarchTokensProvider("javascript", { ...jsxLang, tokenPostfix: ".js" });

};

class Xkin {
  static $types = $types;

  /* ── New API: Workspace + Files + Keys ──────────── */

  static $workspace = $workspace;
  static $files = $files;
  static $active_file = $active_file;
  static $open_files = $open_files;
  static $file_tree = $file_tree;
  static $is_dirty = $is_dirty;
  static $dirty_files = $dirty_files;
  static $active_entry = $active_entry;

  static workspace = workspace_manager;
  static files = file_registry;
  static persistence = persistence;
  static keys = keys_manager;
  static hooks = hook_system;
  static plugins = plugin_registry;
  static ui = ui_slot_manager;
  static commands = contribution_targets;
  static run_command = contribution_targets.run_command;
  static detect_language = detect_language;

  /* ── DnD (Page Builder) ──────────────────────────── */

  static $document = $document;
  static $sections = $sections;
  static $selection = $selection;
  static $drag_state = $drag_state;
  static $section_types = dnd_manager.$section_types;
  static $block_types = dnd_manager.$block_types;
  static dnd = dnd_manager;

  /* ── Editor ──────────────────────────────────────── */

  static editor({
    element,
    value = "",
    language = "javascript",
    theme = "vs-dark",
    read_only = false,
    minimap = false,
    scroll_beyond = false,
    font_size = 14,
    auto_layout = true,
    ...opts
  }) {
    const monaco = get_editor();

    const compilerOpts = {
      jsx: monaco.languages.typescript.JsxEmit.React,
      jsxFactory: "h",
      jsxFragmentFactory: "Fragment",
      allowJs: true,
      allowNonTsExtensions: true,
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      module: monaco.languages.typescript.ModuleKind.ESNext,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      baseUrl: "file:///",
      typeRoots: ["node_modules/@types"],
    };

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions(compilerOpts);
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(compilerOpts);

    // Register JSX-aware Monarch tokenizer (once)
    if (!Xkin._jsx_tokenizer_registered) {
      Xkin._jsx_tokenizer_registered = true;
      _register_jsx_tokenizer(monaco);
    }

    // Use a .tsx/.jsx URI so Monaco enables JSX support
    const ext = { typescript: "tsx", javascript: "jsx" }[language] || language;
    const uid = `${Date.now()}_${Math.random().toString(36).slice(8)}`
    const uri = monaco.Uri.parse(`file:///model_${uid}.${ext}`);
    const model = monaco.editor.createModel(value, language, uri);

    const editor_instance = monaco.editor.create(element, {
      model,
      theme,
      readOnly: read_only,
      minimap: { enabled: minimap },
      scrollBeyondLastLine: scroll_beyond,
      fontSize: font_size,
      automaticLayout: auto_layout,
      // Disable semantic highlighting so our Monarch JSX tokenizer takes effect
      // (Monaco's built-in TS semantic tokenizer would otherwise override it)
      "semanticHighlighting.enabled": false,
      ...opts,
    });

    // Wire up keybindings to this editor
    keys_manager._set_editor(editor_instance);

    return editor_instance;
  }

  static set_theme(theme) {
    get_editor().editor.setTheme(theme);
  }

  static set_language(model, language) {
    get_editor().editor.setModelLanguage(model, language);
  }

  /* ── Models (virtual file system) ────────────────── */

  static create_model(path, content = "", language = "typescript") {
    const monaco = get_editor();
    const uri = monaco.Uri.parse(to_file_uri(path));
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      existing.setValue(content);
      return existing;
    }
    return monaco.editor.createModel(content, language, uri);
  }

  static get_model(path) {
    const monaco = get_editor();
    const uri = monaco.Uri.parse(to_file_uri(path));
    return monaco.editor.getModel(uri);
  }

  static delete_model(path) {
    const model = Xkin.get_model(path);
    if (model) model.dispose();
  }

  /* ── Types (reactive) ───────────────────────────── */

  static add_types(libs) {
    const current = $types.get();
    const merged = [...current];

    for (const lib of libs) {
      const idx = merged.findIndex((l) => l.path === lib.path);
      if (idx >= 0) {
        merged[idx] = lib;
      } else {
        merged.push(lib);
      }
    }

    Xkin.set_types(merged);
  }

  static set_types(libs) {
    $types.set(libs);
    sync_types(libs);
  }

  static get_types() {
    return $types.get();
  }

  /* ── Compiler ───────────────────────────────────── */

  static set_compiler(opts) {
    const monaco = get_editor();
    const ts = monaco.languages.typescript;

    const resolve = (map, value) =>
      typeof value === "string" ? map[value] ?? value : value;

    const resolved = { ...opts };

    if ("jsx" in resolved) {
      resolved.jsx = resolve(ts.JsxEmit, resolved.jsx);
    }
    if ("target" in resolved) {
      resolved.target = resolve(ts.ScriptTarget, resolved.target);
    }
    if ("module" in resolved) {
      resolved.module = resolve(ts.ModuleKind, resolved.module);
    }
    if ("moduleResolution" in resolved) {
      resolved.moduleResolution = resolve(ts.ModuleResolutionKind, resolved.moduleResolution);
    }

    ts.typescriptDefaults.setCompilerOptions(resolved);
    ts.javascriptDefaults.setCompilerOptions(resolved);
  }

  /* ── Tools ──────────────────────────────────────── */

  static tsx(args) {
    return get_tools().tsx(args);
  }

  static format(args) {
    return get_tools().format(args);
  }

  static markdown(args) {
    return get_tools().markdown(args);
  }

  static mdx({ source, md = {} }) {
    const html = get_tools().markdown({ source, options: md });
    const doc = new DOMParser().parseFromString(html, "text/html");

    const walk = (node) => {
      if (node.nodeType === 3) return { tag: "#text", props: {}, children: [node.textContent] };
      if (node.nodeType !== 1) return null;
      if (node.tagName === "BR") return null;
      const props = {};
      for (const a of node.attributes) props[a.name] = a.value;
      const children = [...node.childNodes].map(walk).filter(Boolean);
      return { tag: node.tagName.toLowerCase(), props, children };
    };

    return [...doc.body.childNodes].map(walk).filter(Boolean);
  }

  /* ── Engine (Preact) ────────────────────────────── */

  static get engine() {
    return get_engine();
  }

  /* ── Styles ─────────────────────────────────────── */

  static sass(args) {
    return get_styles().sass(args);
  }

  static css_modules(args) {
    return get_styles().cssModules(args);
  }

  /* ── Store (Nanostores) ─────────────────────────── */

  static store = nano;
}

export default Xkin;
