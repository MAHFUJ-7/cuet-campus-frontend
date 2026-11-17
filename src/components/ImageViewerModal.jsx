// Full-screen image viewer (lightbox) — mirrors PdfViewerModal: Escape closes,
// body scroll locks, and the file can be downloaded straight from the bar.
import { useEffect, useState } from 'react';
import { Icon } from './ui/index.jsx';
import { downloadFile, filenameFromTitle } from '../lib/download.js';

/** Does this filename/URL look like a viewable image? */
export function isImageAttachment(name) {
  return /\.(png|jpe?g|webp|gif|bmp|avif)(?:$|[?#])/i.test(String(name ?? ''));
}

export default function ImageViewerModal({ open, title, src, onClose }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, onClose]);

  if (!open || !src) return null;

  const download = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await downloadFile(src, filenameFromTitle(title, '', 'image'));
    } catch {
      /* nothing sensible to show; the image itself is already visible */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/85">
      <div className="flex items-center gap-3 bg-surface px-4 py-3 shadow-md">
        <Icon name="image" size={22} className="shrink-0 text-accent" />
        <p className="min-w-0 flex-1 truncate text-title-md font-bold text-ink">
          {title || 'Image'}
        </p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          aria-label="Download image"
          title="Download image"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-label-md font-semibold text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink disabled:opacity-50"
        >
          {busy ? <Icon name="sync" size={18} /> : <Icon name="download" size={18} />}
          Download
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close image viewer"
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink"
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
        <img
          src={src}
          alt={title || 'Attachment'}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
      </div>
    </div>
  );
}
