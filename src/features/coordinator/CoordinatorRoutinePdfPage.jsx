// Official Routine PDF — port of coordinator_routine_pdf_screen.dart.
// Status card, upload (replaces current), AI extraction trigger, removal and
// an inline PDF viewer (authed binary fetch → object URL → iframe).
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  Card,
  ConfirmDialog,
  ErrorState,
  Icon,
  IconButton,
  PageHeader,
  PageShell,
  Spinner,
} from '../../components/ui/index.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { extractPayload } from '../../api/client.js';
import { describeApiError } from '../../api/errors.js';
import {
  deleteRoutinePdf,
  downloadRoutinePdf,
  extractRoutinePdf,
  getLatestRoutinePdf,
  uploadRoutinePdf,
} from '../../api/endpoints.js';

const MAX_PDF_BYTES = 20 * 1024 * 1024;

const formatSize = (bytes) => {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

export default function CoordinatorRoutinePdfPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef(null);

  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [infoError, setInfoError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const [pdfUrl, setPdfUrl] = useState(null);
  const [opening, setOpening] = useState(false);
  const [openError, setOpenError] = useState(null);

  const loadInfo = useCallback(async () => {
    setLoadingInfo(true);
    try {
      const response = await getLatestRoutinePdf();
      const payload = extractPayload(response);
      setInfo(payload && typeof payload === 'object' ? payload : null);
      setInfoError(null);
    } catch (error) {
      // 404 means nothing is uploaded yet — anything else is a real failure
      // and must not masquerade as an empty state.
      if (error?.status === 404) {
        setInfo(null);
        setInfoError(null);
      } else {
        setInfoError(describeApiError(error));
      }
    } finally {
      setLoadingInfo(false);
    }
  }, []);

  useEffect(() => {
    loadInfo();
  }, [loadInfo]);

  // Revoke the object URL on unmount / replacement.
  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl]
  );

  const pickFile = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const onFilePicked = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_PDF_BYTES) {
      toast.error('PDF too large. Maximum is 20 MB.');
      return;
    }

    setUploading(true);
    try {
      await uploadRoutinePdf(file, { title: 'Class Routine' });
      toast.success('Routine PDF published — previous version archived');
      // The old preview belongs to the replaced document — drop it.
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
      setOpenError(null);
      await loadInfo();
    } catch (error) {
      toast.error(describeApiError(error));
    } finally {
      setUploading(false);
    }
  };

  const extractAndReview = async () => {
    const id = info?._id ?? info?.id;
    if (!id || extracting) return;
    setExtracting(true);
    try {
      await extractRoutinePdf(id);
      navigate(`/coordinator/routine-review/${id}`);
    } catch (error) {
      // Still open review — it renders the stored failure reason.
      navigate(`/coordinator/routine-review/${id}`);
      toast.error(describeApiError(error));
    } finally {
      setExtracting(false);
    }
  };

  const remove = async () => {
    const id = info?._id ?? info?.id;
    setConfirmRemove(false);
    if (!id) return;
    try {
      await deleteRoutinePdf(id);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
      toast.success('Routine PDF removed');
      loadInfo();
    } catch (error) {
      toast.error(describeApiError(error));
    }
  };

  const openViewer = async () => {
    const id = info?._id ?? info?.id;
    if (!id || opening) return;
    setOpening(true);
    setOpenError(null);
    try {
      const blob = await downloadRoutinePdf(id);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (error) {
      setOpenError(describeApiError(error));
    } finally {
      setOpening(false);
    }
  };

  // Surface the AI extraction state when the backend reports one.
  const rawStatus = info?.extraction?.status ?? info?.extractionStatus ?? info?.status;
  const extractionStatus = ['pending', 'processing', 'completed', 'failed'].includes(
    String(rawStatus ?? '')
  )
    ? String(rawStatus)
    : null;
  const statusTone =
    extractionStatus === 'failed'
      ? 'text-critical'
      : extractionStatus === 'completed'
        ? 'text-success'
        : 'text-warning';

  return (
    <PageShell className="max-w-4xl">
      <PageHeader
        title="Official Routine PDF"
        onBack={() => navigate(-1)}
        actions={<IconButton icon="refresh" label="Refresh" onClick={loadInfo} />}
      />

      <Card>
        {loadingInfo ? (
          <div className="flex justify-center py-6">
            <Spinner size={26} />
          </div>
        ) : infoError && !info ? (
          <ErrorState message={infoError} onRetry={loadInfo} />
        ) : (
          <>
            {infoError && (
              <p className="mb-2.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-label-sm text-warning">
                {infoError}
              </p>
            )}
            <div className="flex items-center gap-2.5">
              <Icon
                name="picture_as_pdf"
                size={24}
                className={info ? 'shrink-0 text-critical' : 'shrink-0 text-ink-muted'}
              />
              <p className="min-w-0 flex-1 truncate text-title-sm font-bold text-ink">
                {info ? info.title ?? 'Class Routine' : 'No PDF uploaded yet'}
              </p>
            </div>

            {info && (
              <p className="mt-1 pl-[34px] text-label-sm text-ink-muted">
                {info.originalName ?? ''} • {formatSize(info.size)}
              </p>
            )}

            {info && extractionStatus && (
              <p className={`mt-1 pl-[34px] text-label-sm font-medium ${statusTone}`}>
                AI extraction: {extractionStatus}
              </p>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                variant="tonal"
                className="flex-1"
                icon="visibility"
                onClick={openViewer}
                disabled={!info || opening}
              >
                View
              </Button>
              <Button
                variant="filled"
                className="flex-1"
                icon={uploading ? null : 'upload_file'}
                onClick={pickFile}
                disabled={uploading}
              >
                {uploading ? <Spinner size={16} /> : null}
                <span>{info ? 'Replace' : 'Upload'}</span>
              </Button>
            </div>

            {info && (
              <>
                <Button
                  variant="outlined"
                  className="mt-2 w-full"
                  icon={extracting ? null : 'auto_awesome'}
                  onClick={extractAndReview}
                  disabled={extracting}
                >
                  {extracting ? <Spinner size={16} /> : null}
                  <span>AI Extract & Review</span>
                </Button>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="mt-2 rounded-lg px-3 py-1.5 text-label-lg font-semibold text-critical transition-colors hover:bg-critical/5"
                  >
                    Remove
                  </button>
                </div>
              </>
            )}
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={onFilePicked}
        />
      </Card>

      {/* Viewer area */}
      <div className="mt-4">
        {opening ? (
          <div className="flex h-72 items-center justify-center">
            <Spinner size={30} />
          </div>
        ) : openError ? (
          <div className="flex flex-col items-center gap-3 py-14 text-center">
            <Icon name="error" size={40} className="text-critical" />
            <p className="max-w-md text-body-md text-ink-muted">{openError}</p>
            <Button variant="outlined" onClick={openViewer}>
              Retry
            </Button>
          </div>
        ) : pdfUrl ? (
          <iframe
            title="Official routine PDF"
            src={pdfUrl}
            className="h-[calc(100dvh-23rem)] min-h-[320px] w-full rounded-xl border border-outline/60 bg-surface"
          />
        ) : (
          <p className="py-14 text-center text-body-md text-ink-muted">
            Open the PDF to preview it here
          </p>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Remove routine PDF?"
        message="Students will no longer see the official PDF until a new one is uploaded."
        confirmLabel="Remove"
        danger
        onConfirm={remove}
        onCancel={() => setConfirmRemove(false)}
      />
    </PageShell>
  );
}
