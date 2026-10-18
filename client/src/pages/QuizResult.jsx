import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Award,
  CheckCircle2,
  XCircle,
  Clock,
  Flag,
  Eye,
  Bot,
  RotateCcw,
  Trophy,
  LayoutDashboard,
  ChevronDown,
  Sparkles,
  Zap,
  Lock,
} from 'lucide-react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import { tierFor, fmtDuration, didPass } from '../lib/quiz';
import { FullScreenLoader } from '../components/FullScreenLoader';
import CertificateModal from '../components/CertificateModal';

export default function QuizResult() {
  const { resultId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const seeded = location.state?.result;
  const [result, setResult] = useState(seeded || null);
  const [passPercentage, setPassPercentage] = useState(location.state?.passPercentage ?? null);
  const [loading, setLoading] = useState(!seeded);
  const [error, setError] = useState('');
  const [showCert, setShowCert] = useState(false);
  const [openLog, setOpenLog] = useState(null);
  const firedRef = useRef(false);

  // Fetch if we arrived without router state (refresh / shared link).
  useEffect(() => {
    if (seeded) return;
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get(`/results/${resultId}`);
        if (!alive) return;
        setResult(data.result);
        // The single-result endpoint doesn't carry the pass mark; look it up.
        try {
          const cats = await api.get('/categories');
          const cat = (cats.data.categories || []).find((c) => String(c._id) === String(data.result.categoryId));
          if (alive) setPassPercentage(cat?.passPercentage ?? 60);
        } catch {
          if (alive) setPassPercentage(60);
        }
      } catch (e) {
        if (alive) setError(e?.response?.data?.error || 'Could not load this result.');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [resultId, seeded]);

  const tier = useMemo(() => (result ? tierFor(result.percentage) : null), [result]);
  const passed = result ? didPass(result.percentage, passPercentage ?? 60) : false;

  // Celebrate a pass — once.
  useEffect(() => {
    if (!result || firedRef.current) return;
    firedRef.current = true;
    if (didPass(result.percentage, passPercentage ?? 60)) {
      const burst = (x) => confetti({ particleCount: 70, spread: 70, origin: { x, y: 0.3 }, colors: ['#8B5CF6', '#F79E93', '#6EE7B7', '#7dd3fc', '#FDE68A'] });
      burst(0.25);
      setTimeout(() => burst(0.75), 200);
    }
  }, [result, passPercentage]);

  if (loading) return <FullScreenLoader label="Loading your result…" />;
  if (error || !result) {
    return (
      <div className="clay-card-lg p-8 max-w-md mx-auto text-center mt-10">
        <XCircle className="w-12 h-12 text-peach-500 mx-auto" />
        <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Result unavailable</h1>
        <p className="text-slate-600 mt-2">{error || 'This result could not be found.'}</p>
        <Link to="/dashboard" className="clay-btn clay-btn-primary mt-6 mx-auto w-max">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const studentName = result.studentName || user?.name || 'Student';
  // Category-less results are the All-in-One challenge; retake sends you there.
  const retakeTo = result.categoryId ? `/quiz/${result.categoryId}` : '/challenge/all-in-one';

  return (
    <div className="space-y-6 animate-pop-in">
      {/* Score hero */}
      <section className="clay-card-lg p-6 sm:p-8">
        <div className="flex flex-col md:flex-row items-center gap-8">
          <ScoreRing percentage={result.percentage} color={tier.ring} />

          <div className="flex-1 text-center md:text-left">
            <div className={`inline-flex items-center gap-2 clay-chip font-extrabold ${tier.text}`}>
              <Award className="w-4 h-4" /> {tier.name} tier
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 mt-3">
              {passed ? 'Nicely done! 🎉' : 'Good effort!'}
            </h1>
            <p className="text-slate-600 mt-1">
              You scored <strong>{result.score}</strong> of <strong>{result.totalQuestions}</strong> on{' '}
              <strong>{result.categoryName}</strong>.
            </p>

            <div
              className={`inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-clay font-bold ${
                passed ? 'bg-mint-100 text-mint-700' : 'bg-peach-100 text-peach-700'
              }`}
            >
              {passed ? <Sparkles className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
              {passed ? `Passed — the mark was ${passPercentage ?? 60}%` : `Pass mark is ${passPercentage ?? 60}% — try again!`}
            </div>

            {!passed && (
              <div className="flex w-max mx-auto md:mx-0 items-center gap-2 mt-3 px-4 py-2 rounded-clay clay-inset text-slate-500 font-semibold text-sm">
                <Lock className="w-4 h-4 shrink-0" /> Reach {passPercentage ?? 60}% to unlock your certificate
              </div>
            )}

            <div className="flex flex-wrap gap-2 mt-5 justify-center md:justify-start">
              {passed && (
                <button onClick={() => setShowCert(true)} className="clay-btn clay-btn-primary">
                  <Award className="w-5 h-5" /> Get certificate
                </button>
              )}
              <Link to={retakeTo} className="clay-btn clay-btn-peach">
                <RotateCcw className="w-5 h-5" /> Retake
              </Link>
              <Link to="/leaderboard" className="clay-btn clay-btn-sky">
                <Trophy className="w-5 h-5" /> Leaderboard
              </Link>
              <Link to="/dashboard" className="clay-btn clay-btn-ghost">
                <LayoutDashboard className="w-5 h-5" /> Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Integrity + timing chips */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <MetaChip icon={Clock} label="Time taken" value={fmtDuration(result.timeTakenSeconds)} />
          <MetaChip icon={CheckCircle2} label="Correct" value={`${result.score}/${result.totalQuestions}`} />
          <MetaChip
            icon={Flag}
            label="Focus warnings"
            value={result.tabViolations}
            tone={result.tabViolations > 0 ? 'warn' : undefined}
          />
          <MetaChip
            icon={Eye}
            label="Fullscreen"
            value={result.exitedFullscreen ? 'Left' : 'Kept'}
            tone={result.exitedFullscreen ? 'warn' : undefined}
          />
        </div>
        {result.autoSubmitted && (
          <p className="text-xs text-peach-600 font-semibold mt-3 flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" /> This attempt was auto-submitted (time ran out or too many focus warnings).
          </p>
        )}
      </section>

      {/* Answer review */}
      <section className="space-y-3">
        <h2 className="text-xl font-extrabold text-slate-900">Review your answers</h2>
        {result.answersLog.map((a, i) => {
          const open = openLog === i;
          return (
            <div key={a.questionId || i} className="clay-card overflow-hidden">
              <button
                onClick={() => setOpenLog(open ? null : i)}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
              >
                {a.isCorrect ? (
                  <CheckCircle2 className="w-6 h-6 text-mint-500 shrink-0" />
                ) : (
                  <XCircle className="w-6 h-6 text-peach-500 shrink-0" />
                )}
                <span className="flex-1 min-w-0">
                  <span className="block font-bold text-slate-800 truncate">
                    {i + 1}. {a.questionText}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {a.gradedBy === 'ai' ? 'AI-assisted grading' : a.questionType === 'mcq' ? 'Multiple choice' : 'Free text'}
                  </span>
                </span>
                {a.gradedBy === 'ai' && <Bot className="w-4 h-4 text-sky-500 shrink-0" title="Graded with AI assistance" />}
                <ChevronDown className={`w-5 h-5 text-slate-300 shrink-0 transition ${open ? 'rotate-180' : ''}`} />
              </button>

              {open && (
                <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-200/60">
                  {a.imageUrl && <img src={a.imageUrl} alt="" className="max-h-40 rounded-clay-sm clay-inset p-2" />}
                  <AnswerRow
                    label="Your answer"
                    value={a.userAnswer || '— (blank)'}
                    tone={a.isCorrect ? 'good' : 'bad'}
                  />
                  {!a.isCorrect && <AnswerRow label="Correct answer" value={a.correctAnswer} tone="good" />}
                  {a.aiReason && (
                    <p className="text-sm text-sky-700 bg-sky-100 rounded-clay-sm px-3 py-2 flex gap-2">
                      <Bot className="w-4 h-4 shrink-0 mt-0.5" /> {a.aiReason}
                    </p>
                  )}
                  {a.explanation && (
                    <p className="text-sm text-slate-600 clay-inset rounded-clay-sm px-3 py-2">
                      <strong className="text-slate-700">Why: </strong>
                      {a.explanation}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>

      <CertificateModal
        open={showCert}
        onClose={() => setShowCert(false)}
        result={{ ...result, tier: tier.name }}
        userName={studentName}
      />
    </div>
  );
}

function ScoreRing({ percentage, color }) {
  const r = 54;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, percentage)) / 100) * c;
  return (
    <div className="relative w-40 h-40 shrink-0">
      <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
        <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(148,163,184,0.25)" strokeWidth="12" />
        <circle
          cx="64"
          cy="64"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-4xl font-extrabold text-slate-900 leading-none">{percentage}%</div>
          <div className="text-xs font-semibold text-slate-400 mt-1">score</div>
        </div>
      </div>
    </div>
  );
}

function MetaChip({ icon: Icon, label, value, tone }) {
  return (
    <div className="clay-inset rounded-clay p-3 flex items-center gap-2.5">
      <Icon className={`w-5 h-5 shrink-0 ${tone === 'warn' ? 'text-peach-500' : 'text-grape-500'}`} />
      <div className="min-w-0">
        <div className={`font-extrabold leading-none ${tone === 'warn' ? 'text-peach-600' : 'text-slate-800'}`}>
          {value}
        </div>
        <div className="text-[11px] font-semibold text-slate-400 mt-0.5 truncate">{label}</div>
      </div>
    </div>
  );
}

function AnswerRow({ label, value, tone }) {
  return (
    <div>
      <span className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <p
        className={`font-semibold mt-0.5 ${
          tone === 'good' ? 'text-mint-700' : tone === 'bad' ? 'text-peach-700' : 'text-slate-700'
        }`}
      >
        {value}
      </p>
    </div>
  );
}
