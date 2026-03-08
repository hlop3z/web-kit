import showdown from "showdown";
import { transform } from "@babel/standalone";
import { minify } from "terser";
import * as prettier from "prettier/standalone";
import * as babelPlugin from "prettier/plugins/babel";
import * as estreePlugin from "prettier/plugins/estree";
import * as typescriptPlugin from "prettier/plugins/typescript";
import * as htmlPlugin from "prettier/plugins/html";
import * as cssPlugin from "prettier/plugins/postcss";
import * as markdownPlugin from "prettier/plugins/markdown";
import * as graphqlPlugin from "prettier/plugins/graphql";
import * as yamlPlugin from "prettier/plugins/yaml";

const PLUGINS = [
  babelPlugin,
  estreePlugin,
  typescriptPlugin,
  htmlPlugin,
  cssPlugin,
  markdownPlugin,
  graphqlPlugin,
  yamlPlugin,
];

const tsx = async ({ source, compress = false, mangle = false }) => {
  const result = transform(source, {
    presets: [
      ["typescript", { isTSX: true, allExtensions: true }],
      ["react", { pragma: "h", pragmaFrag: "Fragment" }],
    ],
    filename: "input.tsx",
  });

  let { code } = result;

  if (compress || mangle) {
    const minified = await minify(code, { compress, mangle });
    if (minified.error) throw minified.error;
    code = minified.code;
  }

  return { code };
};

const format = ({
  source,
  parser = "babel",
  tabWidth = 2,
  printWidth = 80,
  semi = true,
  singleQuote = false,
  useTabs = false,
}) =>
  prettier.format(source, {
    parser,
    tabWidth,
    printWidth,
    semi,
    singleQuote,
    useTabs,
    plugins: PLUGINS,
  });

const markdown = ({ source, options = {} }) => {
  const converter = new showdown.Converter(options);
  return converter.makeHtml(source);
};

const compress = async ({ source, compress: doCompress = true, mangle: doMangle = false }) => {
  const result = await minify(source, { compress: doCompress, mangle: doMangle });
  if (result.error) throw result.error;
  return { code: result.code };
};

export default { tsx, format, markdown, compress };
