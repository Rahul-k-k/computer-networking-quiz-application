import { useEffect, useMemo, useState } from 'react';
import { Crown, Medal, Trophy, Clock, Sparkles, AlertCircle } from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { tierFor, fmtDuration } from '../lib/quiz';
import { FullScreenLoader } from '../components/FullScreenLoader';

const MEDALS = ['#fcd34d', '#cbd5e1', '#f4a98f']; // gold / silver / bronze

export default function Leaderboard() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/results/leaderboard');
        if (alive) setRows(data.leaderboard || []);
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || 'Could not load the leaderboard.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const meId = user?._id ? String(user._id) : null;
  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  // Podium visual order: 2nd, 1st, 3rd.
  const podiumOrder = useMemo(() => {
    if (top3.length === 0) return [];
    const order = [top3[1], top3[0], top3[2]].filter(Boolean);
    return order.map((r) => ({ ...r, rank: rows.indexOf(r) + 1 }));
  }, [top3, rows]);

  if (loading) return <FullScreenLoader label="Tallying scores…" />;

  return (
    <div className="space-y-8 animate-pop-in">
      <header className="text-center">
        <div className="inline-flex clay-chip items-center gap-2 text-grape-600 font-bold">
          <Trophy className="w-4 h-4" /> Class leaderboard
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">Top networkers</h1>
        <p className="text-slate-600 mt-1">Ranked by best score, then speed. Can you reach the top?</p>
      </header>

      {error && (
        <div className="clay-card p-4 text-peach-700 font-semibold flex items-center gap-2 max-w-md mx-auto">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {rows.length === 0 && !error && (
        <div className="clay-card-lg p-10 text-center max-w-md mx-auto">
          <Sparkles className="w-12 h-12 text-grape-400 mx-auto" />
          <p className="text-slate-600 mt-3 font-semibold">No scores yet — be the first to set a record!</p>
        </div>
      )}

      {/* Podium */}
      {podiumOrder.length > 0 && (
        <section className="flex items-end justify-center gap-3 sm:gap-5">
          {podiumOrder.map((r) => {
            const isFirst = r.rank === 1;
            const isMe = meId && String(r._id) === meId;
            const tier = tierFor(r.percentage);
            return (
              <div key={r._id} className={`flex flex-col items-center ${isFirst ? 'order-none' : ''}`}>
                <div
                  className={`clay-card relative flex flex-col items-center px-3 sm:px-5 py-4 ${
                    isFirst ? 'w-32 sm:w-40' : 'w-28 sm:w-32'
                  } ${isMe ? 'ring-2 ring-grape-400' : ''}`}
                >
                  {isFirst && <Crown className="w-8 h-8 text-yellow-400 absolute -top-5" fill="#fcd34d" />}
                  <div
                    className="grid place-items-center rounded-full font-display font-extrabold text-white shadow-clay-sm"
                    style={{
                      width: isFirst ? 64 : 52,
                      height: isFirst ? 64 : 52,
                      background: `linear-gradient(135deg, ${MEDALS[r.rank - 1]}, #ffffff88)`,
                    }}
                  >
                    <span className="text-slate-700">{r.rank}</span>
                  </div>
                  <span className="font-bold text-slate-800 mt-2 text-center text-sm truncate w-full" title={r.studentName}>
                    {r.studentName}
                    {isMe && <span className="text-grape-500"> (you)</span>}
                  </span>
                  <span className={`text-2xl font-extrabold ${tier.text}`}>{r.percentage}%</span>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {fmtDuration(r.timeTakenSeconds)}
                  </span>
                </div>
                {/* Pedestal */}
                <div
                  className={`clay-inset w-full rounded-t-none rounded-b-clay ${
                    isFirst ? 'h-10 sm:h-14' : 'h-6 sm:h-8'
                  }`}
                />
              </div>
            );
          })}
        </section>
      )}

      {/* The rest */}
      {rest.length > 0 && (
        <section className="clay-card-lg p-3 sm:p-4 max-w-2xl mx-auto">
          <ul className="divide-y divide-slate-200/60">
            {rest.map((r, i) => {
              const rank = i + 4;
              const isMe = meId && String(r._id) === meId;
              const tier = tierFor(r.percentage);
              return (
                <li
                  key={r._id}
                  className={`flex items-center gap-3 px-2 sm:px-3 py-3 rounded-clay ${
                    isMe ? 'clay-inset ring-1 ring-grape-300' : ''
                  }`}
                >
                  <span className="font-display font-extrabold text-slate-400 w-8 text-center shrink-0">{rank}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-slate-800 truncate">
                      {r.studentName}
                      {isMe && <span className="text-grape-500"> (you)</span>}
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {r.categoryName} · <Clock className="w-3 h-3 inline -mt-0.5" /> {fmtDuration(r.timeTakenSeconds)}
                    </div>
                  </div>
                  <Medal className={`w-4 h-4 shrink-0 ${tier.text}`} />
                  <span className={`font-display font-extrabold text-lg shrink-0 ${tier.text}`}>{r.percentage}%</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
