import { createScene } from './scene.js';

const gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
gsap.registerPlugin(ScrollTrigger);
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduced && window.Lenis) {
  lenis = new window.Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { offset: typeof target === 'number' ? 0 : -72, duration: 1.4 });
  else window.scrollTo({ top: typeof target === 'number' ? target : target.getBoundingClientRect().top + scrollY - 72 });
};

/* ---------- nav ---------- */
const nav = $('.nav');
const onScroll = () => nav.classList.toggle('scrolled', scrollY > 10);
addEventListener('scroll', onScroll, { passive: true }); onScroll();

/* ---------- 3D scene ---------- */
let scene3d = null;
try { scene3d = createScene($('#gl'), { reduced }); }
catch (e) { document.documentElement.classList.add('no-webgl'); $('#gl').style.display = 'none'; }

/* ---------- fit phones to the stage ---------- */
function fitPhone() {
  const stage = $('.stage'), wrap = $('.phone-wrap');
  const small = innerWidth < 980;
  const s = Math.min(1, (stage.clientHeight - (small ? 8 : 40)) / 630, stage.clientWidth / (small ? 330 : 470));
  wrap.style.setProperty('--ps', Math.max(0.42, s).toFixed(3));
  wrap.style.transformOrigin = small ? 'top center' : 'center center';
}
fitPhone();
addEventListener('resize', fitPhone);

/* ---------- intro: one orchestrated moment ---------- */
gsap.set('.main-phone', { rotationY: -14, rotationX: 4, transformPerspective: 1600 });
if (!reduced) {
  const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
  intro.from('.hero-title .line > span', { yPercent: 110, duration: 1.2, stagger: 0.09 }, 0.15)
    .from('.hero-copy .lead, .hero-copy .ctas, .hero-copy .fact', { y: 24, autoAlpha: 0, duration: 1, stagger: 0.08 }, 0.55)
    .from('.tilt', { y: 90, rotationY: -38, rotationX: 12, autoAlpha: 0, duration: 1.8 }, 0.25)
    .from('.nav-inner > *', { y: -16, autoAlpha: 0, duration: 0.9, stagger: 0.06 }, 0.1)
    .from('.scroll-hint', { autoAlpha: 0, duration: 0.8 }, 1.2);
  // cursor tilt starts once the phone has landed
  intro.call(() => {
    if (!matchMedia('(pointer:fine)').matches) return;
    const rx = gsap.quickTo('.tilt', 'rotationX', { duration: 0.9, ease: 'power3' });
    const ry = gsap.quickTo('.tilt', 'rotationY', { duration: 0.9, ease: 'power3' });
    addEventListener('pointermove', e => {
      const inJourney = scrollY < journeyST.end;
      rx(inJourney ? (e.clientY / innerHeight - 0.5) * -8 : 0);
      ry(inJourney ? (e.clientX / innerWidth - 0.5) * 10 : 0);
    });
  }, null, 1.4);
}

/* ---------- the journey: pinned scam story ---------- */
const L = i => `.layer[data-layer="${i}"]`;
const IN = { autoAlpha: 1, y: 0, duration: 0.5, ease: 'power2.out' };
const OUT = { autoAlpha: 0, y: -40, duration: 0.4, ease: 'power2.in' };
const STEP_AT = [0.6, 2.25, 3.85, 5.35, 6.85];
const tl = gsap.timeline({ defaults: { ease: 'power2.inOut' } });
const fromIn = (sel, at) => tl.fromTo(sel, { autoAlpha: 0, y: 40 }, IN, at);

// 1 · the call
tl.to('.hero-copy', OUT, 0.1)
  .to('.scroll-hint', { autoAlpha: 0, duration: 0.3 }, 0)
  .to('.rail', { autoAlpha: 1, duration: 0.3 }, 0.5)
  .to('.scr-teaser', { autoAlpha: 0, duration: 0.3 }, 0.3)
  .to('.scr-call', { autoAlpha: 1, duration: 0.3 }, 0.45)
  .to('.main-phone', { rotationY: 0, rotationX: 0, duration: 0.6 }, 0.3);
fromIn(L(1), STEP_AT[0]);
tl.from('.scr-call .bubble', { autoAlpha: 0, y: 16, scale: 0.96, stagger: 0.24, duration: 0.25, ease: 'back.out(2)' }, 0.8);

