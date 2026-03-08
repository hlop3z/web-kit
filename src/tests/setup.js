/**
 * Mock Monaco Editor for testing.
 * Simulates models, URIs, editor instances, and KeyMod/KeyCode.
 */

const models = new Map();

const create_mock_model = (content, language, uri) => {
  let _content = content;
  const _listeners = [];
  const _uri = uri;

  const model = {
    getValue: () => _content,
    setValue: (v) => {
      _content = v;
      _listeners.forEach((cb) => cb());
    },
    getFullModelRange: () => ({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: _content.split("\n").length,
      endColumn: _content.split("\n").pop().length + 1,
    }),
    pushEditOperations: (_selections, edits, _cursor_computer) => {
      for (const edit of edits) {
        _content = edit.text;
      }
      _listeners.forEach((cb) => cb());
      return null;
    },
    onDidChangeContent: (cb) => {
      _listeners.push(cb);
      return { dispose: () => {
        const idx = _listeners.indexOf(cb);
        if (idx >= 0) _listeners.splice(idx, 1);
      }};
    },
    dispose: () => {
      models.delete(_uri.toString());
    },
    uri: _uri,
    _getContent: () => _content,
  };

  models.set(_uri.toString(), model);
  return model;
};

const create_mock_uri = (str) => {
  const uri = { toString: () => str, _str: str };
  return uri;
};

// Key codes matching Monaco's enum values (simplified)
const KeyCode = {};
for (let i = 0; i < 26; i++) {
  KeyCode["Key" + String.fromCharCode(65 + i)] = 31 + i; // KeyA=31, KeyB=32, ...
}
for (let i = 0; i < 10; i++) {
  KeyCode["Digit" + i] = 21 + i;
}
Object.assign(KeyCode, {
  Backspace: 1, Tab: 2, Enter: 3, Escape: 9, Space: 10,
  Delete: 80, Insert: 79, Home: 14, End: 13,
  PageUp: 11, PageDown: 12,
  UpArrow: 16, DownArrow: 18, LeftArrow: 15, RightArrow: 17,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64,
  F7: 65, F8: 66, F9: 67, F10: 68, F11: 69, F12: 70,
  Comma: 82, Period: 83, Slash: 84, Backslash: 91,
  Semicolon: 85, Quote: 87, BracketLeft: 88, BracketRight: 89,
  Backquote: 90, Minus: 86, Equal: 81,
});

const KeyMod = {
  CtrlCmd: 2048,
  Shift: 1024,
  Alt: 512,
  WinCtrl: 256,
  chord: (a, b) => (a | (b << 16)),
};

const mock_monaco = {
  Uri: {
    parse: (str) => create_mock_uri(str),
  },
  editor: {
    createModel: (content, language, uri) => {
      return create_mock_model(content, language, uri);
    },
    getModel: (uri) => {
      return models.get(uri.toString()) || null;
    },
    setTheme: () => {},
    setModelLanguage: () => {},
    create: (element, opts) => {
      const actions = new Map();
      const commands = [];
      const context_keys = new Map();
      let current_model = opts.model || null;
      let _view_state = null;

      return {
        getModel: () => current_model,
        setModel: (m) => { current_model = m; },
        saveViewState: () => _view_state,
        restoreViewState: (s) => { _view_state = s; },
        addAction: (desc) => {
          actions.set(desc.id, desc);
          return { dispose: () => actions.delete(desc.id) };
        },
        addCommand: (keybinding, handler, context) => {
          commands.push({ keybinding, handler, context });
        },
        createContextKey: (name, value) => {
          context_keys.set(name, value);
          return { set: (v) => context_keys.set(name, v) };
        },
        _actions: actions,
        _commands: commands,
        _context_keys: context_keys,
      };
    },
  },
  languages: {
    typescript: {
      JsxEmit: { React: 2 },
      ScriptTarget: { ESNext: 99 },
      ModuleKind: { ESNext: 99 },
      ModuleResolutionKind: { NodeJs: 2 },
      typescriptDefaults: {
        setCompilerOptions: () => {},
        setExtraLibs: () => {},
      },
      javascriptDefaults: {
        setCompilerOptions: () => {},
        setExtraLibs: () => {},
      },
    },
  },
  KeyMod,
  KeyCode,
};

export const setup_mock = () => {
  models.clear();
  globalThis.XkinEditor = mock_monaco;
  globalThis.XkinTools = {
    format: async ({ source }) => source.trim() + "\n",
  };
  globalThis.XkinStyles = null;
  globalThis.XkinEngine = null;
};

export const teardown_mock = () => {
  models.clear();
  globalThis.XkinEditor = undefined;
  globalThis.XkinTools = undefined;
};

export { mock_monaco, models, KeyMod, KeyCode };
