// Risk engine: explainable signals first, then the model writes the explanation she hears.
import { store } from './store.js';
import { aiEnabled, complete, parseJson } from './llm.js';

const BAIT = ['verification', 'verify', 'refund', 'safe', 'custody', 'kyc', 'arrest', 'cbi', 'police', 'customs', 'rbi', 'urgent', 'bail', 'lottery', 'prize', 'reward', 'investment', 'returns', 'task', 'fine', 'penalty', 'blocked', 'parcel', 'courier', 'income tax', 'electricity cut',
  'सत्यापन', 'रिफंड', 'गिरफ्तार', 'पुलिस', 'जुर्माना', 'इनाम', 'लॉटरी'];
const AUTHORITY = ['rbi', 'cbi', 'police', 'bank', 'customs', 'income tax', 'court', 'government', 'govt', 'trai', 'ed ', 'narcotics'];
const SECRECY = ["don't tell", 'dont tell', 'do not tell', 'secret', 'confidential', 'किसी को मत', 'किसी को न'];

const median = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : 0; };

export function signals({ payeeEmail, payeeName = '', amount, note = '', callerAsked }) {
  const out = []; let score = 5;
  const add = (w, en, hi) => { score += w; out.push({ weight: w, en, hi }); };
  const text = `${payeeName} ${note}`.toLowerCase();
  const email = String(payeeEmail || '').toLowerCase().trim();
  const hist = store.history;
  const known = hist.some(h => h.email === email || h.payee.toLowerCase() === payeeName.toLowerCase());
  const usual = median(hist.map(h => h.amount)) || 50;
  const ratio = amount / usual;

  const flagged = store.isFlagged(email);
  if (flagged) add(60, `${flagged.reports} ${flagged.reports === 1 ? 'family has' : 'families have'} already reported this account (${flagged.reason}).`, `${flagged.reports} परिवारों ने इस खाते की शिकायत की है (${flagged.reason})।`);
  if (callerAsked) add(30, 'She said someone on a call asked her to make this payment.', 'आपने बताया कि फ़ोन पर किसी ने यह पेमेंट करने को कहा है।');
  if (!known) add(18, 'This is the first payment ever to this account.', 'इस खाते में पहली बार पैसा जा रहा है।');
  if (ratio >= 5) add(25, `It is about ${Math.round(ratio)}× her usual payment.`, `यह आपके आम पेमेंट से लगभग ${Math.round(ratio)} गुना ज़्यादा है।`);
  else if (ratio >= 2) add(10, `It is about ${ratio.toFixed(1)}× her usual payment.`, `यह आपके आम पेमेंट से लगभग ${ratio.toFixed(1)} गुना ज़्यादा है।`);
  const bait = BAIT.filter(w => text.includes(w));
  if (bait.length) add(20, `The note or name uses words scammers rely on: "${bait.slice(0, 3).join('", "')}".`, `नोट या नाम में धोखेबाज़ों वाले शब्द हैं: "${bait.slice(0, 3).join('", "')}"।`);
  const auth = AUTHORITY.filter(w => text.includes(w));
  if (auth.length && !known) add(15, `It claims to be an authority ("${auth[0].trim().toUpperCase()}"), but it's a personal account.`, `यह खुद को सरकारी या बैंक बताता है ("${auth[0].trim().toUpperCase()}"), पर यह किसी व्यक्ति का खाता है।`);
  if (SECRECY.some(w => text.includes(w))) add(20, 'The note asks her to keep it secret.', 'नोट में इसे छिपाकर रखने को कहा गया है।');
  const h = new Date().getHours();
  if (h >= 22 || h < 6) add(8, 'It is being sent late at night, outside her normal hours.', 'यह देर रात भेजा जा रहा है, जो आपके आम समय से अलग है।');

  if (!out.length) out.push({ weight: 0, en: 'A payee and amount that match her normal pattern.', hi: 'पाने वाला और रकम आपके आम पेमेंट जैसे हैं।' });
  return { score: Math.min(99, score), reasons: out.sort((a, b) => b.weight - a.weight), known, ratio };
}

