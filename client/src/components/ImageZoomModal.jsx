import { X } from 'lucide-react';

/** Full-size view of a question image. Click anywhere / Esc-equivalent to close. */
export default function ImageZoomModal({ open, src, alt = 'Question image', onClose }) {
  if (!open || !src) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-pop-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        className="absolute top-5 right-5 text-white/80 hover:text-white"
        aria-label="Close"
        onClick={onClose}
      >
        <X className="w-7 h-7" />
      </button>
      <img
        src={src}
        alt={alt}
        className="max-h-[85vh] max-w-[90vw] rounded-clay bg-slate-50 p-3 shadow-clay-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}
