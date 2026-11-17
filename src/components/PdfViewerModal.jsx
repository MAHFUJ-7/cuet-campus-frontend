// In-app PDF rendering with pdf.js — clicking or viewing a PDF never depends
// on the browser's "download instead of open" setting.
//
// Two presentations share the same renderer:
//   • PdfViewerModal    — full-screen overlay (default export)
//   • PdfInlineViewer   — embedded card, e.g. on the Routine PDF tab
//
// `src` accepts an absolute/relative URL (`/docs/routine.pdf`) or a blob: URL
// created by the caller (e.g. from an authed API download).
import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Icon, Spinner } from './ui/index.jsx';
import { downloadFile, filenameFromTitle } from '../lib/download.js';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * Loads `src` and renders it page-by-page onto a canvas fitted to the
 * container width. Renders its own pager bar.
 */
function PdfDocument({ src, title, className = '', controlsClassName = '' }) {
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const docRef = useRef(null);
  const renderTaskRef = useRef(null);

  const [pageCount, setPageCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // Loads the document bytes whenever the source changes (or Retry is hit).
  useEffect(() => {
    if (!src) {
      docRef.current = null;
      setPageCount(0);
      return undefined;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);

    (async () => {
      try {
        // `cache: 'reload'` bypasses the browser HTTP cache — a poisoned cache
        // entry (e.g. an empty response cached during a dev-server hiccup)
        // would otherwise keep feeding the viewer an empty body forever.
        let response = await fetch(src, { cache: 'reload' });
        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? 'The file was not found on the server.'
              : `The server responded with HTTP ${response.status}.`
          );
        }
        let data = new Uint8Array(await response.arrayBuffer());
        if (cancelled) return;
        if (data.length === 0) {
          // One automatic retry — a transient file lock can serve an empty body.
          await new Promise((resolve) => setTimeout(resolve, 400));
          if (cancelled) return;
          response = await fetch(src, { cache: 'reload' });
          if (!response.ok) {
            throw new Error(`The server responded with HTTP ${response.status}.`);
          }
          data = new Uint8Array(await response.arrayBuffer());
          if (data.length === 0) {
            throw new Error('The file arrived empty from the server — try again in a moment.');
          }
        }
        // A web page instead of the file usually means a stale session or a
        // wrong URL — the SPA fallback answered instead of the PDF.
        const contentType = response.headers.get('content-type') ?? '';
        const looksPdf = contentType.includes('pdf') || data.slice(0, 1024).includes(0x25); // '%P'
        if (contentType.includes('text/html') || (!looksPdf && data[0] !== 0x25)) {
          throw new Error(
            'The server returned a web page instead of the file — try refreshing the app (Ctrl+Shift+R).'
          );
        }
        const pdf = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) {
          pdf.destroy();
          return;
        }
        docRef.current = pdf;
        setPageCount(pdf.numPages);
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        docRef.current = null;
        setError(
          loadError?.message && !/invalid PDF|Unexpected|corrupted/i.test(loadError.message)
            ? loadError.message
            : 'This PDF could not be opened. It may be missing or corrupted.'
        );
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [src, reloadKey]);

  // Render the current page at fit-to-width scale.
  useEffect(() => {
    const pdf = docRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || loading) return undefined;

    let cancelled = false;
    setRendering(true);

    (async () => {
      try {
        renderTaskRef.current?.cancel();
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;

        const availableWidth = Math.max(
          280,
          (scrollRef.current?.clientWidth ?? window.innerWidth) - 32
        );
        const base = pdfPage.getViewport({ scale: 1 });
        const fit = availableWidth / base.width;
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const viewport = pdfPage.getViewport({ scale: fit * dpr });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(base.width * fit)}px`;
        canvas.style.height = `${Math.floor(base.height * fit)}px`;

        const task = pdfPage.render({
          canvasContext: canvas.getContext('2d'),
          viewport,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (renderError) {
        if (!cancelled && renderError?.name !== 'RenderingCancelledException') {
          setError('This page could not be rendered.');
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [page, loading, src]);

  const goPrev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const goNext = useCallback(() => setPage((p) => Math.min(pageCount, p + 1)), [pageCount]);

  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-auto bg-black/10 p-4">
        {loading ? (
          <div className="flex h-full min-h-40 items-center justify-center">
            <Spinner size={30} />
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
            <Icon name="error" size={40} className="text-critical" />
            <p className="max-w-md text-body-md text-ink-muted">{error}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setReloadKey((k) => k + 1)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary/10 px-3.5 py-2 text-label-lg font-semibold text-primary transition-colors hover:bg-primary/15 dark:bg-primary-light/20 dark:text-primary-light"
              >
                <Icon name="refresh" size={17} />
                Try again
              </button>
              <DownloadButton src={src} title={title} />
            </div>
            <p className="max-w-md text-label-sm text-ink-muted">
              If this keeps happening after a refresh, your session may have loaded older app
              files — close and reopen the site.
            </p>
          </div>
        ) : (
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              className="relative h-0 w-0 rounded-lg bg-white shadow-lg"
              style={rendering ? { opacity: 0.55, transition: 'opacity 120ms ease' } : undefined}
            />
          </div>
        )}
      </div>

      {pageCount > 0 && !loading && !error && (
        <div
          className={`flex items-center justify-center gap-4 border-t border-outline/60 bg-surface px-4 py-2 ${controlsClassName}`}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={goPrev}
            className="rounded-full p-2 text-ink transition-colors hover:bg-surface-variant disabled:opacity-30"
            aria-label="Previous page"
          >
            <Icon name="chevron_left" size={22} />
          </button>
          <span className="text-label-lg font-semibold text-ink-muted">
            Page {page} of {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={goNext}
            className="rounded-full p-2 text-ink transition-colors hover:bg-surface-variant disabled:opacity-30"
            aria-label="Next page"
          >
            <Icon name="chevron_right" size={22} />
          </button>
        </div>
      )}
    </div>
  );
}

/** Shared download-button behaviour for both viewer presentations. */
function usePdfDownload(src, title) {
  const [busy, setBusy] = useState(false);
  const download = useCallback(async () => {
    if (!src || busy) return;
    setBusy(true);
    try {
      await downloadFile(src, filenameFromTitle(title, '.pdf', 'document.pdf'));
    } catch {
      /* The viewer already shows load errors; a failed download is silent. */
    } finally {
      setBusy(false);
    }
  }, [src, title, busy]);
  return { busy, download };
}

function DownloadButton({ src, title, className = '' }) {
  const { busy, download } = usePdfDownload(src, title);
  if (!src) return null;
  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      aria-label="Download PDF"
      title="Download PDF"
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-label-md font-semibold text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink disabled:opacity-50 ${className}`}
    >
      {busy ? <Spinner size={15} /> : <Icon name="download" size={18} />}
      Download
    </button>
  );
}

/** Embedded PDF inside the page — used on the Routine PDF tab. */
export function PdfInlineViewer({ open = true, src, title, className = 'h-[68vh]' }) {
  if (!open || !src) return null;
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-outline/70 bg-surface ${className}`}>
      <div className="flex items-center gap-2 border-b border-outline/60 px-2.5 py-2 sm:px-4">
        <Icon name="picture_as_pdf" size={20} className="shrink-0 text-cancellation" />
        <p className="min-w-0 flex-1 truncate text-title-sm font-bold text-ink">
          {title || 'PDF'}
        </p>
        <DownloadButton src={src} title={title} />
      </div>
      <PdfDocument src={src} title={title} className="min-h-0 flex-1" />
    </div>
  );
}

/** Full-screen PDF overlay. */
export default function PdfViewerModal({ open, title, src, onClose }) {
  // Close on Escape; lock body scroll while open.
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/80">
      <div className="flex items-center gap-3 bg-surface px-4 py-3 shadow-md">
        <Icon name="picture_as_pdf" size={22} className="shrink-0 text-cancellation" />
        <p className="min-w-0 flex-1 truncate text-title-md font-bold text-ink">
          {title || 'PDF'}
        </p>
        <DownloadButton src={src} title={title} />
        <button
          type="button"
          onClick={onClose}
          aria-label="Close PDF viewer"
          className="rounded-full p-2 text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink"
        >
          <Icon name="close" size={22} />
        </button>
      </div>

      <PdfDocument key={src ?? 'empty'} src={src} title={title} className="min-h-0 flex-1 bg-black/40" />
    </div>
  );
}
