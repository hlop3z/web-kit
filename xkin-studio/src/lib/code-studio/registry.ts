/**
 * Prefix Registry — domain namespace resolution for MDX composition.
 *
 * Components in MDX use prefixed tags: <ui-button>, <layout-dashboard>, <widget-stats>.
 * The prefix determines which registry to look up and which build steps to run.
 *
 * Built-in prefixes (entity type routing):
 *   ui-*       → Component (core UI primitives)
 *   layout-*   → Layout (page structures)
 *   widget-*   → Widget (component + state bindings)
 *   app-*      → View (full page compositions)
 *   data-*     → Component (data display)
 *   form-*     → Component (form elements)
 *   nav-*      → Component (navigation)
 *   icon-*     → Component (icon set)
 *
 * The registry is library-agnostic — no UI library is embedded.
 * Users (or adapter plugins) register their own component definitions.
 * Custom prefixes can be added via `add_prefix()` for new domains.
 */

/* ── Types ─────────────────────────────────────── */

export interface ComponentDef {
  id: string;
  name: string;
  template: string;
  props: PropDef[];
  slots: SlotDef[];
  style_refs: string[];
  meta: Record<string, unknown>;
}

export interface LayoutDef {
  id: string;
  name: string;
  regions: RegionDef[];
  template: string;
  meta: Record<string, unknown>;
}

export interface WidgetDef {
  id: string;
  name: string;
  component: string;
  bindings: StateBinding[];
  events: EventBinding[];
  meta: Record<string, unknown>;
}

export interface ViewDef {
  id: string;
  name: string;
  layout: string;
  placements: Placement[];
  theme: string;
  root: string;
  meta: Record<string, unknown>;
}

export interface PropDef {
  name: string;
  type: string;
  default?: unknown;
  required: boolean;
}

export interface SlotDef {
  name: string;
  fallback?: string;
}

export interface RegionDef {
  name: string;
  accepts?: string[];
  max_items?: number;
}

export interface StateBinding {
  prop: string;
  state_key: string;
}

export interface EventBinding {
  event: string;
  action: string;
  state_key?: string;
}

export interface Placement {
  region: string;
  widget: string;
  order: number;
  config?: Record<string, unknown>;
}

/* ── Prefix Config ─────────────────────────────── */

export type EntityType = "component" | "layout" | "widget" | "view";

export interface PrefixConfig {
  prefix: string;
  entity_type: EntityType;
  description: string;
}

/** Built-in prefix mappings */
const BUILTIN_PREFIXES: PrefixConfig[] = [
  { prefix: "ui",     entity_type: "component", description: "Core UI primitives" },
  { prefix: "layout", entity_type: "layout",    description: "Page structures" },
  { prefix: "widget", entity_type: "widget",    description: "Stateful compositions" },
  { prefix: "app",    entity_type: "view",      description: "Full page views" },
  { prefix: "data",   entity_type: "component", description: "Data display (table, chart)" },
  { prefix: "form",   entity_type: "component", description: "Form elements" },
  { prefix: "nav",    entity_type: "component", description: "Navigation elements" },
  { prefix: "icon",   entity_type: "component", description: "Icon set" },
];

/* ── Registry ──────────────────────────────────── */

export interface ResolvedSymbol {
  raw: string;
  prefix: string;
  name: string;
  entity_type: EntityType;
  definition: ComponentDef | LayoutDef | WidgetDef | ViewDef | null;
}

