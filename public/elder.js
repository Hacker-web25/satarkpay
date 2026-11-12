// सतर्कPay elder app
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const api = async (url, body) => {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const T = {
  hi: {
    hello: 'नमस्ते, कमला जी', homeSub: 'आज क्या करना है?', sendMoney: 'पैसे भेजें', askSaathi: 'साथी से पूछें',
    guardianOn: 'आपका बेटा राहुल आपके साथ है। बड़े या अजीब पेमेंट पर हम पहले उससे पूछेंगे।', checkLink: 'कोई नंबर या लिंक जाँचें',
    recent: 'हाल के पेमेंट', back: 'पीछे', sendTitle: 'किसे पैसे भेजने हैं?', fName: 'पाने वाले का नाम', fEmail: 'उनका PayPal ईमेल', fAmount: 'कितने पैसे',
    fNote: 'किस लिए? (नोट)', callerQ: 'क्या इस समय कोई फ़ोन पर आपसे यह पैसे भेजने को कह रहा है?', yes: 'हाँ', no: 'नहीं', continue: 'आगे बढ़ें',
    tryDemo: 'डेमो भरें:', demoSafe: 'दवा की दुकान', demoScam: '"RBI सेफ़ कस्टडी"', payTitle: 'PayPal से भेजें',
    payHint: 'आप PayPal में मंज़ूरी देंगी। सतर्कPay पहले पैसा रोककर जाँच करेगा, फिर भेजेगा।', demoPay: 'PayPal से भेजें (डेमो)',
    demoNote: 'डेमो मोड: PayPal सैंडबॉक्स की चाबियाँ नहीं लगी हैं, इसलिए यह नकली PayPal है।',
    checking: 'जाँच हो रही है…', checkingSub: 'पैसा रोका गया है। सतर्कPay देख रहा है कि यह सुरक्षित है या नहीं।',
    sentBig: 'पैसे भेज दिए गए', sentSub: (p) => `${p.payeeName} को ${money(p)} भेज दिए गए।`,
    heldBig: 'रुकिए।', heldMain: 'यह पैसा अभी नहीं गया है।', waiting: 'राहुल से पूछा गया है। उनके जवाब का इंतज़ार है।',
    talk: 'साथी से बात करें', listen: 'सुनिए', cancelPay: 'पेमेंट रद्द करें', home: 'होम पर जाएँ',
    blockedBig: 'आपका पैसा सुरक्षित है', blockedSub: 'राहुल ने यह पेमेंट रोक दिया। एक भी रुपया नहीं गया। यह खाता दूसरों के लिए भी चिह्नित कर दिया गया है।',
    cancelledBig: 'पेमेंट रद्द हो गया', cancelledSub: 'कोई पैसा नहीं गया। आपका पैसा सुरक्षित है।',
    approvedSub: (p) => `राहुल ने मंज़ूरी दी। ${p.payeeName} को ${money(p)} भेज दिए गए।`,
    errorBig: 'कुछ गड़बड़ हो गई', risk: 'जोखिम', checkTitle: 'नंबर, UPI ID या लिंक जाँचें', checkLabel: 'जो किसी ने भेजा है, यहाँ लिखें', checkBtn: 'जाँचें',
    saathiName: 'साथी', saathiSub: 'धोखाधड़ी और पेमेंट से जुड़े सवालों में मदद', autoSpeak: 'बोलकर सुनाएँ', typeHere: 'यहाँ लिखें', listening: 'सुन रहा हूँ… बोलिए',
    placeholder: 'बोलें या यहाँ लिखें…', greet: 'नमस्ते! मैं साथी हूँ। किसी कॉल, मैसेज या पेमेंट से परेशान हैं? माइक दबाकर बोलिए या लिखिए।',
    greetPay: 'मैंने आपका रुका हुआ पेमेंट देखा है। आप पूछ सकती हैं कि इसे क्यों रोका गया, या आगे क्या करें।',
    chips: ['यह पेमेंट क्यों रोका?', 'कोई कह रहा है मैं डिजिटल अरेस्ट में हूँ', 'KYC अपडेट का मैसेज आया है', 'मेरे पैसे कट गए, क्या करूँ?'],
    footHelp: 'मदद चाहिए? साइबर धोखाधड़ी हेल्पलाइन 1930।', familyLink: 'परिवार का ऐप देखें', empty: 'अभी कोई पेमेंट नहीं।',
    status: { sent: 'भेजा गया', held: 'रुका हुआ', blocked: 'रोका गया', cancelled: 'रद्द', created: 'शुरू', authorized: 'जाँच में', captured: 'भेजा जा रहा', error: 'त्रुटि' },
    needCaller: 'कृपया बताइए: क्या कोई फ़ोन पर पैसे भेजने को कह रहा है?', needFields: 'नाम, ईमेल और रकम भरिए।', noVoice: 'इस ब्राउज़र में बोलकर लिखना नहीं चलता। कृपया लिखिए।',
  },
  en: {
    hello: 'Namaste, Kamla ji', homeSub: 'What would you like to do?', sendMoney: 'Send money', askSaathi: 'Ask Saathi',
    guardianOn: 'Your son Rahul is with you. For big or unusual payments, we ask him first.', checkLink: 'Check a number or link',
    recent: 'Recent payments', back: 'Back', sendTitle: 'Who do you want to pay?', fName: "Their name", fEmail: 'Their PayPal email', fAmount: 'How much',
    fNote: 'What is it for? (note)', callerQ: 'Is someone on a phone call asking you to send this money right now?', yes: 'Yes', no: 'No', continue: 'Continue',
    tryDemo: 'Fill a demo:', demoSafe: 'Medicine shop', demoScam: '"RBI Safe Custody"', payTitle: 'Pay with PayPal',
    payHint: 'You approve in PayPal. सतर्कPay holds the money first, checks it, then sends it.', demoPay: 'Pay with PayPal (demo)',
    demoNote: 'Demo mode: PayPal sandbox keys are not set, so this is a simulated PayPal.',
    checking: 'Checking…', checkingSub: 'The money is on hold. सतर्कPay is checking whether it is safe.',
    sentBig: 'Money sent', sentSub: (p) => `${money(p)} sent to ${p.payeeName}.`,
    heldBig: 'Wait.', heldMain: 'This money has not been sent.', waiting: 'We have asked Rahul. Waiting for his answer.',
    talk: 'Talk to Saathi', listen: 'Listen', cancelPay: 'Cancel payment', home: 'Go home',
    blockedBig: 'Your money is safe', blockedSub: 'Rahul blocked this payment. Not a single rupee left. The account has been flagged for other families too.',
    cancelledBig: 'Payment cancelled', cancelledSub: 'No money was sent. Your money is safe.',
    approvedSub: (p) => `Rahul approved it. ${money(p)} sent to ${p.payeeName}.`,
    errorBig: 'Something went wrong', risk: 'Risk', checkTitle: 'Check a number, UPI ID or link', checkLabel: 'Type what someone sent you', checkBtn: 'Check',
    saathiName: 'Saathi', saathiSub: 'Help with scams and payments', autoSpeak: 'Read replies aloud', typeHere: 'Type here', listening: 'Listening… please speak',
    placeholder: 'Speak or type here…', greet: "Namaste! I'm Saathi. Is a call, message or payment worrying you? Press the mic and speak, or type.",
    greetPay: "I can see your held payment. You can ask me why it was stopped, or what to do next.",
    chips: ['Why was this payment stopped?', 'Someone says I am under digital arrest', 'I got a KYC update message', 'Money was taken, what do I do?'],
    footHelp: 'Need help? Cyber fraud helpline 1930.', familyLink: 'See the family app', empty: 'No payments yet.',
    status: { sent: 'Sent', held: 'On hold', blocked: 'Blocked', cancelled: 'Cancelled', created: 'Started', authorized: 'Checking', captured: 'Sending', error: 'Error' },
    needCaller: 'Please tell us: is someone on a call asking you to pay?', needFields: 'Fill in the name, email and amount.', noVoice: 'Voice typing is not available in this browser. Please type.',
  },
};

let lang = localStorageGet('sp_lang') || 'hi';
let cfg = { paypal: { enabled: false, currency: 'USD' } };
let current = null, poll = null, chat = [], spoken = new Set();
const money = p => `${p.currency === 'USD' ? '$' : p.currency + ' '}${Number(p.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const t = k => T[lang][k];
function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch {} }

/* ---------- language & size ---------- */
function applyLang() {
  document.documentElement.lang = lang;
  document.body.setAttribute('lang-ui', lang);
  $$('[data-t]').forEach(el => { const v = T[lang][el.dataset.t]; if (typeof v === 'string') el.textContent = v; });
  $$('[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
  $('#sText').placeholder = t('placeholder');
  renderChips();
  if (current && !$('[data-screen="status"]').hidden) renderStatus(current);
  loadRecent();
}
$$('[data-lang]').forEach(b => b.addEventListener('click', () => { lang = b.dataset.lang; localStorageSet('sp_lang', lang); applyLang(); }));
$$('[data-size]').forEach(b => b.addEventListener('click', () => {
  document.body.dataset.size = b.dataset.size;
  $$('[data-size]').forEach(x => x.setAttribute('aria-pressed', x === b));
}));

/* ---------- navigation ---------- */
function show(name) {
  $$('.screen').forEach(s => { s.hidden = s.dataset.screen !== name; });
  scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  const h = $(`[data-screen="${name}"] h1, [data-screen="${name}"] .hello`); if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  if (name !== 'status') stopPoll();
}
$$('[data-go]').forEach(b => b.addEventListener('click', () => { show(b.dataset.go); if (b.dataset.go === 'home') loadRecent(); }));

/* ---------- recent payments ---------- */
async function loadRecent() {
  try {
    const { payments } = await api('/api/payments');
    const ul = $('#recent');
    const list = payments.filter(p => p.status !== 'created').slice(0, 6);
    ul.innerHTML = list.length ? list.map(p => `<li><div><div class="who">${esc(p.payeeName)}<span class="pill ${p.status}">${esc(t('status')[p.status] || p.status)}</span></div><div class="meta">${new Date(p.createdAt).toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short' })}</div></div><div class="amt">${money(p)}</div></li>`).join('') : `<li><span class="meta">${t('empty')}</span></li>`;
  } catch { /* offline */ }
}

