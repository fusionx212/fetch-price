// AI routing via the estate LiteLLM gateway (:4000, OpenAI-compatible).
// CHEAPEST-FIRST cascade per Dale: free local GPU models first, then cheap cloud
// (Qwen3-235B-A22B-Thinking → DeepSeek flash). NEVER a paid Claude lane in the
// auto-loop (MONEY RULE). Each task tries its cascade in order until one returns
// output that passes the validator; only then does it stop.

const BASE = (process.env.LITELLM_BASE_URL || 'http://192.168.1.7:4000').replace(/\/$/, '');
const KEY = process.env.LITELLM_API_KEY || process.env.LITELLM_MASTER_KEY || '';

// Cascades are env-overridable (comma-separated LiteLLM model_names). Defaults are
// free-local-first, then the two cheap cloud lanes Dale named.
const CASCADE = {
  extract: (process.env.FP_MODELS_EXTRACT || 'local-worker-large,local-worker,qwen3-flash-thinking,deepseek-flash').split(','),
  diff:    (process.env.FP_MODELS_DIFF    || 'local-worker-large,qwen3-flash-thinking,deepseek-flash').split(','),
  draft:   (process.env.FP_MODELS_DRAFT   || 'local-worker-large,qwen3-flash-thinking,deepseek-flash').split(','),
  vision:  (process.env.FP_MODELS_VISION  || 'local-vision,fusion-vision').split(','),
};
const pick = (task) => (CASCADE[task] || CASCADE.extract).map((m) => m.trim()).filter(Boolean);

async function chat(model, messages, { json = false } = {}) {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: 2000,
      ...(json ? { response_format: { type: 'json_object' } } : {}),
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error(`${model} ${res.status}: ${(await res.text()).slice(0, 160)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

function tryParseJson(text) {
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); }
  catch { return null; }
}

/**
 * JSON task with schema validation. Walks the task's cheapest-first cascade; the
 * first model whose parsed output passes `validate` wins.
 */
export async function aiJson(prompt, validate = () => true, task = 'extract') {
  let lastErr;
  for (const model of pick(task)) {
    try {
      const out = tryParseJson(await chat(model, [{ role: 'user', content: prompt }], { json: true }));
      if (out && validate(out)) return { result: out, engine: model };
      lastErr = new Error(`${model}: output failed validation`);
    } catch (e) {
      lastErr = e;
      console.warn(`[ai] ${model} miss (${e.message}) → next`);
    }
  }
  throw new Error(`aiJson exhausted cascade for ${task}: ${lastErr?.message}`);
}

/** Plain-text task (drafts, summaries). Cheapest-first cascade. */
export async function aiText(prompt, task = 'draft') {
  let lastErr;
  for (const model of pick(task)) {
    try {
      const out = await chat(model, [{ role: 'user', content: prompt }]);
      if (out?.trim()) return { result: out, engine: model };
    } catch (e) { lastErr = e; console.warn(`[ai] ${model} miss (${e.message}) → next`); }
  }
  throw new Error(`aiText exhausted cascade for ${task}: ${lastErr?.message}`);
}

/** Vision extraction from a screenshot — free local vision models (gemma4 / llama3.2-vision). */
export async function aiVisionJson(prompt, pngBase64) {
  let lastErr;
  for (const model of pick('vision')) {
    try {
      const out = tryParseJson(await chat(model, [{
        role: 'user',
        content: [
          { type: 'text', text: `${prompt}\nRespond ONLY with valid JSON. No preamble, no markdown.` },
          { type: 'image_url', image_url: { url: `data:image/png;base64,${pngBase64}` } },
        ],
      }], { json: true }));
      if (out) return { result: out, engine: model };
      lastErr = new Error(`${model}: no JSON`);
    } catch (e) { lastErr = e; console.warn(`[ai] vision ${model} miss (${e.message}) → next`); }
  }
  throw new Error(`aiVisionJson exhausted vision cascade: ${lastErr?.message}`);
}
