---
name: qianxun-ui
description: >-
  Enforce the Qianxun (千寻) mobile H5 design language for candidate/employer UI,
  Claude Design handoff prompts, React/CSS implementation, and visual review.
  Use for UI polish, design tokens, shared UI, glass cards, electric-blue styling,
  mono data typography, motion rules, and mobile layout verification.
---

# Qianxun UI Consistency Skill

Use this skill whenever writing, reviewing, or translating a design brief into
Qianxun H5 UI. Qianxun is an AI job-seeking Agent tool, not a consumer app or
marketing site.

## Design Intent

Every UI should feel:

- 精密: dashboard / control-console, not landing page.
- 可信: calm data hierarchy, restrained copy, clear state.
- 在运行中: subtle system activity, never flashy.

## Claude Design Handoff

When the user provides a Claude / design-agent prompt or demo:

1. Decide whether it is a global design rule or a page-level brief.
2. Global rules belong in this skill and `assets/qx-design-system.css`.
3. Page-level direction belongs in the relevant design brief, acceptance doc, or
   same-directory page `.md`; do not bloat this skill with one-off page details.
4. Translate demos into project code using `@qianxun/shared/ui` and tokens.
   Do not paste demo CSS blindly.
5. If the design conflicts with product requirements or this skill, ask whether
   the product/design source should change before implementing.

When asking Claude Design for output, provide this skill plus
`assets/qx-design-system.css`, and require:

- Design Brief
- Codex Implementation Prompt
- single-file 375px HTML/CSS demo
- 320px / 375px / 430px boundary notes
- loading / empty / error / long-copy states

## Non-Negotiable Rules

1. Glass hierarchy: cards and floating surfaces use glass treatment with
   `backdrop-filter: blur(20px) saturate(1.4)` and subtle borders. Avoid pure
   white + heavy drop-shadow consumer UI.
2. Electric-blue monochrome: the product palette is blue / white / gray, plus
   success / warning / error states. Do not introduce purple, pink, cyan, brown,
   orange, or decorative multi-hue gradients.
3. Data-first typography: numbers, versions, percentages, timestamps, English
   status labels, and machine-like tags use mono typography, tight tracking, and
   dark text. Metric numbers are never brand-blue just for decoration.
4. Mechanical motion: rotation is `linear`; breathing is restrained. Approved
   motion families are `agent-breathe 2.6s`, `pulse-dot 1.2s`, and card flow
   rotation around 5s linear. No spring, bounce, playful easing, or lifelike
   character animation.

## Source Of Truth

- Tokens: `qianxun-shared/src/design-tokens/tokens.css`.
- Shared components and shared styles: `@qianxun/shared/ui` and
  `@qianxun/shared/ui.css`.
- H5 app-local styles may compose these classes, but must not invent a separate
  visual system.

Prefer these shared components:

| Component               | Use                                                      |
| ----------------------- | -------------------------------------------------------- |
| `PrimaryButton`         | Main CTA, at most one dominant CTA per screen area       |
| `SecondaryButton`       | Secondary glass CTA                                      |
| `HighlightCard`         | Glass card with `none` / `edge` / `glow` / `flow` levels |
| `Tag`                   | Neutral / brand / warning / success / error labels       |
| `EmptyState`            | Empty states                                             |
| `GhostAnimation`        | Agent / loading / empty brand figure                     |
| `Modal` / `BottomSheet` | Dialogs and bottom sheets                                |

## Tokens

Never hardcode colors, font sizes, spacing, shadows, or radius values in new UI
code. `#fff` and `#000` are the only allowed raw hex values.

Color tokens:

```css
--qx-color-bg-page
--qx-color-card
--qx-color-brand
--qx-color-brand-soft
--qx-color-text-primary
--qx-color-text-secondary
--qx-color-text-tertiary
--qx-color-success
--qx-color-warning
--qx-color-error
```

Typography tokens:

```css
--qx-font-family-sc
--qx-font-family-en
--qx-font-family-mono
--qx-font-hero
--qx-font-title
--qx-font-section
--qx-font-card-title
--qx-font-body
--qx-font-caption
--qx-font-small
```

