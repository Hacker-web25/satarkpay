import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as paypal from './lib/paypal.js';
import { aiInfo, aiEnabled, ensureModel } from './lib/llm.js';
import { assessPayment, checkIdentifier } from './lib/risk.js';
import { askSaathi } from './lib/saathi.js';
import { memoryStats } from './lib/memory.js';
import { store } from './lib/store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const HOLD_ABOVE = Number(process.env.HOLD_ABOVE || 39);
const pub = p => p && ({ ...p, orderId: p.orderId, authorizationId: undefined });
const fail = (res, e, code = 502) => { console.error(e.message); res.status(code).json({ error: e.message, debugId: e.debugId }); };

app.get('/api/config', (_req, res) => res.json({
  paypal: { enabled: paypal.paypalEnabled, clientId: paypal.paypalClientId, currency: paypal.CURRENCY },
  ai: aiInfo, profile: store.profile, holdAbove: HOLD_ABOVE,
}));

/* 1. She fills in who to pay. We score it, then create a PayPal order that can only be authorized. */
app.post('/api/payments', async (req, res) => {
  const { payeeName = '', payeeEmail = '', amount, note = '', callerAsked = false } = req.body || {};
  const amt = Number(amount);
  if (!payeeEmail.trim() || !(amt > 0) || amt > 10000) return res.status(400).json({ error: 'Enter who to pay and an amount between 1 and 10,000.' });
  const id = crypto.randomUUID().slice(0, 8);
  const input = { payeeName: payeeName.trim() || payeeEmail.trim(), payeeEmail: payeeEmail.trim().toLowerCase(), amount: amt, note: note.trim(), callerAsked: !!callerAsked, currency: paypal.CURRENCY };
  try {
    const risk = await assessPayment(input);
    const order = await paypal.createOrder({ amount: amt, description: `सतर्कPay to ${input.payeeName}`, customId: id });
    const p = store.addPayment({ id, ...input, risk, orderId: order.id, status: 'created', demo: !!order.demo, createdAt: new Date().toISOString(), timeline: [{ at: new Date().toISOString(), status: 'created' }] });
    res.json({ payment: pub(p) });
  } catch (e) { fail(res, e); }
});

/* 2. She approved in PayPal. Place the hold, then decide: send now, or wait for family. */
app.post('/api/payments/:id/authorize', async (req, res) => {
  const p = store.payment(req.params.id);
  if (!p) return res.status(404).json({ error: 'Payment not found' });
  if (p.status !== 'created') return res.json({ payment: pub(p) });
  try {
    const auth = await paypal.authorizeOrder(p.orderId);
    store.update(p.id, { authorizationId: auth.authorizationId, authExpires: auth.expires, payer: auth.payer, status: 'authorized' });
    if (p.risk.score > HOLD_ABOVE) {
      store.update(p.id, { status: 'held', heldAt: new Date().toISOString() });
    } else {
      await release(p, 'auto');
    }
    res.json({ payment: pub(store.payment(p.id)) });
  } catch (e) { store.update(p.id, { status: 'error', error: e.message }); fail(res, e); }
});

async function release(p, by) {
  const cap = await paypal.captureAuthorization(p.authorizationId);
  store.update(p.id, { status: 'captured', captureId: cap.id, approvedBy: by });
  try {
    const out = await paypal.payout({ receiver: p.payeeEmail, amount: p.amount, note: p.note, ref: p.id });
    store.update(p.id, { status: 'sent', payoutBatchId: out.batchId, payoutStatus: out.status });
  } catch (e) {
    // Money is captured but the payout failed (for example, Payouts not enabled on the sandbox app).
    store.update(p.id, { status: 'sent', payoutError: e.message });
  }
  store.history.unshift({ payee: p.payeeName, email: p.payeeEmail, amount: p.amount, at: new Date().toISOString().slice(0, 10) });
}

app.get('/api/payments', (_req, res) => res.json({ payments: store.payments().slice(0, 40).map(pub), flagged: store.flagged, profile: store.profile }));
app.get('/api/payments/:id', (req, res) => { const p = store.payment(req.params.id); p ? res.json({ payment: pub(p) }) : res.status(404).json({ error: 'Not found' }); });

/* 3. Family decides on a held payment. */
app.post('/api/payments/:id/approve', async (req, res) => {
  const p = store.payment(req.params.id);
  if (!p || p.status !== 'held') return res.status(409).json({ error: 'This payment is not waiting for approval.' });
  try { await release(p, 'guardian'); res.json({ payment: pub(store.payment(p.id)) }); }
  catch (e) { fail(res, e); }
});
app.post('/api/payments/:id/block', async (req, res) => {
  const p = store.payment(req.params.id);
  if (!p || p.status !== 'held') return res.status(409).json({ error: 'This payment is not waiting for approval.' });
  try {
    await paypal.voidAuthorization(p.authorizationId);
    store.update(p.id, { status: 'blocked', blockedBy: 'guardian' });
    store.flag(p.payeeEmail, p.risk.scamType && p.risk.scamType !== 'None' ? p.risk.scamType : 'Blocked by a family');
    res.json({ payment: pub(store.payment(p.id)) });
  } catch (e) { fail(res, e); }
});
/* She can cancel her own held payment too. */
app.post('/api/payments/:id/cancel', async (req, res) => {
  const p = store.payment(req.params.id);
  if (!p || !['held', 'created'].includes(p.status)) return res.status(409).json({ error: 'This payment can no longer be cancelled.' });
  try {
    if (p.authorizationId) await paypal.voidAuthorization(p.authorizationId);
    store.update(p.id, { status: 'cancelled', cancelledBy: 'payer' });
    res.json({ payment: pub(store.payment(p.id)) });
  } catch (e) { fail(res, e); }
});

/* Saathi assistant */
app.post('/api/saathi', async (req, res) => {
  const { messages = [], lang = 'hi', paymentId } = req.body || {};
  try { res.json(await askSaathi({ messages, lang: lang === 'en' ? 'en' : 'hi', payment: paymentId ? store.payment(paymentId) : null })); }
  catch (e) { fail(res, e, 500); }
});

/* Quick check for a UPI ID, link or number */
app.post('/api/check', (req, res) => res.json(checkIdentifier(req.body?.q)));
app.get('/api/memory', (_req, res) => res.json(memoryStats()));
app.get('/api/flagged', (_req, res) => res.json({ flagged: store.flagged }));

if (process.env.ALLOW_RESET !== 'false') app.post('/api/demo/reset', (_req, res) => { store.reset(); res.json({ ok: true }); });

const port = process.env.PORT || 3000;
app.get('/api/health', (_req, res) => res.json({ paypal: paypal.paypalEnabled ? 'sandbox' : 'demo', ai: aiInfo, aiStatus, memory: memoryStats() }));
let aiStatus = aiEnabled ? 'testing' : 'offline (no key)';
app.listen(port, async () => {
  console.log(`सतर्कPay on http://localhost:${port}  ·  PayPal: ${paypal.paypalEnabled ? 'sandbox' : 'demo mode'}  ·  AI: ${aiInfo.provider}${aiInfo.model ? ' ' + aiInfo.model : ''}`);
  if (!aiEnabled) return console.log('AI test: no AI key set, Saathi will use offline answers.');
  const r = await ensureModel();
  if (r?.ok) { aiStatus = 'ok'; console.log(`AI test: OK. Using "${r.model}".`); }
  else { aiStatus = 'failed: ' + r?.error; console.log(`AI test: FAILED: ${r?.error}\n  Saathi and risk explanations will use offline answers until this is fixed. Check NVIDIA_API_KEY in .env.`); }
});
