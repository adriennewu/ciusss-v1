# SGQRI 008 — Contrast verification notes (WCAG 2.x AA targets)

Targets: **4.5:1** normal text on background, **3:1** large text / non-text UI / focus indicators. Verify with [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) using computed hex from the browser when `html[data-prototype-primary]` is `purple`, `green`, or `yellow`.

| UI area | Tokens / classes | Change applied |
|--------|-------------------|----------------|
| Placeholder on composer | `placeholder:text-muted-foreground` on `bg-card` | Darkened global `--muted-foreground` in `:root` ([app/globals.css](../app/globals.css)). |
| Beta badge (header) | `--beta-badge-bg` / `--beta-badge-fg` | New tokens `#b45309` on `#ffffff` ([app/globals.css](../app/globals.css)); [beta-badge.tsx](../components/chatbot/beta-badge.tsx) uses `var(--beta-badge-*)`. |
| Beta disclaimer banner | `bg-amber-50`, `text-foreground`, border | [notification-banner.tsx](../components/chatbot/notification-banner.tsx) tightened border and `text-foreground`. |
| Yellow prototype theme | `--primary`, `--ring`, `--primary-on-background` | Slightly deepened for icon/UI contrast on white ([app/globals.css](../app/globals.css)). |
| Typing dots (assistant) | `bg-primary-on-background` on `bg-card` | [loading-dots.tsx](../components/chatbot/loading-dots.tsx). |
| User bubble | `bg-primary` / `text-primary-foreground` | Inherits theme tokens ([user-message-bubble.tsx](../components/chatbot/user-message-bubble.tsx)). |
| Composer message text | `text-card-foreground` | Replaced hardcoded `#11161f` ([composer.tsx](../components/chatbot/composer.tsx)). |
| Suggestion chips | `text-primary-on-background`, border | Ring + border tuned in [suggestion-chips.tsx](../components/chatbot/suggestion-chips.tsx). |

**Manual pass:** VoiceOver / NVDA (EN + FR), keyboard-only (Tab wrap, Escape to launcher, arrow keys on message log when focused), and a second pass after switching `data-prototype-primary` in prototype settings.
