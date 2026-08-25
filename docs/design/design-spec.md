# DESIGN-SPEC.md — Pace (Stitch export, 2026-08-23)

Source of truth: `stitch_pace_adaptive_study_planner.zip` (extracted to scratchpad). Every value below is taken from the export, not invented. Screens referenced by folder name.

Brand personality (from `pace/DESIGN.md`): **"The Quiet Mentor"** — calm, editorial, modern minimalist. Structural clarity over decoration. Tonal layering and 1px borders instead of drop shadows.

---

## 1. Design system

### 1.1 Color palette (Material 3 tonal system)

Complete set from the export. Use tokens by name; never hardcode hex.

**Surface / background**
- `background`, `surface`, `surface-bright` — `#fbf8ff` (warm off-white, primary canvas)
- `surface-dim` — `#d7d8f4`
- `surface-container-lowest` — `#ffffff` (card white)
- `surface-container-low` — `#f4f2ff`
- `surface-container` — `#edecff`
- `surface-container-high` — `#e6e6ff`
- `surface-container-highest` / `surface-variant` — `#e0e0fc`
- `inverse-surface` — `#2d2f44`
- `inverse-on-surface` — `#f1efff`

**Primary (Sage — used sparingly for CTAs, progress, active states)**
- `primary` — `#23422a`
- `on-primary` — `#ffffff`
- `primary-container` — `#3a5a40` (this is the actual button fill in most screens)
- `on-primary-container` — `#acd0af`
- `primary-fixed` — `#c7ecca` / `primary-fixed-dim` — `#abd0af`
- `on-primary-fixed` — `#02210c` / `on-primary-fixed-variant` — `#2e4e35`
- `inverse-primary` — `#abd0af`
- `surface-tint` — `#45664b`

**Secondary (muted olive — chips/tags, mild active tint)**
- `secondary` — `#5c6145`
- `on-secondary` — `#ffffff`
- `secondary-container` — `#e1e6c2` (subject/tag chip background)
- `on-secondary-container` — `#62674a`
- `secondary-fixed` — `#e1e6c2` / `secondary-fixed-dim` — `#c5c9a7`
- `on-secondary-fixed` — `#1a1d07` / `on-secondary-fixed-variant` — `#45492f`

**Tertiary (dusty rose — reserved; not used in current screens)**
- `tertiary` — `#593038`, `on-tertiary` — `#ffffff`
- `tertiary-container` — `#73464f`, `on-tertiary-container` — `#f3b7c1`
- `tertiary-fixed` — `#ffd9df`, `tertiary-fixed-dim` — `#f3b7c1`
- `on-tertiary-fixed` — `#321019`, `on-tertiary-fixed-variant` — `#653a43`

**Error**
- `error` — `#ba1a1a`
- `on-error` — `#ffffff`
- `error-container` — `#ffdad6`
- `on-error-container` — `#93000a`

**Text**
- `on-surface`, `on-background` — `#181a2e` (primary body/heading text)
- `on-surface-variant` — `#424842` (secondary/muted)
- `outline` — `#727971` (labels, subtle icons)
- `outline-variant` — `#c2c8bf` (borders, dividers, inactive accent bars)

### 1.2 Typography

Font family: **Hanken Grotesk** (Google Fonts), weights 400/500/600 (700 loaded but unused). Icon font: **Material Symbols Outlined** (weight 400, opsz 24). Filled variant used for active nav / status icons via `font-variation-settings: 'FILL' 1`.

| Token | Size | Weight | Line height | Letter spacing |
|---|---|---|---|---|
| `display` | 40px | 600 | 48px | −0.02em |
| `headline-lg` | 32px | 600 | 40px | −0.01em |
| `headline-lg-mobile` | 24px | 600 | 32px | 0 |
| `headline-md` | 20px | 500 | 28px | 0 |
| `body-lg` | 18px | 400 | 28px | 0 |
| `body-md` | 16px | 400 | 24px | 0 |
| `label-md` | 14px | 500 | 20px | 0.01em |
| `label-sm` | 12px | 600 | 16px | 0.04em |

Timer numerals use `font-variant-numeric: tabular-nums`.

### 1.3 Spacing

Named tokens (from tailwind config):
- `base` — 8px
- `stack-sm` — 12px
- `gutter` — 16px
- `container-margin` — 20px
- `stack-md` — 24px
- `stack-lg` — 40px

Baseline rhythm is 8px. Major-section separation uses `stack-lg`.

### 1.4 Border radius

**Two definitions coexist in the export** and disagree — flagged in §7. The tailwind config *actually applied by the HTML* is:

- `rounded` (default) — 0.125rem (2px)
- `rounded-lg` — 0.25rem (4px) — standard: inputs, buttons, cards
- `rounded-xl` — 0.5rem (8px) — large session cards, hero container
- `rounded-full` — 0.75rem (12px) — soft-pill chips, primary action buttons in transactional screens

