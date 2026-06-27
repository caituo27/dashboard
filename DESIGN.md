# SprixPortal Design Notes

## Visual System

- Shared apps use a light, operational UI with white surfaces, restrained borders, and teal as the main action accent.
- Core tokens come from each app `index.css`: `#ffffff` background, `#1a1a1a` primary text, `#6b6b6b` secondary text, `#eeeeee` borders, and `#0f766e` accent.
- Agent app cards use a softer `22px` radius; admin app cards use a denser `12px` radius.
- Background treatment is already provided by the shared aurora wash in CSS. New feature surfaces should not add decorative gradients or extra background effects.

## Component Patterns

- Primary commands use `ActionButton`; secondary and cancel commands use `SecondaryButton`.
- Status values are displayed with `StatusTag`, and low-emphasis contextual labels use `SoftTag`.
- Admin operational data should stay in `Table` and `Tabs` surfaces with horizontal scroll where needed.
- Modals should keep forms compact, use existing Ant Design controls, and avoid nested card layouts.

## Current Feature Guidance

- Alipay binding should present QR scan as the primary interaction and keep manual/open-link fallback secondary.
- Platform acceptance review belongs in the admin task workflow; approval now auto-posts settlement and triggers platform payout. Funds pages remain the place to monitor payout results and handle historical settlement posting or exceptions.
