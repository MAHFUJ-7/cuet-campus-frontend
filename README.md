# CUET AI Campus — Web

Web port of the Flutter **CUET AI Campus** academic operating system, built with
**React + Tailwind CSS (v4) + Vite**. Plain JavaScript, React Context, and
`fetch` — no extra state or data libraries.

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

The campus backend is expected at `http://localhost:3000/api/v1`. In dev, Vite
proxies `/api` and `/health` to it (see `vite.config.js`), so the app works with
no CORS setup. For a deployed backend, set `VITE_API_BASE_URL` before building:

```bash
VITE_API_BASE_URL=https://api.example.com/api/v1 npm run build
```

## Offline demo accounts

Every login screen has frictionless demo logins (no backend needed):

- **Student / CR / Coordinator preset cards** — one tap, fully offline. The
  preset sets the role explicitly; CRs use the same official email format as
  students.
- **Quick Test Login** — type an email and it tries the dev server first, then
  falls back to an offline session. `*coord*` → coordinator, `dev@…`/`admin…` →
  admin, otherwise student. To test the CR experience, use the CR preset card.
- **Official student email** — `uYYDDRRR@student.cuet.ac.bd`, where `YY` is the
  batch, `DD` is the department code (`04` = CSE), and `RRR` is the roll. For
  example, `u2204037@student.cuet.ac.bd` is Batch 2022 CSE roll 037, student ID
  `2204037`. Registration auto-fills academic details from this address.

Offline sessions seed the routine, updates, and assignments caches and mark
themselves with the `offline-test-session` token. Live server screens that
cannot work offline (data quality, routine import review) show an explicit
error instead of fake data.

## Feature map

| Area | Routes |
| --- | --- |
| Auth | `/`, `/onboarding`, `/login`, `/register`, `/forgot-password`, `/setup`, `/set-password`, `/profile-completion` |
| Student | `/home`, `/routine`, `/routine/conflicts`, `/ai-chat`, `/updates`, `/profile`, `/profile/edit`, `/assignments`, `/attendance`, `/exams`, `/calendar`, `/events`, `/study-materials`, `/directory`, `/campus-map`, `/ai-recommendations`, `/ai-settings`, `/security`, `/notification-preferences`, `/feedback`, `/dev-debug` |
| CR Center | `/cr-dashboard`, `/cr/compose` — one **CR Center** item in the left nav (desktop) and bottom nav (mobile). Includes permanent routine edits, the shared conflict finder and Section/Batch announcements. |
| Coordinator | `/coordinator`, `/coordinator/academics`, `/coordinator/notices`, `/coordinator/profile`, `/coordinator/students`, `/coordinator/exams`, `/coordinator/quality`, `/coordinator/audit`, `/coordinator/routine-pdf`, `/coordinator/routine-review/:id`, `/coordinator/section/:id`, `/coordinator/schedule-suggestions`, `/coordinator/ai` |
| Admin | `/admin` |

Route guards live in `src/router/guards.jsx`; coordinator areas require the
`coordinator` or `admin` role, `/admin` requires `admin`, and the CR routes
accept `cr`, `coordinator`, or `admin`.

## Notable web adaptations

- **Campus Map** uses Leaflet + OpenStreetMap (no API key).
- **Class routine** matches the official Level-3 Term-II (Batch 2022) PDF for
  both sections. Multi-period labs collapse into one card (e.g. `P4–P6`), and
  the PDF tab embeds the bundled official PDF, so it works offline. If a newer
  PDF was uploaded by a coordinator, that copy is offered first.
- **AI assistant** pathways: custom OpenAI-compatible endpoint → personal
  Gemini key → campus server `/ai/chat` → deterministic offline answer from
  the cached routine. Personal API keys stay in `localStorage` on-device.
- **CR declarations** publish locally first (instant feed update), then sync
  to the server on a best-effort basis. One-off actions are **date-aware**:
  cancellations, room/time changes, extra classes, day off and mid-break are
  applied to the effective schedule on Home, Routine, Calendar and reminders,
  even when the backend is unreachable. Cancelled classes remain visible with a
  CANCELLED badge so students can see what changed; withdrawing the declaration
  restores the original schedule. **Permanent routine changes** edit the weekly
  grid itself, persist on-device, and are synced with `PUT /routine/:id` when
  the backend permits it.
- **CR announcements** have exactly two audiences: **Section** (the CR's own
  section) and **Batch** (every section of the CR's batch, e.g. CSE Batch 2022
  Sections A + B). Local audience filtering enforces the same rules offline.
- **Time Conflicts** scans the effective routine (including permanent edits)
  plus exams for time, room, teacher and exam clashes. It is available from the
  Routine header and CR Center to both students and CRs.
- **Events** are local-first until the backend exposes an events endpoint.
  Coordinators/admins can publish campus-wide or section events, CRs can publish
  section events, and students can keep private events. They appear immediately
  on the Academic Calendar and survive reloads on the same device.
- **Personalized reminders** are generated on-device from the routine, exams,
  assignment deadlines and the saved preferences. They show an in-app alert and,
  when browser permission is granted, a native notification while the app is
  open. Quiet hours, class lead time and per-type toggles are respected; exams
  notify at least 1 hour ahead and assignments at least 1 day ahead.

## Project layout

```
src/
  api/         fetch client, ~90 endpoints, error mapping
  components/  UI kit (buttons, cards, dialogs, tabs, …) and app shell
  context/     Theme, Toast, Auth providers
  data/        offline seed data used by demo sessions
  features/    one folder per screen area (auth, home, routine, coordinator, …)
  hooks/       useApi (API → cache → render with offline fallback)
  lib/         models/parsers, storage keys, datetime, validators, AI services
  router/      route guards
```
