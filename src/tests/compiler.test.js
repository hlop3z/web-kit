import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setup_mock, teardown_mock } from "./setup.js";
import Xkin from "../main.js";

let last_opts;

beforeEach(() => {
  setup_mock();
  last_opts = null;
  const ts = globalThis.XkinEditor.languages.typescript;
  ts.typescriptDefaults.setCompilerOptions = (o) => { last_opts = o; };
  ts.javascriptDefaults.setCompilerOptions = () => {};
});

afterEach(() => {
  teardown_mock();
});

describe("set_compiler", () => {
  it.each([
    ["jsx", "React", 2],
    ["jsx", "Preserve", 1],
    ["jsx", "ReactJSX", 4],
    ["target", "ESNext", 99],
    ["target", "ES2015", 2],
    ["target", "ES5", 1],
    ["module", "ESNext", 99],
    ["module", "CommonJS", 1],
    ["moduleResolution", "NodeJs", 2],
    ["moduleResolution", "Bundler", 100],
  ])("resolves %s: %s -> %i", (key, str_value, expected) => {
    Xkin.set_compiler({ [key]: str_value });
    expect(last_opts[key]).toBe(expected);
  });

  it("passes numeric values through unchanged", () => {
    Xkin.set_compiler({ jsx: 2, target: 99 });
    expect(last_opts.jsx).toBe(2);
    expect(last_opts.target).toBe(99);
  });

  it("passes non-enum options through unchanged", () => {
    Xkin.set_compiler({ jsxFactory: "h", allowJs: true });
    expect(last_opts.jsxFactory).toBe("h");
    expect(last_opts.allowJs).toBe(true);
  });
});
