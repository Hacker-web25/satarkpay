// One small adapter for whichever model the team has a key for.
// Set AI_PROVIDER = nvidia | openai | gemini, plus that provider's key. AI_MODEL overrides the default.

const P = (process.env.AI_PROVIDER || '').toLowerCase();
const KEYS = { nvidia: process.env.NVIDIA_API_KEY, openai: process.env.OPENAI_API_KEY, gemini: process.env.GEMINI_API_KEY };
const provider = P || (KEYS.nvidia ? 'nvidia' : KEYS.openai ? 'openai' : KEYS.gemini ? 'gemini' : '');
const DEFAULT_MODEL = { nvidia: 'nvidia/nemotron-3.5-lightning-30b-a3b', openai: 'gpt-4.1-mini', gemini: 'gemini-2.5-flash' };
let MODEL = process.env.AI_MODEL || DEFAULT_MODEL[provider];

export const aiEnabled = Boolean(provider && KEYS[provider]);
export const aiInfo = { provider: aiEnabled ? provider : 'offline', model: aiEnabled ? MODEL : null };

// NVIDIA's own Nemotron models are the reliable ones on the free tier (others are often retired
// or queued). If the chosen model fails, try NVIDIA's models in this order, then any other nvidia/ chat model.
export const NVIDIA_PREFERRED = [
  'nvidia/nemotron-3.5-lightning-30b-a3b',   // 30B, only 3B active: fast and the strongest small model
  'nvidia/nemotron-3.5-bolt-e4b',            // tiny and very fast, built for chat agents
  'nvidia/nemotron-3.5-super-vl-120b-a12b',  // biggest, slower
  'nvidia/nemotron-3-nano-30b-a3b', 'nvidia/llama-3.3-nemotron-super-49b-v1.5', 'nvidia/nvidia-nemotron-nano-9b-v2',
];
const nvidiaChat = id => /^nvidia\//.test(id) && /nemotron|llama/i.test(id) && !/embed|rerank|guard|safety|parse|ocr|clip|retriev|reward|tabular|pose|vila|audio|asr|tts/i.test(id);
export async function nvidiaModels() {
  try {
    const res = await fetch('https://integrate.api.nvidia.com/v1/models', { headers: { Authorization: `Bearer ${KEYS.nvidia}` } });
    return ((await res.json()).data || []).map(m => m.id);
  } catch { return []; }
}
/** Use a specific model from now on (used by the model search and by npm run pick-model). */
export function useModel(m) { MODEL = m; aiInfo.model = m; }

export async function ensureModel(log = console.log) {
  if (!aiEnabled) return null;
  const tryModel = async (m, timeoutMs) => { const prev = MODEL; MODEL = m; try { return await complete('Reply with the single word OK.', [{ role: 'user', content: 'Say OK' }], { maxTokens: 50, timeoutMs }); } catch (e) { MODEL = prev; throw e; } };
  try { const r = await tryModel(MODEL, 30000); aiInfo.model = MODEL; return { ok: true, model: MODEL, reply: r }; }
  catch (first) {
    if (provider !== 'nvidia') return { ok: false, error: first.message };
    log(`AI: "${MODEL}" failed (${first.message.slice(0, 90)}). Trying NVIDIA's own models...`);
    const available = await nvidiaModels();
    const candidates = [...NVIDIA_PREFERRED.filter(m => !available.length || available.includes(m)), ...available.filter(nvidiaChat)]
      .filter((m, i, a) => a.indexOf(m) === i && m !== MODEL).slice(0, 8);
    for (const m of candidates) {
      try { const r = await tryModel(m, 20000); aiInfo.model = m; log(`AI: switched to "${m}". Run "npm run pick-model" to save the fastest model to .env.`); return { ok: true, model: m, reply: r }; }
      catch (e) { log(`AI:   "${m}" not usable (${e.message.slice(0, 70)})`); }
    }
    return { ok: false, error: first.message };
  }
}

/**
 * @param {string} system
 * @param {{role:'user'|'assistant', content:string}[]} messages
 * @param {{maxTokens?:number, json?:boolean}} opts
 */
export async function complete(system, messages, { maxTokens = 600, json = false, timeoutMs = Number(process.env.AI_TIMEOUT_MS || 60000) } = {}) {
  if (!aiEnabled) throw new Error('AI is not configured');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    if (provider === 'openai' || provider === 'nvidia') {
      // NVIDIA build.nvidia.com speaks the same Chat Completions format at its own base URL.
      const url = provider === 'nvidia' ? 'https://integrate.api.nvidia.com/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions';
      const thinks = /deepseek|gpt-oss/i.test(MODEL);   // these still spend tokens thinking, so give them room
      const body = extra => JSON.stringify({ model: MODEL, max_tokens: provider === 'nvidia' && thinks ? Math.max(maxTokens, 1200) : maxTokens, temperature: 0.3, ...extra, messages: [{ role: 'system', content: system }, ...messages], ...(json && provider === 'openai' ? { response_format: { type: 'json_object' } } : {}) });
      const post = extra => fetch(url, { method: 'POST', signal: ctrl.signal, headers: { Authorization: `Bearer ${KEYS[provider]}`, 'content-type': 'application/json' }, body: body(extra) });
      const fast = provider === 'nvidia' ? fastMode(MODEL) : {};
      let res = await post(fast);
      // If a model rejects the "answer directly" switch, ask again without it.
      if (res.status === 400 && Object.keys(fast).length) res = await post({});
      const d = await res.json();
      if (!res.ok) throw new Error(d.error?.message || d.detail || res.statusText);
      const out = (d.choices?.[0]?.message?.content || '').replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (!out) throw new Error('Model returned an empty answer');
      return out;
    }
    if (provider === 'gemini') {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${KEYS.gemini}`, {
        method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
          generationConfig: { maxOutputTokens: maxTokens, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error?.message || res.statusText);
      return d.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    }
    throw new Error('Unknown AI provider');
  } finally { clearTimeout(timer); }
}

/** Ask reasoning models to answer directly instead of thinking at length first. */
function fastMode(model) {
  if (/deepseek/i.test(model)) return { chat_template_kwargs: { thinking: false } };
  if (/gpt-oss/i.test(model)) return { reasoning_effort: 'low' };
  // Nemotron 3.5 and Qwen3 think before answering unless told not to; Saathi needs short, quick answers.
  if (/qwen3|nemotron/i.test(model)) return { chat_template_kwargs: { enable_thinking: false } };
  return {};
}

/** Pull the first JSON object out of a model reply. */
export function parseJson(text) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]); } catch { return null; }
}