/* ---------- send form ---------- */
const DEMO = {
  safe: { payeeName: 'Sharma Medical Store', payeeEmail: 'sharma.medical@example.com', amount: '42', note: 'Monthly medicines', callerAsked: 'no' },
  scam: { payeeName: 'RBI Safe Custody A/c', payeeEmail: 'rbi.safecustody@example.com', amount: '2400', note: 'Verification refund, do not tell anyone', callerAsked: 'yes' },
};
$$('[data-fill]').forEach(b => b.addEventListener('click', () => {
  const d = DEMO[b.dataset.fill], f = $('#sendForm');
  for (const [k, v] of Object.entries(d)) {
    if (k === 'callerAsked') f.querySelector(`input[name=callerAsked][value=${v}]`).checked = true;
    else f.elements[k].value = v;
  }
}));
$('#sendForm').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target, err = $('#formError'); err.textContent = '';
  const caller = f.querySelector('input[name=callerAsked]:checked');
  if (!f.payeeName.value.trim() || !f.payeeEmail.value.trim() || !(+f.amount.value > 0)) { err.textContent = t('needFields'); return; }
  if (!caller) { err.textContent = t('needCaller'); return; }
  const btn = f.querySelector('.cta'); btn.disabled = true;
  try {
    const { payment } = await api('/api/payments', { payeeName: f.payeeName.value, payeeEmail: f.payeeEmail.value, amount: +f.amount.value, note: f.note.value, callerAsked: caller.value === 'yes' });
    current = payment; chat = []; spoken = new Set();
    $('#sumAmt').textContent = money(payment);
    $('#sumTo').textContent = `${payment.payeeName} · ${payment.payeeEmail}`;
    $('#sumNote').textContent = payment.note ? `"${payment.note}"` : '';
    show('pay');
    renderPayButtons();
  } catch (x) { err.textContent = x.message; }
  finally { btn.disabled = false; }
});

