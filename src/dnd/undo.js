/* ── Undo / Redo Stack ───────────────────────────── */

import { atom } from "nanostores";

/**
 * Creates an undo/redo stack that works with a nanostores atom.
 * @param {object} $target - The atom to manage (e.g. $document)
 * @param {number} [max_size=100] - Maximum stack depth
 */
const create_undo_stack = ($target, max_size = 100) => {
  const $can_undo = atom(false);
  const $can_redo = atom(false);

  const undo_stack = [];
  const redo_stack = [];

  const update_flags = () => {
    $can_undo.set(undo_stack.length > 0);
    $can_redo.set(redo_stack.length > 0);
  };

  const push = (before, after) => {
    undo_stack.push({ before, after });
    if (undo_stack.length > max_size) undo_stack.shift();
    redo_stack.length = 0;
    update_flags();
  };

  const undo = () => {
    const cmd = undo_stack.pop();
    if (!cmd) return;
    $target.set(cmd.before);
    redo_stack.push(cmd);
    update_flags();
  };

  const redo = () => {
    const cmd = redo_stack.pop();
    if (!cmd) return;
    $target.set(cmd.after);
    undo_stack.push(cmd);
    update_flags();
  };

  const clear = () => {
    undo_stack.length = 0;
    redo_stack.length = 0;
    update_flags();
  };

  return { push, undo, redo, clear, $can_undo, $can_redo };
};

export { create_undo_stack };