const EXPLAIN_SYSTEM = `You are the risk explainer inside सतर्कPay, a payment app that protects older people in India from scams.
You receive a payment someone is about to make and the signals our rules found.
Return ONLY a JSON object with these keys:
- "scam_type": short English label of the most likely scam (e.g. "Digital arrest", "Fake KYC update", "None")
- "score_adjust": integer from -15 to 15 to correct the rule score using your judgement
- "explain_en": 2 short sentences in plain English, written TO the older person ("you"). Warm, calm, no jargon, no blame.
- "explain_hi": the same in simple everyday Hindi (Devanagari), as a grandchild would say it.
- "advice_en": one clear next step, under 15 words.
- "advice_hi": the same in Hindi.
Facts you can rely on: police, CBI, RBI, banks and courts never ask for money on a call; "digital arrest" does not exist in Indian law; India's cyber fraud helpline is 1930.`;

const TEMPLATES = {
  high: {
    explain_en: 'This payment looks like a scam. Police, CBI and banks never ask you to send money on a call, so your money is on hold and nothing has been sent.',
    explain_hi: 'यह पेमेंट धोखा लगता है। पुलिस, CBI या बैंक कभी भी फ़ोन पर पैसे नहीं माँगते। आपका पैसा रोका गया है, अभी कुछ नहीं गया।',
    advice_en: 'Hang up the call. We have asked your family to check.', advice_hi: 'फ़ोन काट दीजिए। हमने आपके परिवार से पूछा है।',
  },
  low: {
    explain_en: 'This looks like one of your normal payments.', explain_hi: 'यह आपके आम पेमेंट जैसा लगता है।',
    advice_en: 'It is being sent now.', advice_hi: 'पैसे अभी भेजे जा रहे हैं।',
  },
};

function guessType(text) {
  const t = text.toLowerCase();
  if (/(arrest|cbi|police|custody|rbi|verification|narcotics|गिरफ्तार)/.test(t)) return 'Digital arrest';
  if (/kyc/.test(t)) return 'Fake KYC update';
  if (/(customs|parcel|courier)/.test(t)) return 'Courier and customs scam';
  if (/(mistake|wrong transfer|return the money)/.test(t)) return '"Sent by mistake" refund';
  if (/(lottery|prize|reward|kbc)/.test(t)) return 'Lottery or prize scam';
  if (/(task|job|part time|part-time)/.test(t)) return 'Job or task scam';
  if (/(invest|returns|stock|trading)/.test(t)) return 'Investment scam';
  if (/(bail|accident|hospital|son|grandson)/.test(t)) return 'Family emergency scam';
  return 'Possible scam';
}

export async function assessPayment(input) {
  const s = signals(input);
  let score = s.score, ai = null;
  if (aiEnabled) {
    try {
      const reply = await complete(EXPLAIN_SYSTEM, [{ role: 'user', content: JSON.stringify({
        payment: { to: input.payeeName, account: input.payeeEmail, amount: input.amount, currency: input.currency, note: input.note, caller_asked_her_to_pay: !!input.callerAsked },
        rule_score: s.score, signals: s.reasons.map(r => r.en), her_usual_payment: 'about 40-75',
      }) }], { maxTokens: 500, json: true, timeoutMs: Number(process.env.RISK_TIMEOUT_MS || 20000) });
      ai = parseJson(reply);
      if (ai && Number.isFinite(+ai.score_adjust)) score = Math.max(1, Math.min(99, score + Math.max(-15, Math.min(15, Math.round(+ai.score_adjust)))));
    } catch (e) { console.warn('AI explain failed:', e.message); }
  }
  if (store.isFlagged(input.payeeEmail)) score = Math.max(score, 85);
  const level = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  const t = TEMPLATES[level === 'low' ? 'low' : 'high'];
  return {
    score, level, reasons: s.reasons, scamType: ai?.scam_type || (level === 'low' ? 'None' : guessType(`${input.payeeName} ${input.note}`)),
    explain: { en: ai?.explain_en || t.explain_en, hi: ai?.explain_hi || t.explain_hi },
    advice: { en: ai?.advice_en || t.advice_en, hi: ai?.advice_hi || t.advice_hi },
    by: ai ? 'ai' : 'rules',
  };
}

