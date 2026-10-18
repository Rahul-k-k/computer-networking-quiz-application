// AI question generation from an uploaded subject PDF.
//
// A teacher uploads a PDF and picks a category; we ask Claude to read the PDF
// (sent as a native base64 "document" content block — no server-side PDF
// parsing dependency) and return a batch of multiple-choice questions tagged by
// difficulty. Structured output is obtained via a FORCED tool call, so the
// result is machine-readable JSON rather than prose we have to scrape.
//
// Unlike the free-text grading second-opinion (which fails closed and SILENTLY,
// because grading must never depend on the AI), generation is an explicit
// teacher action: with no API key we throw a typed error so the route can tell
// the teacher clearly. The rest of the app still boots and works without a key.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_GEN_MODEL = 'claude-sonnet-5';
const TIMEOUT_MS = 60000; // generation over a PDF is slower than grading
const DIFFICULTIES = ['low', 'medium', 'high'];

// Tool the model is forced to call — its input schema IS our output contract.
const saveQuestionsTool = {
  name: 'save_questions',
  description: 'Save the generated multiple-choice quiz questions.',
  input_schema: {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'The question stem, self-contained.' },
            options: {
              type: 'array',
              items: { type: 'string' },
              description: 'Exactly four distinct answer options, no letter prefixes.',
            },
            correctAnswer: {
              type: 'string',
              description: 'The exact text of the correct option (must equal one of options).',
            },
            explanation: { type: 'string', description: 'One-sentence justification of the answer.' },
            difficulty: { type: 'string', enum: DIFFICULTIES },
          },
          required: ['text', 'options', 'correctAnswer', 'difficulty'],
        },
      },
    },
    required: ['questions'],
  },
};

function buildInstruction({ categoryName, count, spread }) {
  const spreadLine =
    spread === 'balanced'
      ? 'Distribute difficulty as evenly as possible across "low", "medium" and "high".'
      : `Every question must have difficulty "${spread}".`;
  return (
    `Read the attached PDF and write ${count} multiple-choice quiz questions that test understanding ` +
    `of its content, for a quiz category called "${categoryName}".\n` +
    'Rules:\n' +
    '- Each question has exactly 4 options, with exactly one correct.\n' +
    '- "correctAnswer" must be the exact text of the correct option.\n' +
    '- Options must be plausible and distinct; do not prefix them with letters or numbers.\n' +
    '- Questions must be self-contained — a student will NOT see the PDF.\n' +
    '- Add a one-sentence "explanation" for each.\n' +
    `- ${spreadLine}\n` +
    'Return the questions by calling the save_questions tool.'
  );
}

/** Round-robin re-tag, used to guarantee coverage when a balanced spread came back skewed. */
function rebalance(questions) {
  return questions.map((q, i) => ({ ...q, difficulty: DIFFICULTIES[i % DIFFICULTIES.length] }));
}

/**
 * Keep only well-formed MCQs; coerce/repair where safe, drop the rest. Never
 * throws — bad model output simply yields fewer (or zero) questions.
 */
function sanitizeGenerated(raw, spread) {
  if (!Array.isArray(raw)) return [];
  const clean = [];
  for (const item of raw) {
    if (!item || typeof item.text !== 'string' || !item.text.trim()) continue;
    let options = Array.isArray(item.options)
      ? [...new Set(item.options.map((o) => String(o == null ? '' : o).trim()).filter(Boolean))]
      : [];
    if (options.length < 2) continue; // must be answerable as multiple-choice
    options = options.slice(0, 4);
    const correctAnswer = String(item.correctAnswer == null ? '' : item.correctAnswer).trim();
    if (!options.includes(correctAnswer)) continue; // correct answer must be an option
    const difficulty = DIFFICULTIES.includes(item.difficulty) ? item.difficulty : 'medium';
    clean.push({
      text: item.text.trim(),
      options,
      correctAnswer,
      explanation: String(item.explanation || '').trim(),
      difficulty,
    });
  }

  // A specific level was requested → force it. Balanced but skewed (a level
  // missing) → round-robin so students can actually pick every level.
  if (spread && spread !== 'balanced') {
    return clean.map((q) => ({ ...q, difficulty: spread }));
  }
  const levels = new Set(clean.map((q) => q.difficulty));
  if (clean.length >= 3 && levels.size < 2) return rebalance(clean);
  return clean;
}

/**
 * Generate MCQs from a PDF.
 * @param {{ pdfBase64: string, categoryName: string, count?: number, spread?: string }} args
 * @returns {Promise<Array<{text,options,correctAnswer,explanation,difficulty}>>}
 * @throws {Error & {code:'NO_API_KEY'}} when no API key is configured
 * @throws {Error & {code:'AI_ERROR', status:number}} on an upstream API failure
 */
async function generateQuestionsFromPdf({ pdfBase64, categoryName, count = 15, spread = 'balanced' }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error('AI generation is not configured (no ANTHROPIC_API_KEY).');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const model = process.env.ANTHROPIC_GEN_MODEL || process.env.ANTHROPIC_MODEL || DEFAULT_GEN_MODEL;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(ANTHROPIC_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        temperature: 0.6,
        tools: [saveQuestionsTool],
        tool_choice: { type: 'tool', name: 'save_questions' },
        messages: [
          {
            role: 'user',
            content: [
              { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
              { type: 'text', text: buildInstruction({ categoryName, count, spread }) },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const body = await res.json();
        detail = body && body.error && body.error.message ? body.error.message : '';
      } catch {
        /* ignore parse errors on the error body */
      }
      const err = new Error(detail || `AI request failed (${res.status}).`);
      err.code = 'AI_ERROR';
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    const toolUse = Array.isArray(data.content)
      ? data.content.find((b) => b && b.type === 'tool_use' && b.name === 'save_questions')
      : null;
    const rawQuestions = toolUse && toolUse.input ? toolUse.input.questions : [];
    return sanitizeGenerated(rawQuestions, spread);
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { generateQuestionsFromPdf, DIFFICULTIES };
