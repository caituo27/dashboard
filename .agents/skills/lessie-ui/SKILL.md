---
name: lessie-ui
description: Use when building or editing any page/component in the agentDemo (AI Config Rater) project. Enforces the Lessie-inspired light "aurora" design system — design tokens, typography, shared components, and motion patterns — so every new screen stays visually consistent.
---

# Lessie UI (agentDemo design system)

The look: **light, airy, editorial.** White/off-white background, a soft pastel
iridescent "aurora" glow at the top, an elegant serif display headline (with
*italic* accent words), black rounded-pill buttons, generous whitespace, soft
rounded cards. Inspired by lessie.ai.

**Stack:** React 18 + TypeScript + Tailwind v4 + framer-motion + react-chartjs-2.

## Single source of truth

- **Design tokens** live in [`src/index.css`](../../../src/index.css) under `@theme`. Never hardcode a hex/font/radius that already exists as a token — use the Tailwind utility it generates.
- **Shared primitives** live in [`src/components/ui/`](../../../src/components/ui). Prefer them over re-styling raw elements.

When a token or primitive is missing, add it to those files (so it's reusable), don't inline a one-off.

## Tokens → utilities

| Token (`@theme`) | Tailwind utility | Use for |
|---|---|---|
| `--color-bg` | `bg-bg` | page background (off-white) |
| `--color-ink` / `--color-ink-soft` | `text-ink` / `text-ink-soft` | primary / secondary text |
| `--color-line` | `border-line` | hairline borders, dividers |
| `--color-card` | `bg-card` | card surfaces (white) |
| `--color-pill` | `bg-pill` | black pill buttons |
| `--color-accent` | `text-accent` / `bg-accent` | indigo accent (sparingly) |
| `--color-aurora-*` | used by `<Aurora>` | the 4 pastel glow blobs |
| `--font-serif` | `font-serif` | display headings, big numbers |
| `--font-sans` | `font-sans` (default) | everything else |
| `--radius-card` | `rounded-card` | cards (22px) |
| `--shadow-soft` | `shadow-soft` | card elevation |
| `--animate-aurora` | `animate-aurora` | drifting background |
| `--animate-fade-up` | `animate-fade-up` | CSS entrance (non-motion) |

## Typography rules

- **Display headings & big metric numbers** → `font-serif` (Instrument Serif). Emphasis words inside a headline go `italic`.
- **Body, labels, UI** → default sans (Inter).
- Big headline pattern: `font-serif font-normal text-[clamp(28px,5.4vw,68px)] leading-[1.12] tracking-[-0.5px]`.
- **Headlines with a rotating word stay on ONE line** — put `whitespace-nowrap` on the `<h1>` and do NOT cap its width (no `max-w-*`). Otherwise a long word wraps and the line count jumps, which reads as janky. The word's width-tween (below) slides the trailing text horizontally instead.
- Metric numbers (e.g. the overall score): `font-serif text-[60px] leading-none`.

## Core components

- **`<Aurora />`** — fixed pastel glow; render once at the top of a page, before content (`z-0`; content sits at `z-10`).
- **`<NavBar />`** — logo (serif) + a pill CTA.
- **`<Card>`** — white rounded surface with soft shadow. Wrap any content block.
- **`<PillButton variant="solid|outline">`** — `solid` = black CTA, `outline` = subtle secondary. Spreads native button props (id, onClick, disabled…).
- **`<ModeTabs>`** — pill segmented control on a grey track.

Layout shell: page is `relative min-h-screen overflow-x-hidden`; main content is centered `mx-auto max-w-[980px] px-7` and `z-10`.

## Motion (this project uses "full" animation)

- **Background:** `<Aurora>` drifts via `animate-aurora` (slow breathe, 20s).
- **Section entrance:** wrap with framer-motion — `initial={{opacity:0,y:24}}` → on first view `whileInView={{opacity:1,y:0}}` `viewport={{once:true,amount:0.2}}` `transition={{duration:0.6}}`. For above-the-fold use `animate` instead of `whileInView`.
- **Rotating headline word:** use a **fixed-width slot + pure cross-dissolve**. Stack every word in one CSS grid cell (`col-start-1 row-start-1`) so the slot is as wide as the longest word and the centered line **never shifts**; toggle only `opacity` (1 for active, 0 otherwise) with a slow `transition-opacity duration-1000 ease-in-out`. Rotate slowly (~3.4s). See [`Hero.tsx`](../../../src/components/Hero.tsx). Do NOT animate the word's width/position — with mixed CN/EN widths any horizontal movement of the whole line reads as janky.
- **Bars/metrics reveal:** animate `width` from 0 with a small per-item `delay` stagger, see [`Results.tsx`](../../../src/components/Results.tsx).

Keep motion subtle (≤0.6s, gentle easing). Don't animate on every re-render — gate entrance with `once: true`.

## Do / Don't

- ✅ Light background, lots of whitespace, soft shadows, rounded-`card` corners.
- ✅ One serif headline per section, sans everywhere else.
- ✅ Black pill for the primary action; outline pill for secondary.
- ✅ Reuse `ui/` primitives and theme tokens.
- ❌ No dark theme, no hard borders/heavy shadows, no neon.
- ❌ Don't hardcode colors/fonts/radii that exist as tokens.
- ❌ Don't add a new color outside the aurora palette without a reason.

## Adding a new page/component

1. Read this skill + skim `src/index.css` and `src/components/ui/`.
2. Compose from `<Card>`, `<PillButton>`, `<ModeTabs>`; use theme utilities.
3. Add a section entrance animation (the `whileInView` pattern above).
4. If you need a new token or primitive, add it to `index.css` / `ui/` so it's shared.
