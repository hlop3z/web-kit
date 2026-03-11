# Adapter Evaluation: Waria + Uizy

Should these be the **default adapter plugins** that ship as optional starter kits?

**Key principle:** Xkin Studio is library-agnostic. No UI library is embedded.
Waria and Uizy are adapter plugins — users can swap them, extend them, or
build entirely from scratch. The studio provides the infrastructure
(registry, build pipeline, MDX composition); adapters provide the components.

---

## What They Are

**Waria** — Framework-agnostic Web Components library. 30+ accessible, unstyled UI primitives (accordion, dialog, tabs, menu, tooltip, etc.). Zero runtime dependencies. WCAG 2.1 AA compliant. Schema-based `defineComponent()` factory. Built-in focus traps, roving tabindex, portals, positioning. ~13K lines, pure vanilla JS.

**Uizy** — Micro utility-first CSS framework + layout shell. Web Components for app structure (`<uizy-app>`, `<uizy-header>`, `<uizy-drawer>`, etc.). Reactive state via nanostores. Component/action/directive registry. Plugin system. Theme engine with CSS custom properties. ~3.3K lines, only dependency is nanostores.

---

## How They Map to the Architecture

```
Architecture Layer          Waria provides              Uizy provides
─────────────────           ──────────────              ─────────────
Component (pure UI)         30+ accessible primitives   —
Layout (page structure)     —                           App shell (header/drawer/main/footer)
Widget (component + state)  createState/createDerived   nanostores + directive bindings
View (full page)            —                           Theme + layout + responsive breakpoints
Theme (design tokens)       — (unstyled by design)      CSS custom properties, system colors
StoreAdapter                createState (lightweight)    nanostores integration
Runtime (xkin_gui)          Event delegation, scheduler  Plugin registry, action system
```

**Together they cover every layer.** Waria is the UI primitive foundation. Uizy is the app shell + styling + state wiring.

---

## YES — Why They Should Be the Base

### 1. Output independence is already solved

Both produce **pure HTML + vanilla JS**. No virtual DOM, no framework runtime. This directly satisfies the architecture's core rule: "final product has zero dependency on the builder system." Users get real DOM elements, not framework abstractions.

### 2. Accessibility is built-in, not bolted on

Waria's 30+ components ship with WCAG 2.1 AA compliance, ARIA attributes, keyboard navigation, focus management, and screen reader support. This is extremely expensive to build from scratch and easy to get wrong. Users inherit accessible patterns by default.

### 3. The layering is natural

```
User builds a dashboard:
  └── View uses Uizy layout shell (header + drawer + main)
       └── Widgets use Waria primitives (tabs, dialog, menu)
            └── Components are pure HTML fragments rendered via Xkin Studio
```

Each layer has a clear owner. No overlap.

### 4. Zero/minimal runtime cost

- Waria: 0 dependencies, ~693KB source
- Uizy: 1 dependency (nanostores ~2KB), ~138KB source
- Combined: lighter than a single React render

### 5. Both are yours to align

Since you own both libraries, you can evolve them to fit the architecture precisely — align APIs, remove friction, ensure they speak the same language.

---

## CONCERNS — Where Tension Exists

### 1. Two state systems

**Problem:** Waria has `createState()` + `createDerived()`. Uizy uses nanostores (`atom`, `computed`). The architecture defines a single `StoreAdapter` contract. Two competing reactivity models in the base kit creates confusion.

**Fix:** Pick one as canonical. nanostores is the better choice — it's battle-tested, tiny (~2KB), and already has ecosystem adapters. Refactor Waria's `createState` to be an internal detail (for its own component internals), but expose nanostores as the user-facing state API. Or: make Waria's state adapter-agnostic (it already is internally — `createState` is a simple pub/sub that could wrap any store).

**Recommended path:**

```
Internal (Waria components)  → createState (private, for component internals)
User-facing state            → StoreAdapter interface
Default adapter              → nanostores (via Uizy)
```

### 2. Two component models

**Problem:** Waria uses `defineComponent()` with a schema (props, state, events, ARIA). Uizy uses `uizy.add()` registry with dot-notation paths. The architecture defines `Component` as an entity with `PropDef[]` + `SlotDef[]`. Three models is two too many.

**Fix:** Waria's `defineComponent()` IS the Component entity factory — it already has typed props, slots, lifecycle, and ARIA. Make it the single component definition API. Uizy's registry becomes the runtime registry that indexes built components by ID. The Studio's Component entity maps directly to Waria's schema.

```
Studio Component entity  →  Waria defineComponent() schema  →  Uizy registry (runtime index)
```

### 3. Uizy is very early (v0.1.7)

**Problem:** Pre-release, limited docs, no test suite visible. Breaking changes likely.

**Fix:** This is fine for a base kit because you own it. Lock the API contract now (the parts users depend on) and iterate internals freely. The architecture doc's entity model IS the contract — implement Uizy against it.

### 4. Uizy's layout is opinionated

**Problem:** `<uizy-header>`, `<uizy-drawer>`, `<uizy-main>` assume a specific app shell pattern (dashboard-style). Not every View needs a drawer.

**Fix:** This is actually correct for the **default Layout**. The architecture says "a blank layout that just renders the component inside it" as default, with Uizy's dashboard layout as a **named Layout option**. Users pick `layout: "dashboard"` or `layout: "blank"` or define their own.

```
Built-in Layouts:
  "blank"      — just <div id="root">{children}</div>
  "dashboard"  — Uizy's header + drawer + main + footer
  "centered"   — centered content card
  custom       — user-defined via layout.tsx
```

### 5. Theme alignment

**Problem:** Uizy has a theme system (CSS custom properties for colors, scrollbar, brands). The architecture defines `Theme` as an entity with `DesignToken[]`. These must be the same system, not parallel ones.

