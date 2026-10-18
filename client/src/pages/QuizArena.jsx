import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Maximize,
  ChevronLeft,
  ChevronRight,
  Flag,
  Loader2,
  AlertCircle,
  Eye,
  ImageIcon,
  X,
  Send,
  Gauge,
} from 'lucide-react';
import api from '../api/client';
import { DIFFICULTIES, difficultyFor } from '../lib/quiz';
import Logo from '../components/Logo';
import TimerBar from '../components/TimerBar';
import WarningModal from '../components/WarningModal';
import ImageZoomModal from '../components/ImageZoomModal';
import { FullScreenLoader } from '../components/FullScreenLoader';

const MAX_TAB_VIOLATIONS = 3; // auto-submit on the 3rd focus-loss

export default function QuizArena({ mode = 'category' }) {
  const isMixed = mode === 'mixed';
  const { categoryId } = useParams();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('loading'); // loading | difficulty | intro | active | submitting | error
  const [category, setCategory] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');

  // Difficulty picker (shown before the questions load): per-level availability
  // and the level the student ends up choosing.
  const [levelCounts, setLevelCounts] = useState({ low: 0, medium: 0, high: 0 });
  const [pickerMeta, setPickerMeta] = useState({ name: '', description: '' });
  const [difficulty, setDifficulty] = useState(null);

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [overallLeft, setOverallLeft] = useState(0);
  const [qLeft, setQLeft] = useState(0);
  const [tabViolations, setTabViolations] = useState(0);
  const [warning, setWarning] = useState(null);
  const [zoomSrc, setZoomSrc] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Refs mirror the values the interval / event handlers need, to dodge stale
  // closures without re-subscribing every render.
  const overallTotalRef = useRef(0);
  const perQRef = useRef(60);
  const overallLeftRef = useRef(0);
  const qLeftRef = useRef(0);
  const currentRef = useRef(0);
  const answersRef = useRef({});
  const questionsRef = useRef([]);
  const phaseRef = useRef('loading');
  const exitedFullscreenRef = useRef(false);
  const tabViolationsRef = useRef(0);
  const submittingRef = useRef(false);
  const tickRef = useRef(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // ---- Load per-level availability, then show the difficulty picker --------
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await api.get('/categories');
        if (!alive) return;
        const cats = data.categories || [];

        if (isMixed) {
          // The mixed challenge draws from every category, so sum each level.
          const sum = cats.reduce(
            (acc, c) => {
              const dc = c.difficultyCounts || {};
              acc.low += dc.low || 0;
              acc.medium += dc.medium || 0;
              acc.high += dc.high || 0;
              return acc;
            },
            { low: 0, medium: 0, high: 0 }
          );
          setLevelCounts(sum);
          setPickerMeta({
            name: 'All-in-One Challenge',
            description: 'A rapid-fire mix of questions from every category — pick your difficulty.',
          });
        } else {
          const cat = cats.find((c) => String(c._id) === String(categoryId));
          if (!cat) {
            setError('This category could not be found.');
            setPhase('error');
            return;
          }
          const dc = cat.difficultyCounts || { low: 0, medium: 0, high: 0 };
          setLevelCounts({ low: dc.low || 0, medium: dc.medium || 0, high: dc.high || 0 });
          setPickerMeta({ name: cat.name, description: cat.description || '' });
        }
        setPhase('difficulty');
      } catch (e) {
        if (alive) {
          setError(e?.response?.data?.error || 'Could not load this quiz.');
          setPhase('error');
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryId, isMixed]);

  // ---- Fetch the actual questions for the chosen difficulty ----------------
  const loadQuestions = useCallback(
    async (level) => {
      setPhase('loading');
      setError('');
      try {
        let meta; // arena chrome
        let list; // sanitized questions
        let perQ; // seconds per question
        let total; // seconds for the whole attempt

        if (isMixed) {
          const { data } = await api.get('/quiz/mixed/questions', {
            params: { count: 20, difficulty: level },
          });
          list = data.questions;
          perQ = data.challenge.perQuestionSeconds || 60;
          total = list.length * perQ; // one minute each => count minutes overall
          meta = {
            name: data.challenge.name,
            description: data.challenge.description,
            durationMinutes: Math.max(1, Math.round(total / 60)),
            passPercentage: data.challenge.passPercentage,
          };
        } else {
          const { data } = await api.get(`/quiz/${categoryId}/questions`, {
            params: { difficulty: level },
          });
          list = data.questions;
          total = (data.category.durationMinutes || 10) * 60;
          perQ = Math.max(25, Math.min(total, Math.round(total / Math.max(1, list.length))));
          meta = data.category;
        }

        overallTotalRef.current = total;
        perQRef.current = perQ;
        overallLeftRef.current = total;
        qLeftRef.current = perQ;
        questionsRef.current = list;
        setCategory(meta);
        setQuestions(list);
        setOverallLeft(total);
        setQLeft(perQ);
        setDifficulty(level);
        setPhase('intro');
      } catch (e) {
        setError(e?.response?.data?.error || 'Could not load this quiz.');
        setPhase('error');
      }
    },
    [categoryId, isMixed]
  );

  // ---- Submission ----------------------------------------------------------
  const finish = useCallback(
    async ({ autoSubmitted = false } = {}) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      if (tickRef.current) clearInterval(tickRef.current);
      setPhase('submitting');

      // Leave fullscreen if we entered it.
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
      } catch {
        /* ignore */
      }

      const answers = questionsRef.current.map((q) => ({
        questionId: q._id,
        answer: answersRef.current[q._id] ?? '',
      }));
      const common = {
        answers,
        timeTakenSeconds: Math.max(0, overallTotalRef.current - overallLeftRef.current),
        tabViolations: tabViolationsRef.current,
        exitedFullscreen: exitedFullscreenRef.current,
        autoSubmitted,
      };
      // Send the served question ids so the server grades exactly what this
      // student saw — a difficulty-filtered subset, not the whole category.
      const endpoint = isMixed ? '/quiz/mixed/submit' : '/quiz/submit';
      const questionIds = questionsRef.current.map((q) => q._id);
      const payload = isMixed
        ? { ...common, questionIds }
        : { ...common, categoryId, questionIds };

      try {
        const { data } = await api.post(endpoint, payload);
        navigate(`/result/${data.result._id}`, {
          replace: true,
          state: { result: data.result, passPercentage: data.passPercentage },
        });
      } catch (e) {
        submittingRef.current = false;
        setError(e?.response?.data?.error || 'Could not submit your answers. Please try again.');
        setPhase('error');
      }
    },
    [categoryId, isMixed, navigate]
  );

  // ---- Navigation between questions ---------------------------------------
  const goTo = useCallback((idx) => {
    const n = questionsRef.current.length;
    const clamped = Math.max(0, Math.min(n - 1, idx));
    currentRef.current = clamped;
    setCurrent(clamped);
    qLeftRef.current = perQRef.current;
    setQLeft(perQRef.current);
  }, []);

  const setAnswer = useCallback((qid, value) => {
    answersRef.current = { ...answersRef.current, [qid]: value };
    setAnswers(answersRef.current);
  }, []);

  // ---- The one ticking clock ----------------------------------------------
  const startTicking = useCallback(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    tickRef.current = setInterval(() => {
      overallLeftRef.current -= 1;
      qLeftRef.current -= 1;
      setOverallLeft(overallLeftRef.current);
      setQLeft(Math.max(0, qLeftRef.current));

      if (overallLeftRef.current <= 0) {
        finish({ autoSubmitted: true });
        return;
      }
      if (qLeftRef.current <= 0) {
        const isLast = currentRef.current >= questionsRef.current.length - 1;
        if (!isLast) {
          goTo(currentRef.current + 1); // gentle auto-advance
        } else {
          qLeftRef.current = 0; // park at 0 on the final question
          setQLeft(0);
        }
      }
    }, 1000);
  }, [finish, goTo]);

  // ---- Anti-cheat: focus loss + leaving fullscreen -------------------------
  useEffect(() => {
    function registerViolation(reason) {
      if (phaseRef.current !== 'active' || submittingRef.current) return;
      tabViolationsRef.current += 1;
      setTabViolations(tabViolationsRef.current);
      if (tabViolationsRef.current >= MAX_TAB_VIOLATIONS) {
        setWarning(null);
        finish({ autoSubmitted: true });
      } else {
        setWarning({
          title: 'Stay on this tab',
          message: `Leaving the quiz counts as a warning (${tabViolationsRef.current}/${MAX_TAB_VIOLATIONS}). After ${MAX_TAB_VIOLATIONS} the quiz submits automatically.`,
        });
      }
    }

    function onVisibility() {
      if (document.hidden) registerViolation('hidden');
    }
    function onFullscreenChange() {
      if (phaseRef.current !== 'active') return;
      if (!document.fullscreenElement) {
        exitedFullscreenRef.current = true;
        setWarning({
          title: 'You left fullscreen',
          message: 'For a fair attempt, please continue in fullscreen. This has been noted on your result.',
        });
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onVisibility);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onVisibility);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [finish]);

  // Clear the interval if the component unmounts mid-quiz.
  useEffect(() => () => tickRef.current && clearInterval(tickRef.current), []);

  const start = useCallback(async () => {
    // Fullscreen is a nice-to-have; if the browser blocks it we still start.
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* not fatal */
    }
    setPhase('active');
    phaseRef.current = 'active';
    startTicking();
  }, [startTicking]);

  const reenterFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* ignore */
    }
    setWarning(null);
  }, []);

  const answeredCount = useMemo(
    () => questions.filter((q) => String(answers[q._id] ?? '').trim() !== '').length,
    [questions, answers]
  );

  // ---- Render states -------------------------------------------------------
  if (phase === 'loading') return <FullScreenLoader label="Setting up the arena…" />;

  if (phase === 'error') {
    const canRepick = levelCounts.low + levelCounts.medium + levelCounts.high > 0;
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="clay-card-lg p-8 max-w-md text-center">
          <AlertCircle className="w-12 h-12 text-peach-500 mx-auto" />
          <h1 className="text-2xl font-extrabold text-slate-900 mt-3">Something went wrong</h1>
          <p className="text-slate-600 mt-2">{error}</p>
          <div className="flex flex-col sm:flex-row gap-2 mt-6">
            {canRepick && (
              <button
                onClick={() => {
                  setError('');
                  setPhase('difficulty');
                }}
                className="clay-btn clay-btn-ghost flex-1 justify-center"
              >
                Choose another level
              </button>
            )}
            <button onClick={() => navigate('/dashboard')} className="clay-btn clay-btn-primary flex-1 justify-center">
              Back to dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'submitting') return <FullScreenLoader label="Grading your answers…" />;

  // ---- Difficulty picker (shown first) -------------------------------------
  if (phase === 'difficulty') {
    const cap = isMixed ? 20 : 10;
    const totalAvail = levelCounts.low + levelCounts.medium + levelCounts.high;
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="clay-card-lg p-8 max-w-2xl w-full text-center animate-pop-in">
          <Logo size={56} className="justify-center" />
          <h1 className="text-3xl font-extrabold text-slate-900 mt-4">{pickerMeta.name}</h1>
          {pickerMeta.description && <p className="text-slate-600 mt-2">{pickerMeta.description}</p>}

          <div className="flex items-center justify-center gap-2 mt-8 text-slate-700">
            <Gauge className="w-5 h-5 text-grape-500" />
            <h2 className="font-display font-extrabold text-lg">Choose your difficulty</h2>
          </div>

          {totalAvail === 0 ? (
            <div className="clay-inset rounded-clay p-6 mt-6 text-slate-500">
              No questions are available here yet. Please check back later.
            </div>
          ) : (
            <div className="grid sm:grid-cols-3 gap-4 mt-6">
              {DIFFICULTIES.map((d) => {
                const served = Math.min(cap, levelCounts[d.key]);
                const disabled = served === 0;
                return (
                  <button
                    key={d.key}
                    onClick={() => loadQuestions(d.key)}
                    disabled={disabled}
                    className={`clay-card !rounded-clay p-5 text-center transition ${
                      disabled ? 'opacity-40 cursor-not-allowed' : 'hover:-translate-y-1'
                    }`}
                  >
                    <span
                      className={`grid place-items-center w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${d.chip} text-white font-display font-extrabold text-2xl shadow-clay-sm`}
                    >
                      {d.label[0]}
                    </span>
                    <div className={`mt-3 font-display font-extrabold text-lg ${d.text}`}>{d.label}</div>
                    <div className="text-xs text-slate-500 mt-1">{d.blurb}</div>
                    <div className="mt-3">
                      <span className={`clay-chip !py-1 text-xs font-bold ${d.badge}`}>
                        {disabled ? 'None yet' : `${served} question${served === 1 ? '' : 's'}`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <button onClick={() => navigate('/dashboard')} className="clay-btn clay-btn-ghost mx-auto mt-8">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'intro') {
    const dMeta = difficultyFor(difficulty);
    return (
      <div className="min-h-screen grid place-items-center p-4">
        <div className="clay-card-lg p-8 max-w-lg w-full text-center animate-pop-in">
          <Logo size={56} className="justify-center" />
          <h1 className="text-3xl font-extrabold text-slate-900 mt-4">{category.name}</h1>
          <p className="text-slate-600 mt-2">{category.description}</p>

          <div className="mt-3">
            <span className={`clay-chip !py-1 text-xs font-bold ${dMeta.badge}`}>
              <Gauge className="w-3.5 h-3.5" /> {dMeta.label} difficulty
            </span>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6 text-center">
            <MiniStat value={questions.length} label="Questions" />
            <MiniStat value={`${category.durationMinutes}m`} label="Total time" />
            <MiniStat value={`${category.passPercentage}%`} label="To pass" />
          </div>

          <ul className="text-left text-sm text-slate-600 mt-6 space-y-2 clay-inset rounded-clay p-4">
            <li className="flex gap-2"><Eye className="w-4 h-4 text-grape-500 shrink-0 mt-0.5" /> The quiz runs in fullscreen. Leaving fullscreen or switching tabs is recorded.</li>
            <li className="flex gap-2"><Flag className="w-4 h-4 text-peach-500 shrink-0 mt-0.5" /> After {MAX_TAB_VIOLATIONS} focus-loss warnings the quiz auto-submits.</li>
            <li className="flex gap-2"><ChevronRight className="w-4 h-4 text-mint-500 shrink-0 mt-0.5" /> Each question has its own timer; you can move back and forth freely.</li>
          </ul>

          <button onClick={start} className="clay-btn clay-btn-primary w-full justify-center mt-6 text-lg">
            <Maximize className="w-5 h-5" /> Start quiz
          </button>
          <div className="flex flex-col sm:flex-row gap-2 mt-2">
            <button
              onClick={() => setPhase('difficulty')}
              className="clay-btn clay-btn-ghost flex-1 justify-center"
            >
              <Gauge className="w-4 h-4" /> Change difficulty
            </button>
            <button onClick={() => navigate('/dashboard')} className="clay-btn clay-btn-ghost flex-1 justify-center">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- Active quiz ---------------------------------------------------------
  const q = questions[current];
  const isLast = current === questions.length - 1;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sticky quiz header */}
      <header className="sticky top-0 z-30 bg-slate-100/80 backdrop-blur-md border-b border-slate-200/70">
        <div className="mx-auto max-w-4xl px-4 py-3 space-y-3">
          <div className="flex items-center gap-3">
            <Logo size={30} />
            <span className="font-display font-extrabold text-slate-800 truncate">{category.name}</span>
            <span className="flex-1" />
            {tabViolations > 0 && (
              <span className="clay-chip !py-1 text-xs font-bold text-peach-700 flex items-center gap-1">
                <Flag className="w-3.5 h-3.5" /> {tabViolations}/{MAX_TAB_VIOLATIONS}
              </span>
            )}
            <span className="clay-chip !py-1 text-xs font-bold text-slate-600">
              {answeredCount}/{questions.length} answered
            </span>
          </div>
          <TimerBar
            overallRemaining={overallLeft}
            overallTotal={overallTotalRef.current}
            questionRemaining={qLeft}
            questionTotal={perQRef.current}
          />
        </div>
      </header>

      <main className="flex-1 mx-auto max-w-4xl w-full px-4 py-6">
        {/* Question dots */}
        <div className="flex flex-wrap gap-2 mb-5">
          {questions.map((qq, i) => {
            const answered = String(answers[qq._id] ?? '').trim() !== '';
            const isCur = i === current;
            return (
              <button
                key={qq._id}
                onClick={() => goTo(i)}
                aria-label={`Go to question ${i + 1}`}
                className={`w-9 h-9 rounded-clay-sm font-display font-bold text-sm transition ${
                  isCur
                    ? 'bg-grape-500 text-white shadow-clay-sm scale-110'
                    : answered
                    ? 'bg-mint-300 text-mint-700 shadow-clay-sm'
                    : 'clay-inset text-slate-400'
                }`}
              >
                {i + 1}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <div key={q._id} className="clay-card-lg p-6 sm:p-8 animate-pop-in">
          <div className="flex items-center justify-between">
            <span className="clay-chip !py-1 text-xs font-bold text-grape-600 uppercase tracking-wide">
              {q.type === 'mcq' ? 'Multiple choice' : 'Type your answer'}
            </span>
            <span className="text-sm font-semibold text-slate-400">
              Question {current + 1} of {questions.length}
            </span>
          </div>

          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 mt-4 leading-snug">{q.text}</h2>

          {q.imageUrl && (
            <button
              onClick={() => setZoomSrc(q.imageUrl)}
              className="mt-4 clay-inset rounded-clay p-3 inline-flex items-start gap-2 group"
            >
              <img src={q.imageUrl} alt="Question illustration" className="max-h-48 rounded-clay-sm" />
              <span className="text-xs text-slate-400 flex items-center gap-1 group-hover:text-grape-500">
                <ImageIcon className="w-3.5 h-3.5" /> zoom
              </span>
            </button>
          )}

          {/* Answer input */}
          {q.type === 'mcq' ? (
            <div className="mt-6 grid gap-3">
              {q.options.map((opt, i) => {
                const selected = answers[q._id] === opt;
                return (
                  <button
                    key={i}
                    onClick={() => setAnswer(q._id, opt)}
                    className={`text-left clay-card !rounded-clay px-4 py-3.5 flex items-center gap-3 transition ${
                      selected ? 'ring-2 ring-grape-400 shadow-clay-press' : 'hover:-translate-y-0.5'
                    }`}
                  >
                    <span
                      className={`grid place-items-center w-8 h-8 rounded-full font-display font-bold shrink-0 ${
                        selected ? 'bg-grape-500 text-white' : 'clay-inset text-slate-500'
                      }`}
                    >
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span className="font-semibold text-slate-700">{opt}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <textarea
              value={answers[q._id] ?? ''}
              onChange={(e) => setAnswer(q._id, e.target.value)}
              placeholder="Type your answer here…"
              rows={3}
              className="clay-input mt-6 resize-none"
            />
          )}

          {/* Nav */}
          <div className="flex items-center gap-3 mt-8">
            <button
              onClick={() => goTo(current - 1)}
              disabled={current === 0}
              className="clay-btn clay-btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-5 h-5" /> Previous
            </button>
            <span className="flex-1" />
            {isLast ? (
              <button onClick={() => setConfirmOpen(true)} className="clay-btn clay-btn-primary">
                <Send className="w-5 h-5" /> Submit quiz
              </button>
            ) : (
              <button onClick={() => goTo(current + 1)} className="clay-btn clay-btn-primary">
                Next <ChevronRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        <button onClick={() => setConfirmOpen(true)} className="clay-btn clay-btn-ghost mx-auto mt-6 text-slate-500">
          <Flag className="w-4 h-4" /> Finish &amp; submit early
        </button>
      </main>

      {/* Warnings */}
      <WarningModal
        open={Boolean(warning)}
        title={warning?.title}
        message={warning?.message}
        onClose={() => (warning?.title === 'You left fullscreen' ? reenterFullscreen() : setWarning(null))}
        actionLabel={warning?.title === 'You left fullscreen' ? 'Re-enter fullscreen' : 'Got it'}
      />

      <ImageZoomModal open={Boolean(zoomSrc)} src={zoomSrc} onClose={() => setZoomSrc('')} />

      {/* Submit confirmation */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-pop-in">
          <div className="clay-card-lg w-full max-w-md p-6 relative text-center">
            <button onClick={() => setConfirmOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700">
              <X className="w-5 h-5" />
            </button>
            <Send className="w-10 h-10 text-grape-500 mx-auto" />
            <h3 className="text-xl font-extrabold text-slate-900 mt-3">Submit your quiz?</h3>
            <p className="text-slate-600 mt-1">
              You've answered <strong>{answeredCount}</strong> of <strong>{questions.length}</strong> questions.
              {answeredCount < questions.length && ' Unanswered questions are marked incorrect.'}
            </p>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setConfirmOpen(false)} className="clay-btn clay-btn-ghost flex-1 justify-center">
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirmOpen(false);
                  finish({ autoSubmitted: false });
                }}
                className="clay-btn clay-btn-primary flex-1 justify-center"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="clay-inset rounded-clay p-3">
      <div className="text-2xl font-extrabold text-slate-900">{value}</div>
      <div className="text-xs font-semibold text-slate-400">{label}</div>
    </div>
  );
}
