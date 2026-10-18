import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import {
  Play,
  Clock,
  ListChecks,
  Target,
  Trophy,
  Sparkles,
  TrendingUp,
  Award,
  ChevronRight,
  AlertCircle,
  Shuffle,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { tierFor, fmtDuration, shortLabel } from '../lib/quiz';
import { FullScreenLoader } from '../components/FullScreenLoader';

export default function StudentDashboard() {
  const { user, isTrial } = useAuth();
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [cats, res] = await Promise.all([api.get('/categories'), api.get('/results/me')]);
        if (!alive) return;
        setCategories(cats.data.categories || []);
        setResults(res.data.results || []);
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || 'Could not load your dashboard.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // Best percentage achieved per category (by id).
  const bestByCategory = useMemo(() => {
    const map = new Map();
    for (const r of results) {
      const key = String(r.categoryId);
      map.set(key, Math.max(map.get(key) ?? 0, r.percentage));
    }
    return map;
  }, [results]);

  const stats = useMemo(() => {
    if (results.length === 0) return { attempts: 0, avg: 0, best: 0, passed: 0 };
    const best = Math.max(...results.map((r) => r.percentage));
    const avg = Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length);
    const passed = results.filter((r) => r.percentage >= 60).length;
    return { attempts: results.length, avg, best, passed };
  }, [results]);

  const radarData = useMemo(
    () =>
      categories.map((c) => ({
        subject: shortLabel(c.name, 14),
        score: bestByCategory.get(String(c._id)) ?? 0,
      })),
    [categories, bestByCategory]
  );

  // The mixed challenge needs at least one question somewhere to be playable.
  const hasQuestions = useMemo(() => categories.some((c) => c.questionCount > 0), [categories]);

  if (loading) return <FullScreenLoader label="Loading your arena…" />;

  return (
    <div className="space-y-8 animate-pop-in">
      {/* Hero */}
      <section className="clay-card-lg p-6 sm:p-8 relative overflow-hidden">
        <div className="relative z-10">
          <p className="text-grape-500 font-bold flex items-center gap-2">
            <Sparkles className="w-4 h-4" /> {isTrial ? 'Trial session' : 'Welcome back'}
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-1">
            Hi {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-slate-600 mt-2 max-w-lg">
            Pick a challenge below to test your networking chops. Beat your best score and climb the leaderboard.
          </p>
          {isTrial && (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-peach-700 clay-inset px-3 py-1.5 rounded-clay-sm">
              <AlertCircle className="w-4 h-4" /> Trial progress isn't saved after you leave.
            </p>
          )}
        </div>
      </section>

      {error && (
        <div className="clay-card p-4 text-peach-700 font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Stats */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ListChecks} tone="from-grape-200 to-grape-400" label="Quizzes taken" value={stats.attempts} />
        <StatCard icon={TrendingUp} tone="from-sky-200 to-sky-400" label="Average score" value={`${stats.avg}%`} />
        <StatCard icon={Target} tone="from-mint-200 to-mint-400" label="Best score" value={`${stats.best}%`} />
        <StatCard icon={Award} tone="from-peach-200 to-peach-400" label="Passed" value={stats.passed} />
      </section>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Categories */}
        <section className="lg:col-span-2 space-y-4">
          <h2 className="text-xl font-extrabold text-slate-900">Challenges</h2>

          {/* Featured: the All-in-One mixed challenge */}
          {hasQuestions && (
            <Link
              to="/challenge/all-in-one"
              className="clay-card relative overflow-hidden p-5 sm:p-6 flex items-center gap-4 bg-gradient-to-br from-grape-100 to-sky-100 hover:-translate-y-0.5 transition"
            >
              <span className="grid place-items-center w-14 h-14 rounded-clay bg-gradient-to-br from-grape-400 to-sky-400 shadow-clay-sm shrink-0">
                <Shuffle className="w-7 h-7 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-slate-900 text-lg leading-tight">All-in-One Challenge</h3>
                  <span className="clay-chip !py-0.5 !px-2 text-[11px] font-extrabold text-grape-600">NEW</span>
                </div>
                <p className="text-sm text-slate-600 mt-0.5">20 random questions from every category — one minute each.</p>
                <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500 mt-2">
                  <span className="flex items-center gap-1">
                    <ListChecks className="w-4 h-4" /> 20 Qs
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" /> 1 min each
                  </span>
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" /> pass 60%
                  </span>
                </div>
              </div>
              <span className="clay-btn clay-btn-primary shrink-0 hidden sm:inline-flex">
                <Play className="w-4 h-4" /> Start
              </span>
              <ChevronRight className="w-6 h-6 text-grape-400 shrink-0 sm:hidden" />
            </Link>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            {categories.map((c) => (
              <CategoryCard key={c._id} category={c} best={bestByCategory.get(String(c._id))} />
            ))}
            {categories.length === 0 && (
              <p className="text-slate-500 col-span-full">No challenges available yet. Check back soon!</p>
            )}
          </div>
        </section>

        {/* Skill radar + recent */}
        <section className="space-y-6">
          <div className="clay-card p-5">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-grape-500" /> Skill map
            </h3>
            {radarData.length >= 3 ? (
              <div className="h-60 mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="72%">
                    <PolarGrid stroke="rgba(148,163,184,0.35)" />
                    <PolarAngleAxis
                      dataKey="subject"
                      tick={{ fill: 'rgb(var(--c-slate-500))', fontSize: 11, fontWeight: 700 }}
                    />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar dataKey="score" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.45} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="text-sm text-slate-500 mt-3">Take a few quizzes to reveal your skill map.</p>
            )}
          </div>

          <div className="clay-card p-5">
            <h3 className="font-extrabold text-slate-900 flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-peach-500" /> Recent attempts
            </h3>
            {results.length === 0 ? (
              <p className="text-sm text-slate-500">No attempts yet — your history will show up here.</p>
            ) : (
              <ul className="space-y-2">
                {results.slice(0, 5).map((r) => {
                  const tier = tierFor(r.percentage);
                  return (
                    <li key={r._id}>
                      <Link
                        to={`/result/${r._id}`}
                        className="clay-inset rounded-clay-sm px-3 py-2.5 flex items-center gap-3 hover:shadow-clay-sm transition group"
                      >
                        <span className={`font-display font-extrabold text-lg w-12 shrink-0 ${tier.text}`}>
                          {r.percentage}%
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-bold text-slate-800 truncate">{r.categoryName}</span>
                          <span className="block text-xs text-slate-400">
                            {r.score}/{r.totalQuestions} · {fmtDuration(r.timeTakenSeconds)}
                          </span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-grape-500 shrink-0" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, tone, label, value }) {
  return (
    <div className="clay-card p-4 flex items-center gap-3">
      <span className={`grid place-items-center w-12 h-12 rounded-clay-sm bg-gradient-to-br ${tone} shadow-clay-sm shrink-0`}>
        <Icon className="w-6 h-6 text-white" />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-extrabold text-slate-900 leading-none">{value}</div>
        <div className="text-xs font-semibold text-slate-400 mt-1 truncate">{label}</div>
      </div>
    </div>
  );
}

function CategoryCard({ category, best }) {
  const empty = !category.questionCount;
  return (
    <div className="clay-card p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-extrabold text-slate-900 text-lg leading-tight">{category.name}</h3>
        {best != null && (
          <span className={`clay-chip !py-1 text-xs font-extrabold ${tierFor(best).text}`}>Best {best}%</span>
        )}
      </div>
      <p className="text-sm text-slate-500 mt-1 flex-1">{category.description || 'Test your knowledge.'}</p>
      <div className="flex items-center gap-3 text-xs font-semibold text-slate-400 mt-3">
        <span className="flex items-center gap-1">
          <ListChecks className="w-4 h-4" /> {category.questionCount} Qs
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-4 h-4" /> {category.durationMinutes} min
        </span>
        <span className="flex items-center gap-1">
          <Target className="w-4 h-4" /> pass {category.passPercentage}%
        </span>
      </div>
      {empty ? (
        <button disabled className="clay-btn clay-btn-ghost w-full justify-center mt-4 opacity-60 cursor-not-allowed">
          Coming soon
        </button>
      ) : (
        <Link to={`/quiz/${category._id}`} className="clay-btn clay-btn-primary w-full justify-center mt-4">
          <Play className="w-4 h-4" /> Start challenge
        </Link>
      )}
    </div>
  );
}
