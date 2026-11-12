// Saathi's memory: every new question the AI answers is saved. A similar question later is
// answered instantly from memory. Matching works for Hindi (Devanagari) and English, and
// tolerates spelling variants (फोन / फ़ोन, kyc / KYC) by comparing letter patterns, not exact words.
import fs from 'node:fs';
import path from 'node:path';
import { SEED_MEMORY } from './memory-seed.js';

const FILE = process.env.MEMORY_FILE || path.resolve('saathi-memory.json');
const MATCH_AT = Number(process.env.MEMORY_MATCH || 0.5);

const STOP = new Set(('है हैं था थी थे हूँ हूं हो के का की को में से पर और या कि यह ये वह वो मैं मुझे मेरा मेरी मेरे हम आप क्या कैसे क्यों तो भी रहा रही रहे गया गई गए कर करूँ करूं करू करें करना एक जी ना नहीं अब बहुत कुछ कोई किसी '
  + 'a an the is are am was were i me my we you your it this that what how why do does did to of in on for and or with from at be have has please can should will just so if').split(' '));

// Words people use for the same thing, folded together (Hindi script, Hinglish and English).
const SAME = {
  otp: 'ओटीपी otp', kyc: 'केवाईसी kyc', upi: 'यूपीआई upi', pin: 'पिन pin', bank: 'बैंक bank',
  scam: 'fraud fraudster scammer scam cheat cheated ठग ठगी धोखा धोखेबाज धोखाधड़ी फ्रॉड फ्राड स्कैम',
  call: 'call called calling phone caller फोन कॉल कोल', police: 'police cop पुलिस', arrest: 'arrest arrested गिरफ्तार अरेस्ट',
  parcel: 'parcel courier package पार्सल कूरियर', money: 'money paisa rupees पैसे पैसा रुपये रुपए', send: 'send sent transfer transferred भेज भेजे भेजा',
  ask: 'ask asking asked demand मांग मांगे मांगा', link: 'link लिंक', message: 'message sms msg मैसेज मेसेज', lottery: 'lottery prize इनाम लॉटरी',
};
const ALIAS = new Map();
for (const [k, v] of Object.entries(SAME)) for (const w of v.split(' ')) ALIAS.set(w.replace(/़/g, '').replace(/ँ/g, 'ं'), k);

export function normalize(text) {
  return String(text || '').toLowerCase()
    .normalize('NFC')
    .replace(/़/g, '')                 // nukta: फ़ोन -> फोन
    .replace(/[ँं]/g, 'ं')    // chandrabindu / anusvara treated alike
    .replace(/[^a-z0-9ऀ-ॿ\s]/g, ' ')
    .split(/\s+/).filter(w => w && !STOP.has(w)).map(w => ALIAS.get(w) || w);
}
const grams = words => {
  const s = ' ' + words.join(' ') + ' ', g = new Map();
  for (let i = 0; i < s.length - 2; i++) { const k = s.slice(i, i + 3); g.set(k, (g.get(k) || 0) + 1); }
  return g;
};
function similarity(a, b) {
  const wa = new Set(a.words), wb = new Set(b.words);
  let inter = 0; for (const w of wa) if (wb.has(w)) inter++;
  const jaccard = inter / (wa.size + wb.size - inter || 1);
  let dot = 0, na = 0, nb = 0;
  for (const [k, v] of a.grams) { na += v * v; if (b.grams.has(k)) dot += v * b.grams.get(k); }
  for (const v of b.grams.values()) nb += v * v;
  const cosine = dot / (Math.sqrt(na * nb) || 1);
  return 0.4 * jaccard + 0.6 * cosine;
}

let items = [];
try { items = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { items = []; }
// Add any starter answers not already in the file (so updating the seed list reaches old installs).
const have = new Set(items.map(i => i.lang + '|' + i.q));
for (const s of SEED_MEMORY) if (!have.has(s.lang + '|' + s.q)) items.push({ ...s, source: 'seed', uses: 0, at: new Date().toISOString() });
const index = () => items.map(it => { const words = normalize(it.q); return { it, words, grams: grams(words) }; });
let idx = index();
let timer = null;
let dirty = false;
const write = () => { if (!dirty) return; dirty = false; try { fs.writeFileSync(FILE, JSON.stringify(items, null, 2)); } catch (e) { console.warn('Could not save Saathi memory:', e.message); } };
const save = () => { dirty = true; clearTimeout(timer); timer = setTimeout(write, 200); };
// Save before the server stops (Ctrl+C locally, or a restart on Render).
for (const sig of ['SIGINT', 'SIGTERM']) process.once(sig, () => { write(); process.exit(0); });

/** Best saved answer for a question, or null. Needs a few meaningful words so short follow-ups go to the AI. */
export function recall(question, lang, threshold = MATCH_AT) {
  const words = normalize(question);
  if (words.length < 2) return null;
  const q = { words, grams: grams(words) };
  let best = null;
  for (const e of idx) {
    if (e.it.lang !== lang) continue;
    const s = similarity(q, e);
    if (!best || s > best.score) best = { score: s, item: e.it };
  }
  if (!best || best.score < threshold) return null;
  best.item.uses = (best.item.uses || 0) + 1; save();
  return { answer: best.item.a, score: Number(best.score.toFixed(2)), matched: best.item.q };
}

/** Remember a new question and the AI's answer. Skips near-duplicates. */
export function learn(question, answer, lang) {
  if (!answer || answer.length < 20) return false;
  const words = normalize(question);
  if (words.length < 2) return false;
  const q = { words, grams: grams(words) };
  if (idx.some(e => e.it.lang === lang && similarity(q, e) > 0.85)) return false;
  const it = { q: question.trim().slice(0, 400), a: answer.trim(), lang, source: 'ai', uses: 0, at: new Date().toISOString() };
  items.push(it); idx.push({ it, words, grams: grams(words) }); save();
  return true;
}

export const memoryStats = () => ({ total: items.length, learned: items.filter(i => i.source === 'ai').length, seeded: items.filter(i => i.source === 'seed').length, served: items.reduce((n, i) => n + (i.uses || 0), 0) });
