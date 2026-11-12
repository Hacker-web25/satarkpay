// Finds the best NVIDIA model for Saathi on YOUR key, and saves it to .env as AI_MODEL.
// Each model gets the same Hindi and English scam question. A model must answer both, reply in
// Hindi (Devanagari) to the Hindi question, and be fast. The fastest model that passes wins.
// Run:  npm run pick-model
import fs from 'node:fs';
import { aiEnabled, aiInfo, complete, useModel, nvidiaModels, NVIDIA_PREFERRED } from '../lib/llm.js';

if (!aiEnabled || aiInfo.provider !== 'nvidia') { console.log('Put your NVIDIA_API_KEY in .env first (and remove AI_PROVIDER if it says something else).'); process.exit(1); }

const SYSTEM = lang => `You are Saathi, a calm helper for elderly people in India, only about scams and safe payments. Answer in ${lang === 'hi' ? 'simple Hindi (Devanagari script)' : 'simple English'}, at most 3 short sentences, no markdown. Give one clear next step.`;
const TESTS = [
  { lang: 'hi', q: 'मुझे फ़ोन आया कि मेरे आधार से अपराध हुआ है और वीडियो कॉल पर गिरफ्तार करेंगे। क्या करूँ?' },
  { lang: 'en', q: 'A man on the phone says my bank account will be blocked unless I share the OTP. What should I do?' },
];
const devanagari = t => (t.match(/[ऀ-ॿ]/g) || []).length / Math.max(1, t.replace(/\s/g, '').length);

const available = await nvidiaModels();
const others = available.filter(id => /^nvidia\/.*nemotron/i.test(id) && !/embed|rerank|guard|safety|parse|ocr|retriev|reward|tabular/i.test(id));
const models = [...new Set([...NVIDIA_PREFERRED, ...others])].filter(m => !available.length || available.includes(m)).slice(0, 8);
console.log(`Testing ${models.length} NVIDIA models (up to 30s each)...\n`);

const results = [];
for (const m of models) {
  useModel(m);
  let total = 0, ok = true, sample = '', hindi = true;
  for (const t of TESTS) {
    const t0 = Date.now();
    try {
      const out = await complete(SYSTEM(t.lang), [{ role: 'user', content: t.q }], { maxTokens: 300, timeoutMs: 30000 });
      total += Date.now() - t0;
      if (t.lang === 'hi') { sample = out; hindi = devanagari(out) > 0.5; }
    } catch (e) { ok = false; console.log(`✗ ${m}\n    ${e.message.slice(0, 100)}\n`); break; }
  }
  if (!ok) continue;
  const secs = total / TESTS.length / 1000;
  results.push({ m, secs, hindi });
  console.log(`${hindi ? '✓' : '~'} ${m}  ${secs.toFixed(1)}s per answer${hindi ? '' : '  (did not answer in Hindi)'}\n    ${sample.replace(/\s+/g, ' ').slice(0, 160)}\n`);
}

const best = results.filter(r => r.hindi).sort((a, b) => a.secs - b.secs)[0] || results.sort((a, b) => a.secs - b.secs)[0];
if (!best) { console.log('No NVIDIA model answered. Check that NVIDIA_API_KEY in .env is correct, or try again in a minute.'); process.exit(1); }

let env = fs.readFileSync('.env', 'utf8');
env = /^AI_MODEL=.*$/m.test(env) ? env.replace(/^AI_MODEL=.*$/m, `AI_MODEL=${best.m}`) : env.trimEnd() + `\nAI_MODEL=${best.m}\n`;
fs.writeFileSync('.env', env);
console.log(`Winner: ${best.m} (${best.secs.toFixed(1)}s per answer). Saved to .env as AI_MODEL.\nRestart with: npm run dev`);
