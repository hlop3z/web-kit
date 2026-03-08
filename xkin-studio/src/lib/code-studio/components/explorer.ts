import type { XkinAPI, TreeNode, VNode } from "../../types.ts";

/**
 * Explorer — file tree sidebar.
 *
 * Reads xkin.$file_tree for the tree structure, xkin.$active_file for
 * highlighting, and calls xkin.files.set_active() to switch files.
 */
export function create_explorer(xkin: XkinAPI) {
  const { h } = xkin.engine;

  const render_node = (
    node: TreeNode,
    depth: number,
    active_path: string | null,
    expanded: Set<string>,
    toggle: (path: string) => void,
    open_file: (path: string) => void,
  ): VNode => {
    const indent = { paddingLeft: `${depth * 16}px` };

    if (node.type === "directory") {
      const is_open = expanded.has(node.path);
      return h("div", { key: node.path, class: "cs-tree-dir" },
        h("div", {
          class: "cs-tree-row cs-tree-dir-label",
          style: indent,
          onClick: () => toggle(node.path),
        },
          h("span", { class: `cs-tree-arrow ${is_open ? "open" : ""}` }, is_open ? "▾" : "▸"),
          h("span", { class: "cs-tree-name" }, node.name),
        ),
        is_open && node.children
          ? h("div", { class: "cs-tree-children" },
            ...node.children.map((child) =>
              render_node(child, depth + 1, active_path, expanded, toggle, open_file),
            ),
          )
          : null,
      );
    }

    const is_active = node.path === active_path;
    const is_dirty = node.entry ? node.entry.dirty : false;

    return h("div", {
      key: node.path,
      class: `cs-tree-row cs-tree-file ${is_active ? "active" : ""}`,
      style: indent,
      onClick: () => open_file(node.path),
    },
      h("span", { class: "cs-tree-name" },
        is_dirty ? h("span", { class: "cs-dirty-dot" }, "\u2022 ") : null,
        node.name,
      ),
    );
  };

  return () => {
    const tree = xkin.$file_tree.get();
    const active = xkin.$active_file.get();

    // Local expanded state — all dirs open by default
    const all_dirs = new Set<string>();
    const collect_dirs = (nodes: TreeNode[]) => {
      for (const n of nodes) {
        if (n.type === "directory") {
          all_dirs.add(n.path);
          if (n.children) collect_dirs(n.children);
        }
      }
    };
    collect_dirs(tree);

    // For now, expand all directories. A stateful version would
    // use a store atom to track collapsed dirs.
    const expanded = all_dirs;

    const toggle = (_path: string) => {
      // TODO: stateful toggle with xkin.store.atom
    };

    const open_file = (path: string) => {
      xkin.files.open(path);
      xkin.files.set_active(path, null);
    };

    if (tree.length === 0) {
      return h("div", { class: "cs-explorer cs-empty" },
        h("p", null, "No files"),
        h("p", { class: "cs-hint" }, "Create files to get started"),
      );
    }

    return h("div", { class: "cs-explorer" },
      ...tree.map((node) =>
        render_node(node, 0, active, expanded, toggle, open_file),
      ),
    );
  };
}
