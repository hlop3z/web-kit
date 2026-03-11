import { useEffect, useState } from "preact/hooks";
import { create_mock_xkin } from "./dev/mock_xkin.ts";
import { create_studio, type StudioInstance } from "./lib/index.ts";
import type { XkinAPI } from "./lib/types.ts";

/* ── Tiny useStore hook (no extra deps) ────────── */

function useStore<T>(atom: { get(): T; subscribe(cb: (v: T) => void): () => void }): T {
  const [value, setValue] = useState(atom.get());
  useEffect(() => atom.subscribe(setValue), [atom]);
  return value;
}

/* ── Xkin Core detection ───────────────────────── */

/**
 * Detect whether the real Xkin Core loaded from dist/ bundles.
 * If window.Xkin exists and has a real files.create, use it.
 * Otherwise fall back to mock.
 */
/** Required top-level APIs for the studio to function */
const REQUIRED_APIS = ["files", "plugins", "keys", "hooks", "ui", "workspace", "store"] as const;

function get_xkin(): XkinAPI {
  const w = window as unknown as Record<string, unknown>;
  const global_xkin = w.Xkin as Record<string, unknown> | undefined;

  if (global_xkin) {
    const missing = REQUIRED_APIS.filter(
      (k) => typeof global_xkin[k] !== "object" || global_xkin[k] === null,
    );

    if (missing.length === 0) {
      console.log("[xkin-studio] Using Xkin Core from dist/");
      return global_xkin as unknown as XkinAPI;
    }

    console.warn(`[xkin-studio] Xkin Core found but missing: ${missing.join(", ")} — falling back to mock`);
  }

  console.log("[xkin-studio] Using mock (Xkin Core not loaded)");
  return create_mock_xkin();
}

/* ── Bootstrap ─────────────────────────────────── */

interface BootState {
  xkin: XkinAPI;
  studio: StudioInstance;
}

let cached: BootState | null = null;

