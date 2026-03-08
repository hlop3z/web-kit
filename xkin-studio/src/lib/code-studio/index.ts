import type { XkinAPI, PluginContext, Dispose } from "../types.ts";
import { create_explorer } from "./components/explorer.ts";
import { create_tabs } from "./components/tabs.ts";
import { create_editor_panel } from "./components/editor_panel.ts";
import { create_preview } from "./components/preview.ts";
import { create_toolbar } from "./components/toolbar.ts";
import { create_status_bar } from "./components/status_bar.ts";

/**
 * Code Studio — Layer 1
 *
 * Browser IDE built as sub-plugins of xkin-studio.
 * Each plugin contributes UI to xkin slots and registers keybindings/commands.
 * All use the `xkin` object exclusively — zero direct imports from web-kit.
 */
export function register_code_studio(xkin: XkinAPI, _parent_ctx: PluginContext) {

  /* ── Explorer (file tree sidebar) ─────────────── */

  xkin.plugins.register({
    id: "cs.explorer",
    name: "Explorer",
    version: "0.1.0",
    permissions: ["ui", "files"],
    activation: "on_load",
    activate(ctx) {
      const Explorer = create_explorer(xkin);
      ctx.contribute("sidebar_left", {
        id: "cs.explorer",
        label: "Explorer",
        icon: "files",
        order: 1,
        render: Explorer,
      });
    },
  });

  /* ── Editor Tabs ──────────────────────────────── */

  xkin.plugins.register({
    id: "cs.tabs",
    name: "Editor Tabs",
    version: "0.1.0",
    permissions: ["ui", "files"],
    activation: "on_load",
    activate(ctx) {
      const Tabs = create_tabs(xkin);
      ctx.contribute("editor_title", {
        id: "cs.tabs",
        label: "Tabs",
        order: 1,
        render: Tabs,
      });
    },
  });

  /* ── Editor Panel (Monaco) ────────────────────── */

  xkin.plugins.register({
    id: "cs.editor",
    name: "Editor",
    version: "0.1.0",
    permissions: ["ui", "files", "editor", "keys"],
    activation: "on_load",
    activate(ctx) {
      const editor = create_editor_panel(xkin);

      // The editor contributes to the main content area.
      // Since there's no "main_content" slot, we use bottom_panel
      // as a secondary, and the actual editor mounts via the
      // host app's layout. The render function handles DOM mounting.
      ctx.contribute("overlay", {
        id: "cs.editor-panel",
        label: "Editor",
        order: 0,
        render: editor.render,
      });

      ctx.subscriptions.push(editor.dispose);
    },
  });

  /* ── Preview Panel ────────────────────────────── */

  xkin.plugins.register({
    id: "cs.preview",
    name: "Preview",
    version: "0.1.0",
    permissions: ["ui", "tools", "hooks"],
    activation: "on_load",
    activate(ctx) {
      const preview = create_preview(xkin);

      ctx.contribute("bottom_panel", {
        id: "cs.preview",
        label: "Preview",
        icon: "eye",
        order: 1,
        render: preview.render,
      });

      ctx.subscriptions.push(preview.dispose);
    },
  });

  /* ── Toolbar ──────────────────────────────────── */

  xkin.plugins.register({
    id: "cs.toolbar",
    name: "Toolbar",
    version: "0.1.0",
    permissions: ["ui", "files", "workspace", "commands"],
    activation: "on_load",
    activate(ctx) {
      const Toolbar = create_toolbar(xkin);
      ctx.contribute("toolbar", {
        id: "cs.toolbar",
        label: "Toolbar",
        order: 1,
        render: Toolbar,
      });
    },
  });

  /* ── Status Bar ───────────────────────────────── */

  xkin.plugins.register({
    id: "cs.status-bar",
    name: "Status Bar",
    version: "0.1.0",
    permissions: ["ui", "files", "workspace"],
    activation: "on_load",
    activate(ctx) {
      const StatusBar = create_status_bar(xkin);
      ctx.contribute("status_bar", {
        id: "cs.status-bar",
        label: "Status Bar",
        order: 1,
        render: StatusBar,
      });
    },
  });

  /* ── Keybindings & Commands ───────────────────── */

  xkin.plugins.register({
    id: "cs.commands",
    name: "Commands",
    version: "0.1.0",
    permissions: ["keys", "commands", "files", "workspace", "hooks"],
    activation: "on_load",
    activate(ctx) {
      const disposables: Dispose[] = [];

      // Save current file
      disposables.push(xkin.keys.add({
        id: "cs.save",
        label: "Save File",
        keys: "ctrl+s",
        run: async () => {
          const path = xkin.$active_file.get();
          if (path) {
            xkin.files.mark_clean(path);
            await xkin.workspace.save();
          }
        },
      }));

      // Save all files
      disposables.push(xkin.keys.add({
        id: "cs.save-all",
        label: "Save All",
        keys: "ctrl+shift+s",
        run: async () => {
          xkin.files.mark_all_clean();
          await xkin.workspace.save();
        },
      }));

      // Format current file
      disposables.push(xkin.keys.add({
        id: "cs.format",
        label: "Format Document",
        keys: "shift+alt+f",
        run: async () => {
          const path = xkin.$active_file.get();
          if (path) await xkin.files.format(path);
        },
      }));

      // Close current tab
      disposables.push(xkin.keys.add({
        id: "cs.close-tab",
        label: "Close Tab",
        keys: "ctrl+w",
        run: () => {
          const path = xkin.$active_file.get();
          if (path) xkin.files.close(path);
        },
      }));

      // New file
      disposables.push(xkin.keys.add({
        id: "cs.new-file",
        label: "New File",
        keys: "ctrl+n",
        run: async () => {
          const name = await xkin.ui.show_input("cs.commands", {
            placeholder: "Enter file path (e.g., src/app.tsx)",
          });
          if (name) {
            await xkin.files.create(name, "");
            xkin.files.open(name);
            xkin.files.set_active(name, null);
          }
        },
      }));

      // Cycle to next tab
      disposables.push(xkin.keys.add({
        id: "cs.next-tab",
        label: "Next Tab",
        keys: "ctrl+tab",
        run: () => {
          const open = xkin.$open_files.get();
          const active = xkin.$active_file.get();
          if (open.length <= 1) return;
          const idx = active ? open.indexOf(active) : -1;
          const next = open[(idx + 1) % open.length];
          if (next) xkin.files.set_active(next, null);
        },
      }));

      ctx.subscriptions.push(...disposables);
    },
  });
}