// 2 · pay, and the hold
tl.to(L(1), OUT, 1.8).to('.scr-call', { autoAlpha: 0, duration: 0.3 }, 1.85).to('.scr-pay', { autoAlpha: 1, duration: 0.3 }, 2.0);
fromIn(L(2), STEP_AT[1]);
tl.fromTo('.knob', { x: 0 }, { x: () => $('.slider').offsetWidth - 60, duration: 0.5, ease: 'power1.inOut' }, 2.3)
  .to('.hold-overlay', { autoAlpha: 1, duration: 0.35 }, 2.85)
  .from('.hold-ring', { scale: 0.5, duration: 0.45, ease: 'back.out(2.2)' }, 2.85)
  .from('.hold-title, .hold-sub', { y: 12, autoAlpha: 0, stagger: 0.1, duration: 0.3 }, 3.0);

// 3 · explained
tl.to(L(2), OUT, 3.4).to('.scr-pay', { autoAlpha: 0, duration: 0.3 }, 3.45).to('.scr-explain', { autoAlpha: 1, duration: 0.3 }, 3.6);
fromIn(L(3), STEP_AT[2]);
const riskNum = $('.risk-num strong'); const riskObj = { v: 0 };
tl.fromTo('.risk-arc', { strokeDashoffset: 314.16 }, { strokeDashoffset: 314.16 * 0.04, duration: 0.8, ease: 'power2.out' }, 3.7)
  .fromTo(riskObj, { v: 0 }, { v: 96, duration: 0.8, ease: 'power2.out', onUpdate: () => { riskNum.textContent = Math.round(riskObj.v); } }, 3.7)
  .from('.signals li', { autoAlpha: 0, x: -14, stagger: 0.16, duration: 0.25 }, 3.95)
  .from('.hindi-explain', { autoAlpha: 0, y: 18, duration: 0.35 }, 4.5);

// 4 · family decides
tl.to(L(3), OUT, 4.9);
fromIn(L(4), STEP_AT[3]);
tl.to('.main-phone', { x: -80, scale: 0.9, filter: 'brightness(0.5)', duration: 0.6 }, 4.95)
  .fromTo('.son-phone', { autoAlpha: 0, x: 240, rotationY: -28 }, { autoAlpha: 1, x: 0, z: 90, rotationY: -6, duration: 0.7, ease: 'power3.out' }, 5.0)
  .from('.notify', { y: -30, autoAlpha: 0, duration: 0.4, ease: 'back.out(1.6)' }, 5.35)
  .to('.nbtn.block', { scale: 0.9, duration: 0.12, yoyo: true, repeat: 1 }, 5.85)
  .fromTo('.son-done', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 6.05);

// 5 · safe
tl.to(L(4), OUT, 6.4)
  .to('.son-phone', { autoAlpha: 0, x: 220, duration: 0.5 }, 6.45)
  .to('.main-phone', { x: 0, scale: 1, filter: 'brightness(1)', duration: 0.6 }, 6.5)
  .to('.scr-explain', { autoAlpha: 0, duration: 0.3 }, 6.5)
  .to('.scr-safe', { autoAlpha: 1, duration: 0.3 }, 6.65);
fromIn(L(5), STEP_AT[4]);
tl.to('.scr-safe .safe-check circle', { strokeDashoffset: 0, duration: 0.5 }, 6.75)
  .to('.scr-safe .safe-check path', { strokeDashoffset: 0, duration: 0.35 }, 7.05)
  .from('.scr-safe .safe-title, .scr-safe .safe-sub, .scr-safe .safe-row', { y: 14, autoAlpha: 0, stagger: 0.08, duration: 0.3 }, 7.0)
  .to({}, { duration: 0.9 }, 7.4);

const TOTAL = tl.duration();
const railItems = $$('.rail li');
const journey = $('.journey');
let lastStep = -2;
const journeyST = ScrollTrigger.create({
  trigger: '.journey', start: 'top top', end: () => '+=' + Math.round(innerHeight * TOTAL * 0.72),
  pin: true, scrub: reduced ? true : 1, animation: tl, anticipatePin: 1, invalidateOnRefresh: true,
  onUpdate(self) {
    const t = self.progress * TOTAL;
    let step = -1;
    STEP_AT.forEach((at, i) => { if (t >= at - 0.05) step = i; });
    if (step !== lastStep) {
      railItems.forEach((li, i) => { li.classList.toggle('on', i === step); li.classList.toggle('done', i < step); });
      lastStep = step;
    }
    if (scene3d) { scene3d.setClose(t > 2.85 && t < 6.5 ? 1 : 0); scene3d.setSafe(t > 6.5 ? 1 : 0); }
    journey.classList.toggle('safe', t > 6.5);
  },
});

