/**
 * XkinAPI — the shape of the `xkin` object that xkin-studio receives.
 *
 * This mirrors the public API surface from web-kit's `xkin.d.ts`.
 * xkin-studio never imports from web-kit internals — only this interface.
 */

/* ── Utility ────────────────────────────────────── */

export type Dispose = () => void;

export interface Atom<T> {
  get(): T;
  set(value: T): void;
  subscribe(callback: (value: T) => void): Dispose;
  listen(callback: (value: T) => void): Dispose;
}

export interface ReadableAtom<T> {
  get(): T;
  subscribe(callback: (value: T) => void): Dispose;
  listen(callback: (value: T) => void): Dispose;
}

/* ── Data Types ─────────────────────────────────── */

export interface FileEntry {
  path: string;
  language: string;
  main: boolean;
  dirty: boolean;
  created_at: number;
  updated_at: number;
  meta: Record<string, unknown>;
}

export interface TreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  entry?: FileEntry;
  children?: TreeNode[];
}

export interface Workspace {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  meta: Record<string, unknown>;
}

export interface WorkspaceSnapshot {
  workspace: Workspace;
  files: Record<string, string>;
  entries: FileEntry[];
  view_states: Record<string, unknown>;
  active_file: string | null;
  open_files: string[];
}

export interface TypeLib {
  path: string;
  content: string;
}

/* ── Persistence ────────────────────────────────── */

export interface PersistenceAdapter {
  save(id: string, snapshot: WorkspaceSnapshot): Promise<void>;
  load(id: string): Promise<WorkspaceSnapshot | null>;
  delete(id: string): Promise<void>;
  list(): Promise<Workspace[]>;
}

export interface Persistence {
  local_storage(options?: { prefix?: string }): PersistenceAdapter;
  indexed_db(options?: { db_name?: string }): PersistenceAdapter;
  remote(options?: {
    base_url: string;
    headers?: Record<string, string>;
  }): PersistenceAdapter;
}

/* ── File Registry ──────────────────────────────── */

export interface FileCreateOptions {
  main?: boolean;
  language?: string;
  meta?: Record<string, unknown>;
}

export interface FileListOptions {
  depth?: number;
}

export interface FileMergeOptions {
  strip_imports?: boolean;
  separator?: string;
  filter?: (entry: FileEntry) => boolean;
}

export interface FileFormatOptions {
  parser?: string;
  tabWidth?: number;
  printWidth?: number;
  semi?: boolean;
  singleQuote?: boolean;
  useTabs?: boolean;
}

export type FileEventType = "create" | "update" | "delete" | "rename" | "*";

export interface FileRegistry {
  create(
    path: string,
    content?: string,
    options?: FileCreateOptions,
  ): Promise<unknown>;
  read(path: string): string | null;
  update(path: string, content: string): Promise<unknown | null>;
  delete(path: string): Promise<void>;
  get(path: string): unknown | null;
  entry(path: string): FileEntry | null;
  set_meta(
    path: string,
    meta: Record<string, unknown>,
  ): FileEntry | null;

  rename(old_path: string, new_path: string): Promise<unknown | null>;
  move(old_path: string, new_path: string): Promise<unknown | null>;

  list(dir_path?: string, options?: FileListOptions): FileEntry[];
  dirs(dir_path?: string): string[];
  delete_dir(dir_path: string): Promise<void>;
  rename_dir(old_dir: string, new_dir: string): Promise<void>;

  mark_clean(path: string): void;
  mark_all_clean(): void;
  is_dirty(path: string): boolean;

  save_view_state(path: string, editor_instance: unknown): void;
  restore_view_state(
    path: string,
    editor_instance: unknown,
  ): unknown | null;

  set_active(path: string, editor_instance: unknown): unknown | null;
  open(path: string): void;
  close(path: string, editor_instance?: unknown): void;

  merge(options?: FileMergeOptions): string;
  format(
    path: string,
    options?: FileFormatOptions,
  ): Promise<string | null>;
  format_all(
    options?: FileFormatOptions,
    filter_options?: { filter?: (entry: FileEntry) => boolean },
  ): Promise<Record<string, string>>;
  clear(): Promise<void>;

  on(
    event_type: FileEventType,
    callback: (data: unknown) => void,
  ): Dispose;
}

/* ── Workspace Manager ──────────────────────────── */

