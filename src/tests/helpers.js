import { beforeEach, afterEach } from "vitest";
import { setup_mock, teardown_mock } from "./setup.js";
import { create_file_registry, $workspace, $files, $active_file, $open_files } from "../files.js";

/**
 * Shared test context for file registry tests.
 * Call in a describe block — returns object with `files` getter.
 */
export const use_files = () => {
  const ctx = { files: null };

  beforeEach(() => {
    setup_mock();
    $files.set([]);
    $active_file.set(null);
    $open_files.set([]);
    $workspace.set(null);
    ctx.files = create_file_registry();
  });

  afterEach(() => {
    ctx.files.clear();
    teardown_mock();
  });

  return ctx;
};

export const mock_editor = () => {
  const monaco = globalThis.XkinEditor;
  return monaco.editor.create(null, {});
};