// hero button jumps to the start of the story
$$('[data-scroll-step]').forEach(a => a.addEventListener('click', e => {
  e.preventDefault();
  const at = (STEP_AT[0] + 0.5) / TOTAL;
  scrollTo(journeyST.start + (journeyST.end - journeyST.start) * at);
}));
$$('a[href^="#"]:not([data-scroll-step])').forEach(a => a.addEventListener('click', e => {
  const id = a.getAttribute('href');
  if (id === '#top' || id === '#journey-start') { e.preventDefault(); scrollTo(0); return; }
  const el = id.length > 1 && document.querySelector(id);
  if (el) { e.preventDefault(); scrollTo(el); }
}));

/* ---------- hand the screen from 3D to content ---------- */
ScrollTrigger.create({
  trigger: '#check', start: 'top bottom', end: 'top 35%', scrub: true,
  onUpdate(self) {
    const o = 1 - self.progress;
    $('#gl').style.opacity = o.toFixed(3);
    if (scene3d) scene3d.setActive(o > 0.01);
  },
});

/* ---------- reveals (headings wipe in, the rest settles) ---------- */
if (!reduced) {
  $$('.reveal').forEach(el => {
    const isHead = el.matches('.h2, .why-big, .close-title');
    gsap.from(el, isHead
      ? { clipPath: 'inset(0 0 100% 0)', y: 30, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 86%', once: true } }
      : { y: 36, autoAlpha: 0, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%', once: true } });
  });
  gsap.from('.tile', { y: 50, autoAlpha: 0, scale: 0.97, duration: 0.9, ease: 'power3.out', stagger: { each: 0.07, from: 'start' }, scrollTrigger: { trigger: '.bento', start: 'top 80%', once: true } });
  gsap.from('.elder-phone', { y: 80, rotationX: 14, autoAlpha: 0, duration: 1.4, ease: 'expo.out', transformPerspective: 1400, scrollTrigger: { trigger: '.elder-demo', start: 'top 80%', once: true } });
  gsap.from('.close-mark', { scale: 0.4, autoAlpha: 0, duration: 1.2, ease: 'back.out(1.8)', scrollTrigger: { trigger: '.close', start: 'top 70%', once: true } });
}

/* ---------- how it works: the line draws as you read ---------- */
gsap.to('.how-line path', { strokeDashoffset: 0, ease: 'none', scrollTrigger: { trigger: '.how-track', start: 'top 75%', end: 'top 25%', scrub: true } });
$$('.how-n').forEach((n, i) => {
  ScrollTrigger.create({ trigger: '.how-track', start: () => `top ${75 - i * 16}%`, onEnter: () => gsap.to(n, { backgroundColor: '#FF7A1A', color: '#070B14', duration: 0.4 }), onLeaveBack: () => gsap.to(n, { backgroundColor: '#070B14', color: '#FF7A1A', duration: 0.4 }) });
});

/* ---------- warm light for the elders section ---------- */
ScrollTrigger.create({ trigger: '#elders', start: 'top 55%', end: 'bottom 45%', toggleClass: { targets: document.body, className: 'warm' } });

/* ---------- numbers count up once ---------- */
const fmt = n => Math.round(n).toLocaleString('en-IN');
$$('.count').forEach(el => {
  const to = +el.dataset.to, pre = el.dataset.prefix || '', suf = el.dataset.suffix || '';
  if (reduced) return;
  const o = { v: 0 };
  el.textContent = pre + '0' + suf;
  ScrollTrigger.create({ trigger: el, start: 'top 88%', once: true, onEnter: () => gsap.to(o, { v: to, duration: 2, ease: 'power3.out', onUpdate: () => { el.textContent = pre + fmt(o.v) + suf; } }) });
});

/* ---------- scam checker (demo heuristics, runs locally) ---------- */
const BAIT = ['kyc', 'refund', 'verify', 'verification', 'update', 'lottery', 'prize', 'reward', 'customs', 'cbi', 'police', 'arrest', 'safe', 'custody', 'helpdesk', 'support', 'claim', 'cashback', 'bonus', 'blocked', 'urgent', 'incometax', 'income-tax', 'electricity'];
const BANKS = ['sbi', 'hdfc', 'icici', 'axis', 'kotak', 'rbi', 'paytm', 'phonepe', 'gpay', 'npci', 'pnb'];
const OFFICIAL = ['onlinesbi.sbi', 'sbi.co.in', 'hdfcbank.com', 'icicibank.com', 'axisbank.com', 'rbi.org.in', 'paytm.com', 'phonepe.com', 'npci.org.in', 'kotak.com', 'pnbindia.in'];
const SHORT = ['bit.ly', 'tinyurl', 't.co', 'cutt.ly', 'rb.gy', 'is.gd', 'shorturl'];
const esc = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function analyze(raw) {
  const s = raw.trim(), low = s.toLowerCase(), reasons = [];
  let score = 10, kind = 'Input';
  const isUpi = /^[a-z0-9._-]{2,}@[a-z]{2,}$/i.test(s);
  const isUrl = !isUpi && /^(https?:\/\/)?([a-z0-9-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(s);
  const digits = s.replace(/\D/g, '');
  const isPhone = !isUpi && !isUrl && digits.length >= 10 && digits.length <= 13;
  if (isUpi) {
    kind = 'UPI ID';
    const user = low.split('@')[0];
    const words = BAIT.filter(w => user.includes(w));
    const bank = BANKS.find(b => user.includes(b));
    if (words.length) { score += 40; reasons.push(`It uses words scammers rely on: "${words.slice(0, 3).join('", "')}". Banks never collect KYC fees or refunds through a personal UPI ID.`); }
    if (bank) { score += 30; reasons.push(`It borrows a bank's name (${bank.toUpperCase()}) but it's a personal UPI ID, not the bank.`); }
    if (/\d{5,}/.test(user)) { score += 8; reasons.push('It contains a long run of digits, common in throwaway IDs.'); }
    if (!words.length && !bank) { reasons.push('No scam words or borrowed bank names in this ID.'); reasons.push('Before you pay, check that the name your UPI app shows matches who you expect.'); }
  } else if (isUrl) {
    kind = 'Link';
    const host = low.replace(/^https?:\/\//, '').split('/')[0];
    const official = OFFICIAL.some(o => host === o || host.endsWith('.' + o));
    if (low.startsWith('http://')) { score += 15; reasons.push('The link is not secure: it starts with http, not https.'); }
    if (SHORT.some(x => host.includes(x))) { score += 35; reasons.push('It is a shortened link, which hides where it really goes.'); }
    const bank = BANKS.find(b => host.includes(b));
    if (bank && !official) { score += 45; reasons.push(`It looks like ${bank.toUpperCase()}'s website, but it isn't the bank's official address.`); }
    const w = BAIT.find(x => host.includes(x));
    if (w && !official) { score += 20; reasons.push(`The address uses "${w}", a word fake sites use to rush you.`); }
    if (/\.(xyz|top|click|link|info|online|site|live)$/.test(host)) { score += 12; reasons.push('It uses a cheap domain ending often used for short-lived scam sites.'); }
    if (official) { score = 8; reasons.length = 0; reasons.push("This is the bank's official website address."); }
    if (!reasons.length) reasons.push('Nothing obviously wrong in the address. Still, never type your PIN or OTP on a page you opened from a message.');
  } else if (isPhone) {
    kind = 'Phone number'; score = 46;
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
  return { s, kind, score, level, title: T[0], advice: T[1], reasons };
}

const result = $('#result'), input = $('#checkInput');
let checking = false;
function runCheck(value) {
  const v = value.trim();
  if (!v || checking) { if (!v) input.focus(); return; }
  checking = true;
  result.innerHTML = `<div class="scanning"><div class="scan-box">${esc(v)}</div><p>Checking for scam fingerprints…</p></div>`;
  const started = Date.now();
  fetch('/api/check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ q: v }) })
    .then(r => r.ok ? r.json() : Promise.reject()).catch(() => analyze(v))
    .then(r => setTimeout(() => show(r), Math.max(0, (reduced ? 150 : 1100) - (Date.now() - started))));
  const show = (r) => {
    result.innerHTML = `<div class="verdict lvl-${r.level}">
      <div class="v-top">
        <div class="v-score"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="36" class="bg"/><circle cx="40" cy="40" r="36" class="arc"/></svg><strong>${r.score}</strong></div>
        <div><div class="v-label">${r.kind} · risk ${r.score}/100</div><p class="v-title">${r.title}</p><div class="v-input">${esc(r.s)}</div></div>
      </div>
      <ul class="v-reasons">${r.reasons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
      <p class="v-advice">${r.advice}</p>
    </div>`;
    const arc = result.querySelector('.arc');
    requestAnimationFrame(() => requestAnimationFrame(() => { arc.style.strokeDashoffset = (226.2 * (1 - r.score / 100)).toFixed(1); }));
    if (!reduced) gsap.from(result.querySelectorAll('.v-top, .v-reasons li, .v-advice'), { y: 16, autoAlpha: 0, stagger: 0.07, duration: 0.5, ease: 'power3.out' });
    checking = false;
  };
}
$('#checkForm').addEventListener('submit', e => { e.preventDefault(); runCheck(input.value); });
$$('.ex').forEach(b => b.addEventListener('click', () => { input.value = b.dataset.ex; runCheck(b.dataset.ex); }));

/* ---------- Dada-Dadi mode ---------- */
const ep = $('#elderPhone');
const DONE = {
  family: { hi: 'राहुल को संदेश भेज दिया गया है। जब तक वह हाँ नहीं कहते, पैसा नहीं जाएगा।', en: "We've messaged Rahul. The money won't move until he says yes." },
  cancel: { hi: 'पेमेंट रद्द हो गया। आपका पैसा सुरक्षित है।', en: 'Payment cancelled. Your money is safe.' },
};
let lastAct = null;
function setLang(lang) {
  ep.dataset.lang = lang;
  $$('[data-hi]', ep).forEach(el => { el.textContent = el.dataset[lang]; el.lang = lang === 'hi' ? 'hi' : 'en'; });
  if (lastAct) $('.e-done-text', ep).textContent = DONE[lastAct][lang];
  $$('.seg[data-lang]').forEach(b => b.setAttribute('aria-pressed', b.dataset.lang === lang));
}
$$('.seg[data-size]').forEach(b => b.addEventListener('click', () => {
  ep.dataset.size = b.dataset.size;
  $$('.seg[data-size]').forEach(x => x.setAttribute('aria-pressed', x === b));
}));
$$('.seg[data-lang]').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang)));
$$('.e-btn', ep).forEach(b => b.addEventListener('click', () => {
  lastAct = b.dataset.act;
  const lang = ep.dataset.lang;
  $('.e-done-text', ep).textContent = DONE[lastAct][lang];
  const warn = $('.e-warn', ep), done = $('.e-done', ep);
  gsap.to(warn, { autoAlpha: 0, y: -20, duration: 0.3, onComplete: () => {
    warn.hidden = true; done.hidden = false;
    gsap.fromTo(done, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 });
    gsap.fromTo($$('.safe-check circle', done), { strokeDashoffset: 151 }, { strokeDashoffset: 0, duration: 0.5 });
    gsap.fromTo($$('.safe-check path', done), { strokeDashoffset: 40 }, { strokeDashoffset: 0, duration: 0.35, delay: 0.35 });
    $('.e-reset', ep).focus({ preventScroll: true });
  } });
}));
$('.e-reset', ep).addEventListener('click', () => {
  const warn = $('.e-warn', ep), done = $('.e-done', ep);
  done.hidden = true; warn.hidden = false; lastAct = null;
  gsap.fromTo(warn, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.4 });
});

const listenBtn = $('#listenBtn');
listenBtn.addEventListener('click', () => {
  const synth = window.speechSynthesis;
  if (!synth) { listenBtn.querySelector('span').textContent = 'Read-aloud is not supported in this browser'; return; }
  if (synth.speaking) { synth.cancel(); return; }
  const lang = ep.dataset.lang;
  const doneVisible = !$('.e-done', ep).hidden;
  const text = doneVisible ? $('.e-done-text', ep).textContent : $$('.e-warn [data-hi]:not(button)', ep).map(el => el.textContent).join(' ');
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
  u.rate = 0.85;
  const voice = synth.getVoices().find(v => v.lang && v.lang.toLowerCase().startsWith(lang === 'hi' ? 'hi' : 'en-in'));
  if (voice) u.voice = voice;
  u.onstart = () => { listenBtn.classList.add('speaking'); listenBtn.querySelector('span').textContent = 'Stop'; };
  u.onend = u.onerror = () => { listenBtn.classList.remove('speaking'); listenBtn.querySelector('span').textContent = 'Read it aloud'; };
  synth.speak(u);
});

/* ---------- refresh once fonts settle ---------- */
document.fonts && document.fonts.ready.then(() => ScrollTrigger.refresh());
