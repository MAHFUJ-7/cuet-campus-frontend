// Core UI kit — web counterparts of the Flutter shared widgets.
// Material 3-flavoured: filled/tonal/outlined buttons, elevated cards, etc.
import { forwardRef, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ICON_CODEPOINTS } from '../../lib/icons.js';

// ---------------------------------------------------------------------------
// Icons (Material Symbols Outlined, self-hosted + subset, rendered by codepoint)
// ---------------------------------------------------------------------------
export function Icon({ name, size = 24, filled = false, weight = 400, className = '', style }) {
  const codepoint = ICON_CODEPOINTS[name];
  return (
    <span
      aria-hidden="true"
      className={`msr select-none ${filled ? 'msr-fill' : ''} ${className}`}
      style={{
        fontSize: `${size}px`,
        width: `${size}px`,
        height: `${size}px`,
        fontVariationSettings: `"FILL" ${filled ? 1 : 0}, "wght" ${weight}, "GRAD" 0, "opsz" 24`,
        ...style,
      }}
    >
      {codepoint ? String.fromCodePoint(codepoint) : name}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
const BTN_VARIANTS = {
  filled: 'bg-primary text-white hover:bg-primary-light active:bg-primary-dark shadow-sm',
  tonal: 'bg-primary/10 text-primary hover:bg-primary/15 dark:bg-primary-light/20 dark:text-primary-light',
  outlined: 'border border-outline text-ink hover:bg-surface-variant',
  text: 'text-primary hover:bg-primary/5',
  danger: 'bg-danger text-white hover:brightness-95',
  gold: 'bg-gold text-primary-dark hover:bg-gold-light font-semibold',
};

const BTN_SIZES = {
  sm: 'text-label-md px-3 py-1.5 rounded-lg gap-1.5',
  md: 'text-label-lg px-4 py-2.5 rounded-xl gap-2',
  lg: 'text-title-md px-5 py-3 rounded-xl gap-2',
};

export function Button({
  children,
  variant = 'filled',
  size = 'md',
  icon = null,
  trailingIcon = null,
  loading = false,
  disabled = false,
  className = '',
  type = 'button',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${BTN_VARIANTS[variant]} ${BTN_SIZES[size]} ${className}`}
      {...rest}
    >
      {loading ? (
        <Spinner size={16} />
      ) : (
        icon && <Icon name={icon} size={size === 'sm' ? 16 : 18} />
      )}
      {children}
      {trailingIcon && !loading && <Icon name={trailingIcon} size={size === 'sm' ? 16 : 18} />}
    </button>
  );
}

export function IconButton({
  icon,
  label,
  onClick,
  size = 20,
  className = '',
  filled = false,
  disabled = false,
  type = 'button',
  as: As = 'button',
  to,
}) {
  const classes = `inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-surface-variant hover:text-ink disabled:opacity-40 ${className}`;
  const content = <Icon name={icon} size={size} filled={filled} />;
  if (As === Link || to) {
    return (
      <Link to={to} aria-label={label} title={label} className={classes}>
        {content}
      </Link>
    );
  }
  return (
    <button type={type} aria-label={label} title={label} onClick={onClick} disabled={disabled} className={classes}>
      {content}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Spinner / skeletons
// ---------------------------------------------------------------------------
export function Spinner({ size = 20, className = '', label = null }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label ?? undefined}
      aria-hidden={label ? undefined : true}
      className={`inline-block animate-spin-slow rounded-full border-2 border-current border-t-transparent ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

export function SkeletonBlock({ className = '' }) {
  return <div className={`skeleton rounded-xl ${className}`} />;
}

export function LoadingScreen({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-muted">
      <Spinner size={28} />
      <p className="text-body-md">{label}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card / surfaces
// ---------------------------------------------------------------------------
export function Card({ children, className = '', padded = true, onClick, ...rest }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`block w-full rounded-2xl border border-outline/70 bg-surface text-left shadow-sm ${padded ? 'p-4' : ''} ${onClick ? 'transition-transform hover:-translate-y-0.5 hover:shadow-md' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Comp>
  );
}

export function SectionTitle({ children, action = null, className = '' }) {
  return (
    <div className={`mb-2 flex items-center justify-between gap-3 ${className}`}>
      <h2 className="text-title-md font-semibold text-ink">{children}</h2>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chips / badges
// ---------------------------------------------------------------------------
const CHIP_TONES = {
  primary: 'bg-primary/10 text-primary dark:bg-primary-light/20 dark:text-primary-light',
  gold: 'bg-gold/15 text-gold-dark dark:text-gold',
  success: 'bg-success/15 text-emerald-700 dark:text-emerald-300',
  warning: 'bg-warning/15 text-amber-700 dark:text-amber-300',
  danger: 'bg-danger/15 text-red-700 dark:text-red-300',
  info: 'bg-info/15 text-blue-700 dark:text-blue-300',
  violet: 'bg-violet/15 text-violet-700 dark:text-violet-300',
  neutral: 'bg-surface-variant text-ink-muted',
};

export function Chip({ children, tone = 'neutral', icon = null, className = '' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-label-sm font-semibold uppercase tracking-wide ${CHIP_TONES[tone] ?? CHIP_TONES.neutral} ${className}`}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export function Avatar({ name = '', size = 40, src = null, className = '' }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`rounded-full object-cover ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-primary text-white ${className}`}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initials || <Icon name="person" size={size * 0.6} />}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------
export const TextField = forwardRef(function TextField(
  {
    label,
    hint,
    icon = null,
    error = null,
    type = 'text',
    value,
    onChange,
    onBlur,
    autoComplete,
    disabled = false,
    multiline = false,
    rows = 3,
    className = '',
    inputClassName = '',
    suffix = null,
    id,
    name,
    required = false,
    ...rest
  },
  ref
) {
  const [showPassword, setShowPassword] = useState(false);
  const autoId = useId();
  const inputId = id ?? `field-${autoId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  const isPassword = type === 'password';
  const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

  const inputClasses = `w-full rounded-xl border bg-surface px-3 py-2.5 text-body-lg text-ink outline-none transition-colors placeholder:text-ink-muted/60 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${
    error ? 'border-danger' : 'border-outline'
  } ${icon ? 'pl-10' : ''} ${isPassword || suffix ? 'pr-11' : ''} ${inputClassName}`;

  const sharedProps = {
    id: inputId,
    name,
    required,
    value,
    onChange,
    onBlur,
    placeholder: hint,
    disabled,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': errorId,
    ...rest,
  };

  return (
    <label className={`block ${className}`} htmlFor={inputId}>
      {label && (
        <span className="mb-1 block text-label-md font-medium text-ink-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            <Icon name={icon} size={18} />
          </span>
        )}
        {multiline ? (
          <textarea ref={ref} rows={rows} className={inputClasses} {...sharedProps} />
        ) : (
          <input ref={ref} type={inputType} autoComplete={autoComplete} className={inputClasses} {...sharedProps} />
        )}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-ink-muted hover:bg-surface-variant"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            aria-pressed={showPassword}
          >
            <Icon name={showPassword ? 'visibility_off' : 'visibility'} size={18} />
          </button>
        )}
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2">{suffix}</span>}
      </span>
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-label-md text-danger">
          {error}
        </span>
      )}
    </label>
  );
});

// ---------------------------------------------------------------------------
// Select (native dropdown styled to match TextField)
// ---------------------------------------------------------------------------
export function Select({
  label,
  value,
  onChange,
  options = [],
  error = null,
  disabled = false,
  placeholder = 'Select…',
  icon = null,
  className = '',
  id,
  name,
  required = false,
  ...rest
}) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <label className={`block ${className}`} htmlFor={selectId}>
      {label && (
        <span className="mb-1 block text-label-md font-medium text-ink-muted">
          {label}
          {required && <span className="ml-0.5 text-danger">*</span>}
        </span>
      )}
      <span className="relative block">
        {icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted">
            <Icon name={icon} size={18} />
          </span>
        )}
        <select
          id={selectId}
          name={name}
          value={value ?? ''}
          onChange={onChange}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={errorId}
          className={`w-full appearance-none rounded-xl border bg-surface py-2.5 pr-9 text-body-lg text-ink outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 ${
            error ? 'border-danger' : 'border-outline'
          } ${icon ? 'pl-10' : 'pl-3'}`}
          {...rest}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((opt) => {
            const optionValue = typeof opt === 'string' ? opt : opt.value;
            const optionLabel = typeof opt === 'string' ? opt : opt.label;
            return (
              <option key={optionValue} value={optionValue}>
                {optionLabel}
              </option>
            );
          })}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted">
          <Icon name={disabled ? 'lock' : 'expand_more'} size={18} />
        </span>
      </span>
      {error && (
        <span id={errorId} role="alert" className="mt-1 block text-label-md text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Empty / error states
// ---------------------------------------------------------------------------
export function EmptyState({ icon = 'inbox', title, message = null, action = null, className = '' }) {
  return (
    <div className={`flex flex-col items-center gap-2 px-6 py-12 text-center ${className}`}>
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-variant text-ink-muted">
        <Icon name={icon} size={28} />
      </span>
      <p className="text-title-md font-semibold text-ink">{title}</p>
      {message && <p className="max-w-sm text-body-md text-ink-muted">{message}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry = null }) {
  return (
    <EmptyState
      icon="cloud_off"
      title="Something went wrong"
      message={message ?? 'Please check your connection and try again.'}
      action={onRetry ? <Button variant="tonal" icon="refresh" onClick={onRetry}>Retry</Button> : null}
    />
  );
}

// ---------------------------------------------------------------------------
// Segmented control (web stand-in for TabBar / SegmentedButton)
// ---------------------------------------------------------------------------
export function SegmentedTabs({ tabs, value, onChange, className = '' }) {
  return (
    <div className={`inline-flex rounded-xl bg-surface-variant p-1 ${className}`}>
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            aria-pressed={active}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-label-md font-semibold transition-colors ${
              active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {tab.icon && <Icon name={tab.icon} size={15} filled={active} />}
            {tab.label}
            {tab.badge != null && tab.badge > 0 && (
              <span className="ml-0.5 rounded-full bg-danger/15 px-1.5 text-label-sm text-danger">
                {tab.badge}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page scaffolding (web top bar for pushed screens)
// ---------------------------------------------------------------------------
export function PageShell({ children, className = '' }) {
  return <div className={`mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 ${className}`}>{children}</div>;
}

export function PageHeader({ title, subtitle = null, onBack = null, actions = null, className = '' }) {
  return (
    <header className={`mb-5 flex items-start gap-3 ${className}`}>
      {onBack && (
        <IconButton icon="arrow_back" label="Back" onClick={onBack} className="mt-0.5 bg-surface shadow-sm" />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-display-sm font-bold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-body-md text-ink-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Divider({ className = '' }) {
  return <div className={`h-px w-full bg-outline/70 ${className}`} />;
}

// ---------------------------------------------------------------------------
// Settings list row (Profile & preferences screens)
// ---------------------------------------------------------------------------
export function SettingsTile({
  icon,
  title,
  subtitle = null,
  onClick = null,
  trailing = null,
  iconTone = 'text-primary dark:text-primary-light',
  danger = false,
}) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick ?? undefined}
      className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
        onClick ? 'hover:bg-surface-variant' : ''
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          danger ? 'bg-danger/10 text-danger' : `bg-primary/8 ${iconTone}`
        }`}
      >
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-body-lg font-medium ${danger ? 'text-danger' : 'text-ink'}`}>
          {title}
        </span>
        {subtitle && <span className="block truncate text-body-sm text-ink-muted">{subtitle}</span>}
      </span>
      {trailing ?? (onClick && <Icon name="chevron_right" size={20} className="shrink-0 text-ink-muted" />)}
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// Switch row (settings screens)
// ---------------------------------------------------------------------------
export function SwitchRow({
  icon,
  title,
  subtitle = null,
  checked = false,
  onChange,
  disabled = false,
  iconTone = 'text-primary dark:text-primary-light',
}) {
  return (
    <div className="flex w-full items-center gap-3 px-4 py-3">
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/8 ${iconTone}`}
      >
        <Icon name={icon} size={19} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-body-lg font-medium text-ink">{title}</span>
        {subtitle && <span className="block text-body-sm text-ink-muted">{subtitle}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => onChange?.(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-40 ${
          checked ? 'bg-primary' : 'bg-outline'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
            checked ? 'left-[22px]' : 'left-0.5'
          }`}
        />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Confirm dialog
// ---------------------------------------------------------------------------
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const titleId = useId();
  const messageId = useId();
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusable = [
        ...(dialogRef.current?.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        ) ?? []),
      ].filter((element) => !element.hasAttribute('disabled'));
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-5"
      onClick={onCancel}
      role="presentation"
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={message ? messageId : undefined}
        className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId} className="text-title-lg font-semibold text-ink">
          {title}
        </p>
        {message && (
          <p id={messageId} className="mt-1.5 text-body-md text-ink-muted">
            {message}
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="text" onClick={onCancel} autoFocus>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'filled'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CuetBackground — full-bleed campus photo with gradient scrim.
// ---------------------------------------------------------------------------
export function CuetBackground({
  asset = '/images/cuet_campus.jpg',
  overlayOpacity = 0.82,
  children,
  bottomGradient = true,
  className = '',
  contentClassName = '',
}) {
  const alpha = (a) => Math.round(a).toString(16).padStart(2, '0');
  const top = `#1A3A6B${alpha(overlayOpacity * 235)}`;
  const mid = `#1A3A6B${alpha(overlayOpacity * 205)}`;
  const bottom = `#0A1628${alpha(overlayOpacity * 240)}`;
  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#12233F] ${className}`}>
      <img src={asset} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(to bottom, ${top} 0%, ${mid} 55%, ${bottom} 100%)` }}
      />
      {bottomGradient && (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-56"
          style={{ background: 'linear-gradient(to bottom, transparent, #0A1628a0)' }}
        />
      )}
      <div className={`relative h-full overflow-y-auto overscroll-contain ${contentClassName}`}>
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------
export function FadeIn({ children, delay = 0, className = '' }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(t);
  }, [delay]);
  return (
    <div className={`${ready ? 'animate-fade-in-up' : 'opacity-0'} ${className}`}>{children}</div>
  );
}

export function Bars({ value = 0, max = 1, tone = 'bg-primary', className = '', label = 'Progress' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-variant ${className}`}
    >
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
