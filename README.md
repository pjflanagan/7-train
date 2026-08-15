# 7 Train

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

### Google sign in

Optional, and off until it is configured. Signing in with Google is what will
eventually back calendar sync and the spreadsheet export. See
`docs/google-setup.md` for the Google Cloud and environment setup.

### Strava

Optional, and hidden until `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` are
set. Once connected, the app reads this week's and last week's recordings after
the calendar pull, corrects planned workouts to what was actually done, and adds
anything you did without planning. It is its own grant, so it works without a
Google account. See `_todo/-MANUAL-strava-setup.md` for registering the app with
Strava.

### Contributing

See `AGENTS.md` for strict architectural and styling rules before making changes.
