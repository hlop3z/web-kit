/* ── Constraint Checking ─────────────────────────── */

/**
 * Check if a section can accept a block.
 * @param {object} section - The target section
 * @param {object} source - The source block data { block_type?, type? }
 * @param {object} [options] - { is_transfer: boolean } — if true, doesn't count the block being moved in
 * @returns {boolean}
 */
const can_accept_block = (section, source, options = {}) => {
  const { constraints } = section;
  if (!constraints) return true;

  // Max blocks check
  if (constraints.max_blocks != null) {
    const current_count = section.blocks.length;
    if (current_count >= constraints.max_blocks) return false;
  }

  // Allowed block types check
  if (constraints.allowed_blocks) {
    const block_type = source.block_type || source.type;
    if (block_type && !constraints.allowed_blocks.includes(block_type)) {
      return false;
    }
  }

  return true;
};

/**
 * Check if a document can accept another section.
 * @param {object} doc - The document
 * @returns {boolean}
 */
const can_accept_section = (doc) => {
  const max_sections = (doc.meta && doc.meta.max_sections) || 25;
  return doc.sections.length < max_sections;
};

/**
 * Check if removing a block would violate min_blocks constraint.
 * @param {object} section - The section containing the block
 * @returns {boolean}
 */
const can_remove_block = (section) => {
  const { constraints } = section;
  if (!constraints) return true;
  if (constraints.min_blocks != null) {
    return section.blocks.length > constraints.min_blocks;
  }
  return true;
};

export { can_accept_block, can_accept_section, can_remove_block };
