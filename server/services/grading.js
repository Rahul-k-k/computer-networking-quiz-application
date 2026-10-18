// Free-text answer grading.
//
// Default: exact match (case-insensitive, whitespace-trimmed).
// Optional: an AI "second opinion" that can ONLY rescue an answer the exact
// check marked wrong — it can never turn a correct answer into a wrong one,
// and it never runs for MCQ. The AI pass FAILS CLOSED: if there is no API key,
// or the network/timeout/parse fails, we silently keep the exact-match result.

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_MODEL = 'claude-haiku-4-5';
const TIMEOUT_MS = 8000;

/** Normalize for exact comparison: string, trimmed, lower-cased. */
function normalize(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/** Exact grade: true only when both sides are non-empty and equal after normalize. */
function isExactMatch(userAnswer, correctAnswer) {
  const a = normalize(userAnswer);
  const b = normalize(correctAnswer);
  return b.length > 0 && a === b;
}

/**
 * Ask Claude whether the student's answer is substantively equivalent to the
 * expected answer. Returns `{ isCorrect, reason }` on success, or `null` on
 * ANY failure (no key, network error, timeout, bad status, unparseable body).
 * Never throws.
 */
async function gradeWithAI({ questionText, correctAnswer, userAnswer }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null; // fail closed: feature simply off

  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const system =
    'You grade a student’s short free-text answer to a computer-networking question. ' +
    'Decide whether the student answer is substantively equivalent to the expected answer ' +
    '(accept synonyms, abbreviations, extra words, and formatting differences; reject answers ' +
    'that are factually different or wrong). ' +
    'Respond with ONE line of raw JSON and nothing else — no markdown, no code fences: ' +
    '{"isCorrect": boolean, "reason": "<=12 word justification"}.';
  const userContent =
    `Question: ${questionText}\n` +
    `Expected answer: ${correctAnswer}\n` +
    `Student answer: ${userAnswer}`;

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
        max_tokens: 256,
        temperature: 0,
        system,
        messages: [{ role: 'user', content: userContent }],
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();

    // Concatenate any text blocks in the response content array.
    const text = Array.isArray(data.content)
      ? data.content.filter((b) => b && b.type === 'text').map((b) => b.text).join('')
      : '';
    if (!text) return null;

    // Be forgiving: extract the first {...} object if the model added stray text.
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    const parsed = JSON.parse(text.slice(start, end + 1));

    if (typeof parsed.isCorrect !== 'boolean') return null;
    return { isCorrect: parsed.isCorrect, reason: String(parsed.reason || '').slice(0, 200) };
  } catch {
    // Timeout / abort / network / JSON error → fail closed.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Grade a single free-text answer.
 * @returns {Promise<{ isCorrect: boolean, gradedBy: 'exact'|'ai', aiReason: string }>}
 */
async function gradeFreeText({ questionText, correctAnswer, userAnswer }) {
  // 1. Exact match wins immediately and is NEVER overridden by the AI.
  if (isExactMatch(userAnswer, correctAnswer)) {
    return { isCorrect: true, gradedBy: 'exact', aiReason: '' };
  }

  // 2. Exact said "wrong". An empty answer is never rescued.
  if (normalize(userAnswer).length === 0) {
    return { isCorrect: false, gradedBy: 'exact', aiReason: '' };
  }

  // 3. Optional AI rescue (fails closed to the exact "wrong" result).
  const ai = await gradeWithAI({ questionText, correctAnswer, userAnswer });
  if (ai && ai.isCorrect === true) {
    return { isCorrect: true, gradedBy: 'ai', aiReason: ai.reason };
  }
  return { isCorrect: false, gradedBy: 'exact', aiReason: '' };
}

module.exports = { gradeFreeText, isExactMatch, normalize };
