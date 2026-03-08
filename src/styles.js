import Sass from "sass.js/dist/sass.sync.js";
import { minify as cssoMinify } from "csso";
import postcss from "postcss";
import localByDefault from "postcss-modules-local-by-default";
import modulesScope from "postcss-modules-scope";

const compileSass = (source) =>
  new Promise((resolve, reject) => {
    Sass.compile(source, { style: Sass.style.expanded }, (result) => {
      if (result.status !== 0) {
        reject(new Error(result.message));
        return;
      }
      resolve(result.text);
    });
  });

const sass = ({ source, compressed = false }) =>
  new Promise((resolve, reject) => {
    const options = {
      style: compressed ? Sass.style.compressed : Sass.style.expanded,
    };

    Sass.compile(source, options, (result) => {
      if (result.status !== 0) {
        reject(new Error(result.message));
        return;
      }

      const css = compressed ? cssoMinify(result.text).css : result.text;
      resolve({ css });
    });
  });

const fnv1a = (str) => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
};

const cssModules = async ({ source, namespace = "", idSize = 8 }) => {
  const compiled = await compileSass(source);
  const sourceHash = fnv1a(compiled);

  const generateScopedName = (name) => {
    const hash = fnv1a(name + sourceHash).slice(0, idSize);
    const parts = namespace ? [namespace, name, hash] : [name, hash];
    return parts.join("__");
  };

  const processor = postcss([
    localByDefault(),
    modulesScope({ generateScopedName }),
  ]);

  const result = await processor.process(compiled, { from: undefined });
  const tokens = {};

  result.root.each((node) => {
    if (node.type === "rule" && node.selector === ":export") {
      node.walkDecls((decl) => {
        tokens[decl.prop] = decl.value;
      });
    }
  });

  const css = result.css.replace(/:export\s*\{[^}]*\}/s, "").trim();

  return { css, tokens };
};

export default { sass, cssModules };
