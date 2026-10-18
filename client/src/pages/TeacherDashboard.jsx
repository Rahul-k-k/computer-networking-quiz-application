import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FolderPlus,
  Plus,
  Pencil,
  Trash2,
  X,
  ImagePlus,
  Loader2,
  ListChecks,
  Clock,
  Target,
  BookOpen,
  GraduationCap,
  BarChart3,
  Users,
  AlertCircle,
  Check,
  Upload,
  Sparkles,
  Gauge,
} from 'lucide-react';
import api from '../api/client';
import { tierFor, fmtDuration, DIFFICULTIES, difficultyFor } from '../lib/quiz';
import { FullScreenLoader } from '../components/FullScreenLoader';
import GeneratePdfModal from '../components/GeneratePdfModal';

const emptyCat = { name: '', description: '', durationMinutes: 10, passPercentage: 60 };
const emptyQ = {
  type: 'mcq',
  text: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  explanation: '',
  imageUrl: '',
  difficulty: 'medium',
};

export default function TeacherDashboard() {
  const [tab, setTab] = useState('content');
  const [categories, setCategories] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [qLoading, setQLoading] = useState(false);
  const [error, setError] = useState('');

  const [catModal, setCatModal] = useState(null); // {mode, data}
  const [qModal, setQModal] = useState(null);
  const [genOpen, setGenOpen] = useState(false); // "Generate from PDF" modal
  const [confirm, setConfirm] = useState(null); // {message, onConfirm}

  const selected = useMemo(() => categories.find((c) => c._id === selectedId) || null, [categories, selectedId]);

  const loadCategories = useCallback(async () => {
    const { data } = await api.get('/categories');
    const cats = data.categories || [];
    setCategories(cats);
    setSelectedId((prev) => prev || cats[0]?._id || null);
    return cats;
  }, []);

  const loadQuestions = useCallback(async (catId) => {
    if (!catId) {
      setQuestions([]);
      return;
    }
    setQLoading(true);
    try {
      const { data } = await api.get('/questions', { params: { categoryId: catId } });
      setQuestions(data.questions || []);
    } finally {
      setQLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        await Promise.all([loadCategories(), api.get('/results').then((r) => setResults(r.data.results || []))]);
      } catch (e) {
        setError(e?.response?.data?.error || 'Could not load the teacher console.');
      } finally {
        setLoading(false);
      }
    })();
  }, [loadCategories]);

  useEffect(() => {
    loadQuestions(selectedId);
  }, [selectedId, loadQuestions]);

  // ---- Category actions ----------------------------------------------------
  async function saveCategory(form) {
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      durationMinutes: Number(form.durationMinutes) || 10,
      passPercentage: Number(form.passPercentage) || 60,
    };
    if (catModal.mode === 'create') {
      const { data } = await api.post('/categories', payload);
      await loadCategories();
      setSelectedId(data.category._id);
    } else {
      await api.put(`/categories/${catModal.data._id}`, payload);
      await loadCategories();
    }
    setCatModal(null);
  }

  function deleteCategory(cat) {
    setConfirm({
      message: `Delete "${cat.name}" and all its questions? This cannot be undone.`,
      onConfirm: async () => {
        await api.delete(`/categories/${cat._id}`);
        setConfirm(null);
        const cats = await loadCategories();
        if (selectedId === cat._id) setSelectedId(cats[0]?._id || null);
      },
    });
  }

  // ---- Question actions ----------------------------------------------------
  async function saveQuestion(form) {
    const base = {
      categoryId: selectedId,
      type: form.type,
      text: form.text.trim(),
      correctAnswer: form.correctAnswer.trim(),
      explanation: form.explanation.trim(),
      imageUrl: form.imageUrl || '',
      difficulty: form.difficulty || 'medium',
    };
    if (form.type === 'mcq') base.options = form.options.map((o) => o.trim()).filter(Boolean);

    if (qModal.mode === 'create') await api.post('/questions', base);
    else await api.put(`/questions/${qModal.data._id}`, base);

    setQModal(null);
    await Promise.all([loadQuestions(selectedId), loadCategories()]);
  }

  // Publish a batch of reviewed AI drafts, then refresh.
  async function publishGenerated(questions) {
    await api.post('/questions/bulk', { questions });
    setGenOpen(false);
    await Promise.all([loadQuestions(selectedId), loadCategories()]);
  }

  function deleteQuestion(q) {
    setConfirm({
      message: 'Delete this question? This cannot be undone.',
      onConfirm: async () => {
        await api.delete(`/questions/${q._id}`);
        setConfirm(null);
        await Promise.all([loadQuestions(selectedId), loadCategories()]);
      },
    });
  }

  if (loading) return <FullScreenLoader label="Opening the teacher console…" />;

  const totalQuestions = categories.reduce((s, c) => s + (c.questionCount || 0), 0);
  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;

  return (
    <div className="space-y-6 animate-pop-in">
      <header className="clay-card-lg p-6 sm:p-8">
        <p className="text-grape-500 font-bold flex items-center gap-2">
          <GraduationCap className="w-4 h-4" /> Teacher console
        </p>
        <h1 className="text-3xl font-extrabold text-slate-900 mt-1">Manage your arena</h1>
        <p className="text-slate-600 mt-1">Create categories, author questions with images, and track how students do.</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Stat icon={FolderPlus} tone="from-grape-200 to-grape-400" label="Categories" value={categories.length} />
          <Stat icon={ListChecks} tone="from-sky-200 to-sky-400" label="Questions" value={totalQuestions} />
          <Stat icon={Users} tone="from-mint-200 to-mint-400" label="Attempts" value={results.length} />
          <Stat icon={BarChart3} tone="from-peach-200 to-peach-400" label="Avg score" value={`${avgScore}%`} />
        </div>
      </header>

      {error && (
        <div className="clay-card p-4 text-peach-700 font-semibold flex items-center gap-2">
          <AlertCircle className="w-5 h-5" /> {error}
        </div>
      )}

      {/* Tabs */}
      <div className="clay-inset p-1 rounded-clay inline-flex gap-1">
        {[
          { key: 'content', label: 'Categories & questions', icon: BookOpen },
          { key: 'results', label: 'Student results', icon: BarChart3 },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-clay-sm text-sm font-bold flex items-center gap-2 transition ${
              tab === t.key ? 'bg-white text-grape-600 shadow-clay-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'content' ? (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Categories column */}
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold text-slate-900">Categories</h2>
              <button onClick={() => setCatModal({ mode: 'create', data: { ...emptyCat } })} className="clay-btn clay-btn-primary !py-2 !px-3 text-sm">
                <Plus className="w-4 h-4" /> New
              </button>
            </div>
            <ul className="space-y-2">
              {categories.map((c) => (
                <li key={c._id}>
                  <div
                    className={`clay-card p-3 flex items-center gap-2 cursor-pointer transition ${
                      selectedId === c._id ? 'ring-2 ring-grape-400' : 'hover:-translate-y-0.5'
                    }`}
                    onClick={() => setSelectedId(c._id)}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800 truncate">{c.name}</div>
                      <div className="text-xs text-slate-400">
                        {c.questionCount} Qs · {c.durationMinutes}m · pass {c.passPercentage}%
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCatModal({ mode: 'edit', data: { ...emptyCat, ...c } });
                      }}
                      className="clay-chip !p-2 text-slate-500 hover:text-grape-600"
                      aria-label="Edit category"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCategory(c);
                      }}
                      className="clay-chip !p-2 text-slate-500 hover:text-peach-600"
                      aria-label="Delete category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
              {categories.length === 0 && <p className="text-slate-500 text-sm">No categories yet — create one to start.</p>}
            </ul>
          </section>

          {/* Questions column */}
          <section className="lg:col-span-2 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-extrabold text-slate-900 truncate">
                {selected ? `Questions · ${selected.name}` : 'Questions'}
              </h2>
              {selected && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setGenOpen(true)}
                    className="clay-btn clay-btn-ghost !py-2 !px-3 text-sm text-grape-600"
                  >
                    <Sparkles className="w-4 h-4" /> Generate from PDF
                  </button>
                  <button
                    onClick={() => setQModal({ mode: 'create', data: { ...emptyQ, options: ['', '', '', ''] } })}
                    className="clay-btn clay-btn-primary !py-2 !px-3 text-sm"
                  >
                    <Plus className="w-4 h-4" /> Add question
                  </button>
                </div>
              )}
            </div>

            {!selected ? (
              <div className="clay-card p-8 text-center text-slate-500">Select a category to manage its questions.</div>
            ) : qLoading ? (
              <div className="clay-card p-8 grid place-items-center">
                <Loader2 className="w-6 h-6 animate-spin text-grape-500" />
              </div>
            ) : questions.length === 0 ? (
              <div className="clay-card p-8 text-center text-slate-500">No questions yet. Add the first one!</div>
            ) : (
              <ul className="space-y-2">
                {questions.map((q, i) => (
                  <li key={q._id} className="clay-card p-4 flex items-start gap-3">
                    <span className="font-display font-extrabold text-slate-300 w-6 shrink-0">{i + 1}</span>
                    {q.imageUrl && <img src={q.imageUrl} alt="" className="w-12 h-12 object-cover rounded-clay-sm clay-inset p-1 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-slate-800">{q.text}</div>
                      <div className="text-xs mt-1 flex flex-wrap items-center gap-2">
                        <span className="clay-chip !py-0.5 !px-2 text-[11px] font-bold text-grape-600">
                          {q.type === 'mcq' ? 'MCQ' : 'Free text'}
                        </span>
                        {(() => {
                          const d = difficultyFor(q.difficulty);
                          return (
                            <span className={`clay-chip !py-0.5 !px-2 text-[11px] font-bold ${d.badge}`}>
                              {d.label}
                            </span>
                          );
                        })()}
                        <span className="text-mint-600 font-semibold">✓ {q.correctAnswer}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setQModal({ mode: 'edit', data: { ...emptyQ, ...q, options: q.options?.length ? q.options : ['', ''] } })}
                      className="clay-chip !p-2 text-slate-500 hover:text-grape-600"
                      aria-label="Edit question"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteQuestion(q)}
                      className="clay-chip !p-2 text-slate-500 hover:text-peach-600"
                      aria-label="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : (
        <ResultsTable results={results} />
      )}

      {catModal && <CategoryModal state={catModal} onClose={() => setCatModal(null)} onSave={saveCategory} />}
      {qModal && <QuestionModal state={qModal} onClose={() => setQModal(null)} onSave={saveQuestion} />}
      {genOpen && (
        <GeneratePdfModal
          categories={categories}
          defaultCategoryId={selectedId}
          onClose={() => setGenOpen(false)}
          onPublish={publishGenerated}
        />
      )}
      {confirm && <ConfirmDialog {...confirm} onCancel={() => setConfirm(null)} />}
    </div>
  );
}

function Stat({ icon: Icon, tone, label, value }) {
  return (
    <div className="clay-inset rounded-clay p-3 flex items-center gap-3">
      <span className={`grid place-items-center w-10 h-10 rounded-clay-sm bg-gradient-to-br ${tone} shrink-0`}>
        <Icon className="w-5 h-5 text-white" />
      </span>
      <div className="min-w-0">
        <div className="text-xl font-extrabold text-slate-900 leading-none">{value}</div>
        <div className="text-[11px] font-semibold text-slate-400 truncate">{label}</div>
      </div>
    </div>
  );
}

// ---- Modals ----------------------------------------------------------------
function ModalShell({ title, onClose, children, wide }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-pop-in overflow-y-auto">
      <div className={`clay-card-lg w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 my-8 relative`}>
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-extrabold text-slate-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  );
}

