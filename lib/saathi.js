// Saathi: the assistant inside सतर्कPay. Built for older people, limited to scams and safe payments.
import { aiEnabled, complete } from './llm.js';
import { recall, learn } from './memory.js';

const SAATHI_TIMEOUT = Number(process.env.SAATHI_TIMEOUT_MS || 45000);

const SYSTEM = (lang, ctx) => `You are Saathi (साथी), the helper inside सतर्कPay, a payment app that protects older people in India from scams.
You talk with people in their 60s, 70s and 80s who are not comfortable with technology. Many are frightened when they reach you.

WHAT YOU HELP WITH (and nothing else):
- Recognising scams: digital arrest, fake police/CBI/RBI/bank calls, KYC update messages, courier or customs calls, "sent by mistake" refunds, lottery or prize messages, job and task scams, investment tips groups, fake electricity disconnection, family emergency calls.
- Paying safely: UPI and PayPal basics, checking who you are paying, why सतर्कPay held a payment, how family approval works.
- What to do if money is already gone: call 1930 (India's cyber fraud helpline) at once, report on cybercrime.gov.in, call the bank to block the account.
If asked about anything else (health, news, cricket, recipes, general knowledge, coding), say kindly in one sentence that you only help with money safety and scams, and ask what is worrying them about money.

HOW YOU TALK:
- Reply in ${lang === 'hi' ? 'simple everyday Hindi written in Devanagari, the way a caring grandchild speaks. Use "आप". English words people commonly use (UPI, OTP, KYC, bank) are fine.' : 'simple, warm English. Short words. No jargon.'}
- Your reply is read aloud. Plain sentences only: no markdown, no bullet symbols, no emoji. If you give steps, say "पहला", "दूसरा" / "First", "Second".
- At most 4 short sentences, or 3 short steps. One idea per sentence.
- Be calm and reassuring. Never blame them. Never say "you should have known".
- Always end with ONE clear next step they can do right now.
- Never ask for, and tell them never to share, OTP, PIN, passwords, card or Aadhaar numbers. If they type one, tell them gently not to share it with anyone, including you.
- You cannot approve or send payments. Their family member decides on held payments.

FACTS YOU CAN STATE WITH CONFIDENCE:
- There is no "digital arrest" in Indian law. Police, CBI, ED, customs, RBI and banks never ask for money on a phone or video call.
- Banks never ask for KYC through a link in an SMS or WhatsApp. Never share an OTP or UPI PIN. You never need your PIN to receive money.
- If money has been sent to a scammer, calling 1930 quickly gives the best chance of stopping it.
${ctx ? `\nCURRENT SITUATION (from सतर्कPay, use it): ${ctx}` : ''}`;

function contextLine(p) {
  if (!p) return '';
  return `She tried to send ${p.currency} ${p.amount} to "${p.payeeName}" (${p.payeeEmail}) with the note "${p.note || ''}". `
    + `सतर्कPay rated it ${p.risk?.score}/100 risk (${p.risk?.scamType}). Status: ${p.status}. `
    + `Reasons: ${(p.risk?.reasons || []).map(r => r.en).join(' ')} `
    + (p.status === 'held' ? 'The money is on hold and has NOT left her account. Her family member has been asked to approve or block it.' : '');
}

