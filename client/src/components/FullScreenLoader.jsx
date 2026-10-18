import { Loader2 } from 'lucide-react';

export function FullScreenLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-3 text-slate-500">
      <Loader2 className="w-8 h-8 animate-spin text-grape-500" />
      <p className="font-display font-semibold">{label}</p>
    </div>
  );
}

export default FullScreenLoader;