export interface WorkspaceManager {
  create(
    id: string,
    options?: {
      name?: string;
      meta?: Record<string, unknown>;
      activate?: boolean;
    },
  ): Promise<Workspace>;
  switch(id: string): Promise<Workspace | null>;
  current(): Workspace | null;
  list(): Promise<Workspace[]>;
  delete(id: string): Promise<void>;
  update(
    id: string,
    options?: { name?: string; meta?: Record<string, unknown> },
  ): Workspace | null;
  snapshot(): WorkspaceSnapshot | null;
  mount(
    snapshot: WorkspaceSnapshot,
    options?: { activate?: boolean },
  ): Promise<Workspace | null>;
  to_json(): Record<string, string>;
  from_json(
    id: string,
    file_map: Record<string, string>,
    options?: { name?: string; meta?: Record<string, unknown> },
  ): Promise<Workspace>;
  set_persistence(adapter: PersistenceAdapter | null): void;
  set_format_on_save(enabled: boolean): void;
  get_format_on_save(): boolean;
  save(): Promise<void>;
  auto_save(options?: {
    interval?: number;
    on_save?: (workspace: WorkspaceManager) => Promise<void>;
  }): Dispose;
  on(
    event_type: "create" | "switch" | "mount" | "delete" | "auto_save" | "*",
    callback: (data: unknown) => void,
  ): Dispose;
}

/* ── Keybindings ────────────────────────────────── */

export interface KeyBinding {
  id: string;
  label?: string;
  keys: string;
  when?: string;
  run: (editor: unknown, ...args: unknown[]) => void;
  menu?: string;
  menu_order?: number;
}

export interface ContextKey<T> {
  set(value: T): void;
  get(): T;
  reset(): void;
}

export interface KeysManager {
  add(binding: KeyBinding): Dispose;
  add_all(bindings: KeyBinding[]): Dispose;
  remove(id: string): void;
  override(
    id: string,
    options: {
      keys: string;
      run: KeyBinding["run"];
      when?: string;
    },
  ): Dispose;
  unbind(builtin_id: string): Dispose;
  list(): KeyBinding[];
  context<T>(name: string, default_value: T): ContextKey<T>;
}

/* ── Hooks ──────────────────────────────────────── */

export interface HookSystem {
  add(
    name: string,
    callback: (...args: unknown[]) => unknown,
    priority?: number,
  ): Dispose;
  fire(name: string, value?: unknown, context?: unknown): Promise<unknown>;
  has(name: string): boolean;
  list(): string[];
  clear(): void;
}

/* ── Plugins ────────────────────────────────────── */

export type PluginState =
  | "installed"
  | "active"
  | "inactive"
  | "error"
  | "lazy";

export type PluginActivation =
  | "on_load"
  | "on_demand"
  | `on_language:${string}`
  | `on_command:${string}`;

export type PluginPermission =
  | "files"
  | "files.read"
  | "keys"
  | "hooks"
  | "ui"
  | "workspace"
  | "workspace.read"
  | "tools"
  | "editor"
  | "store"
  | "commands"
  | "settings";

export interface SettingField {
  type: "string" | "number" | "boolean" | "select" | "color" | "json";
  label: string;
  description?: string;
  default?: unknown;
  min?: number;
  max?: number;
  options?: Array<{ value: string; label: string }>;
}

export interface PluginUI {
  show_notification(
    message: string,
    opts?: Record<string, unknown>,
  ): void;
  show_quick_pick<T extends { label: string; value: unknown }>(
    items: T[],
    opts?: Record<string, unknown>,
  ): Promise<T | null>;
  show_input(opts?: {
    placeholder?: string;
    value?: string;
  }): Promise<string | null>;
}

export interface PluginContext {
  settings: Atom<Record<string, unknown>>;
  defaults: Record<string, unknown>;
  subscriptions: Dispose[];
  contribute(
    target: string,
    contribution: Record<string, unknown>,
  ): Dispose;
  hook(
    name: string,
    callback: (...args: unknown[]) => unknown,
    priority?: number,
  ): Dispose;
  ui?: PluginUI;
}

export interface PluginManifest {
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

export interface PluginInfo {
  id: string;
  name: string;
  version: string;
  state: PluginState;
  error: Error | null;
}

export interface PluginRegistry {
  register(manifest: PluginManifest): void;
  unregister(id: string): void;
  activate(id: string): Promise<void>;
  deactivate(id: string): Promise<void>;
  get(id: string): PluginInfo | null;
  list(): PluginInfo[];
  is_active(id: string): boolean;
  on(
    event: "register" | "activate" | "deactivate" | "error" | "*",
    callback: (data: unknown) => void,
  ): Dispose;
  trigger_activation(
    kind: "on_language" | "on_command",
    target: string,
  ): Promise<string[]>;
  load_from_url(url: string): Promise<string>;
  perf_stats(id?: string): unknown;
}

/* ── UI Slots ───────────────────────────────────── */

export type UISlotName =
  | "sidebar_left"
  | "sidebar_right"
  | "toolbar"
  | "editor_title"
  | "bottom_panel"
  | "status_bar"
  | "overlay";

export interface UISlotContribution {
  id: string;
  plugin_id: string;
  label?: string;
  render?: Function;
  alignment?: "left" | "right";
  order?: number;
}

export interface UISlotManager {
  $slots: Atom<Record<UISlotName, Array<{ id: string; plugin_id: string; label?: string }>>>;
  $notifications: Atom<unknown[]>;
  $dialog: Atom<unknown | null>;

