/** True for text fields and other editable targets, where keyboard shortcuts must not fire. No React here: the guest viewer uses it. */
export const isEditableTarget = (t: EventTarget | null) =>
  t instanceof HTMLInputElement ||
  t instanceof HTMLTextAreaElement ||
  t instanceof HTMLSelectElement ||
  (t instanceof HTMLElement && t.isContentEditable === true);

/** Inputs that take no typed text (no text undo of their own). */
const NON_TEXT_INPUTS = new Set([
  'checkbox',
  'radio',
  'range',
  'color',
  'button',
  'submit',
  'reset',
  'file',
  'image',
]);

/** True where text is typed (text inputs, text areas, contentEditable): the browser's own undo applies there. */
export const isTextEntry = (t: EventTarget | null) =>
  (t instanceof HTMLInputElement && !NON_TEXT_INPUTS.has(t.type)) ||
  t instanceof HTMLTextAreaElement ||
  (t instanceof HTMLElement && t.isContentEditable === true);
