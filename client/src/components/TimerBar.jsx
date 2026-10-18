import { Clock, Timer } from 'lucide-react';

function fmt(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function fillClass(fraction) {
  if (fraction <= 0.2) return 'from-peach-400 to-peach-600';
  if (fraction <= 0.45) return 'from-peach-300 to-grape-400';
  return 'from-grape-400 to-grape-600';
}

function Bar({ icon: Icon, label, remaining, total, tone }) {
  const fraction = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  const pct = Math.round(fraction * 100);
  const low = fraction <= 0.2;
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Icon className="w-3.5 h-3.5" /> {label}
        </span>
        <span
          className={`font-display font-bold tabular-nums text-sm ${
            low ? 'text-peach-600 animate-pulse' : 'text-slate-700'
          }`}
        >
          {fmt(remaining)}
        </span>
      </div>
      <div className="clay-inset h-3 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${
            tone === 'question' ? fillClass(fraction) : 'from-sky-300 to-sky-500'
          } transition-[width] duration-500 ease-linear`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * Dual progress timers: a slower overall quiz timer and a faster per-question
 * timer. Both count down; the per-question bar warms toward peach as it runs out.
 */
export default function TimerBar({ overallRemaining, overallTotal, questionRemaining, questionTotal }) {
  return (
    <div className="flex items-center gap-4">
      <Bar icon={Clock} label="Total time" remaining={overallRemaining} total={overallTotal} tone="overall" />
      <Bar icon={Timer} label="This question" remaining={questionRemaining} total={questionTotal} tone="question" />
    </div>
  );
}