**Fix:** Uizy's `uizy.theme()` becomes the default `Theme → CSS` emitter. The architecture's `DesignToken` value objects map to Uizy's CSS custom property names. When the Studio builds a View, it calls `uizy.theme(tokens)` to generate the CSS.

```
Studio DesignToken { path: "color.primary", value: "#569cd6" }
  ↓ emits
Uizy CSS: --color-primary: #569cd6;
```

---

## Adapter Architecture

The studio is the **infrastructure layer** — it provides the registry, build pipeline,
MDX composition, and authoring environment. It knows nothing about specific UI libraries.

Libraries plug in as **adapters** that register definitions into the prefix registry:

```
┌─────────────────────────────────────────────────────────────┐
│  Xkin Studio (infrastructure — library-agnostic)            │
│  ├── Prefix registry     → routes symbols to entity types   │
│  ├── Build pipeline      → compiles to pure HTML/CSS/JS     │
│  ├── MDX composition     → tree + symbols + resolution      │
│  └── Authoring UI        → editor, preview, explorer        │
└──────────────────┬──────────────────────────────────────────┘
                   │
        ┌──────────┼──────────┐
        ▼          ▼          ▼
   ┌─────────┐ ┌────────┐ ┌──────────┐
   │ Adapter  │ │Adapter │ │ Adapter  │
   │ waria    │ │ uizy   │ │ custom   │   ← user chooses / builds their own
   │(ui-*)    │ │(layout)│ │(chart-*) │
   └─────────┘ └────────┘ └──────────┘
        │          │          │
        └──────────┼──────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Output (zero Studio + zero adapter dependency)             │
│  ├── index.html    ← layout + components as pure HTML       │
│  ├── styles.css    ← theme tokens as CSS custom properties  │
│  ├── app.js        ← state bindings (if stateful)           │
│  └── (no Preact, no Studio, no adapter code in output)      │
└─────────────────────────────────────────────────────────────┘
```

### What an Adapter Does

An adapter is a plugin that registers entity definitions into the Studio's prefix registry:

```typescript
// xkin-adapter-waria (example — users write their own)
export function register(registry: Registry) {
  registry.register_component({ id: "button", name: "Button", template: "...", props: [...], slots: [], style_refs: [], meta: {} });
  registry.register_component({ id: "dialog", name: "Dialog", template: "...", props: [...], slots: ["content", "footer"], style_refs: [], meta: {} });
  // ... 30+ accessible components
}

// xkin-adapter-uizy (example)
export function register(registry: Registry) {
  registry.register_layout({ id: "dashboard", name: "Dashboard", regions: [{ name: "header" }, { name: "main" }, { name: "sidebar" }], template: "...", meta: {} });
  registry.register_layout({ id: "centered", name: "Centered", regions: [{ name: "content" }], template: "...", meta: {} });
}

// User's own adapter
export function register(registry: Registry) {
  registry.add_prefix({ prefix: "chart", entity_type: "component", description: "D3 charts" });
  registry.register_component({ id: "bar-chart", name: "Bar Chart", template: "...", props: [...], slots: [], style_refs: [], meta: {} });
}
```

### Role Assignment (when using Waria + Uizy as adapters)

| Concern                    | Adapter        | Studio provides            |
| -------------------------- | -------------- | -------------------------- |
| UI primitives              | waria adapter  | Component registry         |
| App shell / layout         | uizy adapter   | Layout registry            |
| Utility CSS                | uizy adapter   | CSS injection in root.html |
| Theme / design tokens      | any adapter    | Theme entity + CSS vars    |
| State management           | any adapter    | StoreAdapter contract      |
| Component definition       | any adapter    | ComponentDef interface     |
| Build pipeline             | —              | **Xkin Studio** (core)     |
| MDX composition            | —              | **Xkin Studio** (core)     |
| Authoring environment      | —              | **Xkin Studio** (core)     |

---

## Starter Kits (not embedded, user-chosen)

When a user starts a new project, they **choose** a starter kit (or start blank):

```
Starter: "waria + uizy" (default recommended)
  Adapters loaded: xkin-adapter-waria, xkin-adapter-uizy
  Files scaffolded: root.html, layout.tsx, index.tsx, styles.scss

Starter: "minimal" (no adapters)
  Adapters loaded: none
  Files scaffolded: root.html, index.tsx

Starter: "custom"
  Adapters loaded: user's own
  Files scaffolded: user-defined template
```

The user writes Preact components in the Studio (for DX), the build pipeline converts them to pure HTML via `renderToString`, and the output is standalone — no Preact, no Studio code, no adapter runtime unless the adapter explicitly requires one.

---

## Action Items

1. **Define the Adapter interface** — `register(registry: Registry)` is the entry point
2. **Build xkin-adapter-waria** — maps Waria's `defineComponent()` schemas to `ComponentDef`
3. **Build xkin-adapter-uizy** — maps Uizy's layouts + theme to `LayoutDef` + `DesignToken`
4. **Starter kit system** — project templates that pre-load adapters and scaffold files
5. **Keep Studio core adapter-free** — zero imports from waria/uizy in studio source

---

## Verdict

**YES — use both as the default starter kit (not embedded dependency).**

- Waria = **what** (accessible UI primitives) — plugged in via adapter
- Uizy = **where** (layout + styling) — plugged in via adapter
- Xkin Studio = **how** (infrastructure: registry, build, MDX, authoring)

The studio never imports or depends on either library. Adapters bridge the gap.
Users who want Shoelace, Radix, or their own components just write a different adapter.
Since you own Waria and Uizy, you can build the adapters yourself and ship them as the recommended default — but they're always swappable.
