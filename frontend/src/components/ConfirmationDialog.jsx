import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Info, KeyRound, Trash2 } from 'lucide-react';

const iconByVariant = {
  danger: { Icon: Trash2, iconClass: 'bg-rose-100 text-rose-700', buttonClass: 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500' },
  warning: { Icon: KeyRound, iconClass: 'bg-amber-100 text-amber-700', buttonClass: 'bg-amber-600 hover:bg-amber-700 focus-visible:ring-amber-500' },
  primary: { Icon: Info, iconClass: 'bg-blue-100 text-blue-700', buttonClass: 'bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500' },
};

const ConfirmationDialogView = ({ confirmation, onCancel, onConfirm }) => {
  useEffect(() => {
    if (!confirmation) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirmation, onCancel]);

  if (!confirmation) return null;
  const style = iconByVariant[confirmation.variant] || iconByVariant.primary;
  const Icon = style.Icon || AlertTriangle;

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${style.iconClass}`}>
            <Icon size={21} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="confirmation-dialog-title" className="text-lg font-bold text-slate-900">{confirmation.title}</h2>
            <p id="confirmation-dialog-description" className="mt-2 text-sm leading-6 text-slate-600">{confirmation.description}</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            {confirmation.cancelLabel || 'Cancel'}
          </button>
          <button
            type="button"
            autoFocus
            onClick={onConfirm}
            className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${style.buttonClass}`}
          >
            {confirmation.confirmLabel || 'Confirm'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export const useConfirmation = () => {
  const [confirmation, setConfirmation] = useState(null);
  const resolveRef = useRef(null);

  const settle = useCallback((confirmed) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setConfirmation(null);
  }, []);

  const requestConfirmation = useCallback((options) => new Promise((resolve) => {
    if (resolveRef.current) resolveRef.current(false);
    resolveRef.current = resolve;
    setConfirmation({
      title: options.title || 'Are you sure?',
      description: options.description || 'Please confirm that you want to continue.',
      confirmLabel: options.confirmLabel || 'Confirm',
      cancelLabel: options.cancelLabel || 'Cancel',
      variant: options.variant || 'primary',
    });
  }), []);

  useEffect(() => () => {
    resolveRef.current?.(false);
  }, []);

  return {
    requestConfirmation,
    confirmationDialog: (
      <ConfirmationDialogView
        confirmation={confirmation}
        onCancel={() => settle(false)}
        onConfirm={() => settle(true)}
      />
    ),
  };
};

export default ConfirmationDialogView;
