<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent Guidelines for Workout Planner

Welcome, Agent. This codebase is a Next.js (App Router) + TypeScript application for a workout planner. It uses Zustand + localStorage for data persistence and SCSS Modules for styling. 

## Architectural Rules

1. **Component Layers:**
   - `components/elements/`: Dumb UI primitives (e.g., Button, Modal, TextInput). They must not have domain logic. Flat — one folder per primitive.
   - Domain components are **nested by render tree**, mirroring page > layout > component > sub-component. Each component owns a folder named after it, containing `X.tsx`, `X.module.scss`, and one sub-folder per component it renders:
     ```
     components/PlannerPage/            page (rendered by app/page.tsx)
       AppShell/                        layout
         AppHeader/
           MyWorkoutsModal/ LinksModal/ ProfileMenu/…
       WeekSection/
         GoalStrip/GoalChip/SubTagChip/
         DayColumn/ScheduledCard/TimeChip/
       MobileDayFeed/MobileDayCard/
     ```
   - A component rendered by two different branches lives at their **lowest common ancestor**, not duplicated or hoisted to the root (e.g. `PlannerPage/WeatherPill/` is used by both `WeekDayHeader` and `MobileDayCard`).
   - Moving a component means moving its folder: adding a child is a new sub-folder, never a new sibling.
   - `lib/` & `hooks/`: Pure logic, Zod schemas, Zustand store, and data-fetching hooks.

2. **Domain vocabulary** (use these words in code, types, styles and UI copy — the old ones are gone):
   - **Activity** (`Activity`, `activities`) — something the user can do, e.g. Running. Managed in "My activities". Never "goal" or "workout type".
   - **Workout type** (`workoutTypes` on an activity) — a sub-kind of one activity, e.g. "Long run". This term stays.
   - **Target** (`weeklyTargets`, `TargetStrip`, `TargetChip`) — how much of an activity a given week aims at. Never "weekly goal".
   - **Event** (`ScheduledEvent`, `events`, `EventCard`) — one scheduled session on the calendar, hitting a target.
   - The persisted keys are `activities` and `events`; `goals`/`items` are the pre-v3 names and appear only inside `migrateStore`.

3. **Imports:**
   - Use the `@/` path alias for anything outside your own subtree (`@/lib/store`, `@/components/elements/Button/Button`). Never use `../` to climb out of a directory.
   - Reserve relative imports for your own folder and descendants (`./Foo.module.scss`, `./DayColumn/DayColumn`).
   - Import the store itself only from `@/lib/store`; `@/hooks/usePlannerSelectors` holds derived selector hooks and does not re-export it.
   - Single quotes for module specifiers.

4. **Styling Constraints:**
   - **STRICTLY NO TAILWIND.** Tailwind CSS is explicitly forbidden.
   - Use SCSS Modules (`.module.scss`) co-located with their respective components.
   - Global variables/mixins are located in `styles/` and should be `@use`-imported inside the `.module.scss` files.

5. **Data Management:**
   - Global state is handled via `zustand` (`usePlannerStore`) combined with `persist` middleware.
   - Always validate data parsing with `zod`.
   - Never perform side effects directly in UI components; dispatch actions to the store.
   - Be mindful of hydration mismatches: wrap client-side logic requiring `window` or `localStorage` behind a `useHydrated` gate.

6. **UI Copy:**
   - **Never use title case.** All user-facing text — buttons, headings, modal titles, labels, placeholders, menu items, toasts — is sentence case: capitalize the first word and proper nouns only.
   - "My activities", not "My Activities". "Add activity", not "Add Activity". "Weekly target", not "Weekly Target".
   - Acronyms keep their casing ("Export CSV"), as do proper nouns ("New York").

7. **Next.js & React:**
   - Use `'use client'` at the top of feature components that rely on state, hooks, or context.
   - The `/app` directory contains the route components (`layout.tsx`, `page.tsx`, `api/`).