/* Offline answers so the demo still works without an AI key. */
const OFFLINE = [
  { k: ['customs', 'parcel', 'courier', 'drugs', 'ड्रग्स', 'पार्सल', 'कस्टम', 'कूरियर', 'fedex', 'dhl'],
    hi: 'यह कूरियर या कस्टम वाला धोखा है। कोई भी कस्टम या पुलिस अधिकारी फ़ोन पर पैसे या जुर्माना नहीं माँगता, और पार्सल में ड्रग्स की बात डराने के लिए कही जाती है। अभी फ़ोन काट दीजिए, कोई पैसा मत भेजिए, और 1930 पर इसकी शिकायत कीजिए।',
    en: 'This is a courier or customs scam. No customs or police officer asks for money or a fine on a phone call, and the talk of drugs in your parcel is meant to scare you. Hang up now, send nothing, and report it on 1930.' },
  { k: ['lottery', 'prize', 'kbc', 'won', 'लॉटरी', 'इनाम', 'जीत'],
    hi: 'अगर इनाम जीतने के लिए पहले पैसे भरने पड़ें, तो वह धोखा है। असली इनाम के लिए कभी फीस नहीं लगती। कोई पैसा मत भेजिए और नंबर ब्लॉक कर दीजिए।',
    en: 'If you must pay to receive a prize, it is a scam. Real prizes never need a fee. Send nothing and block the number.' },
  { k: ['job', 'task', 'like videos', 'part time', 'नौकरी', 'टास्क', 'काम'],
    hi: 'घर बैठे वीडियो लाइक करके पैसे कमाने वाले काम धोखा होते हैं। पहले थोड़े पैसे देते हैं, फिर बड़ी रकम जमा करवाते हैं। कोई पैसा जमा मत कीजिए।',
    en: 'Jobs that pay you to like videos or do small tasks are scams. They pay a little first, then ask for a big deposit. Do not deposit anything.' },
  { k: ['mistake', 'galti', 'गलती', 'wapas', 'वापस', 'return'],
    hi: 'अगर कोई कहे कि उसने गलती से पैसे भेज दिए, तो पहले अपने बैंक ऐप में देखिए कि पैसा सच में आया है या नहीं। अक्सर वह सिर्फ़ नकली मैसेज होता है। खुद से कुछ वापस मत भेजिए, बैंक से बात कीजिए।',
    en: 'If someone says they sent you money by mistake, first check your bank app to see if it really arrived. It is often just a fake message. Do not send anything back yourself; talk to your bank.' },
  { k: ['electricity', 'bijli', 'बिजली', 'light cut', 'disconnect'],
    hi: 'बिजली कटने का डर दिखाकर पैसे माँगने वाले मैसेज धोखा होते हैं। बिल सिर्फ़ बिजली विभाग की असली वेबसाइट या ऐप से भरिए। मैसेज वाले नंबर पर फ़ोन मत कीजिए।',
    en: 'Messages threatening to cut your electricity tonight are scams. Pay bills only on the official website or app. Do not call the number in the message.' },
  { k: ['invest', 'stock', 'share', 'trading', 'returns', 'निवेश', 'शेयर'],
    hi: 'जो कोई पक्का या दोगुना मुनाफ़ा देने का वादा करे, वह धोखा है। WhatsApp या Telegram ग्रुप की टिप्स पर पैसे मत लगाइए। पहले परिवार से बात कीजिए।',
    en: 'Anyone promising guaranteed or double returns is running a scam. Do not invest on tips from WhatsApp or Telegram groups. Talk to your family first.' },
  { k: ['grandson', 'son', 'beta', 'बेटा', 'पोता', 'accident', 'hospital', 'अस्पताल', 'jail', 'जेल'],
    hi: 'अगर कोई कहे कि आपका बेटा या पोता मुसीबत में है और तुरंत पैसे चाहिए, तो पहले फ़ोन काटकर सीधे उसी को फ़ोन कीजिए। धोखेबाज़ घबराहट का फ़ायदा उठाते हैं।',
    en: 'If someone says your son or grandson is in trouble and needs money now, hang up and call him directly first. Scammers use panic.' },
  { k: ['digital arrest', 'arrest', 'cbi', 'police', 'गिरफ्तार', 'पुलिस', 'अरेस्ट'],
    hi: 'घबराइए मत। डिजिटल अरेस्ट जैसी कोई चीज़ कानून में नहीं होती। पुलिस या CBI कभी भी फ़ोन पर पैसे नहीं माँगती। अभी फ़ोन काट दीजिए और अपने परिवार को फ़ोन कीजिए।',
    en: "Don't worry. There is no such thing as a digital arrest. Police and CBI never ask for money on a call. Hang up now and call your family." },
  { k: ['kyc', 'केवाईसी', 'link', 'लिंक'],
    hi: 'बैंक कभी भी SMS या WhatsApp के लिंक से KYC नहीं करवाते। उस लिंक को मत खोलिए। अगर शक हो तो अपनी बैंक शाखा जाइए या बैंक के नंबर पर फ़ोन कीजिए।',
    en: 'Banks never ask for KYC through a link in a message. Do not open that link. If you are unsure, visit your bank branch.' },
  { k: ['otp', 'pin', 'पिन', 'ओटीपी'],
    hi: 'OTP और UPI पिन किसी को भी मत बताइए, मुझे भी नहीं। पैसे लेने के लिए कभी पिन की ज़रूरत नहीं होती। अगर किसी ने माँगा है, तो वह धोखेबाज़ है।',
    en: 'Never share your OTP or UPI PIN with anyone, not even me. You never need a PIN to receive money. Anyone asking for it is a scammer.' },
  { k: ['sent', 'gone', 'chala gaya', 'भेज दिया', 'चला गया', 'कट गया', 'already'],
    hi: 'पहला, तुरंत 1930 पर फ़ोन कीजिए। दूसरा, अपने बैंक को फ़ोन करके खाता रोकने को कहिए। तीसरा, cybercrime.gov.in पर शिकायत दर्ज कीजिए। जितनी जल्दी करेंगे, पैसा वापस मिलने की उम्मीद उतनी ज़्यादा है।',
    en: 'First, call 1930 right now. Second, call your bank and ask them to block the account. Third, report it on cybercrime.gov.in. The faster you act, the better the chance.' },
];
function offline(text, lang, payment) {
  const t = text.toLowerCase();
  if (payment && /(why|क्यों|kyon|hold|रोका)/.test(t)) return lang === 'hi' ? payment.risk.explain.hi + ' ' + payment.risk.advice.hi : payment.risk.explain.en + ' ' + payment.risk.advice.en;
  const hit = OFFLINE.find(o => o.k.some(k => t.includes(k)));
  if (hit) return hit[lang];
  return lang === 'hi'
    ? 'मैं पैसों की सुरक्षा और धोखाधड़ी से जुड़े सवालों में मदद करता हूँ। बताइए, किसी कॉल या मैसेज ने आपको परेशान किया है?'
    : 'I help with money safety and scams. Tell me, did a call or message worry you?';
}

