import type { XkinAPI, PluginContext, Atom } from "../types.ts";

/* ── App Studio Primitives ──────────────────────── */

export interface FieldDefinition {
  type: string;
  label: string;
  required?: boolean;
  readonly?: boolean;
  widget?: string;
  options?: unknown[];
  items?: { type: string };
  target?: string;
  relation?: "many_to_one" | "one_to_many" | "many_to_many";
  default?: unknown;
  auto?: "uuid" | "create" | "update";
  accept?: string;
  [key: string]: unknown;
}

export interface ComputedField {
  type: string;
  depends: string[];
  compute: string;
}

export interface ModelDefinition {
  id: string;
  label: string;
  icon?: string;
  fields: Record<string, FieldDefinition>;
  computed?: Record<string, ComputedField>;
  constraints?: { unique?: string[] };
  translatable?: string[];
}

export interface ViewDefinition {
  id: string;
  type: "list" | "form" | "gallery" | "kanban" | "tree" | "dashboard" | "calendar";
  model: string;
  label: string;
  [key: string]: unknown;
}

export interface ActionDefinition {
  type: string;
  [key: string]: unknown;
}

export interface MenuDefinition {
  id: string;
  label: string;
  icon?: string;
  items: MenuItemDefinition[];
}

export interface MenuItemDefinition {
  id?: string;
  label?: string;
  view?: string;
  icon?: string;
  divider?: boolean;
  items?: MenuItemDefinition[];
}

export interface AppDefinition {
  version: string;
  id: string;
  label: string;
  models: Record<string, ModelDefinition>;
  views: Record<string, ViewDefinition>;
  actions?: Record<string, ActionDefinition>;
  menus?: Record<string, MenuDefinition>;
  security?: Record<string, unknown>;
  workflows?: Record<string, unknown>;
  connectors?: Record<string, unknown>;
  extensions?: {
    widgets?: string[];
    actions?: string[];
    validators?: string[];
  };
  data_source?: { type: string; [key: string]: unknown };
}

/* ── Data Source Interface ───────────────────────── */

export interface FindOptions {
  filters?: Record<string, unknown>;
  sort?: { field: string; direction: "asc" | "desc" };
  limit?: number;
  offset?: number;
  page?: number;
}

export interface FindResult<T = Record<string, unknown>> {
  records: T[];
  total: number;
  page?: number;
  pages?: number;
}

