# Xkin Studio — Architecture

## Where Others Fail (and what we learn)

### Odoo (XPath inheritance)

**Failure:** Multiple modules modifying the same view via XPath selectors cause silent collisions. Changing a model field name requires hunting through XML inheritance chains across all modules.
**Lesson:** Override via **composition** (named slots), never via mutation (find-and-replace). Extension points must be explicit.

### Storybook (isolation gap)

**Failure:** Components run outside their real context — no real routing, state, or API layer. Mock environment diverges from production. It cannot become a builder because stories are read-only — no serialization back to code.
**Lesson:** The authoring environment must produce **real output**, not isolated demos. The preview must run the actual build pipeline.

### Mitosis (lowest-common-denominator)

**Failure:** Every feature must work in every target framework. State semantics diverge (proxy vs signal vs compiled vs scheduler). Constraint violations compile successfully but produce broken output in specific targets.
**Lesson:** Do NOT target every framework. Target **HTML** — the one universal output. Let consumers decide their runtime. State abstraction must be a contract, not a universal implementation.

### Plasmic (sync problem)

**Failure:** Codegen creates source files that conflict when two features are in progress. Once a developer modifies generated code, the visual builder can no longer safely regenerate. The visual representation forks from the actual code.
**Lesson:** Generated output must be **dumb and disposable** — no embedded metadata, no round-trip requirements. The source of truth is the domain model (JSON), not the output (HTML).

### Web Components (styling isolation)

**Failure:** Shadow DOM couples encapsulation with styling isolation. Global styles cannot penetrate. `::slotted()` only targets direct children. Theming requires every hook to be pre-planned by the component author.
**Lesson:** Use **CSS custom properties and token references** for theming, not shadow DOM isolation. Encapsulation at the build level, not runtime.

### Bit.dev (version diamond)

**Failure:** Updating a foundational component triggers cascading rebuilds across the entire dependency graph. Component identity is coupled to proprietary cloud infrastructure.
**Lesson:** Component identity must use **standard semantics** (name + version). Avoid deep dependency chains — prefer flat composition.

### Alpine.js (state-template fusion)

**Failure:** State and template are fused in the DOM. Cannot test state without DOM. Cannot render server-side without headless browser. No component abstraction — reuse requires copy-paste. Store property assignment breaks sync (must always reference `$store` directly).
**Lesson:** State logic must be **testable without DOM**. Templates must be **renderable without state**. The binding layer connects them but is neither.

### Astro Islands (boundary problem)

**Failure:** Islands cannot share state — each is a separate framework tree. The static/interactive boundary decision pervades the entire codebase and is hard to change later.
**Lesson:** Make the static/interactive boundary **explicit but movable**. Widgets declare their interactivity requirements — the View decides hydration strategy.

---

## Hard Rules (Anti-Patterns to Avoid)

| Rule                       | Violation                                          | Why It Hurts                                             |
| -------------------------- | -------------------------------------------------- | -------------------------------------------------------- |
| **Components are pure**    | Component imports a store or framework             | Output locked to one runtime forever                     |
| **Tokens, not values**     | `color="#569cd6"` as a prop                        | Impossible to retheme; values are baked in               |
| **Layout != Component**    | Layout is just a component with children           | Loses semantic distinction; regions become generic slots |
| **State is a contract**    | Widget contains store implementation               | Widget not portable between store adapters               |
| **No expression language** | `state_key: "items.filter(x => x.active).length"`  | Rebuilding JavaScript inside a string (inner platform)   |
| **No layout engine**       | Modeling `row`, `column`, `gap` as domain entities | Rebuilding CSS; use TokenReferences instead              |
| **Slots, not nesting**     | `Component.children: Component[]` unlimited depth  | Rebuilding the DOM tree                                  |
| **Compose, don't mutate**  | XPath-style "find element X and replace it"        | Silent collisions, untraceable inheritance               |

---

## Bounded Contexts

