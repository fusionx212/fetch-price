// AI routing: Hermes (Ollama) first, Claude API fallback — Clawbot hybrid pattern.
// Local model handles text tasks for free; Claude handles vision + escalations.

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const AI_PRIMARY = process.env.AI_PRIMARY || 'ollama';

// Per-task local model routing — e.g. Qwen 235B for strict-JSON extraction,
// DeepSeek for reasoning-heavy diffs and prose drafts. Falls back to OLLAMA_MODEL.
const MODELS = {
  extract: process.env.OLLAMA_MODEL_EXTRACT || process.env.OLLAMA_MODEL || 'qwen3:235b',
  diff:    process.env.OLLAMA_MODEL_DIFF    || process.env.OLLAMA_MODEL || 'deepseek-v3',
  draft:   process.env.OLLAMA_MODEL_DRAFT   || process.env.OLLAMA_MODEL || 'deepseek-v3',
  default: process.env.OLLAMA_MODEL || 'qwen3:235b'
};

async function ollamaChat(prompt, { json = false, task = 'default' } = {}) {
  const res = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODELS[task] || MODELS.default,
      prompt,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      options: { temperature: 0.2 }
    })
  });
  if (!res.ok) throw new Error(`ollama ${res.status}`);
  const data = await res.json();
  return data.response;
}

async function claudeChat(prompt, { system, images = [] } = {}) {
  const content = [
    ...images.map((b64) => ({
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: b64 }
    })),
    { type: 'text', text: prompt }
  ];
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      ...(system ? { system } : {}),
      messages: [{ role: 'user', content }]
    })
  });
  if (!res.ok) throw new Error(`claude ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
}

function tryParseJson(text) {
  try {
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/**
 * Text task with schema validation. Hermes first; if output fails the
 * validator (or Ollama is down), escalate to Claude automatically.
 * @param {string} prompt
 * @param {(parsed:any)=>boolean} validate  returns true if output acceptable
 */
export async function aiJson(prompt, validate = () => true, task = "extract") {
  if (AI_PRIMARY === 'ollama') {
    try {
      const out = tryParseJson(await ollamaChat(prompt, { json: true, task }));
      if (out && validate(out)) return { result: out, engine: MODELS[task] || MODELS.default };
    } catch (e) {
      console.warn(`[ai] hermes unavailable/failed: ${e.message} → claude`);
    }
  }
  const out = tryParseJson(await claudeChat(prompt));
  if (!out) throw new Error('AI JSON parse failed on both engines');
  return { result: out, engine: 'claude' };
}

/** Plain text task (drafts, summaries). Hermes first, Claude fallback. */
export async function aiText(prompt, task = "draft") {
  if (AI_PRIMARY === 'ollama') {
    try {
      return { result: await ollamaChat(prompt, { task }), engine: MODELS[task] || MODELS.default };
    } catch (e) {
      console.warn(`[ai] hermes failed: ${e.message} → claude`);
    }
  }
  return { result: await claudeChat(prompt), engine: 'claude' };
}

/** Vision extraction — Claude only (Hermes farm is text-only). */
export async function aiVisionJson(prompt, pngBase64) {
  const out = tryParseJson(
    await claudeChat(prompt, {
      system: 'Respond ONLY with valid JSON. No preamble, no markdown fences.',
      images: [pngBase64]
    })
  );
  if (!out) throw new Error('Vision JSON parse failed');
  return { result: out, engine: 'claude-vision' };
}