The prose section of `DESIGN.md` explicitly instructs: **no true pill shapes**. Buttons remain rectangular with soft corners.

### 1.5 Borders

- 1px solid, `outline-variant` (`#c2c8bf`) for card, input, and container edges.
- 1px `outline-variant/30` or `/50` for muted internal dividers.
- Focus / active input border: `primary-container` (`#3a5a40`).

### 1.6 Shadows / elevation

Almost none. Two exceptions actually used:
- `shadow-sm` on primary CTA buttons and dashboard highlight cards.
- Backdrop dimming for overlays: solid charcoal at ~60% opacity (per DESIGN.md prose — no modal actually appears in the 13 exported screens).

Depth is otherwise expressed via tonal layering (`surface-container-*` steps) and 1px borders — never drop shadows on general surfaces.

### 1.7 Icons

Material Symbols Outlined only. Used in screens:
`calendar_today`, `event_note`, `menu_book`, `settings` (bottom/side nav), `check_circle`, `timer`, `schedule`, `sync`, `auto_awesome`, `arrow_forward`, `arrow_back`, `close`, `add`, `check`, `chevron_left`, `chevron_right`, `pause`, `play_arrow`, `radio_button_unchecked`, `notifications`, `search`, `account_circle`, `tune`, `shield`, `delete_forever`, `hourglass_empty`, `update`, `compress`, `cloud_off`, `verified`, `hourglass_empty`.

Sizes used inline: 16px, 18px, 20px, 24px (default), and larger (32px+) for hero icons.

---

## 2. Reusable components

### 2.1 Primary button
- Fill: `bg-primary-container` (`#3a5a40`), text `on-primary` (`#ffffff`).
- Padding: `px-6 py-3` (medium), `px-8 py-3` (large landing), `px-10 py-4` (final CTA).
- Radius: `rounded-lg` on regular pages, `rounded-xl` on onboarding/transactional (larger).
- Hover: `hover:bg-primary` or `hover:opacity-90`.
- Optional trailing icon: `arrow_forward` or `check_circle`.
- `shadow-sm` when it's the main page action.

### 2.2 Secondary button
- Border 1px `outline` or `outline-variant`, text `on-surface`.
- No fill; hover fills to `surface-container-low` or `surface-variant`.
- Same padding/radius as primary.

### 2.3 Text-only / tertiary link button
- No border, no fill. Text `on-surface-variant`, hover text `primary`, or underline for footer/help actions.

### 2.4 Input field
- Bottom-border style: transparent background, `border-b border-outline-variant`.
- Focus: `border-primary-container`, no ring.
- Floating label: `label-sm`, `text-primary-container`, animates from placeholder position.
- Placeholder color: `text-outline`.
- Used for: subject entry, availability times, date picker readouts.

### 2.5 Radio / selection card
- Full card acts as label. Border `outline-variant`, hover `border-primary`.
- Selected: `border-primary` + `bg-secondary-container/10-20` + 1px vertical accent bar on left.
- Contains icon (Material Symbols), title (`headline-md`), one-line description (`body-md text-on-surface-variant text-sm`).

### 2.6 Toggle switch
- Track 40×24, ON = `bg-primary-container`, OFF = `bg-outline-variant`.
- Thumb 16×16, `bg-on-primary` (ON) / `bg-on-surface` (OFF).
- Uses `aria-pressed`.

### 2.7 Subject / tag chip
Two variants:
- **Inline label chip** (used inside cards): `bg-secondary-container text-on-secondary-container px-2 py-1 rounded` with `label-sm`. Also appears with `rounded-sm`.
- **Removable / selected chip** (used in setup and mobile focus header): `px-4 py-2 rounded-full` (soft pill), `label-md`, optional trailing `close` icon at reduced opacity.

### 2.8 Session card (dashboard / plan)
Central component. Two forms:

**Horizontal card (desktop dashboard)** — from `today_pace_dashboard`:
- Container: `bg-surface-container-lowest`, `border border-outline-variant`, `rounded-lg`, `overflow-hidden`, hover fills to `surface-container-low`.
- Left **status accent bar**, `w-1`, full height:
  - **In progress** — `bg-primary`
  - **Upcoming** — `bg-outline-variant`
  - **Completed** — `bg-outline-variant` (card also gets `opacity-70` and title `line-through`)
  - **Adjusted / rescheduled** — `bg-secondary` on `bg-secondary-container` card with `auto_awesome` icon
- Layout: three zones — subject/duration column (`w-32`), title/status column (flex-1), action column (Missed / Complete buttons) separated by `border-l`.
- Status label under title uses `label-sm uppercase tracking-wider`, colored by status.

**Compact card (mobile "Today")** — from `pace_mobile_today`:
- Same colors, but `p-3`, icon check/uncheck circle at left, single-line title + subtitle, minute duration right-aligned.

**Timeline card (plan view)** — from `your_plan_pace`:
- Vertical timeline (1px line `outline-variant` or `primary`) with dot at each session (open circle for future, filled sage for current with `ring-4 ring-primary-fixed-dim`, check icon for completed).
- Card offset by `pl-6` inside timeline; internal structure similar to horizontal dashboard card but simpler (no separate action column).

