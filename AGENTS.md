<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Agent Guidelines for Workout Planner

Welcome, Agent. This codebase is a Next.js (App Router) + TypeScript application for a workout planner. It uses Zustand + localStorage for data persistence and SCSS Modules for styling. 

## Architectural Rules

1. **Three-Layer Components:**
   - `components/elements/`: Dumb UI primitives (e.g., Button, Modal, TextInput). They must not have domain logic.
   - `components/features/`: Domain-aware components grouped by feature (e.g., `planner/`, `goals/`, `settings/`).
   - `lib/` & `hooks/`: Pure logic, Zod schemas, Zustand store, and data-fetching hooks.

2. **Imports:**
   - Use the `@/` path alias for every cross-directory import (`@/lib/store`, `@/components/elements/Button/Button`). Never use `../` to climb out of a directory.
   - Reserve relative imports for siblings within the same folder (`./DayNotes`, `./Foo.module.scss`).
   - Import the store itself only from `@/lib/store`; `@/hooks/usePlannerSelectors` holds derived selector hooks and does not re-export it.
   - Single quotes for module specifiers.

3. **Styling Constraints:**
   - **STRICTLY NO TAILWIND.** Tailwind CSS is explicitly forbidden.
   - Use SCSS Modules (`.module.scss`) co-located with their respective components.
   - Global variables/mixins are located in `styles/` and should be `@use`-imported inside the `.module.scss` files.

4. **Data Management:**
   - Global state is handled via `zustand` (`usePlannerStore`) combined with `persist` middleware.
   - Always validate data parsing with `zod`.
   - Never perform side effects directly in UI components; dispatch actions to the store.
   - Be mindful of hydration mismatches: wrap client-side logic requiring `window` or `localStorage` behind a `useHydrated` gate.

5. **UI Copy:**
   - **Never use title case.** All user-facing text — buttons, headings, modal titles, labels, placeholders, menu items, toasts — is sentence case: capitalize the first word and proper nouns only.
   - "My workouts", not "My Workouts". "Add goal", not "Add Goal". "Weekly target (optional)", not "Weekly Target (Optional)".
   - Acronyms keep their casing ("Export CSV"), as do proper nouns ("New York").

6. **Next.js & React:**
   - Use `'use client'` at the top of feature components that rely on state, hooks, or context.
   - The `/app` directory contains the route components (`layout.tsx`, `page.tsx`, `api/`).