async function boot(): Promise<BootState> {
  if (cached) return cached;

  const xkin = get_xkin();
  const studio = create_studio(xkin);

  // Register JSX types so Monaco doesn't complain about missing 'h'
  xkin.add_types([{
    path: "preact.d.ts",
    content: [
      "declare function h(tag: any, props?: any, ...children: any[]): any;",
      "declare const Fragment: unique symbol;",
      "declare function render(el: any, root: any): void;",
      "declare const styles: Record<string, string>;",
    ].join("\n"),
  }]);

  // Seed a demo component
  const counter = await studio.project.create_entity("Counter", "components");
  // Override the scaffold with richer demo files
  await xkin.files.clear();
  await xkin.files.create("index.tsx", [
    "const App = () => (",
    "  <div class={styles.app}>",
    "    <Header title=\"My App\" />",
    "    <Counter start={0} />",
    "  </div>",
    ");",
    "",
    "render(<App />, document.getElementById(\"root\"));",
  ].join("\n"), { main: true });

  await xkin.files.create("part_1.tsx", [
    "const Header = ({ title }: { title: string }) => (",
    "  <header class={styles.header}>",
    "    <h1>{title}</h1>",
    "    <p>Built with Xkin Studio</p>",
    "  </header>",
    ");",
  ].join("\n"));

  await xkin.files.create("part_2.tsx", [
    "const Counter = ({ start }: { start: number }) => {",
    "  let count = start;",
    "  return (",
    "    <div class={styles.card}>",
    "      <span class={styles.count}>{count}</span>",
    "      <button class={styles.button} onClick={() => console.log(++count)}>",
    "        Increment",
    "      </button>",
    "    </div>",
    "  );",
    "};",
  ].join("\n"));

  await xkin.files.create("styles.scss", [
    "$primary: #569cd6;",
    "$card-bg: #2d2d2d;",
    "$radius: 8px;",
    "",
    ".app { max-width: 600px; margin: 20px auto; color: #d4d4d4; }",
    "",
    ".header {",
    "  background: linear-gradient(135deg, $primary, darken($primary, 20%));",
    "  padding: 24px;",
    "  border-radius: $radius;",
    "  text-align: center;",
    "  h1 { color: white; }",
    "  p { color: rgba(white, .7); }",
    "}",
    "",
    ".card {",
    "  background: $card-bg;",
    "  border-radius: $radius;",
    "  padding: 20px;",
    "  display: flex;",
    "  gap: 16px;",
    "  align-items: center;",
    "}",
    "",
    ".count { font-size: 2rem; color: $primary; }",
    "",
    ".button {",
    "  padding: 8px 20px;",
    "  background: $primary;",
    "  color: white;",
    "  border: none;",
    "  border-radius: 4px;",
    "  cursor: pointer;",
    "  &:hover { background: lighten($primary, 10%); }",
    "}",
  ].join("\n"));

  xkin.files.mark_all_clean();

  // Save the demo entity's files and auto-open
  studio.project.capture();
  xkin.files.open("index.tsx");
  xkin.files.open("styles.scss");
  xkin.files.set_active("index.tsx", null);

  // Seed a demo layout
  await studio.project.create_entity("Dashboard", "layouts");

  // Stress test: seed many components
  const names = [
    "Button", "Card", "Modal", "Tooltip", "Dropdown", "Tabs", "Accordion",
    "Breadcrumb", "Avatar", "Badge", "Alert", "Toast", "Spinner", "Skeleton",
    "Progress", "Slider", "Switch", "Checkbox", "Radio", "Select", "Input",
    "Textarea", "DatePicker", "TimePicker", "ColorPicker", "FileUpload",
    "Pagination", "Table", "DataGrid", "TreeView", "Menu", "Sidebar",
    "Navbar", "Footer", "Hero", "Banner", "Callout", "Divider", "Stepper",
    "Popover", "Dialog", "Drawer", "Sheet", "Command", "Combobox",
    "Calendar", "Chart", "Stat", "Metric", "KPI", "Widget",
  ];
  for (let i = 0; i < 100; i++) {
    const base = names[i % names.length];
    const suffix = i >= names.length ? ` ${Math.floor(i / names.length) + 1}` : "";
    await studio.project.create_entity(`${base}${suffix}`, "components");
  }

  // Switch back to the counter component
  await studio.project.switch_entity(counter.id);

  cached = { xkin, studio };
  return cached;
}

/* ── App Shell ─────────────────────────────────── */

export function App() {
  const [state, setState] = useState<BootState | null>(null);

  useEffect(() => {
    boot().then(setState);
  }, []);

  if (!state) return <div class="cs-loading">Loading...</div>;

  return <IDE xkin={state.xkin} studio={state.studio} />;
}

/* ── IDE Layout ────────────────────────────────── */

function IDE({ xkin, studio }: { xkin: XkinAPI; studio: StudioInstance }) {
  const { project } = studio;

  // Subscribe to reactive state so the shell re-renders
  useStore(xkin.ui.$slots);
  useStore(xkin.$files);
  useStore(xkin.$active_file);
  useStore(xkin.$open_files);
  useStore(xkin.$dirty_files);
  useStore(project.$mode);
  useStore(project.$entities);
  useStore(project.$active_entity);

  const render_slot = (name: string) => {
    const items = xkin.ui.get(name) as Array<{
      render?: () => unknown;
      order?: number;
    }>;
    if (!items.length) return null;
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    return sorted.map((c) => (c.render ? c.render() : null));
  };

  return (
    <div class="cs-layout">
      <div class="cs-layout-toolbar">{render_slot("toolbar")}</div>
      <div class="cs-layout-body">
        <div class="cs-layout-sidebar">{render_slot("sidebar_left")}</div>
        <div class="cs-layout-center">
          <div class="cs-layout-tabs">{render_slot("editor_title")}</div>
          <div class="cs-layout-editor">{render_slot("overlay")}</div>
        </div>
        <div class="cs-layout-panel">{render_slot("bottom_panel")}</div>
      </div>
      <div class="cs-layout-statusbar">{render_slot("status_bar")}</div>
    </div>
  );
}