/* ---------- PayPal ---------- */
let sdkPromise = null;
function loadSdk() {
  if (!cfg.paypal.enabled) return Promise.resolve(null);
  if (!sdkPromise) sdkPromise = new Promise((ok, no) => {
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(cfg.paypal.clientId)}&currency=${cfg.paypal.currency}&intent=authorize&components=buttons`;
    s.onload = () => ok(window.paypal); s.onerror = () => no(new Error('PayPal could not load'));
    document.head.appendChild(s);
  });
  return sdkPromise;
}
async function renderPayButtons() {
  const box = $('#paypalButtons'); box.innerHTML = '';
  if (!cfg.paypal.enabled) { $('#demoPay').hidden = false; $('#demoNote').hidden = false; return; }
  $('#demoPay').hidden = true; $('#demoNote').hidden = true;
  try {
    const pp = await loadSdk();
    pp.Buttons({
      style: { layout: 'vertical', color: 'gold', shape: 'pill', label: 'pay', height: 55 },
      createOrder: () => current.orderId,
      onApprove: () => authorize(),
      onError: err => { box.insertAdjacentHTML('beforeend', `<p class="form-error">${esc(err.message || 'PayPal error')}</p>`); },
    }).render(box);
  } catch (e) { box.innerHTML = `<p class="form-error">${esc(e.message)}</p>`; }
}
$('#demoPay').addEventListener('click', () => authorize());

async function authorize() {
  show('status'); renderChecking();
  const started = Date.now();
  try {
    const { payment } = await api(`/api/payments/${current.id}/authorize`, {});
    await new Promise(r => setTimeout(r, Math.max(0, 1600 - (Date.now() - started)))); // let the check be seen
    current = payment; renderStatus(payment);
    if (payment.status === 'held') startPoll();
  } catch (e) { renderError(e.message); }
}

/* ---------- status screens ---------- */
const ICON = {
  shield: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 2 3 5.5V12c0 5.3 3.8 9.6 9 11 5.2-1.4 9-5.7 9-11V5.5Z"/><path d="M10 8v7M14 8v7"/></svg>',
  check: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  safe: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M12 2 3 5.5V12c0 5.3 3.8 9.6 9 11 5.2-1.4 9-5.7 9-11V5.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
  chat: '<svg viewBox="0 0 24 24" class="ic" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>',
};
function renderChecking() {
  $('#state').innerHTML = `<div class="st-icon wait">${ICON.shield}</div><p class="st-main">${t('checking')}</p><p class="st-body">${t('checkingSub')}</p>`;
}
function renderError(msg) {
  $('#state').innerHTML = `<p class="st-big">${t('errorBig')}</p><p class="st-body">${esc(msg)}</p><button class="cta ghost" data-act="home">${t('home')}</button>`;
  bindState();
}
function renderStatus(p) {
  const s = $('#state');
  if (p.status === 'held') {
    const r = p.risk;
    s.innerHTML = `<div class="st-icon hold">${ICON.shield}</div>
      <p class="st-big">${t('heldBig')}</p><p class="st-main">${t('heldMain')}</p>
      <span class="risk-chip">${t('risk')} ${r.score}/100 · ${esc(r.scamType)}</span>
      <p class="st-body" id="explain">${esc(r.explain[lang])} ${esc(r.advice[lang])}</p>
      <ul class="why">${r.reasons.slice(0, 3).map(x => `<li>${esc(x[lang])}</li>`).join('')}</ul>
      <div class="waiting"><span class="dot"></span>${t('waiting')}</div>
      <div class="row2">
        <button class="listen" data-act="listen">${ICON.speaker}${t('listen')}</button>
        <button class="cta" data-act="saathi">${t('talk')}</button>
        <button class="cta ghost" data-act="cancel">${t('cancelPay')}</button>
      </div>`;
    if (!spoken.has(p.id + 'held')) { spoken.add(p.id + 'held'); speak(`${t('heldBig')} ${t('heldMain')} ${r.explain[lang]} ${r.advice[lang]}`); }
  } else if (p.status === 'sent' || p.status === 'captured') {
    const sub = p.approvedBy === 'guardian' ? T[lang].approvedSub(p) : T[lang].sentSub(p);
    s.innerHTML = `<div class="st-icon ok">${ICON.check}</div><p class="st-big green">${t('sentBig')}</p><p class="st-body">${esc(sub)}</p><button class="cta ghost" data-act="home">${t('home')}</button>`;
    if (!spoken.has(p.id + 'sent')) { spoken.add(p.id + 'sent'); speak(sub); }
  } else if (p.status === 'blocked' || p.status === 'cancelled') {
    const big = p.status === 'blocked' ? t('blockedBig') : t('cancelledBig');
    const sub = p.status === 'blocked' ? t('blockedSub') : t('cancelledSub');
    s.innerHTML = `<div class="st-icon stop">${ICON.safe}</div><p class="st-big green">${big}</p><p class="st-body">${sub}</p>
      <div class="row2"><button class="cta" data-act="saathi">${t('talk')}</button><button class="cta ghost" data-act="home">${t('home')}</button></div>`;
    if (!spoken.has(p.id + p.status)) { spoken.add(p.id + p.status); speak(`${big}. ${sub}`); }
  } else if (p.status === 'error') { renderError(p.error || ''); return; }
  else renderChecking();
  bindState();
}
function bindState() {
  $$('#state [data-act]').forEach(b => b.addEventListener('click', async () => {
    const a = b.dataset.act;
    if (a === 'home') { show('home'); loadRecent(); }
    if (a === 'listen') { const r = current.risk; speak(`${t('heldMain')} ${r.explain[lang]} ${r.advice[lang]}`, true); }
    if (a === 'saathi') openSaathi(current);
    if (a === 'cancel') { b.disabled = true; try { const { payment } = await api(`/api/payments/${current.id}/cancel`, {}); current = payment; stopPoll(); renderStatus(payment); } catch (e) { b.disabled = false; alertInline(e.message); } }
  }));
}
function alertInline(m) { $('#state').insertAdjacentHTML('beforeend', `<p class="form-error" role="alert">${esc(m)}</p>`); }
function startPoll() {
  stopPoll();
  poll = setInterval(async () => {
    try {
      const { payment } = await api(`/api/payments/${current.id}`);
      if (payment.status !== current.status) { current = payment; renderStatus(payment); if (payment.status !== 'held') stopPoll(); }
    } catch {}
  }, 2000);
}
function stopPoll() { clearInterval(poll); poll = null; }

/* ---------- speech out ---------- */
function speak(text, force) {
  const synth = window.speechSynthesis;
  if (!synth || (!force && !$('#autoSpeak').checked)) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; u.rate = 0.88;
  const v = synth.getVoices().find(v => v.lang?.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en-in')) || synth.getVoices().find(v => v.lang?.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en'));
  if (v) u.voice = v;
  synth.speak(u);
}
window.speechSynthesis?.getVoices();

/* ---------- Saathi ---------- */
const dlg = $('#saathi'); let opener = null, ctxPayment = null;
function openSaathi(payment) {
  opener = document.activeElement; ctxPayment = payment || null;
  dlg.hidden = false; document.body.style.overflow = 'hidden';
  if (!chat.length) addBot(ctxPayment ? t('greetPay') : t('greet'), false);
  renderChips();
  $('#sText').focus();
}
function closeSaathi() { dlg.hidden = true; document.body.style.overflow = ''; window.speechSynthesis?.cancel(); stopMic(); opener?.focus?.(); }
$$('[data-open-saathi]').forEach(b => b.addEventListener('click', () => openSaathi(null)));
$('#saathiClose').addEventListener('click', closeSaathi);
dlg.addEventListener('keydown', e => { if (e.key === 'Escape') closeSaathi(); });

function renderChips() {
  const chips = T[lang].chips.filter((c, i) => i !== 0 || ctxPayment);
  $('#sChips').innerHTML = chips.map(c => `<button type="button">${esc(c)}</button>`).join('');
  $$('#sChips button').forEach(b => b.addEventListener('click', () => sendMsg(b.textContent)));
}
function addMe(text) { $('#sBody').insertAdjacentHTML('beforeend', `<div class="msg me">${esc(text)}</div>`); scrollChat(); }
function addBot(text, say = true) {
  const el = document.createElement('div'); el.className = 'msg bot';
  el.innerHTML = `${esc(text)}<br><button type="button" class="replay">${ICON.speaker}${t('listen')}</button>`;
  el.querySelector('.replay').addEventListener('click', () => speak(text, true));
  $('#sBody').appendChild(el); scrollChat();
  chat.push({ role: 'assistant', content: text });
  if (say) speak(text);
}
function scrollChat() { const b = $('#sBody'); b.scrollTop = b.scrollHeight; }
let busy = false;
async function sendMsg(text) {
  text = text.trim(); if (!text || busy) return;
  busy = true; $('#sText').value = '';
  addMe(text); chat.push({ role: 'user', content: text });
  const typing = document.createElement('div'); typing.className = 'msg bot typing';
  typing.innerHTML = '<span class="typing-dots"><i></i><i></i><i></i></span>'; $('#sBody').appendChild(typing); scrollChat();
  // A new question goes to the AI and can take a while: say so, so nobody thinks the app froze.
  const slow = setTimeout(() => typing.insertAdjacentHTML('beforeend', `<div class="offline-tag">${lang === 'hi' ? 'नया सवाल है, सोच रहा हूँ…' : 'A new question, thinking it through…'}</div>`), 3500);
  try {
    const { reply, by, learned } = await api('/api/saathi', { messages: chat.filter((m, i) => !(i === 0 && m.role === 'assistant')), lang, paymentId: ctxPayment?.id });
    clearTimeout(slow); typing.remove(); addBot(reply);
    const tag = { memory: lang === 'hi' ? 'सेव जवाब · तुरंत' : 'Saved answer · instant',
      offline: lang === 'hi' ? 'ऑफ़लाइन जवाब' : 'Offline answer',
      ai: learned ? (lang === 'hi' ? 'नया जवाब · अगली बार तुरंत मिलेगा' : 'New answer · saved for next time') : '' }[by];
    if (tag) $('#sBody').lastElementChild.insertAdjacentHTML('beforeend', `<div class="offline-tag ${by}">${tag}</div>`);
  } catch (e) { clearTimeout(slow); typing.remove(); addBot(lang === 'hi' ? 'माफ़ कीजिए, अभी जवाब नहीं आ पाया। अगर कोई आपसे पैसे माँग रहा है, तो फ़ोन काटिए और 1930 पर कॉल कीजिए।' : "Sorry, I couldn't answer just now. If someone is asking you for money, hang up and call 1930."); }
  finally { busy = false; }
}
$('#sForm').addEventListener('submit', e => { e.preventDefault(); sendMsg($('#sText').value); });

/* ---------- voice in (Web Speech API, Hindi or English) ---------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let rec = null, listening = false;
function stopMic() { if (rec && listening) rec.stop(); }
$('#mic').addEventListener('click', () => {
  if (!SR) { addBot(t('noVoice'), false); return; }
  if (listening) { rec.stop(); return; }
  window.speechSynthesis?.cancel();
  rec = new SR(); rec.lang = lang === 'hi' ? 'hi-IN' : 'en-IN'; rec.interimResults = true; rec.continuous = false;
  let finalText = '';
  rec.onstart = () => { listening = true; $('#mic').classList.add('on'); $('#listening').hidden = false; };
  rec.onresult = ev => {
    let interim = ''; finalText = '';
    for (const r of ev.results) (r.isFinal ? (finalText += r[0].transcript) : (interim += r[0].transcript));
    $('#sText').value = finalText || interim;
  };
  rec.onerror = () => {};
  rec.onend = () => { listening = false; $('#mic').classList.remove('on'); $('#listening').hidden = true; const v = $('#sText').value.trim(); if (v) sendMsg(v); };
  rec.start();
});

/* ---------- checker ---------- */
$('#checkForm').addEventListener('submit', async e => {
  e.preventDefault();
  const q = $('#checkQ').value.trim(); if (!q) return;
  try {
    const r = await api('/api/check', { q });
    $('#checkOut').innerHTML = `<div class="verdict ${r.level}"><h2>${esc(r.title)}</h2><p><strong>${t('risk')} ${r.score}/100</strong></p>${r.reasons.map(x => `<p>${esc(x)}</p>`).join('')}<p><strong>${esc(r.advice)}</strong></p></div>`;
  } catch (x) { $('#checkOut').innerHTML = `<p class="form-error">${esc(x.message)}</p>`; }
});

/* ---------- boot ---------- */
(async () => {
  try { cfg = await api('/api/config'); } catch {}
  $$('.cur').forEach(c => c.textContent = cfg.paypal?.currency || 'USD');
  applyLang();
  if (cfg.paypal?.enabled) loadSdk().catch(() => {});
  const q = new URLSearchParams(location.search);
  if (q.get('saathi') === '1') openSaathi(null);
})();
