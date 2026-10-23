/** True for text fields and other editable targets, where keyboard shortcuts must not fire. No React here: the guest viewer uses it. */
export const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable);
