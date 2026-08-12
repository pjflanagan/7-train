
# Prompt

If we are going to add integrations, we first have to make this a real app. To do that, we will be using Nextjs and hosting on Vercel. Let's make a plan to convert this repo to a Nextjs app.

- Document every feature we currently have and how it will have to change
- Be sure to plan:
  - elements for input and things like modals
  - components for business logic
  - useful named hooks
- Write about libraries that are helpful like clsx, react-hooks, and react-icons (I prefer these to Google icons), anything for drag and drop.
- Use scss and not tailwind, use component and element level scss in files that share the same name (ie `Dropdown.module.scss`)
- Write out the steps to take in order to do that plan, be specific

I will hand off the plan to a different AI to execute.

---

# Plan

> **Audience:** the AI agent executing this migration. Read the whole document before writing code.
> **Goal:** convert the static jQuery/vanilla-CSS app into a Next.js (App Router) + TypeScript + SCSS Modules app deployed on Vercel, with no feature regressions, and with a data layer that is ready for Garmin/Strava/Google integrations.

---

## 1. Current state (what exists today)

Static site, no build step. Open `index.html` and it runs.

| File | Lines | Role |
|---|---|---|
| `index.html` | 599 | Whole DOM: header, two week sections, 14 day columns, 5 modals |
| `css/style.css` | 6 | `@import` manifest |
| `css/base.css` | 295 | CSS variables (zinc-dark), resets, locked-viewport layout, header |
| `css/sidebar.css` | 356 | Goal cards, small goal cards, progress bars |
| `css/calendar.css` | 611 | Week grid, day columns, scheduled cards, inline inputs, drop states |
| `css/modal.css` | 324 | Overlays, tabs, color/icon pickers, mobile overrides |
| `js/app.js` | 245 | Orchestrator: modal open/close, links CRUD, CSV export, Escape key |
| `js/storage.js` | 348 | localStorage service + defaults + week-rollover archiving |
| `js/progress.js` | 111 | Pure progress math (per-goal + overall) |
| `js/workout-types.js` | 777 | Goal CRUD, goal modal, small goal cards, draggables |
| `js/calendar.js` | 600 | Calendar render, sortable/droppable, item CRUD, copy/clear week |
| `js/weather.js` | 195 | 4-layer geolocation + Open-Meteo 7-day forecast |

Runtime deps (all CDN): jQuery 3.7.1, jQuery UI 1.13.2, jQuery UI Touch Punch 0.2.3, Google Material Icons, Plus Jakarta Sans.

### 1.1 Data model (as stored today)

```ts
// localStorage key: workout_week_types
type WorkoutType = {
  id: string;              // 'type-run' | 'type-<timestamp>'
  name: string;
  icon: string;            // Material icon ligature, e.g. 'directions_run'
  metric: 'distance' | 'duration' | 'times';
  unit: string;            // 'miles' | 'mins' | 'times' (free text)
  target: number | null;   // null when optional
  color: string;           // hex
  optional?: boolean;
  workoutTypes?: string[]; // sub-tags, e.g. ['Long Run','Tempo Run']
  links?: { id: string; title: string; url: string }[];
};

// localStorage key: workout_week_calendar
type CalendarItem = {
  id: string;
  typeId: string;
  day: 'monday' | ... | 'sunday';
  week?: 1 | 2;                // legacy items may omit → treated as 1
  value: number;               // always 1 for metric 'times'
  workoutType?: string | null; // selected sub-tag
};

// workout_week_notes   → Record<`${day}-${week}`, string>
// workout_week_links   → { id, title, url }[]   (global helpful links)
// workout_week_history → { id, date, day, typeId|null, workoutType|null, value|null, notes|null }[]
// workout_week_last_viewed_monday → 'YYYY-MM-DD'
```

Order is positional: goal order = array order in `workout_week_types`; card order within a day = array order in `workout_week_calendar` filtered by day+week.

---

## 2. Feature inventory and how each one changes

Every row below is a regression-test checklist item. Nothing here may be dropped.

### 2.1 Layout & shell

| # | Feature today | After migration |
|---|---|---|
| 1 | Locked viewport desktop layout, no page scroll; columns scroll internally | Same CSS behaviour, moved to `app/layout.tsx` + `AppShell.module.scss`. Use `dvh` units instead of `vh` for mobile correctness. |
| 2 | Header with app title, "My Week", "Links", "Settings", "Add goal" buttons | `<AppHeader>` component; buttons become `<IconButton>` / `<Button>` elements. |
| 3 | Two stacked week sections (Week 1 = this week, Week 2 = next week) | `<WeekSection week={1|2}>` rendered from a `WEEKS` constant, not duplicated markup. |
| 4 | 7 day columns per week, `data-day` / `data-week` attributes drive everything | `<DayColumn day week>`; the `data-*` selectors disappear — state lives in React, not the DOM. |
| 5 | Google Material Icons via font ligatures | **Replaced with `react-icons`** (see §4). Requires an icon-key migration (§6.3). |
| 6 | Plus Jakarta Sans via Google Fonts `<link>` | `next/font/google` — self-hosted, no layout shift, no external request. |

