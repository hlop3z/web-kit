/**
 * xkin-studio — the entire studio is a plugin
 *
 * Receives the `xkin` object as its only dependency.
 * Never imports from web-kit internals.
 *
 * Usage:
 *   import Xkin from "xkin";
 *   import { create_studio } from "xkin-studio";
 *
 *   const studio = create_studio(Xkin);
 *   studio.project  // → ProjectStore
 *   studio.registry // → Registry
 */

import type { XkinAPI } from "./types.ts";
import { register_code_studio } from "./code-studio/index.ts";
import { create_project, type ProjectStore } from "./code-studio/project.ts";
import { create_registry, type Registry } from "./code-studio/registry.ts";

export type { XkinAPI } from "./types.ts";
export type { Registry } from "./code-studio/registry.ts";
export { create_registry } from "./code-studio/registry.ts";
export type { ProjectStore } from "./code-studio/project.ts";
export { create_project } from "./code-studio/project.ts";
export type {
  ComponentDef, LayoutDef, WidgetDef, ViewDef,
  PropDef, SlotDef, RegionDef,
  StateBinding, EventBinding, Placement,
  PrefixConfig, EntityType, ResolvedSymbol,
} from "./code-studio/registry.ts";

export interface StudioInstance {
  project: ProjectStore;
  registry: Registry;
}

export function create_studio(xkin: XkinAPI): StudioInstance {
  // Create shared instances BEFORE plugin registration
  // so they're available to both the plugins and the host app.
  const project = create_project(xkin);
  const registry = create_registry();

  // Register the studio as a plugin tree
  xkin.plugins.register({
    id: "xkin-studio",
    name: "Xkin Studio",
    version: "0.1.0",
    permissions: [
      "ui",
      "files",
      "keys",
      "hooks",
      "workspace",
      "tools",
      "editor",
      "commands",
      "store",
    ],
    activation: "on_load",

    async activate(ctx) {
      // Layer 1: Code Studio plugins (receives pre-created project + registry)
      register_code_studio(xkin, ctx, project, registry);

      // Layer 2: App Studio — ON HOLD (not registered until Layer 1 is complete)
      // register_app_studio(xkin, ctx, project, registry);
    },

    deactivate() {
      // Sub-plugins clean up via their own subscriptions
    },
  });

  return { project, registry };
}

export default create_studio;