### 2.9 Adaptation banner (Plan Updated)
- `bg-secondary-container/30 border border-secondary/20 rounded-xl p-stack-md`.
- Left: circular icon container `p-2 bg-secondary-container rounded-full text-primary` with `auto_awesome` (filled).
- Title `headline-md text-primary` + body `body-md text-on-surface-variant`.

### 2.10 Progress bar
- Track `bg-surface-container-highest` (or `bg-surface-container-high` in setup) — 4px tall (`h-1`), `rounded-full`.
- Fill `bg-primary-container` (or `bg-primary`), `transition-all duration-500 ease-out`.
- Only linear. **No circular progress rings** except one used inside the loading state's `svg` (system-states loading spinner uses a stroke-dasharray animation).

### 2.11 Bottom navigation (mobile)
- Fixed, `w-full`, `bg-surface`, top border `outline-variant`, `pb-safe` (safe-area).
- 4 tabs, equal width via `justify-around`: **Today** (`calendar_today`), **Plan** (`event_note`), **Subjects** (`menu_book`), **Settings** (`settings`).
- Active tab: pill background `bg-secondary-container text-on-secondary-container rounded-full px-4 py-1 scale-95`, icon filled (`FILL 1`).
- Inactive: text `on-surface-variant`, no background, unfilled icon.
- Label uses `label-sm`, positioned under the icon.

### 2.12 Side navigation (desktop)
- Fixed left, `w-64`, `bg-surface`, right border `outline-variant`.
- Same 4 items in a vertical list.
- Active item: `text-primary font-bold bg-secondary-container rounded-lg px-4 py-3`, filled icon.
- Inactive: `text-on-surface-variant`, hover `bg-surface-container-low`.
- Header block above list: logo image + `label-md` tagline "The Quiet Mentor".

### 2.13 Top app bar (mobile)
- Fixed top, `bg-surface`, bottom border `outline-variant`.
- Left: logo. Right: notification bell + search + optional avatar. All icon buttons `text-on-surface-variant hover:text-primary`. **See §7 conflicts** — notifications/search are UI-only, not backed by MVP features.

### 2.14 Timer display (Study Session)
- `font-display` at 80px mobile / 120px desktop, `tabular-nums`, `text-on-surface`, weight 600.
- 4px linear progress bar directly beneath, with start ("0:00") and end ("45:00") labels below in `label-sm text-on-surface-variant`.
- Subtle 256×256 background circle border on mobile focus screen.

### 2.15 Focus / transactional screen shell
Used by **Session Missed**, **Plan Updated (mobile)**, **Session Complete**, **Study Session**, **Almost Ready**, and setup steps. Rules from DESIGN.md prose:
- **Navigation shell suppressed.** No side nav, no bottom nav — only a small top header with logo and optional back/close button.
- Centered content column, `max-w-[480px]` to `max-w-2xl`.
- One primary action button, optional muted secondary link ("Mark as missed", "Save & Exit").

### 2.16 Setup step chrome
- Sticky top header with logo + "Step N of 5" indicator + optional "Save & Exit".
- Progress bar below (see §2.10).
- Fixed bottom action bar with **Back** (disabled on first step) and **Continue / Create my plan** button.
- Content max-width 600px.

### 2.17 Settings section card
- `border border-outline-variant rounded-xl p-stack-md bg-surface-container-lowest`.
- Section title: `headline-md` with leading Material icon (`text-outline`), bottom-border under title.
- Fields stacked with `stack-md` spacing.

### 2.18 State card (system_states screen)
For loading / empty / error states:
- `bg-surface-container-lowest border border-outline-variant rounded-xl p-stack-lg`
- Centered content, `min-h-[300px]`.
- Round icon container (64×64 `rounded-full bg-surface-container-low` for empty, `bg-surface-variant` for error), Material icon at reduced weight (`wght 300`).
- Title `headline-md`, body `body-md text-on-surface-variant max-w-sm`, optional action button.

### 2.19 Date picker (setup)
- Bordered container, `rounded-xl`, `p-6`, `bg-surface-bright`.
- Prev/Next chevron buttons + `headline-md` month/year.
- 7-column grid, days-of-week header in `label-sm text-outline-variant`.
- Day buttons: circular hover `bg-surface-container-high`, "today" = `bg-secondary-container border border-primary` with small dot, "target" = `bg-primary-container text-on-primary shadow-md`.
- Legend row at bottom with matching swatches.

### 2.20 Timeline dot
- 12×12, `bg-surface`, 2px border `outline-variant` (future).
- Current: `bg-primary` with `ring-4 ring-primary-fixed-dim`.
- Completed: `bg-surface border-outline-variant` with tiny filled `check` icon centered.
- Positioned at `left-[-5px]` on a 1px vertical line.

---

## 3. Pages (13 screens)

