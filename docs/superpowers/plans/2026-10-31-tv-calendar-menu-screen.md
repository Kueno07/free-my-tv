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
- Modify: `app/assets/i18n/*.json` for UI text added in this task
- Test: `tools/test-joyce-tv.js`
- Modify: `tools/check.sh`

**Interfaces:**
- `JoyceTV.beginPairing(baseUrl, deviceLabel, callback)` generates a random pairing code and device token, posts only their SHA-256 hashes to pairing-start, and polls pairing-status using the device token; the code remains on the TV for Joyce to enter.
- `JoyceTV.configure(baseUrl, token)` stores the activated device token and triggers a refresh.
- `JoyceTV.refresh(fromDate, toDate, callback)` fetches the snapshot with XHR; callback signature is `(error, snapshot)`.
- `JoyceTV.snapshot()` returns the last valid cached snapshot or `null`; `JoyceTV.updatedAt()` returns its timestamp or `null`.
- Snapshot contract is `{ updatedAt, timeZone, meals, eventDates, upcomingEvents }` from the Joyce API plan; `eventDates` mark the visible month grid and `upcomingEvents` lists the next three events even when they fall outside that grid.

- [ ] **Step 1: Add pure-function checks** for response validation, month-range formatting, selected meal markers, event-date markers, upcoming-events data, and cache fallback; run `node tools/test-joyce-tv.js` and confirm expected failures.
- [ ] **Step 2: Implement the ES5 XHR client** with response-size and schema checks, bearer token handling, localStorage cache, last-updated time, and one hourly refresh timer.
- [ ] **Step 3: Add a pairing screen to the existing Home Settings flow** in `web/home.js` and `web/index.html`; generate the short-lived code and device token on the TV, show the code for entry in Joyce, poll activation, and persist the token only after Joyce confirms pairing.
- [ ] **Step 4: Add pairing UI keys to the catalogues**. Preserve any existing Portuguese translations; use the English source as fallback in other catalogues where translations are absent, without calling an external translation API.
- [ ] **Step 5: Add the client check to `tools/check.sh web`**. Expected: the new checks pass and the existing ES5/static checks remain enabled.

### Task 2: Month calendar and meal/event data presentation

**Files:**
- Create: `web/calendar-view.js`
- Modify: `web/home.js`
- Modify: `web/home.css`
- Modify: `web/media.js` only if the existing normalization layer must expose remote event/menu markers.
- Modify: `app/assets/i18n/*.json` for calendar and meal text added in this task
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
- [ ] **Step 5: Add calendar and meal UI keys to the catalogues**. Preserve Portuguese translations and use English fallback for locales without a translation; do not call an external translation API.
- [ ] **Step 6: Run `node tools/test-calendar-view.js`**. Expected: all date, selection, ordering, and cutoff checks pass.

### Task 3: Screensaver rotation, expanded slide, and local photo support

**Files:**
- Create: `web/personal-photos.js`
- Modify: `web/home.js`
- Modify: `web/index.html`
- Modify: `web/home.css`
- Modify: `webos/build.py`
- Create: `tools/test-webos-personal-photos.py`
- Modify: `tools/check.sh`
- Preserve: `webos/photos.local/` as a user-owned local directory; package its images only in non-generic local webOS builds, and never commit the image files.
- Preserve: `webos/calendar.local.json` as a user-owned local file; never package its event snapshot, and do not delete or rewrite it.
- Test: `tools/test-calendar-view.js` (transition/timer cases)

- [ ] **Step 1: Add transition checks** for 12-second photo rotation, a five-second expanded-calendar state after each photo, resume behavior, and timer cleanup on exit/pause.
- [ ] **Step 2: Integrate cached/remote Joyce data** into screensaver entry and request a refresh on entry; continue with cached data if XHR fails.
- [ ] **Step 3: Add the five-second expanded-calendar state** after each photo interval, then return to photos without overlapping existing timers or remote-key controls.
- [ ] **Step 4: Add a personal-photo manifest** that defaults to an empty list in web and is replaced by local webOS builds; package only validated image files from `webos/photos.local/` in non-generic builds, and never read/package `calendar.local.json`.
- [ ] **Step 5: Add `tools/test-webos-personal-photos.py`** using a temporary fixture; assert that image files are bundled for local builds while calendar data and generic builds contain no private files. Add this check to `tools/check.sh web`.
- [ ] **Step 6: Run `tools/check.sh web`**. Expected: translation, LG/Samsung build, ES5 syntax, no-forbidden-API, calendar/menu, and private-photo packaging checks pass.

### Verification and completion

- [ ] Run `tools/check.sh web` from the repository root and record its exact result.
- [ ] Inspect a generated LG package/build output to confirm no Joyce token or stale static event snapshot is included.
- [ ] Validate at 1920×1080 and a narrow viewport; confirm remote keys can pause/resume and leave the screensaver cleanly.
- [ ] Report local build status separately from installation on the TV; installing or changing the TV requires a separate explicit request.


