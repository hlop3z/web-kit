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
    create(path: string, content?: string, options?: FileCreateOptions): Promise<any>;
    read(path: string): string | null;
    update(path: string, content: string): Promise<any | null>;
    delete(path: string): Promise<void>;
    get(path: string): any | null;
    entry(path: string): FileEntry | null;
    set_meta(path: string, meta: Record<string, unknown>): FileEntry | null;

    rename(old_path: string, new_path: string): Promise<any | null>;
    move(old_path: string, new_path: string): Promise<any | null>;

    list(dir_path?: string, options?: FileListOptions): FileEntry[];
    dirs(dir_path?: string): string[];
    delete_dir(dir_path: string): Promise<void>;
    rename_dir(old_dir: string, new_dir: string): Promise<void>;

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
    clear(): Promise<void>;

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
    create(id: string, options?: WorkspaceCreateOptions): Promise<Workspace>;
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

  /* ── Hooks ─────────────────────────────────────── */

  interface HookSystem {
    add(name: string, callback: (...args: any[]) => any, priority?: number): Dispose;
    fire(name: string, value?: any, context?: any): Promise<any>;
    has(name: string): boolean;
    list(): string[];
    clear(): void;
  }

  /* ── Plugins ───────────────────────────────────── */

  type PluginState = "installed" | "active" | "inactive" | "error" | "lazy";

  type PluginActivation =
    | "on_load"
    | "on_demand"
    | `on_language:${string}`
    | `on_command:${string}`;

  type PluginPermission =
    | "files" | "files.read" | "keys" | "hooks" | "ui"
    | "workspace" | "workspace.read" | "tools" | "editor"
    | "store" | "commands" | "settings";

  interface SettingFieldBase {
    label: string;
    description?: string;
  }

  interface StringSetting extends SettingFieldBase {
    type: "string";
    default: string;
  }

  interface NumberSetting extends SettingFieldBase {
    type: "number";
    default: number;
    min?: number;
    max?: number;
  }

  interface BooleanSetting extends SettingFieldBase {
    type: "boolean";
    default: boolean;
  }

  interface SelectSetting extends SettingFieldBase {
    type: "select";
    default: string;
    options: Array<{ value: string; label: string }>;
  }

  interface ColorSetting extends SettingFieldBase {
    type: "color";
    default: string;
  }

  interface JsonSetting extends SettingFieldBase {
    type: "json";
    default: any;
  }

  type SettingField = StringSetting | NumberSetting | BooleanSetting | SelectSetting | ColorSetting | JsonSetting;

  interface PluginUI {
    show_notification(message: string, opts?: Record<string, any>): void;
    show_quick_pick<T extends { label: string; value: any }>(items: T[], opts?: Record<string, any>): Promise<T | null>;
    show_input(opts?: { placeholder?: string; value?: string }): Promise<string | null>;
  }

  interface PluginContext {
    settings: Atom<Record<string, any>>;
    defaults: Record<string, any>;
    subscriptions: Dispose[];
    contribute(target: string, contribution: Record<string, any>): Dispose;
    hook(name: string, callback: (...args: any[]) => any, priority?: number): Dispose;
    ui?: PluginUI;
  }

  interface PluginManifest {
    id: string;
    name: string;
    version: string;
    description?: string;
    author?: string;
    icon?: string;
    permissions?: PluginPermission[];
    dependencies?: Record<string, string>;
    activation?: PluginActivation;
    settings?: Record<string, SettingField>;
    activate(ctx: PluginContext): void | Promise<void>;
    deactivate?(): void | Promise<void>;
  }

  interface PluginInfo {
    id: string;
    name: string;
    version: string;
    state: PluginState;
    error: Error | null;
  }

  type PluginEventType = "register" | "activate" | "deactivate" | "error" | "*";

  interface PerfStats {
    activation_ms: number;
    hook_calls: number;
    hook_time_ms: number;
  }

  interface PluginRegistry {
    register(manifest: PluginManifest): void;
    unregister(id: string): void;
    activate(id: string): Promise<void>;
    deactivate(id: string): Promise<void>;
    get(id: string): PluginInfo | null;
    list(): PluginInfo[];
    is_active(id: string): boolean;
    on(event: PluginEventType, callback: (data: any) => void): Dispose;

    /** Trigger lazy activation for plugins matching the given kind/target */
    trigger_activation(kind: "on_language" | "on_command", target: string): Promise<string[]>;

    /** Load a plugin from a URL (fetches JS, evaluates, and registers) */
    load_from_url(url: string): Promise<string>;

    /** Get performance stats for a plugin, or all plugins if no id given */
    perf_stats(id: string): PerfStats | null;
    perf_stats(): Record<string, PerfStats>;
  }

  /* ── UI Slots ──────────────────────────────────── */

  type UISlotName = "sidebar_left" | "sidebar_right" | "toolbar" | "editor_title" | "bottom_panel" | "status_bar" | "overlay";

  interface UISlotContribution {
    id: string;
    plugin_id: string;
    label?: string;
    render?: Function;
    alignment?: "left" | "right";
    order?: number;
  }

  interface UISlotInfo {
    id: string;
    plugin_id: string;
    label?: string;
    alignment?: string;
    order?: number;
  }

  interface Notification {
    id: string;
    plugin_id: string;
    message: string;
    type: "info" | "warning" | "error";
    timeout: number;
    created_at: number;
  }

  interface DialogState {
    type: "quick_pick" | "input";
    plugin_id: string;
    items?: Array<{ label: string; value: any }>;
    placeholder?: string;
    value?: string;
    resolve: (value: any) => void;
  }

  interface UISlotManager {
    $slots: Atom<Record<UISlotName, UISlotInfo[]>>;
    $notifications: Atom<Notification[]>;
    $dialog: Atom<DialogState | null>;

    add(slot: UISlotName, plugin_id: string, contribution: Record<string, any>): Dispose;
    remove(slot: UISlotName, contribution_id: string): void;
    get(slot: UISlotName): UISlotContribution[];

    mount(slot: UISlotName, element: Element): void;
    unmount(slot: UISlotName): void;

    show_notification(plugin_id: string, message: string, opts?: { type?: "info" | "warning" | "error"; timeout?: number }): string;
    dismiss_notification(id: string): void;

    show_quick_pick<T extends { label: string; value: any }>(plugin_id: string, items: T[], opts?: { placeholder?: string }): Promise<T | null>;
    show_input(plugin_id: string, opts?: { placeholder?: string; value?: string }): Promise<string | null>;

    generate_settings_ui(plugin_id: string, schema: Record<string, SettingField> | null, settings_atom: Atom<Record<string, any>>): Function | null;

    on(event: "add" | "remove" | "notification" | "dialog" | "*", callback: (data: any) => void): Dispose;
    slot_names(): UISlotName[];
  }

  /* ── DnD (Page Builder) ──────────────────────────── */

  interface SectionConstraints {
    max_blocks?: number;
    allowed_blocks?: string[] | null;
    min_blocks?: number;
  }

  interface Block {
    id: string;
    type: string;
    order: string;
    section_id: string;
    content: Record<string, any>;
    settings: Record<string, any>;
    children: Block[];
    meta: Record<string, any>;
  }

  interface Section {
    id: string;
    type: string;
    order: string;
    blocks: Block[];
    settings: Record<string, any>;
    constraints: SectionConstraints;
    meta: Record<string, any>;
  }

  interface Document {
    id: string;
    sections: Section[];
    meta: Record<string, any>;
  }

  interface SelectionState {
    type: "section" | "block" | null;
    ids: string[];
  }

  interface DragState {
    status: "idle" | "pending" | "dragging";
    source: { type: string; id: string; section_id?: string } | null;
    target: { type: string; id: string; section_id?: string; index?: number } | null;
    operation: "reorder" | "transfer" | "clone" | null;
  }

  interface SectionTypeDefinition {
    type: string;
    label: string;
    icon?: string;
    category?: string;
    defaults?: Record<string, any>;
    constraints?: SectionConstraints;
    settings?: Record<string, SettingField>;
    render?: (section: Section, ctx: { h: Function; Fragment: Function; render_blocks: () => any[] }) => any;
  }

  interface BlockTypeDefinition {
    type: string;
    label: string;
    icon?: string;
    category?: string;
    defaults?: Record<string, any>;
    settings?: Record<string, SettingField>;
    render?: (block: Block, ctx: { h: Function; Fragment: Function }) => any;
  }

  /* ── DnD Engine (@dnd-kit/dom) ───────────────────── */

  interface DndEngineOptions {
    plugins?: any[];
    sensors?: any[];
    modifiers?: any[];
  }

  interface DndEngine {
    init(container: Element, options?: DndEngineOptions): any;
    destroy(): void;
    readonly manager: any | null;
    readonly instances: Map<string, any>;

    // Sortable factories
    create_section_sortable(element: Element, opts: { id: string; index: number; handle?: Element }): any;
    create_block_sortable(element: Element, opts: { id: string; index: number; section_id: string; handle?: Element }): any;

    // Draggable factories
    create_palette_item(element: Element, opts: { block_type: string; template?: Record<string, any> }): any;
    create_section_palette_item(element: Element, opts: { section_type: string; template?: Record<string, any> }): any;

    // Droppable factory
    create_section_drop_zone(element: Element, opts: { section_id: string; accept?: Function }): any;

    // Instance management
    remove(id: string): void;
    get(id: string): any | null;

    // Event binding
    on(event: string, callback: (event: any) => void): Dispose;

    // Re-exports
    isSortable(element: any): boolean;
    isSortableOperation(operation: any): boolean;
    DragDropManager: any;
    Draggable: any;
    Droppable: any;
    Sortable: any;
  }

  /* ── DnD Feedback Components ───────────────────── */

  interface DndFeedback {
    DropIndicator(props?: { position?: "horizontal" | "vertical"; visible?: boolean; style?: Record<string, any> }): any;
    DragOverlay(props?: { children?: any; style?: Record<string, any> }): any;
    DropTarget(props?: { active?: boolean; children?: any; style?: Record<string, any> }): any;
    css: string;
    inject_css(root?: any): Dispose;
  }

  /* ── DnD Manager ───────────────────────────────── */

  interface DndInitOptions {
    document?: Document;
    max_sections?: number;
    container?: Element;
    engine?: DndEngineOptions;
    builtins?: boolean;
  }

  interface DndManager {
    // Setup
    init(options?: DndInitOptions): void;
    destroy(): void;

    // Type registration
    register_section(definition: SectionTypeDefinition): void;
    register_block(definition: BlockTypeDefinition): void;
    unregister_section(type: string): void;
    unregister_block(type: string): void;
    get_section_type(type: string): SectionTypeDefinition | null;
    get_block_type(type: string): BlockTypeDefinition | null;
    list_section_types(): SectionTypeDefinition[];
    list_block_types(): BlockTypeDefinition[];

    // Document operations
    add_section(type: string, options?: { template?: Record<string, any>; at_index?: number; constraints?: SectionConstraints }): Promise<Document>;
    add_block(section_id: string, type: string, options?: { template?: Record<string, any>; at_index?: number }): Promise<Document>;
    remove_section(section_id: string): Promise<Document>;
    remove_block(section_id: string, block_id: string): Promise<Document>;
    move_section(section_id: string, to_index: number): Promise<Document>;
    move_block(block_id: string, to_section_id: string, to_index: number): Promise<Document>;
    update_block(section_id: string, block_id: string, content: Record<string, any>): Promise<Document>;
    update_section_settings(section_id: string, settings: Record<string, any>): Promise<Document>;
    update_block_settings(section_id: string, block_id: string, settings: Record<string, any>): Promise<Document>;

    // Rendering
    render(doc?: Document): any;
    export_html(doc?: Document): string;

    // Undo / redo
    undo(): void;
    redo(): void;
    $can_undo: ReadableAtom<boolean>;
    $can_redo: ReadableAtom<boolean>;

    // Selection
    select(type: "section" | "block", ids: string | string[]): void;
    clear_selection(): void;
    delete_selected(): Promise<void>;

    // Drag state
    set_drag_state(state: Partial<DragState>): void;

    // Engine (@dnd-kit integration)
    engine: DndEngine;

    // Visual feedback
    feedback: DndFeedback;

    // Built-in type registration
    register_builtins(): Dispose;

    // Reactive atoms
    $document: Atom<Document>;
    $sections: ReadableAtom<Section[]>;
    $selection: Atom<SelectionState>;
    $drag_state: Atom<DragState>;
    $section_types: Atom<Map<string, SectionTypeDefinition>>;
    $block_types: Atom<Map<string, BlockTypeDefinition>>;
  }

  /* ── DevTools ──────────────────────────────────── */

  interface DevToolsPluginInfo extends PluginInfo {
    perf: PerfStats | null;
  }

  interface DevTools {
    snapshot(): DevToolsPluginInfo[];
    inspect(id: string): DevToolsPluginInfo | null;
    manifest: PluginManifest;
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
  hooks: Xkin.HookSystem;
  plugins: Xkin.PluginRegistry;
  ui: Xkin.UISlotManager;

  // DnD (Page Builder)
  $document: Xkin.Atom<Xkin.Document>;
  $sections: Xkin.ReadableAtom<Xkin.Section[]>;
  $selection: Xkin.Atom<Xkin.SelectionState>;
  $drag_state: Xkin.Atom<Xkin.DragState>;
  $section_types: Xkin.Atom<Map<string, Xkin.SectionTypeDefinition>>;
  $block_types: Xkin.Atom<Map<string, Xkin.BlockTypeDefinition>>;
  dnd: Xkin.DndManager;

  /** Execute a command by id (triggers lazy activation if needed) */
  run_command(command_id: string, ...args: any[]): Promise<any>;

  /** Detect language from a file path extension */
  detect_language(path: string): string | null;

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
