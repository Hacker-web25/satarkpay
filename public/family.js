// सतर्कPay family guardian view
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const api = async (url, body) => {
  const res = await fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {});
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || 'Something went wrong');
  return d;
};
const money = p => `${p.currency === 'USD' ? '$' : p.currency + ' '}${Number(p.amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const ago = iso => { const s = (Date.now() - new Date(iso)) / 1000; return s < 60 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); };
const LABEL = { sent: 'Sent', held: 'Waiting for you', blocked: 'Blocked', cancelled: 'Cancelled by Maa', created: 'Started', authorized: 'Checking', captured: 'Sending', error: 'Error' };

let shown = new Set(), knownFlags = null, busy = false;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), 3200);
}
function notify(p) {
  if ('Notification' in window && Notification.permission === 'granted') new Notification('सतर्कPay: Maa needs you', { body: `${money(p)} to ${p.payeeName}. Risk ${p.risk.score}/100.` });
}

function renderPending(list) {
  const box = $('#pending');
  if (!list.length) {
    box.innerHTML = `<div class="empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 3 5.5V12c0 5.3 3.8 9.6 9 11 5.2-1.4 9-5.7 9-11V5.5Z"/><path d="m8.5 12 2.5 2.5 4.5-5"/></svg><span>Nothing needs you right now. Everyday payments go straight through; risky ones will appear here.</span></div>`;
    return;
  }
  const ids = list.map(p => p.id).join();
  if (box.dataset.ids === ids) return;
  box.dataset.ids = ids;
  box.innerHTML = list.map(p => {
    const r = p.risk, off = (283 * (1 - r.score / 100)).toFixed(1);
    return `<article class="req" data-id="${p.id}">
      <div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" class="bg"/><circle cx="50" cy="50" r="45" class="arc" style="stroke-dashoffset:${off}"/></svg><strong>${r.score}<span>risk</span></strong></div>
      <div class="req-body">
        <div class="req-top"><span class="req-amt">${money(p)}</span><span class="req-to">to <strong>${esc(p.payeeName)}</strong> · ${esc(p.payeeEmail)}</span></div>
        <div class="req-top"><span class="tag">${esc(r.scamType)}</span>${p.callerAsked ? '<span class="tag call">Maa said a caller asked her to pay</span>' : ''}</div>
        ${p.note ? `<div class="note">Note: "${esc(p.note)}"</div>` : ''}
        <div class="ai"><b>Why सतर्कPay held it</b>${esc(r.explain.en)}</div>
        <ul class="reasons">${r.reasons.slice(0, 4).map(x => `<li>${esc(x.en)}</li>`).join('')}</ul>
        <div class="actions">
          <button class="btn block" data-act="block">Block payment</button>
          <button class="btn approve" data-act="approve">Approve</button>
        </div>
        <div class="meta-line">Held ${ago(p.heldAt || p.createdAt)} · The money is authorized in PayPal but not captured, so nothing has left Maa's account.</div>
      </div>
    </article>`;
  }).join('');
  box.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => decide(b.closest('.req').dataset.id, b.dataset.act, b)));
}

async function decide(id, act, btn) {
  if (busy) return; busy = true;
  btn.closest('.actions').querySelectorAll('button').forEach(b => (b.disabled = true));
  try {
    const { payment } = await api(`/api/payments/${id}/${act}`, {});
    toast(act === 'block' ? `Blocked. Maa's ${money(payment)} is safe, and the account is flagged.` : `Approved. ${money(payment)} sent to ${payment.payeeName}.`);
    $('#pending').dataset.ids = '';
    await refresh();
  } catch (e) { toast(e.message); btn.closest('.actions').querySelectorAll('button').forEach(b => (b.disabled = false)); }
  finally { busy = false; }
}

function renderActivity(list) {
  $('#activity').innerHTML = list.filter(p => p.status !== 'created').slice(0, 12).map(p => `<li><div class="p"><strong>${esc(p.payeeName)}</strong><span>${ago(p.updatedAt || p.createdAt)}${p.approvedBy === 'guardian' ? ' · approved by you' : p.approvedBy === 'auto' ? ' · everyday payment' : ''}</span></div><span class="st ${p.status}">${LABEL[p.status] || p.status}</span><span class="amt">${money(p)}</span></li>`).join('') || '<li class="muted">No payments yet.</li>';
}
function renderFlagged(list) {
  const fresh = knownFlags ? list.filter(f => !knownFlags.has(f.id + f.reports)) : [];
  knownFlags = new Set(list.map(f => f.id + f.reports));
  $('#flagged').innerHTML = list.slice(0, 10).map(f => `<li class="${fresh.includes(f) ? 'new' : ''}"><code>${esc(f.id)}</code><span>${esc(f.reason)} · reported by ${f.reports} ${f.reports === 1 ? 'family' : 'families'}</span></li>`).join('');
}

async function refresh() {
  try {
    const { payments, flagged } = await api('/api/payments');
    const pending = payments.filter(p => p.status === 'held');
    pending.forEach(p => { if (!shown.has(p.id)) { shown.add(p.id); notify(p); } });
    renderPending(pending); renderActivity(payments); renderFlagged(flagged);
    api('/api/memory').then(m => { $('#memory').textContent = `Saathi knows ${m.total} answers (${m.learned} learned from new questions) and has answered ${m.served} questions instantly from memory. Every new question it answers is saved, so the next person gets it straight away.`; }).catch(() => {});
    document.title = pending.length ? `(${pending.length}) सतर्कPay — Family guardian` : 'सतर्कPay — Family guardian';
  } catch {}
}

$('#reset').addEventListener('click', async () => { await api('/api/demo/reset', {}); shown = new Set(); $('#pending').dataset.ids = ''; refresh(); toast('Demo data reset.'); });
document.addEventListener('click', () => { if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); }, { once: true });
refresh();
setInterval(refresh, 2000);