/* ---------- quick check for a UPI ID, link or phone number (landing page + app) ---------- */
const BANKS = ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'rbi', 'paytm', 'phonepe', 'gpay', 'npci', 'pnb'];
const OFFICIAL = ['onlinesbi.sbi', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'rbi.org.in', 'paytm.com', 'phonepe.com', 'npci.org.in', 'kotak.com', 'pnbindia.in'];
const SHORT = ['bit.ly', 'tinyurl', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl'];
const WORDS = ['kyc', 'refund', 'verify', 'verification', 'update', 'lottery', 'prize', 'reward', 'customs', 'cbi', 'police', 'arrest', 'safe', 'custody', 'helpdesk', 'support', 'claim', 'cashback', 'bonus', 'blocked', 'urgent', 'incometax', 'electricity'];

export function checkIdentifier(raw) {
  const s = String(raw || '').trim().slice(0, 300), low = s.toLowerCase(), reasons = [];
  let score = 10, kind = 'Input';
  const isUpi = /^[a-z0-9._-]{2,}@[a-z][a-z0-9.-]{1,}$/i.test(s);
  const isUrl = !isUpi && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s);
  const digits = s.replace(/\D/g, '');
  const isPhone = !isUpi && !isUrl && digits.length >= 10 && digits.length <= 13;
  const flagged = store.isFlagged(low);
  if (flagged) { score += 70; reasons.push(`${flagged.reports} ${flagged.reports === 1 ? 'family has' : 'families have'} already reported this account on सतर्कPay (${flagged.reason}).`); }
  if (isUpi || (low.includes('@') && !isUrl)) {
    kind = low.includes('.') && /\.[a-z]{2,}$/.test(low) ? 'Account' : 'UPI ID';
    const user = low.split('@')[0];
    const words = WORDS.filter(w => user.includes(w));
    const bank = BANKS.find(b => user.includes(b));
    if (words.length) { score += 40; reasons.push(`It uses words scammers rely on: "${words.slice(0, 3).join('", "')}". Banks never collect KYC fees or refunds through a personal ID.`); }
    if (bank) { score += 30; reasons.push(`It borrows a bank's name (${bank.toUpperCase()}) but it's a personal account, not the bank.`); }
    if (/\d{5,}/.test(user)) { score += 8; reasons.push('It contains a long run of digits, common in throwaway IDs.'); }
    if (!reasons.length) { reasons.push('No scam words, borrowed bank names or reports against this account.'); reasons.push('Before you pay, check that the name your app shows matches who you expect.'); }
  } else if (isUrl) {
    kind = 'Link';
    const host = low.replace(/^https?:\/\//, '').split('/')[0];
    const official = OFFICIAL.some(o => host === o || host.endsWith('.' + o));
    if (low.startsWith('http://')) { score += 15; reasons.push('The link is not secure: it starts with http, not https.'); }
    if (SHORT.some(x => host.includes(x))) { score += 35; reasons.push('It is a shortened link, which hides where it really goes.'); }
    const bank = BANKS.find(b => host.includes(b));
    if (bank && !official) { score += 45; reasons.push(`It looks like ${bank.toUpperCase()}'s website, but it isn't the bank's official address.`); }
    const w = WORDS.find(x => host.includes(x));
    if (w && !official) { score += 20; reasons.push(`The address uses "${w}", a word fake sites use to rush you.`); }
    if (/\.(xyz|top|click|link|info|online|site|live)$/.test(host)) { score += 12; reasons.push('It uses a cheap domain ending often used for short-lived scam sites.'); }
    if (official) { score = 8; reasons.length = 0; reasons.push("This is the bank's official website address."); }
    if (!reasons.length) reasons.push('Nothing obviously wrong in the address. Still, never type your PIN or OTP on a page you opened from a message.');
  } else if (isPhone) {
    kind = 'Phone number'; score = Math.max(score, 46);
    reasons.push('There is no payment history with this number.');
    reasons.push('Calls asking you to pay "for verification", "to avoid arrest" or "to unblock your account" are always scams.');
    reasons.push('If someone is on a call with you right now, hang up and call family first.');
  } else {
    kind = 'Unknown'; score = 30;
    reasons.push("This doesn't look like a UPI ID, a link or a phone number. Check what you pasted.");
  }
  score = Math.max(4, Math.min(97, score));
  const level = score >= 70 ? 'high' : score >= 40 ? 'mid' : 'low';
  const T = {
    high: ['Very likely a scam', "Don't pay. If someone is pressuring you, hang up and call family. You can report it on 1930 or cybercrime.gov.in."],
    mid: ['Be careful', 'Pause before you pay. Ask someone you trust to look at it with you.'],
    low: ['No warning signs found', 'Pay only if you know exactly who this is.'],
  }[level];
  return { s, kind, score, level, title: T[0], advice: T[1], reasons, reported: Boolean(flagged) };
}
