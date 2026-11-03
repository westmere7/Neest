import { NOTE_IMAGE_MAX_CHARS, NoteImageSchema, type NoteImage } from '@/domain/model/schema';
import { newId } from '@/domain/model/ids';

/** Longest side of a stored note picture (pixels). Big photos are scaled down to this on import. */
export const NOTE_IMAGE_SIDE = 1600;

/** Image files a note accepts (anything the browser decodes is re-encoded to WebP or JPEG). */
export const isImageFile = (f: { type: string }) => f.type.startsWith('image/');

/**
 * Turns a picked, pasted or dropped image into a note picture: decoded, scaled to at most
 * `NOTE_IMAGE_SIDE` on its long side and re-encoded (WebP where supported, else JPEG), stepping the
 * size down until it fits the stored limit. Throws with a readable message when it cannot.
 */
export async function readNoteImage(file: Blob): Promise<NoteImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be read.');
  }
  try {
    let side = NOTE_IMAGE_SIDE;
    for (let attempt = 0; attempt < 5; attempt++) {
      const k = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
      const w = Math.max(1, Math.round(bitmap.width * k));
      const h = Math.max(1, Math.round(bitmap.height * k));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('This browser cannot process images.');
      ctx.drawImage(bitmap, 0, 0, w, h);
      let src = canvas.toDataURL('image/webp', 0.82);
      if (!src.startsWith('data:image/webp')) src = canvas.toDataURL('image/jpeg', 0.85);
      if (src.length <= NOTE_IMAGE_MAX_CHARS) return NoteImageSchema.parse({ id: newId('img'), src, w, h });
      side = Math.round(side * 0.7);
    }
    throw new Error('This image is too large to attach.');
  } finally {
    bitmap.close();
  }
}

/** Image files from a paste or drop (other content is ignored). */
export function imageFilesOf(data: DataTransfer | null): File[] {
  if (!data) return [];
  const out: File[] = [];
  for (const item of data.items ?? []) {
    if (item.kind !== 'file') continue;
    const f = item.getAsFile();
    if (f && isImageFile(f)) out.push(f);
  }
  if (!out.length) for (const f of data.files ?? []) if (isImageFile(f)) out.push(f);
  return out;
}