export async function askSaathi({ messages, lang = 'hi', payment }) {
  const clean = messages.filter(m => m && typeof m.content === 'string' && m.content.trim()).slice(-12)
    .map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content.slice(0, 2000) }));
  while (clean.length && clean[0].role !== 'user') clean.shift();
  if (!clean.length) return { reply: '', by: 'none' };
  const question = clean[clean.length - 1].content;
  const aboutHeld = payment && /(why|क्यों|kyon|hold|रोका|this payment|यह पेमेंट)/i.test(question);
  const standalone = clean.filter(m => m.role === 'user').length === 1;

  // 1. Seen a question like this before? Answer instantly from memory.
  if (!aboutHeld) {
    const hit = recall(question, lang);
    if (hit) return { reply: hit.answer, by: 'memory', score: hit.score };
  }
  // 2. New question: ask the AI, and remember the answer for next time.
  if (aiEnabled) {
    try {
      const reply = (await complete(SYSTEM(lang, contextLine(payment)), clean, { maxTokens: 400, timeoutMs: SAATHI_TIMEOUT })).replace(/[*#_`]+/g, '').trim();
      // Only general, first questions are saved: answers about one payment or one conversation stay private.
      const learned = standalone && !payment ? learn(question, reply, lang) : false;
      return { reply, by: 'ai', learned };
    } catch (e) { console.warn('Saathi AI failed:', e.message); }
  }
  // 3. AI unavailable: closest saved answer, then the built-in keyword answers.
  const near = !aboutHeld && recall(question, lang, 0.3);
  if (near) return { reply: near.answer, by: 'memory', score: near.score };
  return { reply: offline(question, lang, payment), by: 'offline' };
}
