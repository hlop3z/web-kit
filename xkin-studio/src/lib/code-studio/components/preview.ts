import type { XkinAPI, VNode, Dispose } from "../../types.ts";

/**
 * Preview — live preview panel.
 *
 * Watches the active file. When it changes, transpiles TSX and renders
 * the result in an iframe sandbox. Supports JS/TS/TSX/JSX and HTML.
 */
export function create_preview(xkin: XkinAPI) {
  const { h } = xkin.engine;

  const TSX_LANGS = new Set(["javascript", "typescript", "typescriptreact", "javascriptreact"]);
  const HTML_LANGS = new Set(["html"]);
  const CSS_LANGS = new Set(["css", "scss"]);
  const MD_LANGS = new Set(["markdown"]);

  let last_html = "";
  let error_msg = "";

  const build_preview = async (): Promise<string> => {
    const path = xkin.$active_file.get();
    if (!path) return "";

    const content = xkin.files.read(path);
    if (!content) return "";

    const entry = xkin.files.entry(path);
    const lang = entry?.language ?? "";

    try {
      if (TSX_LANGS.has(lang)) {
        const { code } = await xkin.tsx({ source: content });
        // Wrap in a basic HTML shell
        return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:system-ui,sans-serif;margin:1em;color:#e0e0e0;background:#1a1a2e;}</style>
</head><body>
<script type="module">
try{${code}}catch(e){document.body.innerHTML='<pre style="color:#f87171">'+e.message+'</pre>';}
</script></body></html>`;
      }

      if (HTML_LANGS.has(lang)) {
        return content;
      }

      if (CSS_LANGS.has(lang)) {
        let css = content;
        if (lang === "scss") {
          const result = await xkin.sass({ source: content });
          css = result.css;
        }
        return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>${css}</style></head>
<body><div class="preview">CSS Preview</div></body></html>`;
      }

      if (MD_LANGS.has(lang)) {
        const html = xkin.markdown({ source: content });
        return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>body{font-family:system-ui,sans-serif;margin:1em;line-height:1.6;color:#e0e0e0;background:#1a1a2e;}
code{background:rgba(255,255,255,0.1);padding:0.2em 0.4em;border-radius:3px;}
pre{background:rgba(255,255,255,0.05);padding:1em;border-radius:6px;overflow-x:auto;}</style>
</head><body>${html}</body></html>`;
      }

      return `<html><body><pre>${content.replace(/</g, "&lt;")}</pre></body></html>`;
    } catch (err) {
      error_msg = String(err);
      return "";
    }
  };

  let sub: Dispose | null = null;

  const render = (): VNode => {
    const active = xkin.$active_file.get();

    if (!active) {
      return h("div", { class: "cs-preview cs-empty" },
        h("p", null, "No file open"),
      );
    }

    if (error_msg) {
      const msg = error_msg;
      return h("div", { class: "cs-preview cs-preview-error" },
        h("pre", null, msg),
      );
    }

    return h("div", { class: "cs-preview" },
      h("div", { class: "cs-preview-toolbar" },
        h("span", null, "Preview"),
        h("button", {
          class: "cs-btn cs-btn-sm",
          onClick: async () => {
            error_msg = "";
            last_html = await build_preview();
          },
          title: "Refresh preview",
        }, "\u21bb Refresh"),
      ),
      last_html
        ? h("iframe", {
          class: "cs-preview-frame",
          srcDoc: last_html,
          sandbox: "allow-scripts",
          style: { width: "100%", height: "100%", border: "none" },
        })
        : h("p", { class: "cs-hint" }, "Click Refresh to preview"),
    );
  };

  const dispose = () => {
    if (sub) { sub(); sub = null; }
  };

  return { render, dispose };
}
