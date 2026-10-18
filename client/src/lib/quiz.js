// Shared quiz helpers used across the dashboard, arena, result and leaderboard.

export const TIERS = [
  { name: 'Platinum', min: 90, ring: '#7dd3fc', text: 'text-sky-600', chip: 'from-sky-300 to-grape-400' },
  { name: 'Gold', min: 75, ring: '#fcd34d', text: 'text-yellow-600', chip: 'from-yellow-300 to-peach-400' },
  { name: 'Silver', min: 60, ring: '#cbd5e1', text: 'text-slate-500', chip: 'from-slate-200 to-slate-400' },
  { name: 'Bronze', min: 0, ring: '#fca5a5', text: 'text-peach-600', chip: 'from-peach-300 to-peach-500' },
];

/** Map a percentage to an achievement tier. */
export function tierFor(percentage) {
  const pct = Number(percentage) || 0;
  return TIERS.find((t) => pct >= t.min) || TIERS[TIERS.length - 1];
}

// The three difficulty levels a student chooses from at quiz start. Every
// question is tagged with one of these `key`s server-side. Shared by the
// student picker, the teacher question form, and the difficulty badges so the
// labels/colours stay consistent everywhere. All class names use palette shades
// that exist in tailwind.config.js.
export const DIFFICULTIES = [
  {
    key: 'low',
    label: 'Easy',
    blurb: 'Warm-up fundamentals',
    ring: '#6EE86E', // mint-400
    text: 'text-mint-600',
    chip: 'from-mint-200 to-mint-400',
    badge: 'bg-mint-100 text-mint-700',
  },
  {
    key: 'medium',
    label: 'Medium',
    blurb: 'Solid working knowledge',
    ring: '#7FC0D6', // sky-400
    text: 'text-sky-600',
    chip: 'from-sky-200 to-sky-400',
    badge: 'bg-sky-100 text-sky-700',
  },
  {
    key: 'high',
    label: 'Hard',
    blurb: 'Expert-level challenge',
    ring: '#F79E93', // peach-400
    text: 'text-peach-600',
    chip: 'from-peach-200 to-peach-400',
    badge: 'bg-peach-100 text-peach-700',
  },
];

/** Look up a difficulty descriptor by key, defaulting to Medium. */
export function difficultyFor(key) {
  return DIFFICULTIES.find((d) => d.key === key) || DIFFICULTIES[1];
}

/** "1h 05m", "9m 30s" or "45s" from a seconds count. */
export function fmtDuration(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
  if (m) return `${m}m ${String(sec).padStart(2, '0')}s`;
  return `${sec}s`;
}

/** "2:05" clock style for the timer displays. */
export function fmtClock(totalSeconds) {
  const s = Math.max(0, Math.ceil(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

/** Did this result meet the category's pass mark? */
export function didPass(percentage, passPercentage = 60) {
  return (Number(percentage) || 0) >= (Number(passPercentage) || 60);
}

/** A compact label for radar axes / tight chips. */
export function shortLabel(name = '', max = 16) {
  const clean = String(name).trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1).trimEnd()}…`;
}
