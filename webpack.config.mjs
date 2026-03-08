import path from "path";
import { fileURLToPath } from "url";
import MonacoWebpackPlugin from "monaco-editor-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ── Core Settings ─────────────────────────────────── */

const LIB_NAME = "Xkin";
const SRC_DIR = "./src";
const DIST_DIR = "dist";

const LANGUAGES = [
  "json",
  "html",
  "css",
  "scss",
  "javascript",
  "typescript",
  "python",
  "sql",
  "graphql",
  "markdown",
  "yaml",
];

const BUNDLES = [
  { name: "editor", global: "Editor" },
  { name: "tools", global: "Tools" },
  { name: "styles", global: "Styles" },
  { name: "engine", global: "Engine" },
  { name: "main", global: "" },
];

/* ── Shared Config ─────────────────────────────────── */

const shared = (isDev) => ({
  module: {
    rules: [
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
      { test: /\.ttf$/, type: "asset/resource" },
      { test: /\.wasm$/, type: "asset/resource" },
    ],
  },
  optimization: {
    minimize: !isDev,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true,
          mangle: true,
          format: { comments: false },
        },
        extractComments: false,
      }),
    ],
    splitChunks: false,
    runtimeChunk: false,
  },
  resolve: {
    extensions: [".js", ".json"],
    fallback: { fs: false, path: false, crypto: false },
  },
});

/* ── Bundle Factory ────────────────────────────────── */

const DIST = path.resolve(__dirname, DIST_DIR);
const libName = (suffix) => suffix ? `${LIB_NAME}${suffix}` : LIB_NAME;
const fileName = (suffix) => suffix ? `${LIB_NAME.toLowerCase()}.${suffix}.min.js` : `${LIB_NAME.toLowerCase()}.min.js`;

const makeBundle = (isDev, { name, global, plugins }) => ({
  ...shared(isDev),
  name,
  mode: isDev ? "development" : "production",
  entry: `${SRC_DIR}/${name}.js`,
  output: {
    path: DIST,
    filename: fileName(global ? name : ""),
    library: { name: libName(global), type: "var", export: "default" },
    globalObject: "self",
    clean: false,
    ...(name === "editor" && {
      chunkFilename: "editor/[name].[contenthash].js",
      assetModuleFilename: "editor/[name][ext]",
    }),
  },
  ...(plugins && { plugins }),
});

/* ── Export ─────────────────────────────────────────── */

export default (_, argv) => {
  const isDev = argv.mode === "development";

  return BUNDLES.map(({ name, global }) =>
    makeBundle(isDev, {
      name,
      global,
      plugins: name === "editor"
        ? [new MonacoWebpackPlugin({
          filename: "editor/monaco.[name].[contenthash].worker.js",
          globalAPI: false,
          languages: LANGUAGES,
        })]
        : undefined,
    })
  );
};