export interface DataSource {
  find(model: string, options?: FindOptions): Promise<FindResult>;
  find_one(model: string, id: string): Promise<Record<string, unknown> | null>;
  create(model: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  update(model: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>;
  delete(model: string, id: string): Promise<void>;
  count(model: string, filters?: Record<string, unknown>): Promise<number>;
  group(model: string, field: string, filters?: Record<string, unknown>): Promise<Array<{ value: unknown; count: number }>>;
  aggregate(model: string, field: string, op: string, filters?: Record<string, unknown>): Promise<number>;
  subscribe?(model: string, filters: Record<string, unknown> | undefined, callback: (records: unknown[]) => void): () => void;
}

/* ── App Studio State ───────────────────────────── */

export interface AppStudioState {
  $models: Atom<Map<string, ModelDefinition>>;
  $views: Atom<Map<string, ViewDefinition>>;
  $actions: Atom<Map<string, ActionDefinition>>;
  $menus: Atom<Map<string, MenuDefinition>>;
  $widgets: Atom<Map<string, unknown>>;
  $data_sources: Atom<Map<string, DataSource>>;
  $current_view: Atom<ViewDefinition | null>;
  $current_record: Atom<Record<string, unknown> | null>;
  $records: Atom<Map<string, unknown[]>>;
  $filters: Atom<Map<string, Record<string, unknown>>>;
}

/* ── Memory Adapter ─────────────────────────────── */

function create_memory_source(): DataSource {
  const tables = new Map<string, Map<string, Record<string, unknown>>>();

  const get_table = (model: string) => {
    if (!tables.has(model)) tables.set(model, new Map());
    return tables.get(model)!;
  };

  return {
    async find(model, options = {}) {
      const table = get_table(model);
      let records = [...table.values()];

      // Sort
      if (options.sort) {
        const { field, direction } = options.sort;
        records.sort((a, b) => {
          const va = a[field] as string;
          const vb = b[field] as string;
          const cmp = va < vb ? -1 : va > vb ? 1 : 0;
          return direction === "desc" ? -cmp : cmp;
        });
      }

      const total = records.length;

      // Pagination
      if (options.page != null && options.limit) {
        const start = (options.page - 1) * options.limit;
        records = records.slice(start, start + options.limit);
        return {
          records,
          total,
          page: options.page,
          pages: Math.ceil(total / options.limit),
        };
      }

      if (options.offset != null) records = records.slice(options.offset);
      if (options.limit != null) records = records.slice(0, options.limit);

      return { records, total };
    },

    async find_one(model, id) {
      return get_table(model).get(id) ?? null;
    },

    async create(model, data) {
      const id = (data.id as string) || crypto.randomUUID();
      const record = { ...data, id };
      get_table(model).set(id, record);
      return record;
    },

    async update(model, id, data) {
      const table = get_table(model);
      const existing = table.get(id);
      if (!existing) throw new Error(`Record not found: ${model}/${id}`);
      const updated = { ...existing, ...data, id };
      table.set(id, updated);
      return updated;
    },

    async delete(model, id) {
      get_table(model).delete(id);
    },

    async count(model) {
      return get_table(model).size;
    },

    async group(model, field) {
      const table = get_table(model);
      const counts = new Map<unknown, number>();
      for (const record of table.values()) {
        const val = record[field];
        counts.set(val, (counts.get(val) ?? 0) + 1);
      }
      return [...counts.entries()].map(([value, count]) => ({ value, count }));
    },

    async aggregate(model, field, op) {
      const table = get_table(model);
      const values = [...table.values()].map((r) => r[field] as number).filter((v) => typeof v === "number");
      if (values.length === 0) return 0;
      switch (op) {
        case "sum": return values.reduce((a, b) => a + b, 0);
        case "avg": return values.reduce((a, b) => a + b, 0) / values.length;
        case "min": return Math.min(...values);
        case "max": return Math.max(...values);
        default: return 0;
      }
    },
  };
}

/**
 * App Studio — Layer 2
 *
 * Visual low-code builder sub-plugins. Creates its own reactive atoms
 * using xkin.store, registers into xkin's plugin system. All use xkin only.
 */
export function register_app_studio(xkin: XkinAPI, _parent_ctx: PluginContext) {
  const { atom } = xkin.store;
  const { h } = xkin.engine;

  /* ── App Studio State (created with xkin.store) ── */

  const state: AppStudioState = {
    $models: atom(new Map()) as Atom<Map<string, ModelDefinition>>,
    $views: atom(new Map()) as Atom<Map<string, ViewDefinition>>,
    $actions: atom(new Map()) as Atom<Map<string, ActionDefinition>>,
    $menus: atom(new Map()) as Atom<Map<string, MenuDefinition>>,
    $widgets: atom(new Map()) as Atom<Map<string, unknown>>,
    $data_sources: atom(new Map()) as Atom<Map<string, DataSource>>,
    $current_view: atom(null) as Atom<ViewDefinition | null>,
    $current_record: atom(null) as Atom<Record<string, unknown> | null>,
    $records: atom(new Map()) as Atom<Map<string, unknown[]>>,
    $filters: atom(new Map()) as Atom<Map<string, Record<string, unknown>>>,
  };

  /* ── Load App Definition ──────────────────────── */

  const load_app = (def: AppDefinition) => {
    const models = new Map<string, ModelDefinition>();
    for (const [id, model] of Object.entries(def.models)) {
      models.set(id, model);
    }
    state.$models.set(models);

    const views = new Map<string, ViewDefinition>();
    for (const [id, view] of Object.entries(def.views)) {
      views.set(id, view);
    }
    state.$views.set(views);

    if (def.actions) {
      const actions = new Map<string, ActionDefinition>();
      for (const [id, action] of Object.entries(def.actions)) {
        actions.set(id, action);
      }
      state.$actions.set(actions);
    }

    if (def.menus) {
      const menus = new Map<string, MenuDefinition>();
      for (const [id, menu] of Object.entries(def.menus)) {
        menus.set(id, menu);
      }
      state.$menus.set(menus);
    }

    // Register default memory data source
    const sources = new Map<string, DataSource>();
    sources.set("default", create_memory_source());
    state.$data_sources.set(sources);
  };

  /* ── Model Editor Plugin ──────────────────────── */

  xkin.plugins.register({
    id: "as.model-editor",
    name: "Model Editor",
    version: "0.1.0",
    permissions: ["ui", "hooks"],
    activation: "on_load",
    activate(ctx) {
      ctx.contribute("sidebar_left", {
        id: "as.models",
        label: "Models",
        icon: "database",
        order: 10,
        render: () => {
          const models = state.$models.get();
          return h("div", { class: "as-models" },
            h("h3", null, "Models"),
            h("ul", null,
              ...[...models.values()].map((m) =>
                h("li", { key: m.id },
                  h("span", null, m.icon ? `${m.icon} ` : ""),
                  m.label,
                  h("small", null, ` (${Object.keys(m.fields).length} fields)`),
                ),
              ),
            ),
          );
        },
      });
    },
  });

  /* ── View Designer Plugin ─────────────────────── */

  xkin.plugins.register({
    id: "as.view-designer",
    name: "View Designer",
    version: "0.1.0",
    permissions: ["ui", "hooks"],
    activation: "on_load",
    activate(ctx) {
      ctx.contribute("sidebar_left", {
        id: "as.views",
        label: "Views",
        icon: "layout",
        order: 11,
        render: () => {
          const views = state.$views.get();
          return h("div", { class: "as-views" },
            h("h3", null, "Views"),
            h("ul", null,
              ...[...views.values()].map((v) =>
                h("li", { key: v.id },
                  h("span", { class: "view-type" }, v.type),
                  " ",
                  v.label,
                ),
              ),
            ),
          );
        },
      });
    },
  });

  /* ── Return App Studio API ────────────────────── */

  return {
    state,
    load_app,
    create_memory_source,
  };
}
