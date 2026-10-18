import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import {
  Mail,
  Lock,
  User as UserIcon,
  Sparkles,
  GraduationCap,
  BookOpen,
  ArrowRight,
  Loader2,
  Zap,
  ShieldCheck,
  Trophy,
  Moon,
  Sun,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const DEMOS = {
  teacher: { email: 'teacher@speednet.dev', password: 'teach1234', label: 'Teacher demo' },
  student: { email: 'student@speednet.dev', password: 'learn1234', label: 'Student demo' },
};

const TABS = [
  { key: 'signin', label: 'Sign in' },
  { key: 'register', label: 'Register' },
  { key: 'trial', label: 'Free trial' },
];

function errMessage(e) {
  return e?.response?.data?.error || 'Something went wrong. Please try again.';
}

export default function Login() {
  const { user, loading, login, register, loginTrial } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [tab, setTab] = useState('signin');
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) {
    return <Navigate to={user.role === 'teacher' ? '/teacher' : '/dashboard'} replace />;
  }

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  function goHome(u) {
    navigate(u.role === 'teacher' ? '/teacher' : '/dashboard', { replace: true });
  }

  async function submit(e) {
    e?.preventDefault();
    setError('');
    setBusy(true);
    try {
      let u;
      if (tab === 'signin') u = await login(form.email.trim(), form.password);
      else if (tab === 'register')
        u = await register({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          role: form.role,
        });
      else u = await loginTrial(form.name.trim());
      goHome(u);
    } catch (e2) {
      setError(errMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  async function quickDemo(kind) {
    setError('');
    setBusy(true);
    try {
      const u = await login(DEMOS[kind].email, DEMOS[kind].password);
      goHome(u);
    } catch (e2) {
      setError(errMessage(e2));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Brand / marketing panel */}
      <aside className="relative lg:w-1/2 px-6 sm:px-10 pt-10 lg:pt-0 lg:flex lg:flex-col lg:justify-center overflow-hidden">
        <div className="mx-auto max-w-md w-full">
          <div className="flex items-center justify-between">
            <Logo size={48} withText />
            <button
              onClick={toggleTheme}
              className="clay-chip grid place-items-center w-10 h-10 !px-0 text-slate-600 lg:hidden"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <h1 className="mt-10 text-4xl sm:text-5xl font-extrabold text-slate-900 leading-tight">
            Master networking,
            <br />
            <span className="text-grape-500">one quiz at a time.</span>
          </h1>
          <p className="mt-4 text-lg text-slate-600">
            Devices, the OSI model, protocols &amp; ports, IP addressing and security — timed challenges with instant
            feedback, certificates and a class leaderboard.
          </p>

          <ul className="mt-8 space-y-3">
            <Feature icon={Zap} tone="from-grape-200 to-grape-400" text="Timed arena with per-question pacing" />
            <Feature icon={Trophy} tone="from-peach-200 to-peach-400" text="Earn tiered certificates & climb the leaderboard" />
            <Feature icon={ShieldCheck} tone="from-mint-200 to-mint-400" text="Fair play: focus tracking keeps scores honest" />
          </ul>
        </div>
      </aside>

      {/* Auth card */}
      <main className="lg:w-1/2 flex items-center justify-center px-4 sm:px-6 py-10">
        <div className="clay-card-lg w-full max-w-md p-6 sm:p-8">
          <div className="hidden lg:flex justify-end -mt-2 -mr-2 mb-2">
            <button
              onClick={toggleTheme}
              className="clay-chip grid place-items-center w-10 h-10 !px-0 text-slate-600"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
          </div>

          <h2 className="text-2xl font-extrabold text-slate-900">
            {tab === 'signin' && 'Welcome back 👋'}
            {tab === 'register' && 'Create your account'}
            {tab === 'trial' && 'Try it, no signup'}
          </h2>
          <p className="text-slate-500 mt-1">
            {tab === 'signin' && 'Sign in to jump back into the arena.'}
            {tab === 'register' && 'Join as a student or a teacher.'}
            {tab === 'trial' && 'A temporary session — nothing is saved after you leave.'}
          </p>

          {/* Tabs */}
          <div className="clay-inset mt-5 p-1 rounded-clay grid grid-cols-3 gap-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setTab(t.key);
                  setError('');
                }}
                className={`py-2 rounded-clay-sm text-sm font-bold transition ${
                  tab === t.key ? 'bg-white text-grape-600 shadow-clay-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-5 space-y-4">
            {(tab === 'register' || tab === 'trial') && (
              <Field
                icon={UserIcon}
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={set('name')}
                autoComplete="name"
                required
              />
            )}

            {tab !== 'trial' && (
              <>
                <Field
                  icon={Mail}
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={set('email')}
                  autoComplete="email"
                  required
                />
                <Field
                  icon={Lock}
                  type="password"
                  placeholder={tab === 'register' ? 'Password (min 6 characters)' : 'Password'}
                  value={form.password}
                  onChange={set('password')}
                  autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
                  minLength={tab === 'register' ? 6 : undefined}
                  required
                />
              </>
            )}

            {tab === 'register' && (
              <div>
                <p className="text-sm font-semibold text-slate-500 mb-2">I am a…</p>
                <div className="grid grid-cols-2 gap-3">
                  <RolePick
                    active={form.role === 'student'}
                    onClick={() => setForm((f) => ({ ...f, role: 'student' }))}
                    icon={BookOpen}
                    label="Student"
                    hint="Take quizzes"
                  />
                  <RolePick
                    active={form.role === 'teacher'}
                    onClick={() => setForm((f) => ({ ...f, role: 'teacher' }))}
                    icon={GraduationCap}
                    label="Teacher"
                    hint="Manage content"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="clay-inset rounded-clay-sm px-4 py-3 text-sm font-semibold text-peach-700 bg-peach-100">
                {error}
              </div>
            )}

            <button type="submit" disabled={busy} className="clay-btn clay-btn-primary w-full justify-center">
              {busy ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {tab === 'signin' && 'Sign in'}
                  {tab === 'register' && 'Create account'}
                  {tab === 'trial' && (
                    <>
                      <Sparkles className="w-5 h-5" /> Start free trial
                    </>
                  )}
                  {tab !== 'trial' && <ArrowRight className="w-5 h-5" />}
                </>
              )}
            </button>
          </form>

          {tab === 'signin' && (
            <div className="mt-6">
              <div className="flex items-center gap-3 text-xs font-semibold text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> OR TRY A DEMO <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <button onClick={() => quickDemo('teacher')} disabled={busy} className="clay-btn clay-btn-sky justify-center">
                  <GraduationCap className="w-4 h-4" /> Teacher
                </button>
                <button onClick={() => quickDemo('student')} disabled={busy} className="clay-btn clay-btn-mint justify-center">
                  <BookOpen className="w-4 h-4" /> Student
                </button>
              </div>
            </div>
          )}

          {tab === 'trial' && (
            <p className="mt-4 text-xs text-slate-400 text-center leading-relaxed">
              Trial progress is kept only in this tab and disappears when you reload or leave. Register to keep your
              results and certificates.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function Feature({ icon: Icon, tone, text }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`grid place-items-center w-10 h-10 rounded-clay-sm bg-gradient-to-br ${tone} shadow-clay-sm shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </span>
      <span className="text-slate-700 font-semibold">{text}</span>
    </li>
  );
}

function Field({ icon: Icon, ...props }) {
  return (
    <label className="relative block">
      <Icon className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
      <input {...props} className="clay-input pl-11" />
    </label>
  );
}

function RolePick({ active, onClick, icon: Icon, label, hint }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`clay-card !rounded-clay p-3 text-left transition ${
        active ? 'ring-2 ring-grape-400 shadow-clay-press' : 'hover:-translate-y-0.5'
      }`}
    >
      <Icon className={`w-6 h-6 mb-1 ${active ? 'text-grape-500' : 'text-slate-400'}`} />
      <div className="font-bold text-slate-800">{label}</div>
      <div className="text-xs text-slate-400">{hint}</div>
    </button>
  );
}