### 2.2 Goals ("workout types")

| # | Feature today | After migration |
|---|---|---|
| 7 | Default seed of 5 goals on first run | Seeded in the store's hydrate step, unchanged shape. |
| 8 | Small goal cards per week showing icon, name, current/target, %, progress bar | `<GoalChip>`; progress comes from a `useWeekProgress(week)` selector, not a re-render of the world. |
| 9 | Inline editable weekly target input on the small card (live-updates bar on `input`, commits + full re-render on `change`) | `<InlineNumberInput>` with a debounced commit (300 ms) + commit on blur/Enter. Removes the manual DOM-poking in `workout-types.js:459-497`. |
| 10 | "Optional" goals: no target, no bar, shows "Logged: N unit", excluded from overall % | Same logic, moved into `lib/progress.ts` unchanged. |
| 11 | Sub-tag chips on goal card, each independently draggable | `<SubTagChip>` as its own drag source (`dnd-kit` draggable with `data.kind: 'subtag'`). |
| 12 | Link icon on goal card → 1 link opens directly, >1 opens a picker modal | `<GoalLinksButton>`; picker becomes `<GoalLinksPickerModal>`. Keep the "don't start a drag" behaviour via `dnd-kit`'s activation constraint rather than `stopPropagation` on mousedown. |
| 13 | "My Week" modal listing all goals, drag-to-reorder by handle, edit/delete | `<MyWeekModal>` + `<SortableGoalList>` (`dnd-kit` `verticalListSortingStrategy`). |
| 14 | Add/Edit goal modal with 4 tabs: Basic, Workout Types (sub-tags), Links, Appearance (color presets + custom picker, icon grid) | `<GoalFormModal>` with `<Tabs>`; form state via `react-hook-form` + `zod`. Tabs get real ARIA roles and keyboard arrow navigation (currently none). |
| 15 | Metric change auto-sets unit; Optional checkbox hides target and seeds a default | Derived in the form via `watch()`, no imperative `.trigger('change')`. |
| 16 | Delete goal → `confirm()` → also deletes all its calendar items | `<ConfirmDialog>` component replaces `window.confirm`. Cascade delete stays in the store action. |

### 2.3 Calendar