  add(
    slot: UISlotName,
    plugin_id: string,
    contribution: Record<string, unknown>,
  ): Dispose;
  remove(slot: UISlotName, contribution_id: string): void;
  get(slot: UISlotName): UISlotContribution[];

  mount(slot: UISlotName, element: Element): void;
  unmount(slot: UISlotName): void;

  show_notification(
    plugin_id: string,
    message: string,
    opts?: { type?: "info" | "warning" | "error"; timeout?: number },
  ): string;
  dismiss_notification(id: string): void;

  show_quick_pick<T extends { label: string; value: unknown }>(
    plugin_id: string,
    items: T[],
    opts?: { placeholder?: string },
  ): Promise<T | null>;
  show_input(
    plugin_id: string,
    opts?: { placeholder?: string; value?: string },
  ): Promise<string | null>;

  on(
    event: "add" | "remove" | "notification" | "dialog" | "*",
    callback: (data: unknown) => void,
  ): Dispose;
  slot_names(): UISlotName[];
}

/* ── DnD ────────────────────────────────────────── */

export interface Section {
  id: string;
  type: string;
  order: string;
  blocks: Block[];
  settings: Record<string, unknown>;
  constraints: Record<string, unknown>;
  meta: Record<string, unknown>;
}

export interface Block {
  id: string;
  type: string;
  order: string;
  section_id: string;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
  children: Block[];
  meta: Record<string, unknown>;
}

export interface Document {
  id: string;
  sections: Section[];
  meta: Record<string, unknown>;
}

export interface SelectionState {
  type: "section" | "block" | null;
  ids: string[];
}

export interface DragState {
  status: "idle" | "pending" | "dragging";
  source: { type: string; id: string; section_id?: string } | null;
  target: {
    type: string;
    id: string;
    section_id?: string;
    index?: number;
  } | null;
  operation: "reorder" | "transfer" | "clone" | null;
}

export interface DndManager {
  init(options?: Record<string, unknown>): void;
  destroy(): void;

  register_section(definition: Record<string, unknown>): void;
  register_block(definition: Record<string, unknown>): void;
  unregister_section(type: string): void;
  unregister_block(type: string): void;

  add_section(
    type: string,
    options?: Record<string, unknown>,
  ): Promise<Document>;
  add_block(
    section_id: string,
    type: string,
    options?: Record<string, unknown>,
  ): Promise<Document>;
  remove_section(section_id: string): Promise<Document>;
  remove_block(
    section_id: string,
    block_id: string,
  ): Promise<Document>;
  move_section(section_id: string, to_index: number): Promise<Document>;
  move_block(
    block_id: string,
    to_section_id: string,
    to_index: number,
  ): Promise<Document>;
  update_block(
    section_id: string,
    block_id: string,
    content: Record<string, unknown>,
  ): Promise<Document>;

  render(doc?: Document): unknown;
  export_html(doc?: Document): string;

  undo(): void;
  redo(): void;
  $can_undo: ReadableAtom<boolean>;
  $can_redo: ReadableAtom<boolean>;

  select(type: "section" | "block", ids: string | string[]): void;
  clear_selection(): void;
  delete_selected(): Promise<void>;

  engine: unknown;
  feedback: unknown;