For each: source folder, purpose, layout, key elements, actions, responsive/state notes.

### 3.1 Landing Page — `pace_landing_page`
- **Purpose**: public entry, explain the product, drive signup.
- **Layout**: max-width 1024px centered. Sticky nav (logo + "Method" / "Log In" / "Get Started"). Hero (display headline + body + two CTAs). Product preview bento block (16:9). "Quiet Mentor Methodology" 4-column grid: Plan / Study / Complete-Miss / Adapt (step 04 highlighted with left accent). Final CTA card. Footer (Privacy / Terms / Support).
- **Actions**: Get Started, See how it works, Start Planning Now.
- **Responsive**: nav links hidden on mobile (`hidden md:flex`); grid collapses to single column.

### 3.2 Pace Dashboard (desktop / tablet) — `today_pace_dashboard`
- **Purpose**: today's schedule + upcoming exam widget.
- **Layout**: side nav (desktop) or top app bar (mobile). Header row: "Today" `headline-lg` + date + "Upcoming Exam" widget (right-aligned card with `timer` icon, subject + days remaining). Below: "Study Sessions" `headline-md` and a vertical stack of horizontal session cards (§2.8). Footer + bottom nav (mobile).
- **Actions per session**: **Missed** (outline button) / **Complete** (primary-container fill with `check_circle` icon).
- **Notes**: session card statuses **In Progress** (sage accent) and **Upcoming** (muted accent) both shown; **Completed** style implied by system-states + timeline patterns.

### 3.3 Subjects (Setup step 1) — `setup_subjects`
- **Purpose**: enter the subjects being studied.
- **Layout**: centered column. Sticky progress header (Step 1 of 5). Display headline "Let's build your plan." Body prompt. Bottom-border input with floating label ("Add a subject") + circular add button. Removable soft-pill chips beneath. Fixed bottom **Continue to Step 2** button.
- **Responsive**: `max-w-2xl` container, natively single-column.
- **State**: pre-filled chips shown for visual demo (Biology, AP History, Calculus).

### 3.4 Session Missed — `session_missed_pace`
- **Purpose**: reassure and show the plan re-shuffling live after a missed session.
- **Layout**: focus screen (no nav). Icon container with `sync`. Headline "That's okay. Life happens." + body "We're adjusting your plan to keep you on track." Animated schedule preview (see §5): missed row fades out and collapses, remaining rows shift, new "Rescheduled" row fades in (`bg-secondary-container` with `auto_awesome`). Primary button **See Updated Plan**.

