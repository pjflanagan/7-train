# Workout Planner

A sleek, responsive, local-first workout planner built for maximum usability and zero loading screens.

## Architecture

This project is a Next.js (App Router) application written in TypeScript. 

### Core Tech Stack
- **Next.js** for the application framework and API routes.
- **Zustand** (with `persist` middleware) for robust, local-first state management.
- **Zod** for schema validation.
- **@dnd-kit** for accessible, touch-friendly drag-and-drop interactions.
- **SCSS Modules** for scoped, modular styling.

### Running Locally

```bash
npm install
npm run dev
```

Then visit `http://localhost:3000`.

### Data Storage

All user data is stored safely in `localStorage`. The application can be used entirely offline, and user progress is kept on-device. An API route is included for live weather data via Open-Meteo.

### Contributing

See `AGENTS.md` for strict architectural and styling rules before making changes.