export function create_registry() {
  const prefixes = new Map<string, PrefixConfig>();
  const components = new Map<string, ComponentDef>();
  const layouts = new Map<string, LayoutDef>();
  const widgets = new Map<string, WidgetDef>();
  const views = new Map<string, ViewDef>();

  // Initialize built-in prefixes
  for (const p of BUILTIN_PREFIXES) {
    prefixes.set(p.prefix, p);
  }

  /** Parse a prefixed tag name into prefix + name */
  function parse_symbol(tag: string): { prefix: string; name: string } | null {
    const idx = tag.indexOf("-");
    if (idx < 1) return null;
    return { prefix: tag.slice(0, idx), name: tag.slice(idx + 1) };
  }

  /** Get the registry map for an entity type */
  function get_store(type: EntityType) {
    switch (type) {
      case "component": return components;
      case "layout":    return layouts;
      case "widget":    return widgets;
      case "view":      return views;
    }
  }

  return {
    /* ── Prefix Management ─────────────────────── */

    /** Register a custom prefix */
    add_prefix(config: PrefixConfig) {
      prefixes.set(config.prefix, config);
    },

    /** Get prefix config */
    get_prefix(prefix: string): PrefixConfig | null {
      return prefixes.get(prefix) ?? null;
    },

    /** List all registered prefixes */
    list_prefixes(): PrefixConfig[] {
      return [...prefixes.values()];
    },

    /* ── Entity Registration ───────────────────── */

    /** Register a component definition */
    register_component(def: ComponentDef) {
      components.set(def.id, def);
    },

    /** Register a layout definition */
    register_layout(def: LayoutDef) {
      layouts.set(def.id, def);
    },

    /** Register a widget definition */
    register_widget(def: WidgetDef) {
      widgets.set(def.id, def);
    },

    /** Register a view definition */
    register_view(def: ViewDef) {
      views.set(def.id, def);
    },

    /* ── Symbol Resolution ─────────────────────── */

    /** Resolve a single prefixed tag name to its entity */
    resolve(tag: string): ResolvedSymbol | null {
      const parsed = parse_symbol(tag);
      if (!parsed) return null;

      const config = prefixes.get(parsed.prefix);
      if (!config) return null;

      const store = get_store(config.entity_type);
      const definition = store.get(parsed.name) ?? store.get(tag) ?? null;

      return {
        raw: tag,
        prefix: parsed.prefix,
        name: parsed.name,
        entity_type: config.entity_type,
        definition,
      };
    },

    /** Resolve all symbols from an MDX compilation result */
    resolve_symbols(symbols: string[]): {
      resolved: ResolvedSymbol[];
      unresolved: string[];
    } {
      const resolved: ResolvedSymbol[] = [];
      const unresolved: string[] = [];

      for (const sym of symbols) {
        const result = this.resolve(sym);
        if (result) {
          resolved.push(result);
        } else {
          // Try with common prefixes (MDX strips the prefix from symbols)
          let found = false;
          for (const [prefix, config] of prefixes) {
            const full_tag = `${prefix}-${sym}`;
            const store = get_store(config.entity_type);
            const def = store.get(sym) ?? store.get(full_tag) ?? null;
            if (def) {
              resolved.push({
                raw: sym,
                prefix,
                name: sym,
                entity_type: config.entity_type,
                definition: def,
              });
              found = true;
              break;
            }
          }
          if (!found) unresolved.push(sym);
        }
      }

      return { resolved, unresolved };
    },

    /* ── Queries ───────────────────────────────── */

    /** List all entities of a type */
    list(type: EntityType): Array<ComponentDef | LayoutDef | WidgetDef | ViewDef> {
      return [...get_store(type).values()];
    },

    /** List all entities under a prefix */
    list_by_prefix(prefix: string): Array<ComponentDef | LayoutDef | WidgetDef | ViewDef> {
      const config = prefixes.get(prefix);
      if (!config) return [];
      return [...get_store(config.entity_type).values()];
    },

    /** Get a specific entity by type and ID */
    get(type: EntityType, id: string): ComponentDef | LayoutDef | WidgetDef | ViewDef | null {
      return get_store(type).get(id) ?? null;
    },

    /** Count entities by type */
    count(type: EntityType): number {
      return get_store(type).size;
    },

    /** Clear all registrations (for testing) */
    clear() {
      components.clear();
      layouts.clear();
      widgets.clear();
      views.clear();
    },
  };
}

export type Registry = ReturnType<typeof create_registry>;
