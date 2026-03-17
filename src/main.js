import * as nano from "nanostores";
import { atom } from "nanostores";

const get_editor = () => globalThis.XkinEditor;
const get_tools = () => globalThis.XkinTools;
const get_styles = () => globalThis.XkinStyles;
const get_engine = () => globalThis.XkinEngine;

const $types = atom([]);

const VOID_RE = /(<(?:area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b[^>]*?)(?<!\/)>/gi;

const html_to_jsx = (html, { strip_br = false } = {}) => {
  let jsx = html.replace(VOID_RE, "$1 />");

  // Remove <br /> tags (mdx mode)
  if (strip_br) jsx = jsx.replace(/<br\s*\/?>/gi, "\n");

  // class → className
  jsx = jsx.replace(/\bclass=/g, "className=");

  // for → htmlFor
  jsx = jsx.replace(/\bfor=/g, "htmlFor=");

  // style="..." → style={{ ... }}
  jsx = jsx.replace(/\bstyle="([^"]*)"/g, (_, css) => {
    const obj = css
      .split(";")
      .filter(Boolean)
      .map((s) => {
        const [k, ...v] = s.split(":");
        const prop = k
          .trim()
          .replace(/-([a-z])/g, (__, c) => c.toUpperCase());
        return `"${prop}":"${v.join(":").trim()}"`;
      })
      .join(",");
    return `style={{${obj}}}`;
  });

  // checked (boolean attr without value)
  jsx = jsx.replace(/\bchecked(?=[\s/>])/g, "checked={true}");
  jsx = jsx.replace(/\bdisabled(?=[\s/>])/g, "disabled={true}");

  // Remove <p> wrappers around block-level elements
  const BLOCK = "details|summary|div|section|nav|aside|header|footer|main|figure|figcaption|dl|dt|dd|table|thead|tbody|tfoot|tr|th|td|ul|ol|li|blockquote|pre|form|fieldset|legend|address|article|hgroup";
  // <p><block...> → <block...>
  jsx = jsx.replace(new RegExp(`<p>\\s*(<(?:${BLOCK})[\\s>/])`, "gi"), "$1");
  // </block></p> → </block>
  jsx = jsx.replace(new RegExp(`(</(?:${BLOCK})>)\\s*</p>`, "gi"), "$1");
  // <p></block> → </block>
  jsx = jsx.replace(new RegExp(`<p>\\s*(</(?:${BLOCK})>)`, "gi"), "$1");
  // <block></p> → <block>  (opening tag followed by stray </p>)
  jsx = jsx.replace(new RegExp(`(<(?:${BLOCK})[^>]*>)\\s*</p>`, "gi"), "$1");

  // Escape stray { } in text content, but NOT inside <pre> blocks
  const PRE_RE = /<pre[\s>][\s\S]*?<\/pre>/gi;
  const pres = [];
  jsx = jsx.replace(PRE_RE, (m) => {
    pres.push(m);
    return `<!--PRE${pres.length - 1}-->`;
  });

  jsx = jsx.replace(/>([^<]*)</g, (_, text) => {
    const escaped = text.replace(/\{/g, "{'{'}").replace(/\}/g, "{'}'}")
    return `>${escaped}<`;
  });

  jsx = jsx.replace(/<!--PRE(\d+)-->/g, (_, i) => {
    // Wrap code block contents in a JSX expression string
    const pre = pres[+i];
    return pre.replace(/>([^<]*)</g, (__, txt) => {
      if (!txt) return `>${txt}<`;
      return `>{"${txt.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"}<`;
    });
  });

  return jsx;
};

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

class Xkin {
  static $types = $types;

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
      ...opts,
    });

    return editor_instance;
  }

  static set_theme(theme) {
    get_editor().editor.setTheme(theme);
  }

  static set_language(model, language) {
    get_editor().editor.setModelLanguage(model, language);
  }

  static set_content(editor, content) {
    const model = editor.getModel();
    if (!model) return;
    const full_range = model.getFullModelRange();
    editor.executeEdits("xkin", [{
      range: full_range,
      text: content,
    }]);
    editor.pushUndoStop();
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

  static async mdx({ source, md = {} }) {
    const html = get_tools().markdown({ source, options: md });
    const jsx = html_to_jsx(html, { strip_br: true });
    const wrapped = `const __mdx__ = (<>${jsx}</>);`;
    const { code } = await get_tools().tsx({ source: wrapped });

    const symbols = new Set();
    const h = (tag, props, ...children) => {
      const node = { tag, props: props || {}, children: children.flat() };
      if (typeof tag === "string" && tag.startsWith("ui-")) symbols.add(tag.slice(3));
      return node;
    };
    const Fragment = ({ children }) => children;
    const tree = new Function("h", "Fragment", `${code}\nreturn __mdx__;`)(h, Fragment);
    return { tree, symbols: [...symbols] };
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
