/**
 * Build Pipeline — layered component assembly.
 *
 * Layers (bottom → top):
 *   1. Styles    — .scss/.css → compiled CSS + module tokens
 *   2. Component — .tsx/.ts parts → merged source with tokens
 *   3. Layout    — layout.tsx wraps the component (default: passthrough)
 *   4. Root      — root.html template shells the page (default: minimal)
 *
 * MDX composition (for Widget/View modes):
 *   .mdx files are compiled via xkin.mdx() → { tree, symbols }
 *   Symbols are resolved through the prefix registry.
 *   The tree is the serializable domain model.
 *
 * Convention files (override defaults by creating them):
 *   root.html   — HTML template with {{styles}} and {{script}} slots
 *   layout.tsx  — Preact layout component (wraps children)
 *
 * All other .tsx/.ts files are component parts.
 * One file marked `main: true` is the entry point (merged last).
 */

import type { XkinAPI } from "../types.ts";
import type { Registry } from "./registry.ts";

/* ── Types ─────────────────────────────────────── */

export interface BuildConfig {
  namespace?: string;
  compress?: boolean;
  mangle?: boolean;
  registry?: Registry;
}

export interface BuildResult {
  html: string;
  js: string;
  css: string;
  tokens: Record<string, string>;
  symbols: string[];
}

export interface MdxBuildResult extends BuildResult {
  tree: unknown;
  resolved: Array<{ raw: string; prefix: string; name: string; entity_type: string }>;
  unresolved: string[];
}

/* ── Defaults ──────────────────────────────────── */

const DEFAULT_ROOT = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  {{styles}}
</head>
<body>
  <div id="root"></div>
  {{script}}