```
BC1: Authoring                BC2: Theming
  Component                     Theme
  Layout                        DesignToken
  Widget                        Breakpoint
  (pure definitions)            (style system)
        |                           |
        |     string references     |
        +----------+----------------+
                   |
            BC3: Composition
              View
              Build Pipeline
              (assembles everything)
                   |
                   |
            BC4: Runtime Adaptation
              StoreAdapter
              Output Emitter
              (pluggable infrastructure)
```

Communication between contexts uses **string references only** (IDs, token paths) — never direct object references.

---

## Entity Model

### Entities (have identity, mutable)

```
Component (Aggregate Root — Authoring BC)
  id          : string
  name        : string
  template    : string              # Preact source → renderToString → HTML
  props       : PropDef[]           # declared inputs
  slots       : SlotDef[]           # named content insertion points
  style_refs  : string[]            # token paths (e.g., "color.primary")
  meta        : Record<string, unknown>

Layout (Aggregate Root — Authoring BC)
  id          : string
  name        : string
  regions     : RegionDef[]         # named areas (header, main, sidebar, footer)
  template    : string              # HTML template with {{region}} placeholders
  meta        : Record<string, unknown>

Widget (Aggregate Root — Authoring BC)
  id          : string
  name        : string
  component   : string              # → Component.id (reference, not object)
  bindings    : StateBinding[]      # maps prop names to state keys
  events      : EventBinding[]      # maps DOM events to state mutations
  meta        : Record<string, unknown>

View (Aggregate Root — Composition BC)
  id          : string
  name        : string
  layout      : string              # → Layout.id
  placements  : Placement[]         # which Widget goes in which region
  theme       : string              # → Theme.id
  root        : string              # → root.html template (or default)
  meta        : Record<string, unknown>

Theme (Aggregate Root — Theming BC)
  id          : string
  name        : string
  tokens      : DesignToken[]
  breakpoints : Breakpoint[]
  meta        : Record<string, unknown>

StoreAdapter (Aggregate Root — Runtime BC)
  id          : string
  type        : string              # "vanilla" | "alpine" | "nano" | custom
  schema      : StateSchema
  emit()      : string              # produces JS code for the chosen runtime
```

### Value Objects (immutable, no identity)

```
PropDef        { name, type, default?, required }
SlotDef        { name, fallback? }
RegionDef      { name, accepts?: string[], max_items? }
DesignToken    { path, value, type }           # "color.primary.500" → "#569cd6"
StateBinding   { prop, state_key }             # "count" → "cart.count"
EventBinding   { event, action, state_key? }   # "click" → "increment"
Placement      { region, widget, order }       # "main" → "counter-widget" @ 1
Breakpoint     { name, min_width }
StateSchema    { keys: Record<string, { type, default }> }
```

### Relationships

```
Component  1 ─── N  PropDef           (owns)
Component  1 ─── N  SlotDef           (owns)
Component  1 ─── N  string            (references token paths)
Layout     1 ─── N  RegionDef         (owns)
Widget     N ─── 1  Component         (references by ID)
Widget     1 ─── N  StateBinding      (owns)
Widget     1 ─── N  EventBinding      (owns)
View       N ─── 1  Layout            (references by ID)
View       N ─── 1  Theme             (references by ID)
View       1 ─── N  Placement         (owns)
Placement  N ─── 1  Widget            (references by ID)
Theme      1 ─── N  DesignToken       (owns)
```

### Aggregate Boundaries

```
Aggregate 1: Component + PropDef[] + SlotDef[]
Aggregate 2: Layout + RegionDef[]
Aggregate 3: Widget + StateBinding[] + EventBinding[]
Aggregate 4: View + Placement[]
Aggregate 5: Theme + DesignToken[] + Breakpoint[]
Aggregate 6: StoreAdapter + StateSchema
```

**Invariants enforced per aggregate:**

- Component: prop names unique, slot names unique
- Layout: region names unique
- Widget: every binding.prop must exist in referenced Component.props
- View: every placement.region must exist in referenced Layout.regions
- Theme: token paths unique

---

## MDX as the Composition Language

Views, Widgets, and Layouts compose via **MDX** — markdown with prefixed component tags.
MDX compiles to `{ tree, symbols }`: a serializable JSON tree + dependency list.

