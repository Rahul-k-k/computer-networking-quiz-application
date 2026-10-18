import { AlertTriangle, X } from 'lucide-react';

/**
 * A clay modal used for anti-cheat warnings (tab switching, leaving
 * fullscreen). Controlled via `open`.
 */
export default function WarningModal({ open, title, message, onClose, actionLabel = 'Got it' }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-pop-in"
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="clay-card-lg w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="flex flex-col items-center text-center gap-3">
          <span className="grid place-items-center w-16 h-16 rounded-full bg-gradient-to-br from-peach-200 to-peach-400 shadow-clay">
            <AlertTriangle className="w-8 h-8 text-peach-700" />
          </span>
          <h3 className="text-xl font-extrabold text-slate-900">{title}</h3>
          <p className="text-slate-600">{message}</p>
          <button onClick={onClose} className="clay-btn clay-btn-peach mt-2">
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