Claude demos may use aliases such as `--qx-font-sc`, `--qx-fs-hero`,
`--qx-s5`, and `--qx-r-card`; the project tokens expose these aliases, but app
code should prefer the existing long-form names when editing current files.

## Core Classes

Use the class system from `assets/qx-design-system.css` for design demos and as
the naming source for implementation.

### Shell

`qx-shell` is the page root container. It gives the mobile viewport a light blue
radial field and subtle 32px grid. Existing `app-bg` / `phone-frame` layouts may
stay, but new page-level shells should move toward `qx-shell`.

### Cards

`HighlightCard` maps card levels to implementation classes:

| Level  | Class                            | When                        |
| ------ | -------------------------------- | --------------------------- |
| `none` | `qx-card`                        | default glass card          |
| `edge` | `qx-card-edge` / `qx-card--edge` | elevated static state       |
| `glow` | `qx-card-glow` / `qx-card--glow` | activated or selected state |
| `flow` | `qx-card-flow` / `qx-card--flow` | actively running only       |

`flow` is strict: only use it when a real process is running/executing. Stopped
or queued states must pause or remove the flow treatment.

### GhostAnimation

The ghost is the Qianxun brand figure. Do not redraw its anatomy. You may only
change size or pause it.

Sizes:

- `large`: 112 x 132 page-level empty state.
- `medium`: 88 x 104 card-level state.
- `small`: 64 x 76 inline / compact state.

Inactive agents use `isAnimating={false}` or a paused class.

### Buttons

Use `.qx-button` plus exactly one semantic variant:

| Variant                | Use                                                    |
| ---------------------- | ------------------------------------------------------ |
| `qx-button--primary`   | primary CTA; every screen area should have at most one |
| `qx-button--secondary` | secondary glass action                                 |
| `qx-button--ghost`     | low-emphasis action                                    |
| `qx-button--danger`    | delete / offline / destructive action                  |
| `qx-button--disabled`  | unmet prerequisite                                     |

Size tiers:

| Tier            | Height | Use                 |
| --------------- | ------ | ------------------- |
| default         | 44px   | card CTA rows       |
| `qx-button--md` | 36px   | inline card actions |
| `qx-button--sm` | 30px   | compact row actions |

Do not mix size tiers within the same action group. Async buttons use the shared
`loading` prop; CSS-only demos use `.is-loading`.

### Data And Status

- Large metrics use `.qx-metric`.
- Inline numbers use `.qx-num`.
- Status chips use `.qx-status-pill` and `.qx-status-dot`.
- Tags use `.qx-tag` plus `--warning`, `--success`, or `--error`.
- English eyebrows are uppercase, mono/English-feeling, and limited to one or
  two short concepts, for example `QIANXUN · TASK BOARD`.

### Other Shared Patterns

- `qx-segmented`: segmented control; active item uses `.is-active`.
- `qx-input`: 44px input with brand focus ring.
- `qx-rsbar`: running progress bar.
- `qx-banner`: `--info` / `--warning` / `--error` top notices.
- `qx-icon-btn` and `qx-pill-group`: miniapp-style top controls.
- `qx-topbar`: centered title and left/right slots.
- `qx-nav` and `qx-nav__item`: bottom nav; active item uses `.is-active`.
- `qx-fab`: bottom-right create action.

## Page Skeleton

Use this structure as a design target, adapted to the actual React shell:

```html
<div class="qx-shell">
  <div class="qx-topbar">
    <div class="qx-topbar__title">千寻用人方端</div>
    <div class="qx-topbar__right">
      <div class="qx-pill-group">
        <button>···</button>
        <span class="qx-divider"></span>
        <button>⊙</button>
      </div>
    </div>
  </div>

  <section style="padding: 12px var(--qx-page-x) 0">
    <div class="qx-eyebrow">QIANXUN · TASK BOARD</div>
    <h1>任务管理</h1>
    <p>上线模拟实战任务，考察候选人真实人机协同能力</p>
  </section>

  <!-- cards / lists / states -->

  <nav class="qx-nav">
    <button class="qx-nav__item is-active">首页</button>
  </nav>
</div>
```

