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

  interface FileEntry {
    path: string;
    language: string;
    main: boolean;
    dirty: boolean;
    created_at: number;
    updated_at: number;
    meta: Record<string, unknown>;
  }

  interface TreeNode {
    name: string;
    path: string;
    type: "file" | "directory";
    entry?: FileEntry;
    children?: TreeNode[];
  }

  interface Workspace {
    id: string;
    name: string;
    created_at: number;
    updated_at: number;
    meta: Record<string, unknown>;
  }

  interface WorkspaceSnapshot {
    workspace: Workspace;
    files: Record<string, string>;
    entries: FileEntry[];
    view_states: Record<string, any>;
    active_file: string | null;
    open_files: string[];
  }

  interface TypeLib {
    path: string;
    content: string;
  }

  /* ── Persistence ────────────────────────────────── */

  interface PersistenceAdapter {
    save(id: string, snapshot: WorkspaceSnapshot): Promise<void>;
    load(id: string): Promise<WorkspaceSnapshot | null>;
    delete(id: string): Promise<void>;
    list(): Promise<Workspace[]>;
  }

  /* ── File Options ───────────────────────────────── */

  interface FileCreateOptions {
    main?: boolean;
    language?: string;
    meta?: Record<string, unknown>;
  }

  interface FileListOptions {
    depth?: number;
  }

  interface FileMergeOptions {
    strip_imports?: boolean;
    separator?: string;
    filter?: (entry: FileEntry) => boolean;
  }

  interface FileFormatOptions {
    parser?: string;
    tabWidth?: number;
    printWidth?: number;
    semi?: boolean;
    singleQuote?: boolean;
    useTabs?: boolean;
  }

  type FileEventType = "create" | "update" | "delete" | "rename" | "*";

  /* ── File Registry ──────────────────────────────── */

  interface FileRegistry {
    create(path: string, content?: string, options?: FileCreateOptions): any;
    read(path: string): string | null;
    update(path: string, content: string): any | null;
    delete(path: string): void;
    get(path: string): any | null;
    entry(path: string): FileEntry | null;
    set_meta(path: string, meta: Record<string, unknown>): FileEntry | null;

    rename(old_path: string, new_path: string): any | null;
    move(old_path: string, new_path: string): any | null;

    list(dir_path?: string, options?: FileListOptions): FileEntry[];
    dirs(dir_path?: string): string[];
    delete_dir(dir_path: string): void;
    rename_dir(old_dir: string, new_dir: string): void;

    mark_clean(path: string): void;
    mark_all_clean(): void;
    is_dirty(path: string): boolean;

    save_view_state(path: string, editor_instance: any): void;
    restore_view_state(path: string, editor_instance: any): any | null;

    set_active(path: string, editor_instance: any): any | null;
    open(path: string): void;
    close(path: string, editor_instance?: any): void;

    merge(options?: FileMergeOptions): string;
    format(path: string, options?: FileFormatOptions): Promise<string | null>;
    format_all(options?: FileFormatOptions, filter_options?: { filter?: (entry: FileEntry) => boolean }): Promise<Record<string, string>>;
    clear(): void;

    on(event_type: FileEventType, callback: (data: any) => void): Dispose;
  }

  /* ── Workspace Manager ──────────────────────────── */

  interface WorkspaceCreateOptions {
    name?: string;
    meta?: Record<string, unknown>;
    activate?: boolean;
  }

  interface WorkspaceUpdateOptions {
    name?: string;
    meta?: Record<string, unknown>;
  }

  interface AutoSaveOptions {
    interval?: number;
    on_save?: (workspace: WorkspaceManager) => Promise<void>;
  }

  type WorkspaceEventType = "create" | "switch" | "mount" | "delete" | "auto_save" | "*";

  interface WorkspaceManager {
    create(id: string, options?: WorkspaceCreateOptions): Workspace;
    switch(id: string): Promise<Workspace | null>;
    current(): Workspace | null;
    list(): Promise<Workspace[]>;
    delete(id: string): Promise<void>;
    update(id: string, options?: WorkspaceUpdateOptions): Workspace | null;
    snapshot(): WorkspaceSnapshot | null;
    mount(snapshot: WorkspaceSnapshot, options?: { activate?: boolean }): Promise<Workspace | null>;
    to_json(): Record<string, string>;
    from_json(id: string, file_map: Record<string, string>, options?: { name?: string; meta?: Record<string, unknown> }): Promise<Workspace>;
    set_persistence(adapter: PersistenceAdapter | null): void;
    set_format_on_save(enabled: boolean): void;
    get_format_on_save(): boolean;
    save(): Promise<void>;
    auto_save(options?: AutoSaveOptions): Dispose;
    on(event_type: WorkspaceEventType, callback: (data: any) => void): Dispose;
  }

  /* ── Persistence Adapters ───────────────────────── */

  interface Persistence {
    local_storage(options?: { prefix?: string }): PersistenceAdapter;
    indexed_db(options?: { db_name?: string }): PersistenceAdapter;
    remote(options?: { base_url: string; headers?: Record<string, string> }): PersistenceAdapter;
  }

  /* ── Keybindings ────────────────────────────────── */

  interface KeyBinding {
    id: string;
    label?: string;
    keys: string;
    when?: string;
    run: (editor: any, ...args: any[]) => void;
    menu?: string;
    menu_order?: number;
  }

  interface ContextKey<T> {
    set(value: T): void;
    get(): T;
    reset(): void;
  }

  interface KeysManager {
    add(binding: KeyBinding): Dispose;
    add_all(bindings: KeyBinding[]): Dispose;
    remove(id: string): void;
    override(id: string, options: { keys: string; run: KeyBinding["run"]; when?: string }): Dispose;
    unbind(builtin_id: string): Dispose;
    list(): KeyBinding[];
    context<T>(name: string, default_value: T): ContextKey<T>;
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
  // Reactive Stores — Atoms
  $types: Xkin.Atom<Xkin.TypeLib[]>;
  $workspace: Xkin.Atom<Xkin.Workspace | null>;
  $files: Xkin.Atom<Xkin.FileEntry[]>;
  $active_file: Xkin.Atom<string | null>;
  $open_files: Xkin.Atom<string[]>;

  // Reactive Stores — Computed
  $file_tree: Xkin.ReadableAtom<Xkin.TreeNode[]>;
  $is_dirty: Xkin.ReadableAtom<boolean>;
  $dirty_files: Xkin.ReadableAtom<Xkin.FileEntry[]>;
  $active_entry: Xkin.ReadableAtom<Xkin.FileEntry | null>;

  // Modules
  workspace: Xkin.WorkspaceManager;
  files: Xkin.FileRegistry;
  persistence: Xkin.Persistence;
  keys: Xkin.KeysManager;

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
