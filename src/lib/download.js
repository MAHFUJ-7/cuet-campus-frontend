// File download helpers — fetch the bytes and hand them to the browser as a
// download, so it works for blob: URLs, authed API endpoints and static files
// alike, regardless of the browser's "open instead of download" setting.

/** Save an already-fetched Blob under `filename`. */
export function saveBlob(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename || 'download';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a moment to start the download before revoking.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
}

/** Fetch `url` and save it as a download. Returns the blob for reuse. */
export async function downloadFile(url, filename) {
  // Bypass the HTTP cache — same reasoning as the PDF viewer.
  const response = await fetch(url, { cache: 'reload' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  saveBlob(blob, filename);
  return blob;
}

/** Turn a display title into a safe download filename with `extension`. */
export function filenameFromTitle(title, extension, fallback = 'download') {
  const base = String(title ?? '')
    .trim()
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .slice(0, 80);
  return `${base || fallback}${extension}`;
}