| # | Feature today | After migration |
|---|---|---|
| 17 | Drag a goal from the week's goal strip into any day column | `dnd-kit`: goal chip = draggable, day column = droppable. |
| 18 | Drag a sub-tag chip → creates an item pre-tagged with that sub-tag | Same, distinguished by drag `data.kind`. |
| 19 | Drag scheduled cards between days **and** reorder within a day | `dnd-kit` `SortableContext` per day + a shared `DndContext` across all 14 days. |
| 20 | Drop onto an empty column (including its header/notes area) | Whole `<DayColumn>` is the droppable; no separate `.droppable()` hack. **Deletes the `dragHandled` race-guard flag** (`calendar.js:261,284,346`) — a single `onDragEnd` handler makes it unnecessary. |
| 21 | Custom drag helper (colored pill with icon + name) | `<DragOverlay>` rendering `<DragPreviewCard>`. |
| 22 | Drop-zone visual states (`day-droppable-active` / `-hover`, dashed placeholder) | `clsx` on `isOver` / `active` from `useDroppable`. |
| 23 | Touch support via Touch Punch | Native — `dnd-kit`'s `TouchSensor` with a 200 ms delay + 5 px tolerance. Touch Punch is deleted. |
| 24 | Scheduled card: colored by goal, icon, name, remove button | `<ScheduledCard>`. Inline `style` for the goal color stays (it's dynamic); everything else moves to SCSS. |
| 25 | Sub-tag `<select>` on the card when the goal has sub-tags | `<Select>` element component. |
| 26 | Inline value input (distance/duration only), empty allowed while typing, falls back to 1 on blur | `<InlineNumberInput>` — same component as #9, same semantics. |
| 27 | `times` metric renders a compact capsule, value forced to 1 | Same. Note the current code *writes* to storage during render (`calendar.js:141-144`) — move that normalization into the store's hydrate/migrate step, never into render. |
| 28 | Day column header shows "Monday - 12"; today's column highlighted; refreshed every 60 s | `useCurrentDate()` hook with a `setInterval` that only updates when the day actually changes. Dates must be computed client-side after mount to avoid SSR/client hydration mismatch (§7.2). |
| 29 | Free-text notes textarea per day, autosaved on every keystroke | `<DayNotes>` with a 400 ms debounced write. |
| 30 | Per-week progress tracker bar (percent, "N of M goals met") | `<WeekProgressBar>`. |
| 31 | "Copy week" → Week 1 items + notes overwrite Week 2 | Store action `copyWeek(1, 2)`, guarded by `<ConfirmDialog>`. |
| 32 | "Clear week 1" / "Clear week 2" | Store actions, confirm dialog. |

### 2.4 Week rollover & history

| # | Feature today | After migration |
|---|---|---|
| 33 | On load, compare stored Monday to real Monday; archive elapsed weeks into history; Week 2 → Week 1; clear if >1 week passed | Moves to `lib/weekRollover.ts` as a **pure function** `computeRollover(state, today) → newState`. Called once from a client-side `useEffect` on mount. Making it pure is what makes it unit-testable — today it's untestable because it reads/writes localStorage inline. |
| 34 | CSV export of history (7 columns, RFC-escaped) | `lib/csv.ts` + `useCsvExport()`. Same columns, same escaping. |
| 35 | "Reset everything" → clears all keys → `window.location.reload()` | Store action `resetAll()` + normal React re-render. No page reload. |

### 2.5 Weather

| # | Feature today | After migration |
|---|---|---|
| 36 | 4-layer location resolution: ipapi.co → freeipapi.com → browser geolocation → NYC | **Layers 1–2 move to a Next.js Route Handler** `app/api/weather/route.ts`, so third-party rate limits/keys are server-side and CORS stops mattering. Browser geolocation stays client-side (it must). |
| 37 | Open-Meteo 7-day forecast, °F for US / °C elsewhere | Fetched in the route handler with `next: { revalidate: 1800 }`. |
| 38 | Weather pill (WMO code → icon + color + temp) in each Week 1 day header | `<WeatherPill>`; `getWeatherDetails()` moves to `lib/weather.ts` with `react-icons` instead of Material Symbols. |
| 39 | Resolved location shown in Settings modal (reverse-geocode fallback) | Same, from the route handler response. |

### 2.6 Modals & global UI

| # | Feature today | After migration |
|---|---|---|
| 40 | 5 overlays toggled by `.active` class: goal form, settings, links, my-week, goal-links-picker | One `<Modal>` primitive + a `useModal()` / modal-store so only one owner controls open state. |
| 41 | Close on overlay click, close on Escape (a single handler closes *all* modals) | `<Modal>` handles Escape/overlay/focus-trap itself, closing only the topmost. |
| 42 | Global "Helpful links" CRUD in the Links modal | `<LinksModal>`; the hand-written inline-styled HTML strings in `app.js:118-141` become real components. |
| 43 | `window.confirm` / `window.alert` in 6 places | `<ConfirmDialog>` + a toast (`sonner`) for the "no history yet" alert. |
| 44 | Settings modal: weather location, export CSV, clear weeks, reset app | `<SettingsModal>`, same actions. |

### 2.7 Things that are new because of the platform

- **SSR/hydration**: all state comes from localStorage, so the first server render has no data. Handle deliberately — see §7.2.
- **`suppressHydrationWarning` is not the fix**; a hydration gate is.
- **Vercel deploy**, preview URLs per PR.
- **Type safety**: the whole data model becomes zod schemas, which also gives us safe parsing of old localStorage payloads.

---

## 3. Target architecture

```
workout-plan/
├── app/
│   ├── layout.tsx                 # html/body, font, providers
│   ├── page.tsx                   # renders <PlannerPage />
│   ├── globals.scss               # resets + :root custom properties only
│   └── api/
│       └── weather/route.ts       # geo + Open-Meteo proxy
├── components/
│   ├── elements/                  # dumb, reusable, no app knowledge
│   │   ├── Button/                # Button.tsx + Button.module.scss
│   │   ├── IconButton/
│   │   ├── Modal/
│   │   ├── ConfirmDialog/
│   │   ├── Tabs/
│   │   ├── TextInput/
│   │   ├── NumberInput/
│   │   ├── InlineNumberInput/
│   │   ├── Select/
│   │   ├── Textarea/
│   │   ├── Checkbox/
│   │   ├── ColorPicker/
│   │   ├── IconPicker/
│   │   ├── TagInput/
│   │   ├── ProgressBar/
│   │   └── Badge/
│   └── features/                  # app-aware, composed of elements
│       ├── AppShell/
│       ├── AppHeader/
│       ├── planner/
│       │   ├── PlannerPage/
│       │   ├── WeekSection/
│       │   ├── WeekProgressBar/
│       │   ├── GoalStrip/
│       │   ├── GoalChip/
│       │   ├── SubTagChip/
│       │   ├── DayColumn/
│       │   ├── ScheduledCard/
│       │   ├── DayNotes/
│       │   ├── WeatherPill/
│       │   ├── DragPreviewCard/
│       │   └── PlannerDndProvider/
│       ├── goals/
│       │   ├── MyWeekModal/
│       │   ├── SortableGoalList/
│       │   ├── GoalRow/
│       │   ├── GoalFormModal/
│       │   └── GoalLinksPickerModal/
│       ├── links/LinksModal/
│       └── settings/SettingsModal/
├── hooks/
│   ├── usePlannerStore.ts
│   ├── useWeekProgress.ts
│   ├── useGoal.ts
│   ├── useDayItems.ts
│   ├── useCurrentDate.ts
│   ├── useWeekRollover.ts
│   ├── useWeather.ts
│   ├── useCsvExport.ts
│   ├── useDebouncedCallback.ts
│   ├── useHydrated.ts
│   ├── useConfirm.ts
│   └── usePlannerDnd.ts
├── lib/
│   ├── types.ts                   # zod schemas + inferred TS types
│   ├── store.ts                   # zustand store + persist
│   ├── migrate.ts                 # localStorage v0 → v1
│   ├── progress.ts                # ported from js/progress.js (pure)
│   ├── weekRollover.ts            # ported from storage.js (made pure)
│   ├── dates.ts                   # getMonday, formatDateLocal, DAYS
│   ├── csv.ts
│   ├── icons.ts                   # icon key → react-icons component map
│   ├── weather.ts                 # WMO code → icon/desc/color
│   └── constants.ts               # PRESET_COLORS, DEFAULT_*
├── styles/
│   ├── _variables.scss
│   ├── _mixins.scss
│   └── _breakpoints.scss
└── __tests__/                     # vitest
```

### 3.1 Three-layer component rule

1. **`components/elements/*`** — knows nothing about workouts. Takes props, emits callbacks. No store imports. Reusable in any app.
2. **`components/features/*`** — knows the domain. Reads the store via hooks, composes elements. Contains no raw `<input>`/`<button>` styling.
3. **`hooks/*` + `lib/*`** — business logic. `lib/` is pure and unit-tested; `hooks/` binds pure logic to React/store.

If a component needs a styled `<button>`, it belongs in `elements/`. If it needs to know what a "sub-tag" is, it belongs in `features/`.

### 3.2 State management: Zustand + `persist`

Use **zustand** with the `persist` middleware backed by localStorage. Why not Context: the current app re-renders everything on any change (`render()` calls `WorkoutTypes.render()` calls `Calendar.render()`); zustand's selector subscriptions are exactly the fix, and `persist` replaces `js/storage.js` wholesale.

One store, sliced:

```ts
type PlannerStore = {
  goals: WorkoutType[];
  items: CalendarItem[];
  notes: Record<string, string>;
  links: HelpfulLink[];
  history: HistoryEntry[];
  lastViewedMonday: string | null;

  // goals
  addGoal, updateGoal, deleteGoal, reorderGoals, setGoalTarget,
  // items
  addItem, updateItemValue, setItemSubType, removeItem, moveItem, reorderDay,
  // notes / weeks
  setNote, copyWeek, clearWeek,
  // links
  addLink, removeLink,
  // lifecycle
  applyRollover, resetAll,
};
```

`persist` config: `name: 'workout-week'`, `version: 1`, `migrate` → `lib/migrate.ts`, `partialize` excluding nothing (everything is persisted today).

**Critical:** all six legacy localStorage keys must be read once and folded into the new single `workout-week` key so existing users don't lose data. See §6.2.

---

## 4. Libraries

### Required

| Library | Why |
|---|---|
| **next** (App Router) + **react** + **typescript** | The platform. |
| **sass** | SCSS Modules. Next.js supports `*.module.scss` natively once `sass` is installed. **No Tailwind.** |
| **zustand** | Store + `persist` middleware. Replaces `js/storage.js`. |
| **zod** | Schema-validate localStorage payloads and form input. Untrusted persisted data is exactly what zod is for. |
| **clsx** | Conditional class names — `clsx(s.column, isOver && s.isOver, isToday && s.isToday)`. Replaces the `addClass`/`removeClass` calls throughout. |
| **react-icons** | Requested over Google Material Icons. Tree-shaken, no font load, no FOUT, real React components. Prefer the `Lu` (Lucide) set for UI chrome and `Md` for activity icons. |
| **@dnd-kit/core** + **@dnd-kit/sortable** + **@dnd-kit/utilities** | Drag and drop. See below. |
| **react-hook-form** + **@hookform/resolvers** | The goal form has 10+ fields across 4 tabs; uncontrolled RHF avoids re-rendering the whole modal per keystroke. Pairs with zod via the resolver. |

### Recommended

| Library | Why |
|---|---|
| **sonner** | Toasts, replacing `alert()`. Tiny, no config. |
| **vitest** + **@testing-library/react** | Unit tests for `lib/` (progress math, rollover, CSV) — the highest-value tests, currently impossible to write. |
| **@vercel/analytics** | One line, free on Vercel. |

### Drag and drop: use `@dnd-kit`

The app needs: cross-container drag (goal strip → day), container-to-container move (day → day), reorder-within-container, custom drag preview, and touch support.

- **`@dnd-kit`** — accessible (keyboard drag included, which the app has never had), first-class touch sensors, `DragOverlay` for the custom helper, `SortableContext` per day for reordering. Actively maintained, no dependency on HTML5 DnD (which is broken on mobile). **This is the choice.**
- `react-beautiful-dnd` — deprecated/unmaintained; its fork `@hello-pangea/dnd` works but has no good story for "drag from an external palette into a list", which is feature #17/#18. Reject.
- HTML5 native DnD — no touch support. Reject; that's why Touch Punch exists today.

Sensor config to match the current feel:

```ts
useSensors(
  useSensor(PointerSensor,  { activationConstraint: { distance: 5 } }),
  useSensor(TouchSensor,    { activationConstraint: { delay: 200, tolerance: 5 } }),
  useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
)
```

`distance: 5` on pointer is what lets the link button inside a draggable card still be clickable (feature #12) without `stopPropagation`.

### Explicitly not used

- Tailwind (excluded by the brief) — SCSS Modules only.
- jQuery, jQuery UI, Touch Punch — all deleted.
- Any CSS-in-JS runtime.

---

## 5. Styling conventions

- **One `.module.scss` per component, same basename, same folder.** `Dropdown.tsx` ↔ `Dropdown.module.scss`.
- **Global scope is only:** `app/globals.scss` (reset + `:root` custom properties + font-family) and the `styles/_*.scss` partials (variables/mixins/breakpoints), which are `@use`-imported into modules — never emitted globally.
- Keep the existing CSS custom properties verbatim in `:root` (`--bg-primary: #090d16` … `--box-shadow-premium`). They're already the theme system; SCSS variables are for build-time things (breakpoints, mixins) only. Dynamic per-goal colors keep using inline `style` or a CSS var: `style={{ '--goal-color': goal.color } as CSSProperties}`.
- `@use 'variables' as *;` at the top of each module (configure `sassOptions.includePaths` to point at `styles/`).
- Class naming inside modules: flat, camelCase, local — `.card`, `.cardHeader`, `.isDragging`. No BEM, no nesting past 2 levels.
- Nothing that exists in a module gets duplicated as an inline `style` prop. The current code has ~40 inline style strings (e.g. `workout-types.js:392`, `app.js:120`) — every one of them moves into SCSS unless it's a runtime color.

Mixins worth having in `_mixins.scss`: `focus-ring()`, `truncate()`, `scroll-area()` (the custom scrollbar in the columns), `card-surface()`, `respond-to($bp)`.

---

## 6. Migration risks and how to handle them

### 6.1 Full-tree re-render (a correctness issue, not just perf)

`Calendar.render()` empties and rebuilds all 14 day containers and re-binds every listener. Two consequences the new code must consciously handle:

- A focused notes textarea is skipped during repopulation (`calendar.js:119`) — a hack for exactly this problem. In React, controlled inputs make it a non-issue; **do not port the `:focus` check.**
- `render()` mutates storage mid-render (`calendar.js:141-144` forces `value = 1` for `times` goals). Move to `migrate.ts`/`applyRollover`. Never write during render.

### 6.2 Existing users' data

Users have data under six separate localStorage keys. On first load of the new app:

```ts
// lib/migrate.ts
export function importLegacy(): Partial<PlannerState> | null {
  const raw = {
    types:   localStorage.getItem('workout_week_types'),
    items:   localStorage.getItem('workout_week_calendar'),
    notes:   localStorage.getItem('workout_week_notes'),
    links:   localStorage.getItem('workout_week_links'),
    history: localStorage.getItem('workout_week_history'),
    monday:  localStorage.getItem('workout_week_last_viewed_monday'),
  };
  if (Object.values(raw).every(v => v == null)) return null;
  // parse each with its zod schema, falling back to the default on failure,
  // then localStorage.removeItem() all six
}
```

Run this **before** zustand hydrates (in `onRehydrateStorage` or a pre-hydration bootstrap), and only when the new `workout-week` key is absent. Normalize while you're there: default `week` to `1`, force `value` to `1` for `times` goals, default `workoutTypes`/`links` to `[]`.

### 6.3 Icons: Material ligature strings → `react-icons` components

Goals persist `icon: 'directions_run'` — a Material ligature. Do **not** try to keep the string as a component reference.

Build `lib/icons.ts`:

```ts
export const ACTIVITY_ICONS = {
  run:        { label: 'Run',        Icon: MdDirectionsRun,    legacy: 'directions_run' },
  gym:        { label: 'Gym',        Icon: MdFitnessCenter,    legacy: 'fitness_center' },
  bike:       { label: 'Bike',       Icon: MdDirectionsBike,   legacy: 'directions_bike' },
  swim:       { label: 'Swim',       Icon: MdPool,             legacy: 'pool' },
  yoga:       { label: 'Yoga',       Icon: MdSelfImprovement,  legacy: 'self_improvement' },
  walk:       { label: 'Walk',       Icon: MdDirectionsWalk,   legacy: 'directions_walk' },
  skate:      { label: 'Skate',      Icon: MdRollerSkating,    legacy: 'roller_skating' },
  row:        { label: 'Row',        Icon: MdRowing,           legacy: 'rowing' },
  tennis:     { label: 'Tennis',     Icon: MdSportsTennis,     legacy: 'sports_tennis' },
  gymnastics: { label: 'Gymnastics', Icon: MdSportsGymnastics, legacy: 'sports_gymnastics' },
  combat:     { label: 'Combat',     Icon: MdSportsKabaddi,    legacy: 'sports_kabaddi' },
  other:      { label: 'Other',      Icon: MdHelpOutline,      legacy: 'help_outline' },
} as const;

export type IconKey = keyof typeof ACTIVITY_ICONS;
```

The `legacy` field drives migration (`'directions_run'` → `'run'`); unknown values fall back to `'other'`. Store `IconKey` going forward. UI chrome icons (close, edit, delete, drag, link, settings, external-link, chevron) come straight from `react-icons/lu` and are never persisted.

### 6.4 Positional ordering

Order is implicit in array position and is rebuilt from the DOM (`saveLayoutFromDOM`, `saveGoalsOrderFromDOM`). With `dnd-kit`, reorder happens in the store via `arrayMove` — the DOM is never read. Keep the array-position convention (don't introduce an `order` field); it's simpler and the migration is a no-op.

### 6.5 `week` as a magic number

`week: 1 | 2` is relative to "the current Monday", which is why rollover has to shift everything. This is the right thing to change when integrations land (real dates), but **do not change it in this migration.** Keep `week: 1 | 2` and note it as follow-up work. Scope discipline here is what keeps the migration reviewable.

---

## 7. Next.js specifics

### 7.1 Client vs server

This is a localStorage app: essentially everything under `components/` is `'use client'`. Keep server components for `app/layout.tsx`, `app/page.tsx` (shell only), and the weather route handler. Don't fight it — the value of Next.js here is the build system, routing, API routes for integrations, and Vercel deploy, not RSC.

### 7.2 Hydration

Server renders with no localStorage. Rendering goal cards on the server produces markup that won't match the client → hydration error.

Use an explicit gate:

```ts
// hooks/useHydrated.ts
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
```

`<PlannerPage>` renders a skeleton (correct layout, no data) until `useHydrated() && usePlannerStore.persist.hasHydrated()`. The same gate covers "today's date" (feature #28) — computing dates during SSR would bake in the server's timezone.

### 7.3 Weather route handler

```
GET /api/weather?lat=&lon=   → forecast for explicit coords
GET /api/weather             → server resolves via IP, then forecasts
```

Response: `{ location: { city, region, lat, lon }, unit: '°F' | '°C', days: [{ date, code, tempMax }] }`.
Use `export const revalidate = 1800`. The client calls it from a plain `useWeather()` hook — no data-fetching library needed at this scale.

### 7.4 Deployment

`framework: nextjs` auto-detected. No env vars required for the initial migration (Open-Meteo and the IP services are keyless). Add `vercel.json` only if custom headers are needed.

---

## 8. Execution steps

Each step should be one commit. Steps 2–14 keep the old app working in-place (it's untouched until step 15), so the migration is never in a broken state on `main`.

### Step 1 — Scaffold

1. Move `index.html`, `css/`, `js/` into `legacy/` so the old app stays runnable and out of the way.
2. `npx create-next-app@latest . --typescript --app --no-src-dir --no-tailwind --import-alias "@/*"`
3. `npm i zustand zod clsx react-icons @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-hook-form @hookform/resolvers sonner`
4. `npm i -D sass vitest @testing-library/react @testing-library/user-event jsdom @vitejs/plugin-react`
5. `next.config.ts`: `sassOptions: { includePaths: [path.join(__dirname, 'styles')] }`.
6. `.gitignore`: add `node_modules`, `.next`, `.vercel`.
7. Verify `npm run dev` serves a blank page.

### Step 2 — Design tokens

1. `styles/_variables.scss`, `_mixins.scss`, `_breakpoints.scss`.
2. `app/globals.scss`: reset + `:root { … }` with every custom property copied verbatim from `legacy/css/base.css`.
3. `app/layout.tsx`: `next/font/google` Plus Jakarta Sans, `<Toaster />`, `<html lang="en">`.
4. Render a throwaway swatch page to confirm the palette matches.

### Step 3 — Types and pure logic (no UI)

1. `lib/types.ts` — zod schemas for `WorkoutType`, `CalendarItem`, `HelpfulLink`, `HistoryEntry`, `PlannerState`; export inferred types.
2. `lib/constants.ts` — `DAYS`, `PRESET_COLORS`, `DEFAULT_WORKOUT_TYPES`, `DEFAULT_CALENDAR_ITEMS`, `DEFAULT_LINKS` (copied from `storage.js`, with `icon` remapped to `IconKey`).
3. `lib/dates.ts` — `formatDateLocal`, `getMonday(date)`, `dayIndex`, `dayLabel`.
4. `lib/progress.ts` — direct port of `js/progress.js`. Behaviour must be identical, including the "no required goals" fallback branch.
5. `lib/weekRollover.ts` — port `checkAndProcessWeekTransition` as `computeRollover(state, today): PlannerState`. No I/O.
6. `lib/csv.ts` — port the export logic; return a string, don't touch the DOM.
7. `lib/icons.ts`, `lib/weather.ts`.
8. **Tests:** `__tests__/progress.test.ts`, `weekRollover.test.ts` (0 / 1 / 2 / 3+ weeks elapsed, clock-went-backwards), `csv.test.ts` (quotes, commas, newlines, nulls). This is the step that makes the rest safe — don't skip it.

### Step 4 — Store

1. `lib/migrate.ts` — `importLegacy()` + `migrate(persisted, version)`.
2. `lib/store.ts` — zustand + `persist`, all actions from §3.2.
3. `hooks/usePlannerStore.ts` — typed selector helpers (`useGoals()`, `useGoal(id)`, `useDayItems(day, week)`, `useNote(day, week)`).
4. `hooks/useWeekProgress.ts` — memoized `calculateProgress` + `getOverallProgress` per week.
5. Test: seed the six legacy keys in jsdom → assert `importLegacy()` produces the expected state and clears the old keys.

### Step 5 — Element components

Build in this order, each with its `.module.scss`, each rendered in isolation before moving on:
`Button`, `IconButton`, `Badge`, `ProgressBar`, `TextInput`, `Textarea`, `NumberInput`, `Checkbox`, `Select`, `InlineNumberInput`, `Modal`, `ConfirmDialog`, `Tabs`, `ColorPicker`, `IconPicker`, `TagInput`.

`Modal` requirements (it carries a lot of weight): portal to `document.body`, Escape closes topmost only, overlay click closes, focus trap, `aria-modal` + `aria-labelledby`, body scroll lock, restore focus on close.

`InlineNumberInput` requirements (used by features #9 and #26): allows an empty string while typing, calls `onLiveChange` on valid input, calls `onCommit` on blur/Enter with the fallback applied.

### Step 6 — Shell

`AppShell`, `AppHeader`. Port `css/base.css` layout: locked viewport (`100dvh`, `overflow: hidden` on desktop), header row, week sections area. Mobile breakpoint relaxes the lock to normal scroll.

### Step 7 — Read-only planner

`PlannerPage` → `WeekSection` ×2 → `WeekProgressBar`, `GoalStrip` (`GoalChip` + `SubTagChip`), `DayColumn` (header + `DayNotes` + `ScheduledCard` list). Wire the hydration gate + skeleton. No drag, no modals yet. Port `css/calendar.css` and `css/sidebar.css` into the respective modules.

At the end of this step the app should *look* identical to the current one, side by side, with real migrated data.

### Step 8 — Inline editing

`ScheduledCard` value input, sub-tag `<select>`, remove button; `GoalChip` inline target input; `DayNotes` debounced autosave. Features #9, #25, #26, #29.

### Step 9 — Drag and drop

1. `PlannerDndProvider` — one `DndContext` wrapping both weeks, sensors per §4, `DragOverlay` → `DragPreviewCard`.
2. Draggables: `GoalChip` (`{kind:'goal', typeId}`), `SubTagChip` (`{kind:'subtag', typeId, tag}`), `ScheduledCard` (`{kind:'item', itemId}`).
3. Droppables: each `DayColumn` (`{day, week}`), each wrapped in a `SortableContext` over its item ids.
4. `usePlannerDnd` — `onDragStart`/`onDragOver`/`onDragEnd` mapping to store actions `addItem(typeId, day, week, index, tag)`, `moveItem`, `reorderDay`.
5. Drop-zone styling from `isOver`/`active` via `clsx`.
6. Verify on a real touch device: features #17–#23.

### Step 10 — Goal modals

`GoalFormModal` (RHF + zod, 4 tabs, `ColorPicker`, `IconPicker`, `TagInput`, links sub-form), `MyWeekModal` + `SortableGoalList` + `GoalRow` (edit/delete/reorder), `GoalLinksPickerModal`. Features #12–#16.

### Step 11 — Links & settings modals

`LinksModal` (global links CRUD), `SettingsModal` (location text, CSV export via `useCsvExport`, clear week 1/2, copy week, reset app). Replace every `confirm`/`alert`. Features #31, #32, #34, #35, #42, #43, #44.

### Step 12 — Week rollover

`useWeekRollover()` — on mount, after hydration, call `computeRollover(state, new Date())` and `applyRollover()` if it changed. Feature #33. Manually test by setting `lastViewedMonday` back 1, 2, and 3 weeks.

### Step 13 — Weather

`app/api/weather/route.ts` (layers 1–2 + Open-Meteo + reverse geocode), `useWeather()` (calls the route; on a server-side geo failure, retries once with browser-geolocation coords; final fallback is just weather disabled), `WeatherPill` in Week 1 day headers, location line in Settings. Features #36–#39.

### Step 14 — Polish

1. Accessibility: labels on every input, `aria-label` on every icon button, visible focus rings, tab order through modals, keyboard drag (`dnd-kit` gives this free but the screen-reader announcements need writing).
2. Responsive: re-check every breakpoint from `css/modal.css` and `css/base.css`.
3. `next/dynamic` where it helps; check the bundle with `@next/bundle-analyzer`.
4. Lighthouse pass.

### Step 15 — Cut over

2. Delete `legacy/`.
3. Rewrite `README.md` and `AGENTS.md` — **`AGENTS.md` currently forbids exactly this migration** ("No Compilation or Build Steps", "DO NOT introduce … Sass/SCSS"). It must be rewritten to describe the Next.js architecture, the three-layer component rule, the SCSS-module convention, and the no-Tailwind rule.
5. Move `todo/move-to-nextjs.md` into `todo/done/`.

#### Manual (human will do)

1. Walk the full feature table (§2) against the new app with real migrated data. Every numbered row gets ticked.
4. Deploy to Vercel, verify the production URL.

### Step 16 — Integration readiness (not part of this migration; unblocked by it)

With route handlers available, `todo/future/integration-{garmin,strava,google}.md` become tractable: OAuth callbacks under `app/api/auth/*`, a real database instead of localStorage, and `week: 1|2` replaced by real dates (§6.5).

---

## 9. Definition of done

- [ ] Every row in §2 verified by hand against the running app.
- [IGNORE] Existing localStorage data from the old app loads without loss (test with a real pre-migration profile).
- [ ] `lib/progress.ts`, `lib/weekRollover.ts`, `lib/csv.ts`, `lib/migrate.ts` unit-tested.
- [ ] Drag and drop works on desktop mouse, iOS Safari touch, and keyboard.
- [ ] No `window.confirm` / `window.alert` / jQuery / Tailwind anywhere.
- [ ] Every component has a co-located `.module.scss`; no global CSS outside `app/globals.scss` and `styles/`.
- [ ] No hydration warnings in the console.
- [ ] `npm run build` clean; deployed and working on Vercel.
- [ ] `README.md` and `AGENTS.md` updated to the new architecture.
