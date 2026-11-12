// Tiny JSON-file store. Enough for a hackathon demo; swap for Postgres in production.
import fs from 'node:fs';
import path from 'node:path';

const FILE = process.env.DATA_FILE || path.resolve('data.json');

const seed = () => ({
  profile: {
    name: 'Kamla Sharma', nameHi: 'कमला शर्मा', age: 68, lang: 'hi',
    guardian: { name: 'Rahul', relation: 'son', relationHi: 'बेटा', phone: '+91 98XXX XXXXX' },
    holdAbove: 25, // risk score above which a payment waits for the guardian
  },
  // Her usual payments: the baseline the risk engine compares against (demo data).
  history: [
    { payee: 'Sharma Medical Store', email: 'sharma.medical@example.com', amount: 42, at: '2026-10-28' },
    { payee: 'City Electricity Board', email: 'bills@electricity.example.com', amount: 28, at: '2026-10-20' },
    { payee: 'Gupta Kirana', email: 'gupta.kirana@example.com', amount: 61, at: '2026-10-14' },
    { payee: 'Sharma Medical Store', email: 'sharma.medical@example.com', amount: 39, at: '2026-09-28' },
    { payee: 'Gupta Kirana', email: 'gupta.kirana@example.com', amount: 75, at: '2026-09-12' },
  ],
  payments: [],
  // Accounts families have blocked. Grows every time a guardian taps Block.
  flagged: [
    { id: 'kyc.update.sbi@ybl', reason: 'Fake KYC update', reports: 37, at: '2026-11-02' },
    { id: 'customs.clearance.desk@example.com', reason: 'Courier and customs scam', reports: 12, at: '2026-11-07' },
  ],
});

let db;
try { db = JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { db = seed(); }
let timer = null;
const save = () => { clearTimeout(timer); timer = setTimeout(() => fs.writeFile(FILE, JSON.stringify(db, null, 2), () => {}), 150); };

export const store = {
  get profile() { return db.profile; },
  get history() { return db.history; },
  get flagged() { return db.flagged; },
  payments: () => db.payments,
  payment: id => db.payments.find(p => p.id === id),
  addPayment(p) { db.payments.unshift(p); save(); return p; },
  update(id, patch) {
    const p = db.payments.find(x => x.id === id); if (!p) return null;
    Object.assign(p, patch, { updatedAt: new Date().toISOString() });
    (p.timeline ||= []).push({ at: new Date().toISOString(), status: p.status });
    save(); return p;
  },
  isFlagged(id) { const k = String(id || '').toLowerCase().trim(); return db.flagged.find(f => f.id === k); },
  flag(id, reason) {
    const k = String(id).toLowerCase().trim();
    const f = db.flagged.find(x => x.id === k);
    if (f) { f.reports += 1; f.at = new Date().toISOString().slice(0, 10); }
    else db.flagged.unshift({ id: k, reason, reports: 1, at: new Date().toISOString().slice(0, 10) });
    save();
  },
  reset() { db = seed(); save(); },
};
