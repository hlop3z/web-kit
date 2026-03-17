/**
 * Xkin Type Definitions (browser-ready, self-contained)
 *
 * Inject into Monaco for autocompletion:
 *
 *   const types = await fetch("dist/xkin.d.ts").then(r => r.text());
 *   Xkin.add_types([{ path: "xkin.d.ts", content: types }]);
 *
 */

declare namespace Xkin {

  /* ── Utility Types ──────────────────────────────── */

  type Dispose = () => void;

  /** Minimal reactive store (nanostores Atom) */
  interface Atom<T> {
    get(): T;
    set(value: T): void;
    subscribe(callback: (value: T) => void): Dispose;
    listen(callback: (value: T) => void): Dispose;
  }

  /** Minimal read-only reactive store (nanostores ReadableAtom) */
  interface ReadableAtom<T> {
    get(): T;
    subscribe(callback: (value: T) => void): Dispose;
    listen(callback: (value: T) => void): Dispose;
  }

  /* ── Data Types ─────────────────────────────────── */

  interface TypeLib {
    path: string;
    content: string;
  }

  /* ── Editor Options ─────────────────────────────── */

  interface EditorOptions {
    element: HTMLElement;
    value?: string;
    language?: string;
    theme?: string;
    read_only?: boolean;
    minimap?: boolean;
    scroll_beyond?: boolean;
    font_size?: number;
    auto_layout?: boolean;
    [key: string]: any;
  }

  /* ── Compiler Options ─────────────────────────────── */

  type JsxEmit = "None" | "Preserve" | "React" | "ReactNative" | "ReactJSX" | "ReactJSXDev" | number;
  type ScriptTarget = "ES3" | "ES5" | "ES2015" | "ES2016" | "ES2017" | "ES2018" | "ES2019" | "ES2020" | "ES2021" | "ES2022" | "ESNext" | number;
  type ModuleKind = "None" | "CommonJS" | "AMD" | "UMD" | "System" | "ES2015" | "ES2020" | "ESNext" | "Node16" | "NodeNext" | number;
  type ModuleResolutionKind = "Classic" | "NodeJs" | "Node16" | "NodeNext" | "Bundler" | number;

  interface CompilerOptions {
    jsx?: JsxEmit;
    jsxFactory?: string;
    jsxFragmentFactory?: string;
    target?: ScriptTarget;
    module?: ModuleKind;
    moduleResolution?: ModuleResolutionKind;
    allowJs?: boolean;
    allowNonTsExtensions?: boolean;
    baseUrl?: string;
    typeRoots?: string[];
    [key: string]: any;
  }

  /* ── Tool Args ──────────────────────────────────── */

  interface TsxArgs {
    source: string;
    compress?: boolean;
    mangle?: boolean;
  }

  interface TsxResult {
    code: string;
  }

  interface FormatArgs {
    source: string;
    parser?: string;
    tabWidth?: number;
    printWidth?: number;
    semi?: boolean;
    singleQuote?: boolean;
    useTabs?: boolean;
  }

  interface MarkdownArgs {
    source: string;
    options?: Record<string, unknown>;
  }

  interface MdxArgs {
    source: string;
    md?: Record<string, unknown>;
  }

  interface MdxResult {
    tree: any;
    symbols: string[];
  }

  /* ── Style Args ─────────────────────────────────── */

  interface SassArgs {
    source: string;
    compressed?: boolean;
  }

  interface SassResult {
    css: string;
  }

  interface CssModulesArgs {
    source: string;
    namespace?: string;
    idSize?: number;
  }

  interface CssModulesResult {
    css: string;
    tokens: Record<string, string>;
  }

  /* ── Engine (Preact) ────────────────────────────── */

  interface VNode {
    type: string | Function;
    props: Record<string, any>;
    key?: string | number | null;
  }

  interface Engine {
    h(type: string | Function, props?: Record<string, any> | null, ...children: any[]): VNode;
    Fragment(props: { children?: any }): any;
    render(vnode: VNode, parent: Element): void;
    createElement(type: string | Function, props?: Record<string, any> | null, ...children: any[]): VNode;
    renderToString(vnode: VNode): string;
  }
}

/* ── Global Declaration ───────────────────────────── */

declare var Xkin: {
  // Reactive Stores
  $types: Xkin.Atom<Xkin.TypeLib[]>;

  // Store (nanostores)
  store: {
    atom<T>(value: T): Xkin.Atom<T>;
    computed<T>(stores: Xkin.ReadableAtom<any> | Xkin.ReadableAtom<any>[], fn: (...values: any[]) => T): Xkin.ReadableAtom<T>;
    map<T extends Record<string, any>>(value?: T): Xkin.Atom<T>;
    [key: string]: any;
  };

  // Editor
  editor(options: Xkin.EditorOptions): any;
  set_theme(theme: string): void;
  set_language(model: any, language: string): void;
  set_content(editor: any, content: string): void;

  // Models
  create_model(path: string, content?: string, language?: string): any;
  get_model(path: string): any | null;
  delete_model(path: string): void;

  // Types
  add_types(libs: Xkin.TypeLib[]): void;
  set_types(libs: Xkin.TypeLib[]): void;
  get_types(): Xkin.TypeLib[];

  // Compiler
  set_compiler(opts: Xkin.CompilerOptions): void;

  // Tools
  tsx(args: Xkin.TsxArgs): Promise<Xkin.TsxResult>;
  format(args: Xkin.FormatArgs): Promise<string>;
  markdown(args: Xkin.MarkdownArgs): string;
  mdx(args: Xkin.MdxArgs): Promise<Xkin.MdxResult>;

  // Engine (Preact)
  readonly engine: Xkin.Engine;

  // Styles
  sass(args: Xkin.SassArgs): Promise<Xkin.SassResult>;
  css_modules(args: Xkin.CssModulesArgs): Promise<Xkin.CssModulesResult>;
};