### 3.5 Plan Updated — `plan_updated_pace`
- **Purpose**: post-adaptation view: banner + today's focus + change log.
- **Layout**: same top/side nav as dashboard. Adaptation banner (§2.9). Two-column grid on desktop (`md:col-span-8` today's focus, `md:col-span-4` "What Changed" log). Mobile stacks vertically.
- **Today's Focus card**: session card with progress bar and **Resume** button, "Extended" indicator, `ring-1 ring-primary/10`.
- **What Changed panel**: rows with `update` / `compress` icons, subject + change description ("Moved to tomorrow, 4:00 PM"; "Shortened by 15 mins today"). Ends with secondary **View Full Schedule** button.

### 3.6 Study Session (desktop / responsive) — `study_session_pace`
- **Purpose**: focus timer for one scheduled session.
- **Layout**: focus screen. Top-left back button ("Back to Plan" on desktop). Subject chip + display headline (topic name) + body (instruction). Massive timer (§2.14). Under it, linear progress bar with 0:00 / 45:00 labels.
- **Actions**:
  - Initial state: **Start Session** (primary) + text link "Mark as missed".
  - Active state: **Pause** / **Finish** side-by-side (both outlined), plus small "Cancel session" link.
  - Pause toggles to "Resume" with `play_arrow`.

### 3.7 Session Complete — `session_complete_pace`
- **Purpose**: brief positive confirmation and hand-off to the next session.
- **Layout**: transactional (no nav). Circular check_circle icon (`bg-secondary-container`). Headline "Nice. That's done." "Next up" card showing subject, time range, topic. Two buttons: **Continue** (primary) → jumps to next session, **View today's plan** (outlined).

### 3.8 Your Plan — `your_plan_pace`
- **Purpose**: full upcoming schedule grouped by day, with historical items visible.
- **Layout**: dual navigation (both top app bar with logo/tabs and left side nav) — the export has both on this screen. Header "Study Plan" + sub-copy + small "Pace adjusted your schedule" pill (right-aligned).
- **Sections**: "Today" and "Tomorrow, Oct 24" (`headline-md` with bottom border). Each contains vertical timeline cards (§2.20, §2.8). Sessions are labeled Completed (strikethrough), In Progress (sage), or with an "Adjusted by Pace" `auto_awesome` icon and an italic explanation.
- **Bottom nav** appears on mobile.

### 3.9 Settings — `settings_pace`
- **Purpose**: manage account + preferences.
- **Layout**: side/bottom nav shell. Header "Settings" + sub-copy. Sections stacked with `stack-lg` gap (§2.17):
  - **Account** — Email (with Edit), Password (with Update).
  - **Study Availability** — summarized as two boxes (Weekdays / Weekends) with "Edit Times" text button — implies a deeper editor exists but is not shown here.
  - **Study Preferences** — Default Session Length radios: **25 / 45 / 60 mins** (25 checked). "Focus Mode Auto-Start" toggle.
  - **Privacy** — "Data Analytics" toggle ("Share anonymous study data to improve Pace").
  - **Danger zone** — centered outlined **Delete account** button with `delete_forever` icon, `text-error`.

### 3.10 Almost Ready (multi-step setup) — `setup_almost_ready`
Despite the name, this screen is a **5-step wizard** (Steps 2–5 plus Review):
- **Step 2 (Topics)**: choose from pre-listed topics grouped by subject; each item is an add/check row. Custom "Add another math topic…" input at bottom. Selected items get sage accent bar + filled check button.
- **Step 3 (Exam Date)**: calendar picker (§2.19).
- **Step 4 (Availability)**: per-day rows (MON, TUE, WED…). Each row has zero or more time windows (`type="time"` inputs `HH:MM` — with "to" between them) and an "Add window" text link. Days without windows show a muted "Add availability" prompt. Note "You can easily adjust this later in settings."
- **Step 5 (Session Length)**: 4 radio cards — **25 / 45 / 60 / 90** minutes. 45 checked by default.
- **Review**: 4 rows (Topics Focus, Target Date, Weekly Availability with computed "~12 hours / week" and days list, Session Length). Each with **Edit** link. Final button "Create my plan" turns into a "Building…" spinner on submit.
- Chrome per §2.16.

### 3.11 System States — `system_states_pace`
- **Purpose**: reference gallery of empty / loading / error states.
- **Layout**: two-column grid at desktop, stacked at mobile. Each tile per §2.18.
  - **You're all clear today** (empty) — `check_circle` in muted circle, message about resting.
  - **Building your plan…** (loading) — animated SVG circle with `auto_awesome` icon, spinner uses a custom `progress-spin` keyframe.
  - **Your plan couldn't be updated** (error) — `cloud_off` icon, reassuring copy ("your existing plan is still safe and active"), **Try again** primary button. Spans both columns at desktop.
- Top / bottom nav shell present.

### 3.12 Pace Mobile (Today) — `pace_mobile_today`
- **Purpose**: mobile version of the dashboard.
- **Layout**: mobile top app bar (logo + notifications + search). Content:
  - Greeting `headline-lg-mobile` "Good Morning, Alex" + date + soft-pill "14 Days to Finals".
  - **Up Next** section: a large session card with left sage accent, subject chip, duration, topic title, instruction, then a full-width **Start Session** button beneath.
  - **Today's Plan** section: compact stack of check-circle rows (§2.8 compact form). Completed items strikethrough at `opacity-60`, upcoming items with empty `radio_button_unchecked`.
- Bottom nav (§2.11).

### 3.13 Pace Mobile Study Session — `pace_mobile_session`
- **Purpose**: mobile focus-mode timer.
- **Layout**: full-screen focus. Top header with **close** button (X), centered "Focus Mode" `label-md`, right-aligned small logo. Content:
  - Subject soft-pill chip.
  - Topic `headline-lg-mobile text-primary`.
  - 80px `font-display` timer inside a subtle 256×256 outline circle, "Scheduled Session" caption.
  - Primary **Start Session** button, then on activation two side-by-side **Pause** / **Finish** buttons. Bottom underlined **Mark as missed** link.
- Explicitly `md:hidden` — mobile only.

---

## 4. Responsive design

**Breakpoint**: single Tailwind `md` break (~768px). No custom breakpoints in the export.

**Desktop / tablet (≥ md)**
- Max-width 1024px canvas centered.
- Left side navigation (`w-64` fixed), main content pushed right (`md:pl-64` or grid).
- Multi-column layouts allowed (dashboard 12-col grid; Plan Updated 8/4 split).
- Larger typography scale (`headline-lg` 32px).
- Sessions displayed as horizontal 3-zone cards.
- Focus screens keep the ~480px centered column even at desktop.

**Mobile (< md)**
- Single column, 20px side margins (`container-margin`).
- Fixed bottom navigation replaces the side nav.
- Sticky top app bar with logo + notifications + search + avatar.
- Typography scaled down (`headline-lg-mobile` 24px instead of 32px, display used sparingly).
- Session cards collapse to compact form (dashboard) or full-width vertical cards (plan view).
- Setup form uses fixed-bottom action bar instead of inline button.
- Focus screens fill viewport.

**Components that are redesigned (not just resized) between breakpoints**
- Navigation shell (side vs bottom + top app bar).
- Session card (3-zone horizontal → compact vertical).
- Study Session — the dedicated `pace_mobile_session` file re-composes the layout (subtle background circle appears only in the mobile variant).
- Dashboard header row (side-by-side title + exam widget on desktop → stacked with widget as its own card on mobile).
- Setup: multi-step wizard uses same steps but the bottom action bar sticks at the bottom on mobile.

**Layouts explicitly focus-only (nav suppressed)**: Session Missed, Session Complete, Study Session (desktop and mobile), all Setup steps, Almost Ready.

---

## 5. Animation

Only what's in the export. Nothing invented.

- **Session Missed schedule shift** (`session_missed_pace`): two-phase keyframed sequence, cubic-bezier(0.4, 0, 0.2, 1), 1.2s each.
  - `fadeOutCollapse`: missed row fades then collapses (max-height 80 → 0, opacity → 0), delay 0.5s.
  - `fadeInExpand`: rescheduled row expands and fades in from 0 max-height, delay 1.2s.
- **Setup step transition** (`setup_almost_ready`): 0.4s `fadeIn` with 10px `translateY(10px) → 0`.
- **Loading state** (`system_states_pace`): `progress-spin` — stroke-dashoffset animation 264→100→264, 2s linear infinite, on the SVG circle.
- **Progress bars** update via `transition-all duration-500 ease-out` (or 300ms in setup).
- **Nav pill active state**: `scale-95` transform with 150ms transition.
- **Buttons**: `hover:opacity-90`, `hover:bg-*` colour transitions, no scale on hover for buttons; `active:scale-[0.98]` on mobile up-next tile.
- **Icon "translate on hover"** used on Continue buttons: `group-hover:translate-x-1` on the trailing `arrow_forward`.

No parallax, no fancy scroll effects, no gradients-as-visual-feature. One functional gradient (`from-surface via-surface/90 to-transparent`) is used at the bottom of the setup screen to fade content behind the fixed action bar.

---

## 6. Accessibility

Explicit accessibility signals in the export:
- `alt` text on every image (real, contextual).
- `aria-label` on icon-only buttons ("Go back", "Add subject", "Notifications", "Search", "Close session", "Today", "Plan", "Subjects", "Settings").
- `aria-pressed` on toggle switches.
- `aria-hidden="true"` on decorative animation container (Session Missed).
- Radio groups use `name` for grouping and hidden inputs (`sr-only` + `peer`) so keyboard focus follows the visual card.
- Focus rings via Tailwind's `focus:ring-2 focus:ring-primary-container focus:ring-offset-2` on the primary session buttons.
- Focus outline on inputs uses `focus:border-primary(-container)`.
- Safe-area padding on mobile bottom nav (`pb-safe` with `env(safe-area-inset-bottom)`).

Requirements the export leaves unstated (must be enforced in implementation):
- All interactive elements keyboard-reachable (visible focus rings — the export applies them inconsistently outside session buttons).
- Color contrast on the sage-on-white palette should be verified before implementation. Primary text `#181a2e` on `#fbf8ff` passes AAA; `on-surface-variant #424842` on `#fbf8ff` passes AA. Muted `outline #727971` on `#fbf8ff` is borderline AA for large text only — use it for icons/labels ≥18px, not body text.
- Reduced motion: the Session Missed and loading animations should be gated behind `@media (prefers-reduced-motion: reduce)` — the export does not implement this.
- Screen-reader announcements for the re-plan flow (Session Missed → Plan Updated) are not specified.
- Non-visual affordance for status accent bars: pair with a text label (already done in session cards — "In Progress" / "Upcoming").
- Timer changes should not rely on colour alone.

---

## 7. Conflicts against existing documentation

The Stitch export contradicts several already-approved docs. Not silently resolved — reported here for your call.

### C1. Session length options
- `REQUIREMENTS.md` F3.5: **30, 45, or 60 min**.
- Stitch Setup step 5: **25, 45, 60, 90**.
- Stitch Settings: **25, 45, 60**.
- Dashboard cards show **40, 30, 25** as example values.
- **Affected**: `REQUIREMENTS.md` F3.5, `DATABASE.md` (`session_length_minutes` allowed values), `USER-FLOWS.md`, `UI.md`, `API.md`.
- **My recommendation**: adopt Stitch's Settings set — **25 / 45 / 60** — as canon. Drop 90 (Setup) because it doesn't appear in Settings, and drop 30 (docs) because it doesn't appear in Stitch. Update `REQUIREMENTS.md` and DB constraint.

### C2. Topic difficulty (1–3)
- `REQUIREMENTS.md` F3.2 + `DATABASE.md` `topics.difficulty`: user rates each topic 1/2/3.
- Stitch: no difficulty input anywhere. Topics are picked from a pre-populated list per subject, then confirmed.
- **My recommendation**: keep difficulty in the data model (it materially affects re-planning quality) but **make it optional in the UI** — either infer it later or hide it behind an "advanced" affordance not present in the current designs. Alternative: drop difficulty from the MVP and update `REQUIREMENTS.md`/`DATABASE.md` accordingly.

### C3. Setup flow shape
- `UI.md`: "**One long scrolling form** (mobile-friendly), not a multi-step wizard."
- Stitch: explicit **5-step wizard** with progress indicator, Back/Continue, Save & Exit.
- **My recommendation**: adopt the wizard — Stitch clearly designed for it and it's better UX for teens. Rewrite the "Onboarding form" section of `UI.md`.

### C4. Availability data model
- `REQUIREMENTS.md` F3.4 + `DATABASE.md` `availability`: one number per day (`minutes`).
- Stitch: **multiple time windows per day** (start/end `HH:MM`), each with add/remove.
- **Affected**: DB schema (would need `availability_windows` table with `day_of_week`, `starts_at TIME`, `ends_at TIME` and multiple rows per day), LLM prompt, re-plan logic.
- **My recommendation**: adopt Stitch's model — it's meaningfully better (LLM can place sessions inside real windows, not just "somewhere in 3 hours"). Requires DB migration and rewriting `DATABASE.md` `availability` section.

### C5. Session action labels
- `REQUIREMENTS.md` F6: **Done / Skip**.
- Stitch: **Complete / Missed** (dashboard), "Mark as missed" (focus screen), "Cancel session" (mid-session).
- **My recommendation**: adopt Stitch's labels. "Missed" is more honest than "Skip" and matches the "Session Missed" screen name.

### C6. Navigation adds a "Subjects" tab not in `UI.md`
- `UI.md` MVP pages: `/`, `/login`, `/signup`, `/onboarding`, `/today`, `/plan`, `/settings` (7 pages).
- Stitch nav has 4 tabs: **Today, Plan, Subjects, Settings** — a Subjects page/tab that has no design in this export beyond the nav item itself.
- **My recommendation**: add `/subjects` to `UI.md` and route it initially to a light "manage my subjects & topics" page (this is a natural home for what's currently sprinkled across onboarding and settings). Alternatively, remove the Subjects tab from the nav.

### C7. Auth screens missing entirely
- `UI.md`/`USER-FLOWS.md` require `/login` and `/signup` with 13+ age gate.
- Stitch exports **no** login or signup screen. Landing page has "Log In" and "Get Started" text links that go nowhere.
- **My recommendation**: implement plain, brand-consistent auth screens ourselves (single form, bottom-border inputs matching §2.4, primary CTA per §2.1) and flag as design gap for a later Stitch pass.

### C8. Focus timer / Pomodoro is present in the design but explicitly out of MVP scope
- `PRODUCT.md` non-goals: "Focus timer / Pomodoro deep integration".
- `DECISIONS.md` D3: the single differentiator is adaptive re-planning, not focus.
- Stitch: **Study Session** and **Pace Mobile Study Session** are full-screen timer experiences with start/pause/finish, progress bar, and "Focus Mode Auto-Start" toggle in Settings.
- **This is the largest conflict.** Recommendation: pick one of:
  - **(a)** Expand MVP scope to include the timer — update `PRODUCT.md`, `REQUIREMENTS.md` (add F10 timer), `DATABASE.md` (need session-elapsed / paused state), `API.md` (start/pause/finish actions).
  - **(b)** Keep MVP scope as-is: implement the "Study Session" screens as static "here's your session — press Complete when you're done" instead of a running timer. The screen exists but the timer is decorative. `DECISIONS.md` records the deferral.
  - I lean **(b)** for the prototype — cheapest, respects the gate, and Stitch's screen still works visually. But it's your call.

### C9. Notifications and Search UI
- No feature requirement for either.
- Stitch top app bars include `notifications` and `search` icon buttons on every authenticated screen.
- **My recommendation**: hide both icons in the MVP build. Do not implement dead controls.

### C10. "Data Analytics" toggle in Settings
- `RULES.md` and `DECISIONS.md` D7: **no third-party analytics, no behavioural SDKs**.
- Stitch Settings: "Share anonymous study data to improve Pace" toggle.
- **My recommendation**: omit the toggle. It contradicts an explicit decision. Do not surface a UI for a capability we've decided not to build.

### C11. "Focus Mode Auto-Start" toggle in Settings
- No such feature in requirements.
- Tied to C8. Omit unless C8 resolves toward option (a).

### C12. Personalization ("Good Morning, Alex")
- `DATABASE.md` `profiles` has no first-name field.
- Stitch mobile dashboard uses a first name.
- **My recommendation**: add `first_name` (nullable) to `profiles` and prompt for it during onboarding step 1. Fall back to "Good Morning" without a name.

### C13. Border-radius token double-definition
- `pace/DESIGN.md` frontmatter defines: `sm 2px, DEFAULT 4px, md 6px, lg 8px, xl 12px, full 9999px`.
- The tailwind config actually applied in every screen redefines: `DEFAULT 2px, lg 4px, xl 8px, full 12px` (no md, no true full).
- **My recommendation**: adopt the code-level (tailwind config) definitions since they match what the screens actually render. Update the frontmatter or discard it. Note that `rounded-full` here is **not a real pill** (12px only) — this is intentional per DESIGN.md prose.

### C14. Time zone / IANA
- `DATABASE.md` D15: per-user `time_zone`, sessions stored `timestamptz`.
- Stitch: no UI for timezone anywhere.
- **My recommendation**: capture at signup silently (browser `Intl.DateTimeFormat().resolvedOptions().timeZone`); no UI needed. Add a note to `USER-FLOWS.md` describing the invisible capture.

### C15. Session Complete + Session Missed + Plan Updated are separate full-screen flows not in `UI.md`
- `UI.md` names 7 pages; these three transactional screens aren't among them.
- Stitch has full designs for all three, without navigation shells.
- **My recommendation**: treat them as **modal/full-page overlays** triggered from `/today`, not separate routes. They're part of the adaptive-replan flow and don't need distinct URLs.

---

## 8. Missing from the Stitch export

Documented gaps to fill later (either with a follow-up Stitch pass or with plain in-house implementation):
1. **Login and Signup screens** (C7).
2. **Loading spinner / building-plan** exists as a card in `system_states_pace` but no dedicated post-onboarding transition screen ("Building your plan…" full page) — could reuse the state card centered.
3. **Onboarding Step 1 (subjects) vs. Setup steps 2–5**: Stitch has step 1 as its own file (`setup_subjects`) *and* embeds "step 2 topics" inside `setup_almost_ready`. So `setup_almost_ready` really covers steps 2–5 + Review. The "Almost Ready" title implies a distinct screen at the end but there isn't one — the Review step at the end of the wizard is what's meant.
4. **Subjects page** (nav tab exists, no design).
5. **Toast / snackbar** — never appears in the export; UI.md mentions toasts on network failures. Style needs to be designed or improvised (recommend `bg-inverse-surface text-inverse-on-surface`, `rounded-lg`, `shadow-sm`).
6. **Modal / dialog** styling — DESIGN.md prose describes it (solid 60% charcoal backdrop) but no rendered modal appears. The Delete-account confirmation from USER-FLOWS.md needs one.
7. **Warning banner** for "topic no longer fits" (F7.5) — Plan Updated has an adaptation banner style (§2.9) that can be repurposed with `tertiary` or `error-container` tones.
8. **Empty state variants**: only one empty state exists ("You're all clear today"). No design for "No sessions yet — create a plan" post-signup empty state, or "No subjects yet" on the Subjects page.
9. **Dark mode**: tailwind config includes `dark:` classes on nav items, but no dark variants of screens are rendered. Deferred.
10. **Small copy / microcopy** for the age-gate at signup — not in the export.

---

## 9. What lives in the codebase after Phase 4 setup (guidance, not a decision)

- Tailwind config token names (colors, spacing, fontSize, borderRadius) should be copied verbatim from the export into `tailwind.config.ts`.
- Google Fonts: Hanken Grotesk (400/500/600) + Material Symbols Outlined loaded via `<link>` in root layout — cache with `next/font` when possible.
- Material Symbols renders as a font — a small `Icon` wrapper component that sets `font-variation-settings` is preferable to inline styles everywhere.
- Session-card status accent bar, side nav item, and bottom nav item are the three components that will get reused most; build them first.

---

## 10. Resolutions of §7 conflicts (locked)

All 15 conflicts were resolved on 2026-08-23 and recorded in [DECISIONS.md](../development/decisions-log.md) D21–D35. Summary for quick reference during implementation:

| ID | Topic | Resolution |
|---|---|---|
| C1 | Session length | **25 / 45 / 60** — 30 (docs) and 90 (wizard) dropped. |
| C2 | Difficulty | **Removed from UI and schema.** |
| C3 | Setup shape | **5-step wizard** (Stitch) is canonical. |
| C4 | Availability | **Time windows** per weekday, new `availability_windows` table. |
| C5 | Session actions | **Complete / Missed** everywhere. DB status renames `skipped` → `missed`. |
| C6 | Subjects tab | **Kept.** `/subjects` page reusing wizard-step components. |
| C7 | Auth screens | **Built in-house** in the Pace visual system. |
| C8 | Study timer | **Ships.** Start / Pause / Resume / Finish → Complete or Missed. Not a Pomodoro system. Client-side only. |
| C9 | Notifications / search | **Removed** from the top app bar. |
| C10 | Data Analytics setting | **Removed.** |
| C11 | Focus Mode Auto-Start | **Removed.** |
| C12 | First name | **Added** to `profiles`; captured at signup. |
| C13 | Border radius | **Tailwind-config values** are canonical: `rounded` 2px / `rounded-lg` 4px / `rounded-xl` 8px / `rounded-full` 12px. |
| C14 | Timezone | **Auto-detected** from `Intl.DateTimeFormat`. No UI. |
| C15 | Missed / Updated / Complete screens | **In-page overlays** within `/today` (or `/study/[sessionId]` for Session Complete). |

*End of design spec.*
