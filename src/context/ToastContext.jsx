// Floating snackbar-style toasts — the web counterpart of SnackBar.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/ui/index.jsx';

const ToastContext = createContext(null);

const TONE_STYLES = {
  error: { box: 'bg-red-700 text-white', icon: 'error' },
  success: { box: 'bg-emerald-700 text-white', icon: 'check_circle' },
  info: { box: 'bg-primary text-white', icon: 'info' },
  warning: { box: 'bg-amber-600 text-white', icon: 'warning' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (message, { type = 'info', duration = 4000 } = {}) => {
      const id = nextId.current;
      nextId.current += 1;
      setToasts((list) => [...list.slice(-3), { id, message: String(message ?? ''), type }]);
      if (duration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), duration)
        );
      }
      return id;
    },
    [dismiss]
  );

  useEffect(
    () => () => {
      timers.current.forEach((timer) => window.clearTimeout(timer));
      timers.current.clear();
    },
    []
  );

  const value = useMemo(
    () => ({
      show,
      dismiss,
      success: (m, opts) => show(m, { ...opts, type: 'success' }),
      error: (m, opts) => show(m, { ...opts, type: 'error' }),
      info: (m, opts) => show(m, { ...opts, type: 'info' }),
      warning: (m, opts) => show(m, { ...opts, type: 'warning' }),
    }),
    [show, dismiss]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:items-end sm:pr-6">
        {toasts.map((t) => {
          const tone = TONE_STYLES[t.type] ?? TONE_STYLES.info;
          return (
            <div
              key={t.id}
              role={t.type === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto flex max-w-md animate-fade-in-up items-start gap-2.5 rounded-xl px-4 py-3 text-left text-body-md font-medium shadow-lg ${tone.box}`}
            >
              <Icon name={tone.icon} size={18} className="mt-0.5 shrink-0" />
              <span className="min-w-0 flex-1">{t.message}</span>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-1 rounded-full p-0.5 text-white/80 transition-colors hover:bg-white/15 hover:text-white"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
