import type { XkinAPI, VNode } from "../../types.ts";
import { build } from "../build.ts";
import type { BuildConfig, BuildResult } from "../build.ts";

/**
 * Preview Panel — build and render the component.
 *
 * "Preview" to the user, "build" internally.
 * Assembles root + layout + component layers → iframe.
 */
export function create_preview(xkin: XkinAPI) {
  const { h } = xkin.engine;

  let iframe_el: HTMLIFrameElement | null = null;
  let status_el: HTMLElement | null = null;
  let last_result: BuildResult | null = null;

  const run_build = async (config?: BuildConfig) => {
    if (status_el) {
      status_el.textContent = "Building...";
      status_el.className = "cs-preview-status";
    }

    try {
      last_result = await build(xkin, config);

      if (iframe_el) iframe_el.srcdoc = last_result.html;
      if (status_el) {
        status_el.textContent = "";
        status_el.className = "cs-preview-status";
      }
    } catch (err) {
      last_result = null;
      if (iframe_el) iframe_el.srcdoc = "";
      if (status_el) {
        status_el.textContent = String(err);
        status_el.className = "cs-preview-status cs-preview-error";
      }
    }
  };

  const render = (): VNode => {
    return h("div", { class: "cs-preview" },
      h("div", { class: "cs-preview-toolbar" },
        h("span", null, "Preview"),
        h("div", { style: { display: "flex", gap: "4px" } },
          h("button", {
            class: "cs-btn cs-btn-sm cs-btn-accent",
            onClick: () => run_build(),
            title: "Build and preview component (Ctrl+Enter)",
          }, "\u25b6 Build"),
        ),
      ),
      h("div", {
        class: "cs-preview-status",
        ref: (el: HTMLElement | null) => { status_el = el; },
      }),
      h("iframe", {
        class: "cs-preview-frame",
        sandbox: "allow-scripts",
        style: { width: "100%", flex: "1", border: "none" },
        ref: (el: HTMLIFrameElement | null) => { iframe_el = el; },
      }),
    );
  };

  const dispose = () => {
    iframe_el = null;
    status_el = null;
    last_result = null;
  };

  return { render, dispose, build: run_build, get result() { return last_result; } };
}
