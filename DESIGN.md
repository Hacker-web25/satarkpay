# Pause — DESIGN.md

Direction: a calm, high-trust fintech product page in deep navy, where the product itself (a phone making a payment) is the hero. One memorable thing: a scroll-pinned 3D phone that lives through a scam attempt. Everything around it stays quiet.
Reference: the person's mockup (dark navy, ember orange, product-in-hero). No UXKIN examples were used; this direction is from the person's reference and the open-source references named below.

## Color (dark only)
| Token | Value | Role |
|---|---|---|
| --ink | #070B14 | Page background |
| --night | #0D1424 | Raised surfaces: phone screens, panels |
| --line | #1C2640 | Borders and dividers |
| --text | #EEF2F8 | Primary text (17:1 on ink) |
| --muted | #93A0B8 | Secondary text (7.2:1 on ink) |
| --ember | #FF7A1A | Primary actions, the "held" state, focus ring |
| --ember-glow | rgba(255,122,26,.35) | Glow behind held objects only |
| --safe | #5CC8FF | Approved / safe state (differs from ember in hue and lightness) |
| --danger | #FF4D4F | Scam alert inside product UI only, never in page chrome |

## Typography
- One family: Instrument Sans (Google Fonts), with Mukta for Devanagari. Display 600/700, body 400/500. Tabular numbers for money.
- Scale (px / line-height): 88/0.95, 56/1.02, 36/1.1, 24/1.25, 19/1.55 (lead), 16/1.6 (body), 14/1.45 (small).
- Sentence case everywhere. No all-caps labels, no mono labels, no colored single words in headlines.

## Spacing and shape
- 8px scale. Section padding 160px desktop / 96px mobile. Content width 1200px; text ≤ 64ch.
- Radius: 12 (controls), 20 (panels), 44 (phone). One shadow: 0 40px 120px rgba(0,0,0,.55) on the phone only.

## Components
- Primary button: ember fill, ink text, 48px tall, pill. Hover: lighter ember. Focus: 2px ember ring offset 3px.
- Secondary button: 1px line border, text color; hover border ember.
- Phone: HTML/CSS screen (crisp text) in a 3D-transformed frame, driven by GSAP on scroll.
- Status pill: Held (ember), Safe (safe), Scam (danger) — product UI only.

## Motion
- Lenis smooth scroll + GSAP ScrollTrigger. One orchestrated moment: the pinned phone story. Everything eases; nothing snaps.
- WebGL (Three.js) behind the hero only: a glass shield with soft bloom and a slow particle orbit, reacting to cursor and scroll.
- prefers-reduced-motion: no pin, no WebGL motion, all states shown statically.

## Imagery and icons
- Lucide-style 1.5px stroke icons, inline SVG. No photos of people, no stock, no fake avatars or user counts.

## References
- tsogjavklann/awwwards-3d (MIT): Three.js r170 + GSAP 3.12.5 + Lenis 1.1 stack, lerp-everything, tone mapping and bloom.
- vudovn/ag-kit frontend-design: anti-template rules.
