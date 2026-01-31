## Rotation On‑Call Keeper (ROCK)

A deterministic, fairness-focused web app for generating and saving **daily on‑call rotations** (00:00–23:59) with **member unavailability** and clear **fairness statistics**.

ROCK is designed for a Tech Lead / on‑call owner who wants to stop doing manual scheduling, avoid mistakes, and keep the workload balanced over time.

### Table of contents

- [1. Project name](#1-project-name)
- [2. Project description](#2-project-description)
- [3. Tech stack](#3-tech-stack)
- [4. Getting started locally](#4-getting-started-locally)
- [5. Available scripts](#5-available-scripts)
- [6. Project scope](#6-project-scope)
- [7. Project status](#7-project-status)
- [8. License](#8-license)

## 1. Project name

**Rotation On‑Call Keeper (ROCK)**

## 2. Project description

ROCK helps teams plan on‑call schedules that are:

- **Deterministic**: the same input always produces the same schedule (stable tie‑breaker based on immutable `memberId`).
- **Fair**: assignments are balanced using an effective counter:
  - `effectiveCount = initialOnCallCount + savedCount + previewCount`
- **Availability‑aware**: a member with unavailability on a given day is skipped; if nobody is available, the day is marked **`UNASSIGNED`**.
- **Auditable**: generated schedules can be previewed and then saved as immutable plans; fairness and `UNASSIGNED` days are visible.

Product requirements and MVP definition live in:

- `./.ai/PRD.md`

## 3. Tech stack

### Frontend

- **Astro 5** (with React islands)
- **React 19**
- **TypeScript 5**
- **Tailwind CSS 4**
- **shadcn/ui** (Radix-based UI building blocks)

### Backend

- **Supabase** (PostgreSQL + Auth + Row Level Security)

### Testing

- **Vitest** (unit/integration tests)
- **Playwright** (E2E tests)

### CI/CD & hosting (as planned in PRD)

- **GitHub Actions** (CI)
- **DigitalOcean** (container-based hosting)

## 4. Getting started locally

### Prerequisites

- **Node.js 22.14.0** (see `.nvmrc`)
- **npm** (bundled with Node)

### Install & run

```bash
npm install
npm run dev
```

Then open the URL printed by Astro (typically `http://localhost:4321`).

### Notes on backend setup (Supabase)

The PRD assumes Supabase Auth (OAuth, e.g. GitHub) and RLS-protected tables. This repository may require additional Supabase configuration and environment variables that are not yet documented in this README.

- **Source of truth**: see `./.ai/PRD.md` for required capabilities (Auth, CRUD, generator, plan saving, event instrumentation).

## 5. Available scripts

From `package.json`:

- **`npm run dev`**: start local dev server
- **`npm run build`**: build for production
- **`npm run preview`**: preview the production build locally
- **`npm run astro`**: run the Astro CLI
- **`npm run lint`**: run ESLint
- **`npm run lint:fix`**: auto-fix ESLint issues where possible
- **`npm run format`**: run Prettier across the repo

## 6. Project scope

### MVP capabilities

- **Auth**: Supabase Auth login/logout (OAuth); the app is available only to logged-in users.
- **Members (CRUD)**:
  - Add member with immutable `memberId` (e.g. UUID).
  - `initialOnCallCount` is set to the historical `maxSavedCount` at the time of creation (to avoid over-assigning new members) and is immutable.
  - Soft-delete members (excluded from future schedules; history preserved).
- **Unavailability (CRUD)**:
  - Add one-day unavailability per member.
  - Enforce uniqueness of (member, date) (exact behavior on duplicates is TBD in API).
- **Schedule generator (preview)**:
  - Input: inclusive `startDate` and `endDate` (1–365 days).
  - Range cannot start before “today” defined in **UTC** (timezone UX needs clarification).
  - Deterministic selection by lowest `effectiveCount`; ties resolved by stable order on immutable `memberId`.
  - If nobody is available: assign **`UNASSIGNED`**.
  - Preview includes per-member counters (`savedCount`, `previewCount`, `effectiveCount`) and fairness metrics:
    - historical inequality: based on `savedCount`
    - preview inequality: based on `savedCount + previewCount`
    - inequality is defined as `max - min`
  - Warning includes number and list of `UNASSIGNED` dates.
- **Save plan**:
  - Saving persists the preview as an immutable plan.
  - Reject saving if the date range overlaps any existing saved plan.
  - Saving updates members’ `savedCount` and updates `maxSavedCount` for future member additions.
- **Instrumentation**:
  - Persist events `plan_generated` and `plan_saved` with analytics fields (UTC timestamp, range, membersCount, unassignedCount, inequality on save, duration).

### Explicit non-goals in MVP

- Multiple teams/projects, roles, or complex permissions (MVP is “one logged-in user, one team”)
- Preferences/weights, holiday calendars, weekend weighting (weekend is only for stats)
- Editing or deleting saved plans; swaps; approval workflows; exports/integrations (PagerDuty/Slack/Calendar)

## 7. Project status

**MVP specification is defined** (see `./.ai/PRD.md`). Implementation is **in progress** and may be incomplete; the backend (Supabase schema/RLS/env config) and full feature set described in the PRD may not be fully wired in yet.

If you’re evaluating the project, start with:

- `./.ai/PRD.md` (requirements)
- `package.json` (scripts/deps)

## 8. License

**No `LICENSE` file is currently present in this repository.**

If you want this project to be open source, add a license file (for example `MIT`, `Apache-2.0`, or `GPL-3.0`) and update this section accordingly.
