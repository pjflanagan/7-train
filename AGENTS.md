# 🤖 AGENTS.md — Agent & Assistant Guidelines

Welcome! This document provides context, architectural guardrails, and operational guidelines for AI agents, language models, and developer assistants working on the **Workout Week** repository. 

Please read and adhere to these guidelines to ensure consistency, security, and high engineering quality.

---

## 🎯 Project Overview
**Workout Week** is a premium, modular, single-page weekly fitness planner built with HTML5, Vanilla CSS, jQuery, and browser local storage. It has no compilation/build steps and runs directly by opening `index.html`.

---

## 🏗️ Architectural Guardrails & Tech Stack

Before modifying any code, note the foundational constraints of this codebase:
1. **No Compilation or Build Steps:** Do not introduce Node.js, Webpack, Vite, Babel, npm dependencies, or build scripts unless explicitly instructed. The application must remain a static, frontend-only page runnable via `open index.html`.
2. **Library Stack:**
   - **jQuery (v3.7.1)** for DOM manipulation.
   - **jQuery UI (v1.13.2)** for drag-and-drop actions.
   - **jQuery UI Touch Punch (v0.2.3)** to bridge mouse events to touch screens.
3. **Styling (Vanilla CSS Only):**
   - **DO NOT** introduce Tailwind CSS, Bootstrap, Sass/SCSS, or other styling frameworks.
   - Write modern, standard Vanilla CSS.
   - Maintain the modular stylesheet organization under `css/`.
4. **Layout Constraints:**
   - The desktop view utilizes a **locked viewport screen layout** behavior (restricted within columns, no global page scroll on desktop).
   - Ensure media queries in `css/modal.css` or `css/base.css` handle mobile responsive views gracefully.

---

## 📂 File Structure & Responsibilities

Keep files decoupled and respect their designated scopes:

| File Path | Primary Responsibility |
|---|---|
| `index.html` | App skeleton, modals, template structures, and third-party CDN scripts. |
| `css/style.css` | Main entry point that imports modular CSS files. |
| `css/base.css` | Global zinc-dark variables, resets, core layout grids, and headers. |
| `css/sidebar.css` | Goals list, progress indicators, stats cards, and sidebar interactions. |
| `css/calendar.css` | Weekly grid columns, drag-and-drop calendar slots, and inline capsule inputs. |
| `css/modal.css` | Overlays, responsive flexboxes/grids, color picker presets, and mobile overrides. |
| `js/app.js` | Main orchestrator initializing event handlers, modal triggers, and UI bindings. |
| `js/storage.js` | Service layer wrapper managing localStorage operations and default states. |
| `js/progress.js` | Pure mathematical operations determining goal completion and total progress. |
| `js/workout-types.js` | Goal definition manager (defining goals, styling, adding custom goal metadata). |
| `js/calendar.js` | Calendar planner manager (interpreting drag-and-drop events and editing scheduled items). |

---

## 🧠 Guidelines for AI Agents & Assistant Workflows

When editing or proposing changes in this workspace, follow these best practices:

### 1. Code Changes & Surgical Edits
- **Prefer Precise Modifications:** Use precise tools (like `replace`) to apply surgical changes instead of overwriting whole files.
- **Maintain Idiomatic Quality:** Follow the current ES6 JavaScript style and clean Vanilla CSS naming conventions (using CSS variables where applicable).
- **No Hacks:** Avoid suppressing linters or bypassing standard type systems. Write self-documenting code with clear variable and function names.

### 2. UI & Aesthetic Excellence
- **Vibrant Zinc Theme:** Respect the dark slate / zinc theme palette and its interactive states.
- **Micro-interactions:** Ensure drag-and-drop operations remain smooth and provide instant visual feedback (e.g., active drop-zone borders, smooth progress bar transitions).
- **Mobile Compatibility:** Always verify that modifications do not break the jQuery UI Touch Punch event translation. Drag-and-drop must work seamlessly on both mobile devices and desktop.

### 3. Agent Execution & Delegation (for Gemini CLI)
- For broad research or intensive investigations, consider using the **`codebase_investigator`** sub-agent to keep the main context window lean.
- For high-volume terminal command output or complex bulk modifications, delegate to the **`generalist`** sub-agent.
- For CLI help, configurations, or custom agent policies, run the **`cli_help`** sub-agent.
