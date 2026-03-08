import { useEffect, useState } from "preact/hooks";
import { create_mock_xkin } from "./dev/mock_xkin.ts";
import { create_studio } from "./lib/index.ts";
import type { XkinAPI } from "./lib/types.ts";

/* ── Tiny useStore hook (no extra deps) ────────── */

function useStore<T>(atom: { get(): T; subscribe(cb: (v: T) => void): () => void }): T {
  const [value, setValue] = useState(atom.get());
  useEffect(() => atom.subscribe(setValue), [atom]);
  return value;
}

/* ── Bootstrap ─────────────────────────────────── */

let xkin: XkinAPI | null = null;

async function boot(): Promise<XkinAPI> {
  if (xkin) return xkin;
  xkin = create_mock_xkin();

  // Seed demo files so the IDE isn't empty
  await xkin.files.create("src/app.tsx", [
    'import { h } from "preact";',
    "",
    "export function App() {",
    "  return <div>Hello World</div>;",
    "}",
    "",
  ].join("\n"));

  await xkin.files.create("src/main.ts", [
    'import { App } from "./app.tsx";',
    'console.log("Starting...");',
    "",
  ].join("\n"));

  await xkin.files.create("src/styles.css", [
    "body {",
    "  margin: 0;",
    "  font-family: system-ui, sans-serif;",
    "  background: #1a1a2e;",
    "  color: #e0e0e0;",
    "}",
    "",
  ].join("\n"));

  await xkin.files.create("README.md", [
    "# Demo Project",
    "",
    "This is a demo workspace for **Xkin Studio**.",
    "",
    "Edit files in the explorer to try it out.",
    "",
  ].join("\n"));

  xkin.files.mark_all_clean();

  // Register the studio plugin tree
  create_studio(xkin);

  return xkin;
}

/* ── App Shell ─────────────────────────────────── */

export function App() {
  const [api, setApi] = useState<XkinAPI | null>(null);

  useEffect(() => {
    boot().then(setApi);
  }, []);

  if (!api) return <div class="cs-loading">Loading...</div>;

  return <IDE xkin={api} />;
}

/* ── IDE Layout ────────────────────────────────── */

function IDE({ xkin }: { xkin: XkinAPI }) {
  // Subscribe to reactive state so the shell re-renders
  useStore(xkin.ui.$slots);
  useStore(xkin.$files);
  useStore(xkin.$active_file);
  useStore(xkin.$open_files);
  useStore(xkin.$dirty_files);

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