### Why MDX (not JSON config)

- Human-readable — it's markdown with components
- The tree output IS the domain model — serializable JSON, cacheable, diffable
- Symbols give you the dependency graph for free at parse time
- Prefixes organize symbols by bounded context
- Already implemented in web-kit (`xkin.mdx()`)
- Avoids inner platform effect — MDX IS the expression language, no custom DSL needed

### Prefix Registry — Domain Namespaces

```
Prefix       Bounded Context       Entity Type        Resolved From
──────       ───────────────       ───────────        ─────────────
ui-*         Authoring (Core)      Component          Registered component definitions
layout-*     Authoring (Core)      Layout             Registered layout definitions
widget-*     Authoring (App)       Widget             Component ref + StateBinding
app-*        Composition           View               Layout + Widgets
data-*       Authoring (Core)      Component          Data display (table, chart)
form-*       Authoring (Core)      Component          Form elements
nav-*        Authoring (Core)      Component          Navigation elements
icon-*       Theming               Component          Icon set
```

The prefix IS the bounded context marker. The build pipeline reads the prefix
to know which registry to look up, which build steps to run, and what to bundle.

**The registry is library-agnostic.** No UI library (Waria, Shoelace, custom, etc.)
is embedded. Users or adapter plugins register their own definitions:

```typescript
// User plugs in their own component library
registry.register_component({ id: "button", name: "Button", ... });
registry.register_component({ id: "card", name: "Card", ... });

// Or an adapter plugin does it in bulk
import { waria_adapter } from "xkin-adapter-waria";
waria_adapter.register_all(registry);
```

Custom prefixes can be added for new domains:
```typescript
registry.add_prefix({ prefix: "chart", entity_type: "component", description: "Chart library" });
```

### MDX Composition Examples

**Widget definition** (counter.mdx):
```mdx
<ui-card>
  <ui-text bind="count" />
  <ui-button on:click="increment">+1</ui-button>
</ui-card>
```
→ `symbols: ["card", "text", "button"]` — all `ui-*`, resolved from the component registry

**View definition** (dashboard.mdx):
```mdx
# Sales Dashboard

<layout-dashboard>
  <widget-stats slot="header" store="sales.summary" />

  <widget-table slot="main" store="sales.orders">
    <ui-column label="Date" field="date" />
    <ui-column label="Amount" field="total" />
  </widget-table>

  <widget-chart slot="sidebar" store="sales.revenue" />
</layout-dashboard>
```
→ `symbols: ["stats", "table", "column", "chart", "dashboard"]`
→ Build resolves each by prefix: `layout-*` from Layout registry, `widget-*` from Widget registry, `ui-*` from Component registry

### MDX Build Pipeline

```
1. Author writes MDX (markdown + prefixed components)
          │
2. xkin.mdx({ source }) → { tree, symbols }
          │
3. Prefix router resolves each symbol:
     ui-button     → Component registry → registered definition
     layout-dash   → Layout registry    → registered template
     widget-stats  → Widget registry    → Component ref + StateBinding[]
          │
4. For each widget, StoreAdapter.emit() → JS bindings
          │
5. renderToString(tree, resolved_components) → pure HTML
          │
6. Inject into root.html → standalone page
```

## Composition Pipeline (Build)

```
Input (what devs author)              Output (what ships — zero deps)
─────────────────────────             ──────────────────────────────
Component (Preact source)     ──┐
                                ├──→  renderToString  ──→  HTML fragment
Slots (named insertion points)──┘

Layout (template + regions)   ──────→  HTML template with regions filled

Theme (design tokens)         ──────→  CSS custom properties file

Widget (MDX + bindings)       ──┐
                                ├──→  HTML fragment + <script> binding code
StoreAdapter.emit()           ──┘

View (MDX composition)        ───→  Complete standalone HTML page
                                      ├── index.html (Layout with Widgets placed)
                                      ├── styles.css (resolved tokens as CSS vars)
                                      └── app.js    (only if stateful; emitted by adapter)
```

### Per-Mode Build Pipeline