  $document: Atom<Document>;
  $sections: ReadableAtom<Section[]>;
  $selection: Atom<SelectionState>;
  $drag_state: Atom<DragState>;
}

/* ── Engine (Preact) ────────────────────────────── */

export interface VNode {
  type: string | Function;
  props: Record<string, unknown>;
  key?: string | number | null;
}

export interface Engine {
  h(
    type: string | Function,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): VNode;
  Fragment(props: { children?: unknown }): unknown;
  render(vnode: VNode, parent: Element): void;
  createElement(
    type: string | Function,
    props?: Record<string, unknown> | null,
    ...children: unknown[]
  ): VNode;
  renderToString(vnode: VNode): string;
}

/* ── Store (nanostores) ─────────────────────────── */

export interface Store {
  atom<T>(value: T): Atom<T>;
  computed<T>(
    stores: ReadableAtom<unknown> | ReadableAtom<unknown>[],
    fn: (...values: unknown[]) => T,
  ): ReadableAtom<T>;
  map<T extends Record<string, unknown>>(value?: T): Atom<T>;
  [key: string]: unknown;
}

/* ── Commands ───────────────────────────────────── */

export interface Commands {
  run_command(command_id: string, ...args: unknown[]): Promise<unknown>;
  [key: string]: unknown;
}

/* ── Tool Args ──────────────────────────────────── */

export interface TsxArgs {
  source: string;
  compress?: boolean;
  mangle?: boolean;
}

export interface TsxResult {
  code: string;
}

export interface FormatArgs {
  source: string;
  parser?: string;
  tabWidth?: number;
  printWidth?: number;
  semi?: boolean;
  singleQuote?: boolean;
  useTabs?: boolean;
}

export interface SassArgs {
  source: string;
  compressed?: boolean;
}

export interface SassResult {
  css: string;
}

export interface CssModulesArgs {
  source: string;
  namespace?: string;
  idSize?: number;
}

export interface CssModulesResult {
  css: string;
  tokens: Record<string, string>;
}

export interface CompilerOptions {
  jsx?: unknown;
  jsxFactory?: string;
  jsxFragmentFactory?: string;
  target?: unknown;
  module?: unknown;
  moduleResolution?: unknown;
  allowJs?: boolean;
  allowNonTsExtensions?: boolean;
  baseUrl?: string;
  typeRoots?: string[];
  [key: string]: unknown;
}

/* ══════════════════════════════════════════════════
 *  XkinAPI — the single object xkin-studio receives
 * ══════════════════════════════════════════════════ */

export interface XkinAPI {
  /* ── Reactive Atoms ───────────────────────────── */
  $workspace: Atom<Workspace | null>;
  $files: Atom<FileEntry[]>;
  $active_file: Atom<string | null>;
  $open_files: Atom<string[]>;
  $file_tree: ReadableAtom<TreeNode[]>;
  $is_dirty: ReadableAtom<boolean>;
  $dirty_files: ReadableAtom<FileEntry[]>;
  $active_entry: ReadableAtom<FileEntry | null>;
  $types: Atom<TypeLib[]>;

  /* ── DnD Atoms ────────────────────────────────── */
  $document: Atom<Document>;
  $sections: ReadableAtom<Section[]>;
  $selection: Atom<SelectionState>;
  $drag_state: Atom<DragState>;

  /* ── Modules ──────────────────────────────────── */
  files: FileRegistry;
  workspace: WorkspaceManager;
  persistence: Persistence;
  keys: KeysManager;
  hooks: HookSystem;
  plugins: PluginRegistry;
  ui: UISlotManager;
  commands: Commands;
  dnd: DndManager;

  /* ── Store & Engine ───────────────────────────── */
  store: Store;
  readonly engine: Engine;

  /* ── Editor ───────────────────────────────────── */
  editor(options: {
    element: HTMLElement;
    value?: string;
    language?: string;
    theme?: string;
    read_only?: boolean;
    minimap?: boolean;
    scroll_beyond?: boolean;
    font_size?: number;
    auto_layout?: boolean;
    [key: string]: unknown;
  }): unknown;
  set_theme(theme: string): void;
  set_language(model: unknown, language: string): void;
  create_model(
    path: string,
    content?: string,
    language?: string,
  ): unknown;
  get_model(path: string): unknown | null;
  delete_model(path: string): void;

  /* ── Types ────────────────────────────────────── */
  add_types(libs: TypeLib[]): void;
  set_types(libs: TypeLib[]): void;
  get_types(): TypeLib[];
  set_compiler(opts: CompilerOptions): void;

  /* ── Tools ────────────────────────────────────── */
  tsx(args: TsxArgs): Promise<TsxResult>;
  format(args: FormatArgs): Promise<string>;
  markdown(args: { source: string; options?: Record<string, unknown> }): string;
  mdx(args: {
    source: string;
    md?: Record<string, unknown>;
  }): Promise<{ tree: unknown; symbols: string[] }>;
  sass(args: SassArgs): Promise<SassResult>;
  css_modules(args: CssModulesArgs): Promise<CssModulesResult>;

  /* ── Utilities ────────────────────────────────── */
  detect_language(path: string): string | null;
  run_command(command_id: string, ...args: unknown[]): Promise<unknown>;
}
