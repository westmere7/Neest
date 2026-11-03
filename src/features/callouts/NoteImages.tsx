import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, ImagePlus, X } from 'lucide-react';
import { NOTE_IMAGE_MAX, type NoteImage } from '@/domain/model/schema';
import { toast } from '@/state/uiStores';
import { imageFilesOf, readNoteImage } from './images';

/** Reads image files into note pictures after `current`, up to `NOTE_IMAGE_MAX`; problems become toasts. */
export async function addNoteImages(current: NoteImage[], files: File[]): Promise<NoteImage[]> {
  const room = NOTE_IMAGE_MAX - current.length;
  if (room <= 0) {
    toast.warning(`A note holds up to ${NOTE_IMAGE_MAX} images.`);
    return current;
  }
  if (files.length > room) toast.warning(`Only ${room} more image${room === 1 ? '' : 's'} fit in this note.`);
  const out = [...current];
  for (const f of files.slice(0, room)) {
    try {
      out.push(await readNoteImage(f));
    } catch (e) {
      toast.error('Image not added', e instanceof Error ? e.message : undefined);
    }
  }
  return out;
}

/** Full-size viewer over everything; arrows step through the note's images, Esc or a click outside closes. */
function ImageLightbox({ images, index, onIndex, onClose }: { images: NoteImage[]; index: number; onIndex: (i: number) => void; onClose: () => void }) {
  const img = images[index];
  useEffect(() => {
    // Capture phase: Esc must close this viewer, not the dialog or the notes mode underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && images.length > 1) onIndex((index - 1 + images.length) % images.length);
      else if (e.key === 'ArrowRight' && images.length > 1) onIndex((index + 1) % images.length);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [images.length, index, onIndex, onClose]);
  if (!img) return null;
  return createPortal(
    <div className="note-lightbox" role="dialog" aria-label="Note image" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <img src={img.src} width={img.w} height={img.h} alt={`Note image ${index + 1} of ${images.length}`} />
      <button type="button" className="note-lightbox-btn close" aria-label="Close" onClick={onClose}>
        <X size={18} />
      </button>
      {images.length > 1 && (
        <>
          <button type="button" className="note-lightbox-btn prev" aria-label="Previous image" onClick={() => onIndex((index - 1 + images.length) % images.length)}>
            <ChevronLeft size={22} />
          </button>
          <button type="button" className="note-lightbox-btn next" aria-label="Next image" onClick={() => onIndex((index + 1) % images.length)}>
            <ChevronRight size={22} />
          </button>
          <span className="note-lightbox-count">
            {index + 1} / {images.length}
          </span>
        </>
      )}
    </div>,
    document.body,
  );
}

/**
 * A note's pictures as thumbnails (click to view full size). Only where a note is read in full: the
 * Notes panel, the editor and the Inspector; the floating labels never show them.
 */
export function NoteImages({ images }: { images: NoteImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!images.length) return null;
  return (
    <div className="note-images" data-testid="note-images">
      {images.map((img, i) => (
        <button
          key={img.id}
          type="button"
          className="note-image-thumb"
          title="View full size"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(i);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <img src={img.src} alt={`Note image ${i + 1}`} loading="lazy" />
        </button>
      ))}
      {open !== null && <ImageLightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

/** Editing a note's pictures: thumbnails with remove buttons, an Add image button, and drop to add. */
export function NoteImagesEditor({ images, onChange }: { images: NoteImage[]; onChange: (next: NoteImage[]) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const add = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      onChange(await addNoteImages(images, files));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div
      className={`note-images-editor${over ? ' drop-over' : ''}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return;
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        setOver(false);
        const files = imageFilesOf(e.dataTransfer);
        if (!files.length) return;
        e.preventDefault();
        void add(files);
      }}
      data-testid="note-images-editor"
    >
      {images.map((img, i) => (
        <div key={img.id} className="note-image-thumb editable">
          <button type="button" className="note-image-open" title="View full size" onClick={() => setOpen(i)}>
            <img src={img.src} alt={`Note image ${i + 1}`} />
          </button>
          <button type="button" className="note-image-remove" aria-label="Remove image" title="Remove image" onClick={() => onChange(images.filter((x) => x.id !== img.id))}>
            <X size={12} />
          </button>
        </div>
      ))}
      {images.length < NOTE_IMAGE_MAX && (
        <button type="button" className="note-image-add" disabled={busy} onClick={() => input.current?.click()} title="Add images (or paste / drop them here)" data-testid="note-image-add">
          <ImagePlus size={15} />
          <span>{busy ? 'Adding…' : images.length ? 'Add' : 'Add image'}</span>
        </button>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
        multiple
        hidden
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          e.target.value = '';
          void add(files);
        }}
        data-testid="note-image-input"
      />
      {open !== null && <ImageLightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}
