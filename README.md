# सतर्कPay (SatarkPay)

**Stop the scam before the money leaves.** सतर्कPay puts a risky payment on hold in PayPal, explains the danger out loud in Hindi or English, and lets a trusted family member approve or block it. Built for older people, who are the first target of "digital arrest" and other payment scams in India.

Built for the PayPal AI Hackathon 2026.

## What's in the product

| Part | URL | What it does |
|---|---|---|
| Landing page | `/` | The story and the scam checker |
| Elder app (Dada-Dadi mode) | `/app` | Send money through PayPal. Big text, Hindi or English, read-aloud, and **Saathi**, a voice assistant |
| Family app | `/family` | Live list of held payments with the AI's reasons, plus **Block** or **Approve** |

## How PayPal and AI are used

```
Elder app ──► POST /api/payments ──► risk engine (rules + AI) ──► PayPal Orders v2  intent=AUTHORIZE
     │                                                                   │
     └─ PayPal button (buyer approves) ──► /authorize ──► PayPal authorize (money is HELD)
                                                │
                     low risk ◄─────────────────┴─────────────────► high risk
          capture + Payouts to recipient                   status=held → Family app
                                                     Approve ─► capture + Payouts
                                                     Block   ─► void (nothing ever leaves)
                                                                + account added to shared blocklist
```

- **PayPal JavaScript SDK (Buttons):** she approves the payment in PayPal's own checkout.
- **PayPal Orders v2:** orders are created with `intent: AUTHORIZE`, so the money is reserved, not sent.
- **PayPal Payments v2:** `capture` releases a held payment; `void` cancels it.
- **PayPal Payouts v1:** after capture, सतर्कPay pays the person she meant to pay.
- **AI risk explainer (`lib/risk.js`):** explainable signals (new payee, amount vs her usual payments, "a caller asked me to pay", scam words, impersonating an authority, secrecy, accounts other families blocked). A language model then writes the explanation she hears, in Hindi and English, and can adjust the score by ±15.
- **AI model:** NVIDIA NIM, `nvidia/nemotron-3.5-super-vl-120b-a12b` (Nemotron 3.5 Super VL), with automatic fallback to other NVIDIA Nemotron models. `npm run pick-model` tests them on a Hindi scam question and saves the fastest one that answers in Hindi.
- **Saathi (`lib/saathi.js`):** an assistant limited to scams and safe payments, written for people in their 60s–80s. Short sentences, read aloud, always ending with one safe next step. Voice input uses the browser's speech recognition (hi-IN or en-IN). When a payment is held, Saathi already knows its details. New answers are saved to a learning memory (`lib/memory.js`), so common questions are answered instantly.
- **Sponsor tool, Render:** the app is deployed on Render from `render.yaml` (Blueprint), at https://satarkpay-rxmv.onrender.com.

## Saathi learns

Saathi answers common questions instantly from its memory (`saathi-memory.json`), which starts with about 60 questions older people ask most, in Hindi and English. A question it hasn't seen before goes to the AI. The answer is saved, so the next person who asks something similar gets it at once. Matching handles reworded questions, Hindi spelling variants (फ़ोन / फोन, माँग / मांग) and common synonyms (ओटीपी / OTP, fraud / scammer).

Only general first questions are saved. Answers about a specific payment, and follow-ups inside a conversation, are never stored. To pre-teach a batch of questions, run `npm run teach` (or `npm run teach -- questions.txt`, one question per line). Commit `saathi-memory.json` so the deployed app ships with everything learned.

## Run it locally

Requires Node 20.6+.

```bash
npm install
cp .env.example .env      # fill in keys (see below)
npm run dev               # http://localhost:3000
```

Without keys the app still runs: PayPal switches to a clearly labelled **demo mode** and Saathi gives built-in offline answers.

### 1. PayPal sandbox keys
1. Go to developer.paypal.com → **Apps & Credentials** → **Sandbox** → **Create App** (type: Merchant).
2. Copy the **Client ID** and **Secret** into `.env`.
3. In the app's features, make sure **Payouts** is enabled.
4. Under **Sandbox Accounts**, note the default **Personal** account (the payer who logs in at the PayPal button). Create a second Personal account to use as the recipient's email.

### 2. An AI key (any one)

With a free NVIDIA key, run `npm run pick-model` once. It asks each of NVIDIA's own Nemotron models the same Hindi and English scam question, then saves the fastest one that answers in Hindi to `.env`.

- `NVIDIA_API_KEY` from build.nvidia.com (free; the hosted demo uses `nvidia/nemotron-3.5-super-vl-120b-a12b`), or
- `GEMINI_API_KEY` from aistudio.google.com (has a free tier), or
- `OPENAI_API_KEY`.

Set `AI_MODEL` if you want a model other than the default for that provider.

## Deploy (Render)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint** → pick the repo (it reads `render.yaml`).
3. Add the PayPal and AI keys as environment variables, then deploy.

## Demo in 60 seconds
1. Open `/family` in one window and `/app` in another (or on a phone).
2. In the app: **पैसे भेजें / Send money** → tap the **"RBI Safe Custody"** demo → answer **हाँ / Yes** to "is a caller asking you to pay?" → pay with the sandbox Personal account.
3. The payment is held. The app reads the warning aloud and shows the reasons.
4. In the family window, tap **Block payment**. The elder app updates to "आपका पैसा सुरक्षित है" (your money is safe), and the account appears in the shared blocklist.
5. Paste that account into the landing page checker: it now says a family has already reported it.
6. Open **Saathi**, tap the mic and say "कोई कह रहा है मैं डिजिटल अरेस्ट में हूँ" ("someone says I'm under digital arrest").

## For judges
- Hosted demo: https://satarkpay-rxmv.onrender.com (on Render's free tier the first load after a quiet spell can take about a minute)
- Elder app: `/app` · Family guardian view: `/family` · Landing page: `/`
- PayPal sandbox payer (Kamla ji), used in the PayPal window: **kamla-ji@example.com** / **hK48_Q%O** (the last character is a capital letter O). This is a PayPal sandbox test account; no real money moves.
- Quick test: on `/app` tap **Send money → "RBI Safe Custody" → Yes → Continue → Pay with PayPal**, log in with the account above and complete the payment. It is held. On `/family` tap **Block payment**: the PayPal authorization is voided and her app says her money is safe. The **"Medicine shop"** demo ($42) goes straight through (capture + payout).
- Use **Reset demo data** on the family page to start fresh.
- Amounts run in USD because the PayPal sandbox is used. The story on the landing page is set in India, where these scams are common.

## Production notes (not done in the hackathon build)
- Swap the JSON file store for Postgres; add auth for elders and guardians, plus multi-family support.
- Real push or WhatsApp notifications to guardians; authorizations expire, so remind the guardian well before the hold expires.
- Holding and paying out on someone's behalf needs the right PayPal partner setup (PayPal Complete Payments or multiparty) and local compliance.

## Tech
Node + Express, PayPal REST APIs (Orders v2 authorize, Payments v2 capture/void, Payouts v1, JS SDK), NVIDIA NIM (Nemotron 3.5) or Gemini / OpenAI, Web Speech API. Landing page: Three.js, GSAP, Lenis. Design rules: `DESIGN.md`.

## License
MIT. Note that `vendor/` contains Three.js (MIT), GSAP and Lenis under their own licenses.
