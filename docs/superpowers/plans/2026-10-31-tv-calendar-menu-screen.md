# TV Calendar and Joyce Menu Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show a prominent monthly Family calendar and selected Joyce meals in the Free My TV screensaver while photos continue rotating.

**Architecture:** Add an ES5-compatible XHR client for the Joyce read-only snapshot endpoint, pair it through a device code, and cache the last successful response locally. Render a month view over the photo with today's meal and next three events; after each photo, show a five-second expanded calendar state before resuming photos.

**Tech Stack:** Existing Free My TV JavaScript, HTML, CSS, webOS build tooling; plain ES5 and XMLHttpRequest for older TV browsers.

**Spec:** `C:\Users\kelvi\.codex\visualizations\2026\10\31\01a191ba-7912-7850-925e-41a6a137c072\design-menu-calendario-tv.md`

## Global Constraints

- LG webOS and Tizen code stays plain ES5; use XMLHttpRequest, not `fetch`, Promise, Map, CSS Grid, CSS variables, or `backdrop-filter`.
- Keep personal photos as the screensaver background.
- Lunch is eligible 00:00–11:59; dinner 12:00–17:59; hide the meal card from 18:00 onward in `America/Sao_Paulo`.
- Show one plate icon per date with one or both selected meals, a separate event dot, the current date, and the next three Family events.
- Refresh on screensaver entry and hourly; retain the last successful snapshot and display its update time while offline.
- The TV is read-only and stores only its paired device token, not Joyce family credentials.
- Keep local photo support intact and avoid baking a stale calendar snapshot into new app builds.

## Review Focus

- Snapshot unavailable, malformed, or stale: preserve cached data, show its update time, and continue the screensaver.
- Empty menus and events: show a complete calendar grid with no false markers or empty meal card.
- Month boundaries and Monday-first layout: render leading/trailing dates consistently with Joyce.
- 18:00 boundary and São Paulo local date: show/hide the meal at the exact configured cutoff.
- Remote-key pause/exit during transition: clear timers and prevent overlapping photo/calendar slides.

---

### Task 1: Pairing and snapshot client

**Files:**
- Create: `web/joyce-tv.js`
- Modify: `web/index.html`
- Modify: `web/home.js` for the pairing screen and remote-control flow within the existing Home Settings UI
- Modify: `web/home.css` for pairing-screen presentation
- Test: `tools/test-joyce-tv.js`
- Modify: `tools/check.sh`

**Interfaces:**
- `JoyceTV.beginPairing(baseUrl, deviceLabel, callback)` generates a random pairing code and device token, posts only their hashes plus the code to pairing-start, and polls pairing-status using the device token.
- `JoyceTV.configure(baseUrl, token)` stores the activated device token and triggers a refresh.
- `JoyceTV.refresh(fromDate, toDate, callback)` fetches the snapshot with XHR; callback signature is `(error, snapshot)`.
- `JoyceTV.snapshot()` returns the last valid cached snapshot or `null`; `JoyceTV.updatedAt()` returns its timestamp or `null`.
- Snapshot contract comes from `C:\Users\kelvi\OneDrive\Documentos\ChatGPT\Geral 2\free-my-tv\docs\superpowers\plans\2026-10-31-tv-calendar-menu-screen.md` and the Joyce API plan: `{ updatedAt, timeZone, meals, events }`.

- [ ] **Step 1: Add pure-function checks** for response validation, month-range formatting, selected meal markers, and cache fallback; run `node tools/test-joyce-tv.js` and confirm expected failures.
- [ ] **Step 2: Implement the ES5 XHR client** with response-size and schema checks, bearer token handling, localStorage cache, last-updated time, and one hourly refresh timer.
- [ ] **Step 3: Add a pairing screen to the existing Home Settings flow** in `web/home.js` and `web/index.html`; generate the short-lived code and device token on the TV, show the code for entry in Joyce, poll activation, and persist the token only after Joyce confirms pairing.
- [ ] **Step 4: Add the client check to `tools/check.sh web`**. Expected: the new checks pass and the existing ES5/static checks remain enabled.

### Task 2: Month calendar and meal/event data presentation

**Files:**
- Create: `web/calendar-view.js`
- Modify: `web/home.js`
- Modify: `web/home.css`
- Modify: `web/media.js` only if the existing normalization layer must expose remote event/menu markers.
- Test: `tools/test-calendar-view.js`
- Modify: `tools/check.sh`

**Interfaces:**
- `CalendarView.render(snapshot, selectedDate, now)` returns/updates the month panel using Monday-first calendar weeks.
- `CalendarView.currentMeal(snapshot, now)` returns the selected lunch or dinner title only within its eligible local-time window; otherwise `null`.
- `CalendarView.upcomingEvents(snapshot, now, limit)` returns no more than three future Family events.

- [ ] **Step 1: Add transform checks** for month grid/date highlighting, one plate marker per selected date, event dots, next-three ordering, and lunch/dinner cutoff; confirm they fail before implementation.
- [ ] **Step 2: Implement month/date transforms** using `America/Sao_Paulo`-consistent date keys and Monday-first cells; do not infer selections from unselected options.
- [ ] **Step 3: Render the prominent calendar panel** with month title, current day highlight, plate icons, separate event dots, and three upcoming events.
- [ ] **Step 4: Render the current meal card** in the separate clock area and hide it when the current meal is unselected or local time is at/after 18:00.
- [ ] **Step 5: Run `node tools/test-calendar-view.js`**. Expected: all date, selection, ordering, and cutoff checks pass.

### Task 3: Screensaver rotation, expanded slide, and stale static calendar removal

**Files:**
- Modify: `web/home.js`
- Modify: `web/home.css`
- Modify: `webos/build.py`
- Preserve: `webos/calendar.local.json` as a user-owned local file; stop packaging its events as the screensaver data source, but do not delete or rewrite it.
- Test: `tools/test-calendar-view.js` (transition/timer cases)

- [ ] **Step 1: Add transition checks** for 12-second photo rotation, a five-second expanded-calendar state after each photo, resume behavior, and timer cleanup on exit/pause.
- [ ] **Step 2: Integrate cached/remote Joyce data** into screensaver entry and request a refresh on entry; continue with cached data if XHR fails.
- [ ] **Step 3: Add the five-second expanded-calendar state** after each photo interval, then return to photos without overlapping existing timers or remote-key controls.
- [ ] **Step 4: Stop including `calendar.local.json` events in packaged personal-media data** while preserving photo packaging and the local file itself.
- [ ] **Step 5: Run `tools/check.sh web`**. Expected: translation, LG/Samsung build, ES5 syntax, no-forbidden-API checks, and calendar/menu checks pass.

### Verification and completion

- [ ] Run `tools/check.sh web` from the repository root and record its exact result.
- [ ] Inspect a generated LG package/build output to confirm no Joyce token or stale static event snapshot is included.
- [ ] Validate at 1920×1080 and a narrow viewport; confirm remote keys can pause/resume and leave the screensaver cleanly.
- [ ] Report local build status separately from installation on the TV; installing or changing the TV requires a separate explicit request.
