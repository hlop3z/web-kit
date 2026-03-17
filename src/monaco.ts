function setupMonaco() {
  // @ts-ignore
  const monaco = window.XkinEditor;
  // @ts-ignore
  const mjsx = window.JSXMonaco;
  if (!monaco || !mjsx) return false;

  const JSX_GLOBALS = `
declare const h: any;
declare const Fragment: any;
`;
  monaco.languages.typescript.typescriptDefaults.addExtraLib(
    JSX_GLOBALS,
    "file:///xkin-jsx-globals.d.ts",
  );
  monaco.languages.typescript.javascriptDefaults.addExtraLib(
    JSX_GLOBALS,
    "file:///xkin-jsx-globals.d.ts",
  );

  monaco.languages.setMonarchTokensProvider("javascript", mjsx);
  monaco.languages.setMonarchTokensProvider("typescript", mjsx);
  return true;
}

if (!setupMonaco()) {
  window.addEventListener("load", setupMonaco, { once: true });
}
