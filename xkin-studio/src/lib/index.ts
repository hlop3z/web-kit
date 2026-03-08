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
 *   create_studio(Xkin);  // done — studio is live
 */

import type { XkinAPI } from "./types.ts";
import { register_code_studio } from "./code-studio/index.ts";

export type { XkinAPI } from "./types.ts";

export function create_studio(xkin: XkinAPI) {
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
      // Layer 1: Code Studio plugins
      register_code_studio(xkin, ctx);

      // Layer 2: App Studio — ON HOLD (not registered until Layer 1 is complete)
      // register_app_studio(xkin, ctx);
    },

    deactivate() {
      // Sub-plugins clean up via their own subscriptions
    },
  });
}

export default create_studio;