function Labelled({ label, children }) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CategoryModal({ state, onClose, onSave }) {
  const [form, setForm] = useState(state.data);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (!form.name.trim()) return setErr('Name is required.');
    setBusy(true);
    setErr('');
    try {
      await onSave(form);
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <ModalShell title={state.mode === 'create' ? 'New category' : 'Edit category'} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <Labelled label="Name">
          <input className="clay-input" value={form.name} onChange={set('name')} placeholder="e.g. Protocols & Ports" />
        </Labelled>
        <Labelled label="Description">
          <textarea className="clay-input resize-none" rows={2} value={form.description} onChange={set('description')} />
        </Labelled>
        <div className="grid grid-cols-2 gap-4">
          <Labelled label="Duration (minutes)">
            <input type="number" min="1" className="clay-input" value={form.durationMinutes} onChange={set('durationMinutes')} />
          </Labelled>
          <Labelled label="Pass mark (%)">
            <input type="number" min="0" max="100" className="clay-input" value={form.passPercentage} onChange={set('passPercentage')} />
          </Labelled>
        </div>
        {err && <p className="text-sm font-semibold text-peach-700">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="clay-btn clay-btn-primary flex-1 justify-center">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function QuestionModal({ state, onClose, onSave }) {
  const [form, setForm] = useState(state.data);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const setOption = (i, v) =>
    setForm((f) => {
      const options = [...f.options];
      const prev = options[i];
      options[i] = v;
      // Keep correctAnswer pointing at the same option if it was selected.
      return { ...f, options, correctAnswer: f.correctAnswer === prev ? v : f.correctAnswer };
    });
  const addOption = () => setForm((f) => ({ ...f, options: [...f.options, ''] }));
  const removeOption = (i) =>
    setForm((f) => {
      const removed = f.options[i];
      const options = f.options.filter((_, idx) => idx !== i);
      return { ...f, options, correctAnswer: f.correctAnswer === removed ? '' : f.correctAnswer };
    });

  async function uploadImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('image', file);
      const { data } = await api.post('/uploads', fd);
      setForm((f) => ({ ...f, imageUrl: data.imageUrl }));
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Image upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    if (!form.text.trim()) return setErr('Question text is required.');
    if (form.type === 'mcq') {
      const opts = form.options.map((o) => o.trim()).filter(Boolean);
      if (opts.length < 2) return setErr('Provide at least two options.');
      if (!opts.includes(form.correctAnswer.trim())) return setErr('Pick which option is correct.');
    } else if (!form.correctAnswer.trim()) {
      return setErr('Provide the expected answer.');
    }
    setBusy(true);
    setErr('');
    try {
      await onSave(form);
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <ModalShell title={state.mode === 'create' ? 'New question' : 'Edit question'} onClose={onClose} wide>
      <form onSubmit={submit} className="space-y-4">
        {/* Type toggle */}
        <div className="clay-inset p-1 rounded-clay grid grid-cols-2 gap-1">
          {[
            { key: 'mcq', label: 'Multiple choice' },
            { key: 'free-text', label: 'Free text' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setForm((f) => ({ ...f, type: t.key, correctAnswer: '' }))}
              className={`py-2 rounded-clay-sm text-sm font-bold transition ${
                form.type === t.key ? 'bg-white text-grape-600 shadow-clay-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <Labelled label="Question">
          <textarea className="clay-input resize-none" rows={2} value={form.text} onChange={set('text')} placeholder="What are you asking?" />
        </Labelled>

        {/* Image */}
        <div>
          <span className="text-sm font-bold text-slate-600">Image (optional)</span>
          <div className="mt-1 flex items-center gap-3">
            {form.imageUrl ? (
              <div className="relative">
                <img src={form.imageUrl} alt="" className="w-20 h-20 object-cover rounded-clay clay-inset p-1" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  className="absolute -top-2 -right-2 bg-peach-500 text-white rounded-full p-1 shadow-clay-sm"
                  aria-label="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <label className="clay-btn clay-btn-ghost cursor-pointer">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ImagePlus className="w-5 h-5" />}
                {uploading ? 'Uploading…' : 'Upload image'}
                <input type="file" accept="image/*" className="hidden" onChange={uploadImage} disabled={uploading} />
              </label>
            )}
          </div>
        </div>

        {/* Answers */}
        {form.type === 'mcq' ? (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-slate-600">Options (tap the circle to mark the correct one)</span>
              <button type="button" onClick={addOption} className="clay-chip !py-1 text-xs font-bold text-grape-600">
                <Plus className="w-3.5 h-3.5" /> Add
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {form.options.map((opt, i) => {
                const isCorrect = form.correctAnswer && form.correctAnswer === opt;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, correctAnswer: opt.trim() }))}
                      className={`grid place-items-center w-8 h-8 rounded-full shrink-0 transition ${
                        isCorrect ? 'bg-mint-500 text-white shadow-clay-sm' : 'clay-inset text-slate-300'
                      }`}
                      aria-label="Mark correct"
                      disabled={!opt.trim()}
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <input
                      className="clay-input flex-1"
                      value={opt}
                      onChange={(e) => setOption(i, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                    />
                    {form.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(i)} className="clay-chip !p-2 text-slate-400 hover:text-peach-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <Labelled label="Expected answer">
            <input className="clay-input" value={form.correctAnswer} onChange={set('correctAnswer')} placeholder="e.g. 255.255.255.0" />
          </Labelled>
        )}

        <Labelled label="Explanation (shown after grading)">
          <textarea className="clay-input resize-none" rows={2} value={form.explanation} onChange={set('explanation')} />
        </Labelled>

        {/* Difficulty */}
        <div>
          <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
            <Gauge className="w-4 h-4 text-grape-500" /> Difficulty
          </span>
          <div className="clay-inset p-1 rounded-clay grid grid-cols-3 gap-1 mt-1">
            {DIFFICULTIES.map((d) => (
              <button
                key={d.key}
                type="button"
                onClick={() => setForm((f) => ({ ...f, difficulty: d.key }))}
                className={`py-2 rounded-clay-sm text-sm font-bold transition ${
                  form.difficulty === d.key ? `bg-white ${d.text} shadow-clay-sm` : 'text-slate-500'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {err && <p className="text-sm font-semibold text-peach-700">{err}</p>}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="clay-btn clay-btn-primary flex-1 justify-center">
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Save question'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ConfirmDialog({ message, onConfirm, onCancel }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-pop-in">
      <div className="clay-card-lg w-full max-w-sm p-6 text-center">
        <span className="grid place-items-center w-14 h-14 rounded-full bg-gradient-to-br from-peach-200 to-peach-400 mx-auto shadow-clay">
          <Trash2 className="w-7 h-7 text-peach-700" />
        </span>
        <p className="text-slate-700 font-semibold mt-3">{message}</p>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancel} className="clay-btn clay-btn-ghost flex-1 justify-center">
            Cancel
          </button>
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="clay-btn clay-btn-peach flex-1 justify-center"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResultsTable({ results }) {
  const [q, setQ] = useState('');
  const filtered = results.filter(
    (r) =>
      !q ||
      r.studentName?.toLowerCase().includes(q.toLowerCase()) ||
      r.categoryName?.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <section className="clay-card-lg p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
        <h2 className="font-extrabold text-slate-900">Student results</h2>
        <input
          className="clay-input sm:max-w-xs"
          placeholder="Search by student or category…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-slate-500 text-center py-8">No results to show yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 font-bold border-b border-slate-200/60">
                <th className="py-2 pr-3">Student</th>
                <th className="py-2 pr-3">Category</th>
                <th className="py-2 pr-3">Score</th>
                <th className="py-2 pr-3 hidden sm:table-cell">Time</th>
                <th className="py-2 pr-3 hidden md:table-cell">Integrity</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const tier = tierFor(r.percentage);
                const flagged = r.tabViolations > 0 || r.exitedFullscreen || r.autoSubmitted;
                return (
                  <tr key={r._id} className="border-b border-slate-100/70 last:border-0">
                    <td className="py-2.5 pr-3 font-bold text-slate-800">{r.studentName}</td>
                    <td className="py-2.5 pr-3 text-slate-600">{r.categoryName}</td>
                    <td className="py-2.5 pr-3">
                      <span className={`font-extrabold ${tier.text}`}>{r.percentage}%</span>
                      <span className="text-slate-400"> ({r.score}/{r.totalQuestions})</span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-500 hidden sm:table-cell">{fmtDuration(r.timeTakenSeconds)}</td>
                    <td className="py-2.5 pr-3 hidden md:table-cell">
                      {flagged ? (
                        <span className="clay-chip !py-0.5 !px-2 text-[11px] font-bold text-peach-700">
                          <AlertCircle className="w-3 h-3" /> flagged
                        </span>
                      ) : (
                        <span className="text-mint-600 text-xs font-semibold">clean</span>
                      )}
                    </td>
                    <td className="py-2.5 text-slate-400 text-xs">
                      {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
