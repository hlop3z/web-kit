/**
 * Custom confirm dialog — replaces window.confirm() with a styled modal.
 *
 * Returns a promise that resolves true (delete) or false (cancel).
 * Closes on Escape, overlay click, or button click.
 */
export function confirm_delete(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "cs-confirm-overlay";

    const dialog = document.createElement("div");
    dialog.className = "cs-confirm-dialog";

    const msg = document.createElement("p");
    msg.className = "cs-confirm-message";
    msg.textContent = message;

    const actions = document.createElement("div");
    actions.className = "cs-confirm-actions";

    const cancel_btn = document.createElement("button");
    cancel_btn.className = "cs-confirm-cancel";
    cancel_btn.textContent = "Cancel";

    const delete_btn = document.createElement("button");
    delete_btn.className = "cs-confirm-delete";
    delete_btn.textContent = "Delete";

    actions.append(cancel_btn, delete_btn);
    dialog.append(msg, actions);
    overlay.append(dialog);

    const close = (result: boolean) => {
      overlay.remove();
      resolve(result);
    };

    cancel_btn.addEventListener("click", () => close(false));
    delete_btn.addEventListener("click", () => close(true));
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close(false);
    });
    overlay.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close(false);
    });

    document.body.append(overlay);
    cancel_btn.focus();
  });
}