</body>
</html>`;

/** Files that are handled as layers, not component parts */
const LAYER_FILES = new Set(["root.html", "layout.tsx", "layout.ts"]);

/** Languages treated as style sources */
const STYLE_LANGS = new Set(["scss", "css"]);

/* ── Layer 1: Styles ───────────────────────────── */

async function resolve_styles(
  xkin: XkinAPI,
  namespace: string,
): Promise<{ css: string; tokens: Record<string, string> }> {
  const style_files = xkin.files.list().filter((f) => STYLE_LANGS.has(f.language));

  if (style_files.length === 0) return { css: "", tokens: {} };

  const source = style_files
    .map((f) => xkin.files.read(f.path) ?? "")
    .join("\n");

  const result = await xkin.css_modules({ source, namespace });
  return {
    css: result.css,
    tokens: (result.tokens ?? {}) as Record<string, string>,
  };
}

/* ── Layer 2: Component ────────────────────────── */

function resolve_component(
  xkin: XkinAPI,
  tokens: Record<string, string>,
): string {
  const all = xkin.files.list();

  // Component files = tsx/ts files except layer files, styles, and mdx
  const parts = all.filter(
    (f) =>
      !LAYER_FILES.has(f.path) &&
      !STYLE_LANGS.has(f.language) &&
      f.language !== "html" &&
      f.language !== "markdown",
  );

  const non_main = parts.filter((f) => !f.main);
  const main_file = parts.find((f) => f.main);

  const chunks: string[] = [];

  for (const f of non_main) {
    chunks.push(strip_for_merge(xkin.files.read(f.path) ?? ""));
  }

  if (main_file) {
    chunks.push(strip_for_merge(xkin.files.read(main_file.path) ?? ""));
  }

  const styles_decl = `const styles = ${JSON.stringify(tokens)};`;
  return `${styles_decl}\n\n${chunks.join("\n\n")}`;
}

/** Strip local imports and export keywords for single-bundle merge */
function strip_for_merge(source: string): string {
  return source
    .replace(/^import\s+.*from\s+["']\.\/.+["'];?\s*$/gm, "")
    .replace(/^export\s+(?=const |function |class |interface |type |enum )/gm, "")
    .trim();
}

/* ── Layer 3: Layout ───────────────────────────── */

function resolve_layout(xkin: XkinAPI): string {
  const layout = xkin.files.list().find(
    (f) => f.path === "layout.tsx" || f.path === "layout.ts",
  );
  if (!layout) return "";
  return xkin.files.read(layout.path) ?? "";
}

/* ── Layer 4: Root ─────────────────────────────── */

function resolve_root(xkin: XkinAPI): string {
  const root = xkin.files.list().find((f) => f.path === "root.html");
  if (!root) return DEFAULT_ROOT;
  return xkin.files.read(root.path) ?? DEFAULT_ROOT;
}

/* ── MDX Resolution ────────────────────────────── */

async function resolve_mdx(
  xkin: XkinAPI,
  registry?: Registry,
): Promise<{
  tree: unknown;
  symbols: string[];
  resolved: Array<{ raw: string; prefix: string; name: string; entity_type: string }>;
  unresolved: string[];
} | null> {
  const mdx_files = xkin.files.list().filter(
    (f) => f.path.endsWith(".mdx"),
  );

  if (mdx_files.length === 0) return null;

  // Merge all MDX sources (main first if flagged)
  const main_mdx = mdx_files.find((f) => f.main);
  const other_mdx = mdx_files.filter((f) => !f.main);
  const ordered = main_mdx ? [...other_mdx, main_mdx] : mdx_files;

  const source = ordered
    .map((f) => xkin.files.read(f.path) ?? "")
    .join("\n\n");

  const { tree, symbols } = await xkin.mdx({ source });

  // Resolve symbols through prefix registry
  if (registry) {
    const { resolved, unresolved } = registry.resolve_symbols(symbols);
    return {
      tree,
      symbols,
      resolved: resolved.map((r) => ({
        raw: r.raw,
        prefix: r.prefix,
        name: r.name,
        entity_type: r.entity_type,
      })),
      unresolved,
    };
  }

  return {
    tree,
    symbols,
    resolved: [],
    unresolved: symbols,
  };
}

/* ── Component Build (current mode) ────────────── */

export async function build(
  xkin: XkinAPI,
  config: BuildConfig = {},
): Promise<BuildResult> {
  // Layer 1: Styles
  const { css, tokens } = await resolve_styles(xkin, config.namespace ?? "app");

  // Layer 2: Component
  const component = resolve_component(xkin, tokens);

  // Layer 3: Layout
  const layout = resolve_layout(xkin);

  // Assemble source: layout declarations + component
  const full_source = [layout, component].filter(Boolean).join("\n\n");

  // Transpile
  const { code: js } = await xkin.tsx({
    source: full_source,
    compress: config.compress,
    mangle: config.mangle,
  });

  // Layer 4: Root — inject into HTML template
  const root = resolve_root(xkin);
  const html = root
    .replace("{{styles}}", css ? `<style>${css}</style>` : "")
    .replace("{{script}}", `<script type="module">${js}</script>`);

  return { html, js, css, tokens, symbols: [] };
}

/* ── MDX Build (widget/view modes) ─────────────── */

export async function build_mdx(
  xkin: XkinAPI,
  config: BuildConfig = {},
): Promise<MdxBuildResult> {
  // Layer 1: Styles
  const { css, tokens } = await resolve_styles(xkin, config.namespace ?? "app");

  // MDX: compile and resolve symbols
  const mdx = await resolve_mdx(xkin, config.registry);

  // Component source (non-MDX tsx/ts files still contribute)
  const component = resolve_component(xkin, tokens);

  // Layout
  const layout = resolve_layout(xkin);

  // Assemble: layout + component parts
  const full_source = [layout, component].filter(Boolean).join("\n\n");

  // Transpile component source
  const { code: js } = await xkin.tsx({
    source: full_source,
    compress: config.compress,
    mangle: config.mangle,
  });

  // Root template
  const root = resolve_root(xkin);
  const html = root
    .replace("{{styles}}", css ? `<style>${css}</style>` : "")
    .replace("{{script}}", `<script type="module">${js}</script>`);

  return {
    html,
    js,
    css,
    tokens,
    symbols: mdx?.symbols ?? [],
    tree: mdx?.tree ?? null,
    resolved: mdx?.resolved ?? [],
    unresolved: mdx?.unresolved ?? [],
  };
}