## Copy And Typography

- Chinese UI text uses `var(--qx-font-family-sc)`, whose canonical stack is
  `-apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans SC", "Helvetica Neue", Arial, sans-serif`.
  Do not put `HarmonyOS Sans SC` before the Apple / PingFang stack; it renders
  heavier than the approved Qianxun reference in WeChat mini-program previews.
- English brand labels and eyebrows use `var(--qx-font-family-en)` at 600; do
  not use the mono stack for brand text such as `QIANXUN AGENT WORK`.
- Data uses `var(--qx-font-family-mono)`, whose canonical stack is
  `"SF Mono", "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace`.
  Reserve mono for numbers, timestamps, versions, kernel/status strings, and
  machine tags.
- Typography must feel comfortable, fluid, and precise, not thick or loud.
  The reference demos are `login-d.jsx`, `page-choose-role.jsx`,
  `page-seeker-home.jsx`, `page-employer-home.jsx`, `page-task-mgmt.jsx`,
  `page-messages.jsx`, and `qx-design-system.css`.
- Do not use `font-weight: 800` in Qianxun UI. Avoid broad Chinese 700 usage,
  and avoid making normal titles feel heavy or粗糙. Regular page titles, card
  titles, buttons, and role names default to 500.
  Body and description copy uses 400; secondary labels may use 500.
  Reserve 700 for numeric metrics or rare brand-emphasis headings only.
- H5 typography scale at the 375px baseline:
  topbar title 16px / 500; page hero and page h1 28px / 500; section title
  17-18px / 500; card title 16-18px / 500; body 14-15px / 400; helper text
  12.5-13px / 400; eyebrow 11px / 600; mono status/version 10.5-11px / 500-600;
  primary button 14px / 500 with 44px height.
- WeChat mini-program typography scale:
  topbar title 32rpx / 500; normal page h1 56rpx / 500; splash two-line hero
  54-56rpx / 500; role card title 38-40rpx / 500; body 26-28rpx / 400;
  helper text 24-26rpx / 400; eyebrow 21-23rpx / 600; mono status/version
  20-22rpx / 500-600; primary button 28rpx / 500 with 84-88rpx height.
- Chinese paragraphs use line-height 1.6 to 1.7 and should wrap cleanly.
- Chinese and normal UI letter-spacing stays `0`. Do not use negative
  letter-spacing to fake density. English eyebrows may use 0.08em-0.1em;
  mono status labels may use 0.06em-0.08em.
- Avoid marketing copy such as "AI 智能赋能". Use tool-like verbs and nouns:
  "创建分身", "上线任务", "派出 Agent", "查看过程".
- Do not use icons as decoration when data hierarchy can carry the layout.

## Message Module Pattern

Use shared message components from `@qianxun/shared/ui` for both C and B sides
before adding app-local message UI. C/B pages may own data fetching and
role-specific actions, but list rows, detail header, bubbles, composer, retry,
and invitation cards should remain visually consistent.

When changing message UI, verify:

- chronological message order;
- sticky header does not cover or leak messages;
- composer does not cover final messages;
- long text, URLs, and invitation cards wrap at 320px / 375px / 430px;
- failed send and retry states are visible, not Toast-only.

## Verification Checklist

Before saying UI work is done:

- colors use tokens; no raw hex except `#fff` / `#000`;
- no purple / pink / cyan decorative hue was introduced;
- font sizes, spacing, radius, and shadows use tokens;
- numbers, versions, percentages, and English status labels use mono;
- glass cards use blur/saturate and subtle borders;
- `flow` appears only for real running state;
- buttons within one group use one size tier;
- async buttons use shared loading behavior;
- 320px / 375px / 430px have no horizontal scroll, overlap, or clipped text;
- no `!important`;
- GhostAnimation anatomy is unchanged.
