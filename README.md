# 🏋️‍♂️ Workout Week

A premium, modular, single-page weekly fitness planner built with HTML5, vanilla CSS, jQuery, and browser local storage. Define your fitness targets, schedule sessions via intuitive drag-and-drop mechanics, and watch your week completion progress bar fill up in real time as you crush your goals.

![Workout Week App Icon](https://img.shields.io/badge/Workout--Week-Premium_Planner-blue?style=for-the-badge&logo=fitness_center)

---

## ✨ Features & Visual Cues

- **Interactive Drag & Drop:**
  - Drag workout goals from your sidebar directly into any day of the weekly calendar.
  - Easily reschedule active events by **dragging cards between calendar days**!
- **Sleek, Space-Saving Capsules:**
  - Goals measured in **Number of Times** render as minimal, compact capsules on your planner with zero redundant inputs or tags.
  - Goals measured in **Distance** or **Duration** feature auto-saving inline inputs that let you easily backspace to clear and type any planned mileage or minutes.
- **True Incremental Progress:**
  - Your top dashboard progress meter tracks the **true average of each goal's completion rate** (capped at 100%). You get incremental credit for every single mile run, lap swum, or session finished!
- **Premium Dark Slate Theme:**
  - Built on a beautiful zinc-dark palette with vibrant color-coding.
  - Locked viewport screen layout behaves like a desktop dashboard, with scrollable cards restricted within individual columns.
- **Mobile Touch Support:**
  - Features **Touch Punch** bridging to translate mouse events, meaning you can drag, drop, and edit on any tablet or mobile browser.
  - Media queries dynamically relax screen locks to adapt to phone screens.

---

## 🛠️ Tech Stack & Dependencies

No compilation steps, node servers, or Tailwind bloat. Simply open `index.html` to run.
- **Library:** [jQuery (v3.7.1)](https://jquery.com/)
- **Interactions:** [jQuery UI (v1.13.2)](https://jqueryui.com/)
- **Mobile Gestures:** [jQuery UI Touch Punch (v0.2.3)](https://github.com/furf/jquery-ui-touch-punch)
- **Typography:** [Plus Jakarta Sans via Google Fonts](https://fonts.google.com/specimen/Plus+Jakarta+Sans)
- **Icons:** [Google Material Icons](https://fonts.google.com/icons)

---

## 📂 File Architecture

The codebase has been meticulously modularized into specific service layers and layout sheets for ultimate readability and long-term maintainability:

```bash
workout-week/
├── index.html          # Main HTML structure, grid container, and modals
├── PROMPT.md           # Original project specifications
├── README.md           # Project documentation and guide
├── css/
│   ├── style.css       # Main manifest importing CSS modules
│   ├── base.css        # Global variables, page resets, structures, and headers
│   ├── sidebar.css     # Goals library panels, stats card, progress bar animations
│   ├── calendar.css    # 7-day planner grids, drops, scheduled cards, and inline inputs
│   └── modal.css       # Modal overlays, grid elements, color presets, and media queries
└── js/
    ├── app.js          # Core orchestrator tying modal triggers and rendering loops
    ├── storage.js      # Service wrapper managing load/save and default data
    ├── progress.js     # Calculator for individual totals and true overall percentages
    ├── workout-types.js# Sidebar goal manager (creation, editing, custom colors/icons)
    └── calendar.js     # Planner grid manager (drags, drops, values, deletions, and moves)
```

---

## 🚀 Quick Start Guide

Since Workout Week uses standard browser APIs and CDN-hosted dependencies, setup is instantaneous:

1. **Clone or navigate** to the project directory:
   ```bash
   cd workout-plan
   ```
2. **Open `index.html`** in your favorite browser:
   - On macOS:
     ```bash
     open index.html
     ```
   - On Windows:
     ```bash
     start index.html
     ```
   - Or simply double-click `index.html` in your file explorer!

3. **Enjoy your planning!** Play with the pre-populated default goals or click **"+ Add Goal"** to define your custom routine with specialized colors and metric targets.
