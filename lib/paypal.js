// PayPal REST integration: Orders v2 (AUTHORIZE), Payments v2 (capture / void), Payouts v1.
// Runs against the sandbox unless PAYPAL_ENV=live. With no credentials it falls back to a
// clearly labelled demo mode so the app can still be explored offline.

const BASE = process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const CLIENT_ID = process.env.PAYPAL_CLIENT_ID || '';
const SECRET = process.env.PAYPAL_CLIENT_SECRET || '';
export const CURRENCY = process.env.PAYPAL_CURRENCY || 'USD';
export const paypalEnabled = Boolean(CLIENT_ID && SECRET);
export const paypalClientId = CLIENT_ID;

let token = null, tokenExp = 0;
async function accessToken() {
  if (token && Date.now() < tokenExp - 60_000) return token;
  const res = await fetch(`${BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: 'Basic ' + Buffer.from(`${CLIENT_ID}:${SECRET}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`PayPal auth failed: ${data.error_description || res.status}`);
  token = data.access_token; tokenExp = Date.now() + data.expires_in * 1000;
  return token;
}

async function call(method, path, body, idem) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(idem ? { 'PayPal-Request-Id': idem } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const detail = data.details?.[0]?.description || data.message || res.statusText;
    const err = new Error(`PayPal ${method} ${path} failed: ${detail}`);
    err.debugId = data.debug_id; err.status = res.status;
    throw err;
  }
  return data;
}

const mockId = p => `${p}-DEMO-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;

/** Create an order that only reserves the money (intent AUTHORIZE). */
export async function createOrder({ amount, description, customId }) {
  if (!paypalEnabled) return { id: mockId('ORDER'), status: 'CREATED', demo: true };
  return call('POST', '/v2/checkout/orders', {
    intent: 'AUTHORIZE',
    purchase_units: [{
      reference_id: customId, custom_id: customId,
      description: description.slice(0, 127),
      amount: { currency_code: CURRENCY, value: Number(amount).toFixed(2) },
    }],
    payment_source: undefined,
  }, `order-${customId}`);
}

/** After the payer approves in PayPal, place the hold. Returns the authorization id. */
export async function authorizeOrder(orderId) {
  if (!paypalEnabled) return { authorizationId: mockId('AUTH'), status: 'CREATED', demo: true };
  const data = await call('POST', `/v2/checkout/orders/${orderId}/authorize`, {});
  const auth = data.purchase_units?.[0]?.payments?.authorizations?.[0];
  const payer = data.payer?.email_address;
  return { authorizationId: auth?.id, status: auth?.status, expires: auth?.expiration_time, payer };
}

/** Release the held money to सतर्कPay (it is then paid out to the recipient). */
export async function captureAuthorization(authorizationId) {
  if (!paypalEnabled) return { id: mockId('CAPTURE'), status: 'COMPLETED', demo: true };
  return call('POST', `/v2/payments/authorizations/${authorizationId}/capture`, { final_capture: true }, `cap-${authorizationId}`);
}

/** Cancel the hold. Nothing ever leaves the payer's account. */
export async function voidAuthorization(authorizationId) {
  if (!paypalEnabled) return { status: 'VOIDED', demo: true };
  await call('POST', `/v2/payments/authorizations/${authorizationId}/void`, null, `void-${authorizationId}`);
  return { status: 'VOIDED' };
}

/** Send the captured amount on to the person the payer meant to pay. */
export async function payout({ receiver, amount, note, ref }) {
  if (!paypalEnabled) return { batchId: mockId('PAYOUT'), status: 'SUCCESS', demo: true };
  const data = await call('POST', '/v1/payments/payouts', {
    sender_batch_header: { sender_batch_id: `satark-${ref}`, email_subject: 'You have a payment via सतर्कPay', email_message: 'This payment was checked by सतर्कPay.' },
    items: [{ recipient_type: 'EMAIL', receiver, note: (note || 'Payment via सतर्कPay').slice(0, 4000), sender_item_id: ref, amount: { currency: CURRENCY, value: Number(amount).toFixed(2) } }],
  }, `payout-${ref}`);
  return { batchId: data.batch_header?.payout_batch_id, status: data.batch_header?.batch_status };
}