| Mode          | Input Files                    | Build Steps                                      | Output            |
| ------------- | ------------------------------ | ------------------------------------------------ | ----------------- |
| **Component** | `*.tsx` + `*.scss`             | merge → renderToString → CSS modules             | HTML string + CSS |
| **Layout**    | `layout.tsx` + regions config  | renderToString with `{{region}}` markers         | HTML template     |
| **Widget**    | `*.mdx` + `bindings.json`     | mdx → resolve symbols → bind state → emit JS     | HTML + `<script>` |
| **View**      | `*.mdx` + `root.html`         | mdx → resolve all prefixes → assemble → inject   | Standalone page   |

---

## Store Adapter Contract

```typescript
interface StoreAdapter {
  // Domain declares its needs
  declare(schema: StateSchema): void;

  // Runtime API (used by emitted JS)
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  subscribe(key: string, cb: (value: unknown) => void): () => void;

  // Build-time: emit JS code for this state approach
  emit(): string;
}
```

### Adapter Mapping

| Adapter               | `emit()` produces                      | State lives     |
| --------------------- | -------------------------------------- | --------------- |
| **vanilla** (default) | Plain JS object + event dispatch       | JS variable     |
| **alpine**            | `x-data` attributes + `Alpine.store()` | DOM attributes  |
| **nano**              | `import { atom } from 'nanostores'`    | JS module scope |
| **htmx**              | No JS — `hx-get`, `hx-swap` attributes | Server          |

---

## Runtime Global — `xkin_gui`

The final product exposes one global. No Preact, no Xkin internals:

```typescript
interface XkinGUI {
  // Store — abstract adapter (devs choose implementation)
  store: StoreAdapter;

  // Registries — built artifacts
  components: Record<string, (props?: any) => string>; // → HTML string
  layouts: Record<string, (slots: any) => string>; // → HTML template
  widgets: Record<string, (target: HTMLElement) => void>; // mounts with state
  views: Record<string, (target: HTMLElement) => void>; // full page mount

  // API
  mount(view_id: string, target: HTMLElement): void;
  render(component_id: string, props?: Record<string, unknown>): string;
}
```

---

## Studio Navigation

```
┌──────────────────────────────────────────────────────────────┐
│ Core: [Components · Layouts]    Apps: [Widgets · Views]      │
├──────────┬───────────────────────────────┬───────────────────┤
│ Pinned   │                               │                   │
│ + Parts  │  Editor                       │  Preview          │
│ + Config │                               │                   │
└──────────┴───────────────────────────────┴───────────────────┘
```

Each mode shows its own workspace with mode-appropriate file conventions and build pipeline.

---

## Key Design Decisions

1. **Preact is internal only.** Components are authored in Preact for DX, but `renderToString` compiles them to pure HTML. Zero runtime dependency.

2. **HTML is the universal target.** Not JSX, not framework IR, not virtual DOM. HTML is what every consumer can use. This avoids Mitosis's lowest-common-denominator trap.

3. **State is a contract, not implementation.** Widgets declare `StateBinding[]` — abstract key paths. The StoreAdapter emits the right runtime code. Widgets never import a store library.

4. **Tokens, not values.** Components reference design tokens by path string (`"color.primary"`). Themes resolve tokens to CSS custom properties. Retheming is a config swap.

5. **Composition over inheritance.** Named slots and regions — never XPath-style mutation. If you can't extend, add a new slot.

6. **Output is disposable.** Generated HTML has no embedded metadata, no builder IDs, no round-trip state. The source of truth is the domain model (JSON aggregates), not the output files.

7. **Flat over deep.** Components reference other components by ID, not by nesting. Widget references Component by ID. View references Layout by ID. No deep dependency chains.

8. **MDX is the composition language.** Views and Widgets are defined in MDX, not JSON config. MDX compiles to `{ tree, symbols }` — the tree is the serializable domain model, symbols are the dependency graph. No custom DSL needed.

9. **Prefixes are bounded context markers.** `ui-button`, `layout-dashboard`, `widget-stats` — the prefix routes to the correct registry and build pipeline. Adding a new domain is adding a new prefix.
