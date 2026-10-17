import {
  forwardRef,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import type { LengthUnit } from '@/domain/model/schema';
import { formatLengthValue, parseLength } from '@/domain/model/units';
import './components.css';

// ───────────── Buttons ─────────────

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'primary' | 'ghost' | 'danger' | 'subtle';
  size?: 'sm' | 'md';
};

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'default', size = 'md', className = '', type = 'button', ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest} />;
});

type IconBtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  shortcut?: string;
  active?: boolean;
  tooltipSide?: 'top' | 'bottom' | 'left' | 'right';
  children: ReactNode;
};

/** Icon-only button with an accessible name and a portal tooltip showing name + shortcut above all panels. */
export const IconButton = forwardRef<HTMLButtonElement, IconBtnProps>(function IconButton(
  {
    label,
    shortcut,
    active,
    tooltipSide = 'bottom',
    className = '',
    children,
    type = 'button',
    onMouseEnter,
    onMouseLeave,
    onFocus,
    onBlur,
    onPointerDown,
    ...rest
  },
  ref,
) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const tipRef = useRef<HTMLDivElement | null>(null);
  const timerRef = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = () => {
    clearTimer();
    timerRef.current = window.setTimeout(() => {
      setOpen(true);
    }, 220);
  };

  const hide = () => {
    clearTimer();
    setOpen(false);
    setCoords(null);
  };

  useEffect(() => () => clearTimer(), []);

  useEffect(() => {
    if (rest.disabled && open) hide();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rest.disabled, open]);

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !tipRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const tr = tipRef.current.getBoundingClientRect();
    const tw = tr.width;
    const th = tr.height;
    const gap = 7;
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let top = 0;
    let left = 0;

    if (tooltipSide === 'bottom') {
      top = r.bottom + gap;
      if (top + th > vh - pad) top = r.top - gap - th;
      left = Math.min(vw - pad - tw, Math.max(pad, r.left + r.width / 2 - tw / 2));
    } else if (tooltipSide === 'top') {
      top = r.top - gap - th;
      if (top < pad) top = r.bottom + gap;
      left = Math.min(vw - pad - tw, Math.max(pad, r.left + r.width / 2 - tw / 2));
    } else if (tooltipSide === 'right') {
      left = r.right + gap;
      if (left + tw > vw - pad) left = r.left - gap - tw;
      top = Math.min(vh - pad - th, Math.max(pad, r.top + r.height / 2 - th / 2));
    } else {
      left = r.left - gap - tw;
      if (left < pad) left = r.right + gap;
      top = Math.min(vh - pad - th, Math.max(pad, r.top + r.height / 2 - th / 2));
    }

    setCoords({ top, left });
  }, [open, label, shortcut, tooltipSide]);

  const tipText = shortcut ? `${label}  ${shortcut}` : label;

  return (
    <>
      <button
        ref={(node) => {
          btnRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) ref.current = node;
        }}
        type={type}
        aria-label={shortcut ? `${label} (${shortcut})` : label}
        aria-pressed={active === undefined ? undefined : active}
        className={`icon-btn${active ? ' active' : ''} ${className}`}
        data-tooltip={tipText}
        data-tooltip-side={tooltipSide}
        onMouseEnter={(e) => {
          show();
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          hide();
          onMouseLeave?.(e);
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(':focus-visible')) show();
          onFocus?.(e);
        }}
        onBlur={(e) => {
          hide();
          onBlur?.(e);
        }}
        onPointerDown={(e) => {
          hide();
          onPointerDown?.(e);
        }}
        {...rest}
      >
        {children}
      </button>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={tipRef}
            role="tooltip"
            className="ui-tooltip"
            style={{
              top: coords ? `${coords.top}px` : '-9999px',
              left: coords ? `${coords.left}px` : '-9999px',
              opacity: coords ? 1 : 0,
            }}
          >
            <span>{label}</span>
            {shortcut && <kbd className="ui-tooltip-kbd">{shortcut}</kbd>}
          </div>,
          document.body,
        )}
    </>
  );
});

// ───────────── Fields ─────────────

