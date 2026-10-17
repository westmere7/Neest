import { useEffect, useRef, type ReactNode } from 'react';
import { X, CheckCircle2, AlertTriangle, Info, XCircle } from 'lucide-react';
import { useDialogStore, useToastStore } from '@/state/uiStores';
import { Button } from './ui';
import './components.css';

/** Accessible modal dialog with focus trapping, Esc to close and focus restore. */
export function Dialog({
  title,
  onClose,
  children,
  footer,
  wide,
  testId,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean | 'xl';
  testId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const prevFocus = useRef<Element | null>(null);
  useEffect(() => {
    prevFocus.current = document.activeElement;
    const el = ref.current;
    const focusables = () =>
      [...(el?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])].filter(
        (x) => !x.hasAttribute('disabled'),
      );
    const first = el?.querySelector<HTMLElement>('[data-autofocus]') ?? focusables()[1] ?? focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') {
        const f = focusables();
        if (!f.length) return;
        const i = f.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          f[f.length - 1].focus();
        } else if (!e.shiftKey && i === f.length - 1) {
          e.preventDefault();
          f[0].focus();
        }
      }
    };
    el?.addEventListener('keydown', onKey);
    return () => {
      el?.removeEventListener('keydown', onKey);
      (prevFocus.current as HTMLElement | null)?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal${wide === 'xl' ? ' modal-xl' : wide ? ' modal-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        data-testid={testId}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function ConfirmHost() {
  const confirm = useDialogStore((s) => s.confirm);
  if (!confirm) return null;
  return (
    <Dialog
      title={confirm.title}
      onClose={() => confirm.resolve(false)}
      testId="confirm-dialog"
      footer={
        <>
          <Button onClick={() => confirm.resolve(false)}>Cancel</Button>
          <Button variant={confirm.danger ? 'danger' : 'primary'} onClick={() => confirm.resolve(true)} data-autofocus>
            {confirm.confirmLabel ?? 'OK'}
          </Button>
        </>
      }
    >
      <p className="confirm-text">{confirm.message}</p>
    </Dialog>
  );
}

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle };

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return (
    <div className="toast-host" role="region" aria-label="Notifications" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.kind];
        return (
          <div key={t.id} className={`toast toast-${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
            <Icon size={16} className="toast-icon" aria-hidden />
            <div className="toast-text">
              <strong>{t.title}</strong>
              {t.message && <span>{t.message}</span>}
            </div>
            {t.action && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  t.action!.run();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </Button>
            )}
            <button type="button" className="icon-btn sm" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Placeholder shown inside a panel while its content loads. */
export function PanelLoading({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="panel-loading" role="status" aria-live="polite">
      <span className="panel-spinner" aria-hidden />
      <span>{text}</span>
    </div>
  );
}
