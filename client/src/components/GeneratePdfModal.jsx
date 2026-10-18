import { useState } from 'react';
import {
  X,
  Loader2,
  Sparkles,
  FileText,
  Trash2,
  Check,
  Gauge,
  AlertCircle,
  ChevronLeft,
  UploadCloud,
} from 'lucide-react';
import api from '../api/client';
import { DIFFICULTIES, difficultyFor } from '../lib/quiz';

// Teacher flow: upload a subject PDF + pick a category → Claude drafts MCQs →
// teacher reviews/edits each one → "Publish all" writes them via /questions/bulk.
// Generation is key-gated server-side: a missing key comes back as a clean 503
// that we surface inline (the rest of the app keeps working without it).

const SPREADS = [
  { key: 'balanced', label: 'Balanced' },
  { key: 'low', label: 'Easy' },
  { key: 'medium', label: 'Medium' },
  { key: 'high', label: 'Hard' },
];

/** A draft is publishable when it has text, >= 2 options and a correct one among them. */
function isValidDraft(d) {
  if (!d || !d.text.trim()) return false;
  const opts = d.options.map((o) => o.trim()).filter(Boolean);
  if (opts.length < 2) return false;
  return opts.includes((d.correctAnswer || '').trim());
}

export default function GeneratePdfModal({ categories, defaultCategoryId, onClose, onPublish }) {
  const [step, setStep] = useState('form'); // form | review
  const [categoryId, setCategoryId] = useState(defaultCategoryId || categories[0]?._id || '');
  const [file, setFile] = useState(null);
  const [count, setCount] = useState(15);
  const [spread, setSpread] = useState('balanced');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [drafts, setDrafts] = useState([]);
  const [genCategoryId, setGenCategoryId] = useState('');

  const genCategoryName = categories.find((c) => String(c._id) === String(genCategoryId))?.name || '';
  const validCount = drafts.filter(isValidDraft).length;

  // ---- Draft editing helpers (operate on the array by index) ----------------
  const patchDraft = (i, patch) => setDrafts((ds) => ds.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const setOption = (i, optIdx, value) =>
    setDrafts((ds) =>
      ds.map((d, idx) => {
        if (idx !== i) return d;
        const options = [...d.options];
        const prev = options[optIdx];
        options[optIdx] = value;
        // Keep the correct pointer on the same option while its text is edited.
        const correctAnswer = d.correctAnswer === prev ? value : d.correctAnswer;
        return { ...d, options, correctAnswer };
      })
    );
  const removeDraft = (i) => setDrafts((ds) => ds.filter((_, idx) => idx !== i));

  // ---- Generate -------------------------------------------------------------
  async function generate(e) {
    e.preventDefault();
    if (!categoryId) return setErr('Choose a category first.');
    if (!file) return setErr('Attach a PDF to generate from.');
    setBusy(true);
    setErr('');
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      fd.append('categoryId', categoryId);
      fd.append('count', String(count));
      fd.append('spread', spread);
      const { data } = await api.post('/questions/generate', fd);
      const normalized = (data.questions || []).map((q) => ({
        text: q.text || '',
        options: [0, 1, 2, 3].map((i) => (q.options && q.options[i]) || ''),
        correctAnswer: q.correctAnswer || '',
        explanation: q.explanation || '',
        difficulty: DIFFICULTIES.some((d) => d.key === q.difficulty) ? q.difficulty : 'medium',
      }));
      setDrafts(normalized);
      setGenCategoryId(categoryId);
      setStep('review');
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Generation failed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  // ---- Publish --------------------------------------------------------------
  async function publish() {
    const valid = drafts.filter(isValidDraft).map((d) => ({
      categoryId: genCategoryId,
      type: 'mcq',
      text: d.text.trim(),
      options: d.options.map((o) => o.trim()).filter(Boolean),
      correctAnswer: d.correctAnswer.trim(),
      explanation: d.explanation.trim(),
      difficulty: d.difficulty,
    }));
    if (valid.length === 0) return setErr('None of the drafts are complete yet — fill in options and mark the correct one.');
    setBusy(true);
    setErr('');
    try {
      await onPublish(valid); // parent closes + refreshes on success
    } catch (e2) {
      setErr(e2?.response?.data?.error || 'Publishing failed. Please try again.');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-slate-950/50 backdrop-blur-sm animate-pop-in overflow-y-auto">
      <div className="clay-card-lg w-full max-w-3xl p-6 my-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-700" aria-label="Close">
          <X className="w-5 h-5" />
        </button>

        <h3 className="text-xl font-extrabold text-slate-900 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-grape-500" />
          {step === 'form' ? 'Generate questions from a PDF' : 'Review & publish drafts'}
        </h3>

        {step === 'form' ? (
          <form onSubmit={generate} className="space-y-4 mt-4">
            <p className="text-sm text-slate-500">
              Upload a subject PDF and pick a category. Claude reads the document and drafts multiple-choice
              questions — you review and edit them before anything is saved.
            </p>

            <label className="block">
              <span className="text-sm font-bold text-slate-600">Category</span>
              <select
                className="clay-input mt-1"
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
              >
                {categories.length === 0 && <option value="">No categories yet</option>}
                {categories.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <div>
              <span className="text-sm font-bold text-slate-600">Subject PDF</span>
              <label className="mt-1 flex items-center gap-3 clay-inset rounded-clay p-4 cursor-pointer hover:ring-2 hover:ring-grape-200 transition">
                <span className="grid place-items-center w-11 h-11 rounded-clay-sm bg-gradient-to-br from-grape-200 to-grape-400 shrink-0">
                  {file ? <FileText className="w-5 h-5 text-white" /> : <UploadCloud className="w-5 h-5 text-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold text-slate-700 truncate">
                    {file ? file.name : 'Choose a PDF…'}
                  </span>
                  <span className="block text-xs text-slate-400">PDF only · up to 10 MB</span>
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] || null);
                    setErr('');
                  }}
                />
              </label>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-sm font-bold text-slate-600">How many questions</span>
                <input
                  type="number"
                  min="3"
                  max="30"
                  className="clay-input mt-1"
                  value={count}
                  onChange={(e) => setCount(e.target.value)}
                />
                <span className="text-xs text-slate-400">Between 3 and 30.</span>
              </label>

              <div>
                <span className="text-sm font-bold text-slate-600 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-grape-500" /> Difficulty spread
                </span>
                <div className="clay-inset p-1 rounded-clay grid grid-cols-2 gap-1 mt-1">
                  {SPREADS.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => setSpread(s.key)}
                      className={`py-2 rounded-clay-sm text-xs font-bold transition ${
                        spread === s.key ? 'bg-white text-grape-600 shadow-clay-sm' : 'text-slate-500'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-slate-400">
                  {spread === 'balanced' ? 'Mixes Easy / Medium / Hard.' : 'All questions at one level.'}
                </span>
              </div>
            </div>

            {err && (
              <p className="text-sm font-semibold text-peach-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /> {err}
              </p>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 justify-center">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="clay-btn clay-btn-primary flex-1 justify-center">
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" /> Generate
                  </>
                )}
              </button>
            </div>
            {busy && (
              <p className="text-xs text-slate-400 text-center">
                Reading the PDF and writing questions — this can take up to a minute.
              </p>
            )}
          </form>
        ) : (
          <div className="mt-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-sm text-slate-600">
                <strong>{drafts.length}</strong> draft{drafts.length === 1 ? '' : 's'} for{' '}
                <strong>{genCategoryName}</strong> · <span className="text-mint-600 font-semibold">{validCount} ready</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('form');
                  setErr('');
                }}
                className="clay-chip !py-1 text-xs font-bold text-slate-500 hover:text-grape-600"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back to setup
              </button>
            </div>

            <div className="space-y-3 mt-4 max-h-[55vh] overflow-y-auto pr-1">
              {drafts.map((d, i) => (
                <DraftCard
                  key={i}
                  index={i}
                  draft={d}
                  valid={isValidDraft(d)}
                  onPatch={patchDraft}
                  onSetOption={setOption}
                  onRemove={removeDraft}
                />
              ))}
              {drafts.length === 0 && (
                <p className="text-slate-500 text-center py-8">
                  All drafts removed. Go back to setup to generate again.
                </p>
              )}
            </div>

            {err && (
              <p className="text-sm font-semibold text-peach-700 flex items-center gap-2 mt-3">
                <AlertCircle className="w-4 h-4 shrink-0" /> {err}
              </p>
            )}

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="clay-btn clay-btn-ghost flex-1 justify-center">
                Cancel
              </button>
              <button
                type="button"
                onClick={publish}
                disabled={busy || validCount === 0}
                className="clay-btn clay-btn-primary flex-1 justify-center disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> Publishing…
                  </>
                ) : (
                  <>
                    <Check className="w-5 h-5" /> Publish {validCount} question{validCount === 1 ? '' : 's'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DraftCard({ index, draft, valid, onPatch, onSetOption, onRemove }) {
  const dMeta = difficultyFor(draft.difficulty);
  return (
    <div className={`clay-card p-4 ${valid ? '' : 'ring-2 ring-peach-200'}`}>
      <div className="flex items-start gap-2">
        <span className="font-display font-extrabold text-slate-300 w-6 shrink-0 pt-2">{index + 1}</span>
        <div className="min-w-0 flex-1 space-y-3">
          <textarea
            className="clay-input resize-none"
            rows={2}
            value={draft.text}
            onChange={(e) => onPatch(index, { text: e.target.value })}
            placeholder="Question text"
          />

          <div className="space-y-2">
            {draft.options.map((opt, oi) => {
              const isCorrect = draft.correctAnswer && draft.correctAnswer === opt;
              return (
                <div key={oi} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPatch(index, { correctAnswer: opt.trim() })}
                    disabled={!opt.trim()}
                    className={`grid place-items-center w-7 h-7 rounded-full shrink-0 transition ${
                      isCorrect ? 'bg-mint-500 text-white shadow-clay-sm' : 'clay-inset text-slate-300'
                    }`}
                    aria-label="Mark correct"
                  >
                    <Check className="w-3.5 h-3.5" />
                  </button>
                  <input
                    className="clay-input flex-1 !py-2"
                    value={opt}
                    onChange={(e) => onSetOption(index, oi, e.target.value)}
                    placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                  />
                </div>
              );
            })}
          </div>

          <input
            className="clay-input !py-2 text-sm"
            value={draft.explanation}
            onChange={(e) => onPatch(index, { explanation: e.target.value })}
            placeholder="Explanation (optional)"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="clay-inset p-1 rounded-clay inline-flex gap-1">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => onPatch(index, { difficulty: d.key })}
                  className={`px-3 py-1 rounded-clay-sm text-xs font-bold transition ${
                    draft.difficulty === d.key ? `bg-white ${d.text} shadow-clay-sm` : 'text-slate-500'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {!valid && (
              <span className="text-xs font-semibold text-peach-600 flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> needs a correct option
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="clay-chip !p-2 text-slate-400 hover:text-peach-600 shrink-0"
          aria-label="Remove draft"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
