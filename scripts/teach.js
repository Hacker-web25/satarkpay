// Teach Saathi ahead of time: asks the AI each question below once and saves the answers,
// so they are instant in the demo. Questions already in memory are skipped.
// Run:  npm run teach            (add your own questions to the lists, or pass a .txt file:
//       npm run teach -- my-questions.txt   one question per line)
import fs from 'node:fs';
import { ensureModel, aiEnabled } from '../lib/llm.js';
import { askSaathi } from '../lib/saathi.js';
import { memoryStats } from '../lib/memory.js';

const QUESTIONS = {
  hi: [
    'मेरे बेटे के नाम से WhatsApp पर पैसे माँगे जा रहे हैं',
    'बैंक वाला कह रहा है मेरा कार्ड बंद हो जाएगा',
    'UPI पर पैसे लेने की रिक्वेस्ट आई है, क्या करूँ',
    'कोई QR कोड स्कैन करने को कह रहा है ताकि पैसे मिलें',
    'पेंशन रुकने का फ़ोन आया है, जीवन प्रमाण पत्र के लिए पैसे माँग रहे हैं',
    'गैस कनेक्शन बंद होने का मैसेज आया है',
    'कोई कह रहा है मेरा सिम कार्ड बंद हो जाएगा',
    'मेरे बैंक खाते में लोन पास हुआ है ऐसा फ़ोन आया',
    'सोशल मीडिया पर सस्ता सामान बेचने वाला पहले पैसे माँग रहा है',
    'टैक्स रिफ़ंड का मैसेज आया है, लिंक खोलूँ?',
  ],
  en: [
    'Someone on WhatsApp using my son\'s photo is asking for money',
    'The bank says my card will be blocked today',
    'I got a UPI collect request, should I accept it',
    'Someone wants me to scan a QR code to receive money',
    'Caller says my pension will stop unless I pay for a life certificate',
    'Message says my gas connection will be cut',
    'Someone says my SIM card will be blocked in two hours',
    'Caller says a loan has been approved in my name',
    'A seller on Facebook wants advance payment for a cheap phone',
    'I got a tax refund message with a link, should I open it',
  ],
};

const file = process.argv[2];
if (file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n').map(l => l.trim()).filter(Boolean);
  for (const l of lines) (/[ऀ-ॿ]/.test(l) ? QUESTIONS.hi : QUESTIONS.en).push(l);
}

if (!aiEnabled) { console.log('No AI key in .env, so there is nothing to learn from. Add NVIDIA_API_KEY or GEMINI_API_KEY first.'); process.exit(1); }
const t = await ensureModel();
if (!t?.ok) { console.log('AI is not answering:', t?.error); process.exit(1); }

let added = 0, known = 0, failed = 0;
for (const [lang, qs] of Object.entries(QUESTIONS)) {
  for (const q of qs) {
    const started = Date.now();
    const r = await askSaathi({ messages: [{ role: 'user', content: q }], lang });
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    if (r.by === 'memory') { known++; console.log(`  already known   ${q}`); }
    else if (r.by === 'ai') { if (r.learned) added++; console.log(`  learned (${secs}s) ${q}`); }
    else { failed++; console.log(`  AI failed       ${q}`); }
  }
}
// give the memory file a moment to be written
await new Promise(r => setTimeout(r, 500));
const s = memoryStats();
console.log(`\nDone. ${added} new, ${known} already known, ${failed} failed. Saathi now knows ${s.total} answers.`);