export function Field({ label, children, hint, inline }: { label: string; children: ReactNode; hint?: string; inline?: boolean }) {
  return (
    <label className={`field${inline ? ' inline' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// ───────────── Number stepper ─────────────

/**
 * Up/down arrows at the end of a numeric input. A click steps once, holding repeats, Shift steps
 * ten times as far. The buttons are skipped by Tab (the arrow keys do the same in the field).
 */
function Stepper({ onStep, disabled }: { onStep: (dir: 1 | -1, big: boolean) => void; disabled?: boolean }) {
  const timer = useRef<number | null>(null);
  const stop = () => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  const start = (dir: 1 | -1, big: boolean) => {
    onStep(dir, big);
    let delay = 380;
    const tick = () => {
      onStep(dir, big);
      delay = Math.max(50, delay * 0.8);
      timer.current = window.setTimeout(tick, delay);
    };
    timer.current = window.setTimeout(tick, delay);
  };
  const btn = (dir: 1 | -1, label: string, icon: ReactNode) => (
    <button
      type="button"
      tabIndex={-1}
      aria-label={label}
      disabled={disabled}
      // Keep focus (and any typed text) in the input while stepping.
      onMouseDown={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        start(dir, e.shiftKey);
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
    >
      {icon}
    </button>
  );
  return (
    <span className="stepper">
      {btn(1, 'Increase', <ChevronUp size={11} strokeWidth={2.4} />)}
      {btn(-1, 'Decrease', <ChevronDown size={11} strokeWidth={2.4} />)}
    </span>
  );
}

/** Step for length fields, in metres: 1 cm in metric units, 1 inch in imperial ones. */
const lengthStep = (unit: LengthUnit): number => (unit === 'in' || unit === 'ft' ? 0.0254 : 0.01);

interface LengthFieldProps {
  label: string;
  value: number;
  unit: LengthUnit;
  precision: number;
  min?: number;
  max?: number;
  disabled?: boolean;
  onCommit: (metres: number) => void;
  hint?: string;
  testId?: string;
}

/**
 * Length input in display units that commits on Enter/blur, reverts on Esc,
 * and shows an inline error for invalid or out-of-range values (never
 * silently discarding the edit).
 */
export function LengthField({ label, value, unit, precision, min = 0, max = 1000, disabled, onCommit, hint, testId }: LengthFieldProps) {
  const [text, setText] = useState(() => formatLengthValue(value, unit, precision));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!focused.current) {
      setText(formatLengthValue(value, unit, precision));
      setError(null);
    }
  }, [value, unit, precision]);
  const commit = () => {
    const v = parseLength(text, unit);
    if (v == null) {
      setError('Enter a length, e.g. 2.4, 240cm or 7\'10"');
      return;
    }
    if (v < min - 1e-9 || v > max + 1e-9) {
      setError(`Must be between ${formatLengthValue(min, unit, precision)} and ${formatLengthValue(max, unit, precision)} ${unit === 'ft' ? '' : unit}`.trim());
      return;
    }
    setError(null);
    if (Math.abs(v - value) > 1e-7) onCommit(v);
    else setText(formatLengthValue(value, unit, precision));
  };
  // Steps from what is typed (when it parses) so a half-typed value isn't lost.
  const step = (dir: 1 | -1, big: boolean) => {
    const base = parseLength(text, unit) ?? value;
    const nv = Math.min(max, Math.max(min, Math.round((base + dir * lengthStep(unit) * (big ? 10 : 1)) * 1e6) / 1e6));
    setText(formatLengthValue(nv, unit, precision));
    setError(null);
    if (Math.abs(nv - value) > 1e-7) onCommit(nv);
  };
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap has-stepper">
        <input
          id={id}
          className="input num"
          value={text}
          disabled={disabled}
          inputMode="decimal"
          data-testid={testId}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : undefined}
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') {
              commit();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') {
              setText(formatLengthValue(value, unit, precision));
              setError(null);
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
            }
          }}
        />
        {unit !== 'ft' && <span className="input-suffix">{unit}</span>}
        <Stepper onStep={step} disabled={disabled} />
      </div>
      {error ? (
        <span className="field-error" id={`${id}-err`} role="alert">
          {error}
        </span>
      ) : (
        hint && <span className="field-hint">{hint}</span>
      )}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  decimals?: number;
  disabled?: boolean;
  onCommit: (v: number) => void;
}

export function NumberField({ label, value, min = -Infinity, max = Infinity, step: step0 = 1, suffix, decimals = 1, disabled, onCommit }: NumberFieldProps) {
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(decimals));
  const [text, setText] = useState(fmt(value));
  const [error, setError] = useState<string | null>(null);
  const focused = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!focused.current) setText(fmt(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  const commit = () => {
    const v = parseFloat(text.replace(',', '.'));
    if (!Number.isFinite(v)) return setError('Enter a number');
    if (v < min || v > max) return setError(`Between ${min} and ${max}`);
    setError(null);
    if (v !== value) onCommit(v);
  };
  const step = (dir: 1 | -1, big: boolean) => {
    const typed = parseFloat(text.replace(',', '.'));
    const base = Number.isFinite(typed) ? typed : value;
    const nv = Number(Math.min(max, Math.max(min, base + dir * step0 * (big ? 10 : 1))).toFixed(4));
    setText(fmt(nv));
    setError(null);
    if (nv !== value) onCommit(nv);
  };
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="input-wrap has-stepper">
        <input
          id={id}
          className="input num"
          value={text}
          disabled={disabled}
          inputMode="decimal"
          onFocus={(e) => {
            focused.current = true;
            e.currentTarget.select();
          }}
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setText(fmt(value));
              setError(null);
            }
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              e.preventDefault();
              step(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
            }
          }}
        />
        {suffix && <span className="input-suffix">{suffix}</span>}
        <Stepper onStep={step} disabled={disabled} />
      </div>
      {error && (
        <span className="field-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  placeholder,
  autoFocusEvent,
  maxLength = 80,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  placeholder?: string;
  autoFocusEvent?: string;
  maxLength?: number;
}) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const focused = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  useEffect(() => {
    if (!autoFocusEvent) return;
    const h = () => {
      ref.current?.focus();
      ref.current?.select();
    };
    window.addEventListener(autoFocusEvent, h);
    return () => window.removeEventListener(autoFocusEvent, h);
  }, [autoFocusEvent]);
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input
        ref={ref}
        id={id}
        className="input"
        value={text}
        placeholder={placeholder}
        maxLength={maxLength}
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          const t = text.trim();
          if (t && t !== value) onCommit(t);
          else setText(value);
        }}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') {
            setText(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
      />
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select id={id} className="input select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  onCommit,
  format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange?: (v: number) => void;
  onCommit: (v: number) => void;
  format?: (v: number) => string;
}) {
  const [local, setLocal] = useState(value);
  const dragging = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!dragging.current) setLocal(value);
  }, [value]);
  const pct = max > min ? Math.min(100, Math.max(0, ((local - min) / (max - min)) * 100)) : 0;
  return (
    <div className="field slider-field">
      <div className="slider-head">
        <label className="field-label" htmlFor={id}>
          {label}
        </label>
        <span className="slider-value num">{format ? format(local) : local.toFixed(2)}</span>
      </div>
      <input
        id={id}
        type="range"
        className="slider"
        min={min}
        max={max}
        step={step}
        value={local}
        style={{ '--slider-pct': `${pct}%` } as CSSProperties}
        onPointerDown={() => (dragging.current = true)}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          setLocal(v);
          onChange?.(v);
          if (!dragging.current) onCommit(v);
        }}
        onPointerUp={(e) => {
          dragging.current = false;
          onCommit(parseFloat((e.target as HTMLInputElement).value));
        }}
        onKeyDown={(e) => e.stopPropagation()}
      />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  size = 'md',
}: {
  value: T;
  options: { value: T; label: ReactNode; title?: string; testId?: string }[];
  onChange: (v: T) => void;
  label: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className={`segmented seg-${size}`} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          className={value === o.value ? 'on' : ''}
          title={o.title}
          data-testid={o.testId}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId();
  return (
    <div className="toggle-row">
      <label htmlFor={id}>
        <span>{label}</span>
        {hint && <span className="field-hint">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        className={`switch${checked ? ' on' : ''}`}
        onClick={() => onChange(!checked)}
      >
        <span className="knob" />
      </button>
    </div>
  );
}

const HEX = /^#?([0-9a-f]{6}|[0-9a-f]{3})$/i;
const RGB = /^rgb\s*\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$|^(\d{1,3})\s*[, ]\s*(\d{1,3})\s*[, ]\s*(\d{1,3})$/i;

/** Parses HEX (#abc, #aabbcc) or RGB ("rgb(1,2,3)" / "1, 2, 3") into #rrggbb. */
export function parseColor(input: string): string | null {
  const s = input.trim();
  const h = s.match(HEX);
  if (h) {
    let v = h[1];
    if (v.length === 3) v = v.split('').map((c) => c + c).join('');
    return `#${v.toLowerCase()}`;
  }
  const r = s.match(RGB);
  if (r) {
    const nums = (r[1] ? [r[1], r[2], r[3]] : [r[4], r[5], r[6]]).map(Number);
    if (nums.some((n) => n > 255)) return null;
    return `#${nums.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
  }
  return null;
}

export function ColorField({ label, value, onCommit, onPreview }: { label: string; value: string; onCommit: (hex: string) => void; onPreview?: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [error, setError] = useState(false);
  const id = useId();
  useEffect(() => setText(value), [value]);
  return (
    <div className={`field${error ? ' has-error' : ''}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className="color-field">
        <input
          type="color"
          aria-label={`${label} picker`}
          value={value}
          onInput={(e) => onPreview?.((e.target as HTMLInputElement).value)}
          onChange={(e) => onCommit(e.target.value)}
        />
        <input
          id={id}
          className="input mono"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            const c = parseColor(text);
            if (c) {
              setError(false);
              if (c !== value) onCommit(c);
              setText(c);
            } else setError(true);
          }}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-invalid={error}
          placeholder="#aabbcc or 12, 34, 56"
        />
      </div>
      {error && (
        <span className="field-error" role="alert">
          Use HEX (#a1b2c3) or RGB (161, 178, 195)
        </span>
      )}
    </div>
  );
}

export function Section({ title, children, actions, defaultOpen = true }: { title: string; children: ReactNode; actions?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`section${open ? ' open' : ''}`}>
      <header className="section-head">
        <button type="button" className="section-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
          <ChevronRight size={13} className="chev" aria-hidden />
          {title}
        </button>
        {actions}
      </header>
      {open && <div className="section-body">{children}</div>}
    </section>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="kbd">{children}</kbd>;
}
