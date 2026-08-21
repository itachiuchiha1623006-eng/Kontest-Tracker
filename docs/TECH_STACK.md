# Kontest Tracker — Tech Stack, Tools & Technologies

## Stack at a glance

| Layer | Choice | Why |
|---|---|---|
| Runtime | **Electron 38** (Chromium + Node 22 embedded) | The only practical way to get a frameless always-on-top desktop widget with tray + native notifications in one codebase on Linux. |
| UI | **Vanilla JS + HTML/CSS** — no framework, no build step | An always-running widget should be light. Zero build tooling = instant startup, ~45 plain files, nothing to transpile. Views are switched sections, not routes. |
| Module systems | **CommonJS** in main, **ES modules** in renderer, one shared `.mjs` | Main follows Electron convention (`require`); the renderer uses native ESM via a custom protocol; `src/shared/platforms.mjs` is loaded by both (main uses dynamic `import()`). |
| Renderer origin | Custom **`app://`** scheme (standard + secure) | Avoids every `file://` CORS/ESM quirk and gives CSP a stable `'self'`. Path-prefix routing serves `src/shared` same-origin. |
| Dependencies | **Zero runtime npm packages** | Everything needed (fetch, JSON, notifications, tray) is in Electron/Node. Only dev dep: `electron`. |
| Persistence | Plain **JSON files**, atomic writes (tmp + rename) | No SQLite for a few KB of contests; atomic renames make kill-9 safe. |
| Time | Unix epoch seconds end-to-end; `Intl` formatting only at render | Timezone-proof, cache-safe, sleep/resume-proof. |

## Toolchain

- Node v24 / npm 11 (dev machine)
- git for version control
- No bundler, no TypeScript, no linter configured yet (deliberate — keep the footprint minimal)

## Upstream data sources (verified working Aug 2026)

> kontests.net — the classic aggregator — is dead (connection timeouts), which is why this app talks to each platform directly with clist.by as the optional catch-all.

| Source | Endpoint | Quirks handled |
|---|---|---|
| Codeforces | `GET https://codeforces.com/api/contest.list` | Sorted newest-first; upcoming = `phase === 'BEFORE' && relativeTimeSeconds < 0`; `CODING` = running. |
| LeetCode | `POST https://leetcode.com/graphql` | Requires a `Referer: https://leetcode.com` header. Working fields: `contestV2UpcomingContests{title titleSlug startTime duration}` and `activeDailyCodingChallengeQuestion{date link question{…}}`. Introspection is disabled — field names were probed via error messages. |
| AtCoder | `GET https://kenkoooo.com/atcoder/resources/contests.json` | ~1 MB payload → only the normalized/filtered result is cached. Permanent/practice contests excluded by dropping durations > 14 days. |
| HackerRank | `GET https://www.hackerrank.com/rest/contests/upcoming?limit=20` | Unofficial site endpoint; entries with `epoch_starttime = 0` (unscheduled) skipped. |
| clist.by | `GET https://clist.by/api/v4/json/contest/?username=…&api_key=…&order_by=start&start_after=<ISO>` | Free key from clist.by. ISO timestamp must not include milliseconds. Covers CodeChef/GfG/HackerEarth/Topcoder/CS Academy; duplicates of keyless sources merged away (see ARCHITECTURE.md). |

Networking goes through one funnel (`src/main/net.js`): 15 s timeout via `AbortSignal.timeout`, one retry after 2 s on network errors, optional `ETag`/`If-Modified-Since`, structured results that never throw expected failures.

## Platform-specific decisions (Ubuntu 24 GNOME / Wayland)

- **Native Wayland**: Electron 38 runs Wayland-native here (ozone logs confirm). Frameless windows, always-on-top, skip-taskbar all work.
- **GPU process bypassed** with `app.commandLine.appendSwitch('in-process-gpu')` + `disableHardwareAcceleration()`. On this NVIDIA/Wayland setup the separate GPU process fails to launch (`GPU process launch failed: error_code=1002`) and kills the app; GPU-in-browser-process is free for a text widget.
- **No window transparency**: flaky under compositors; the widget is opaque with CSS-rounded corners instead.
- **Tray**: AppIndicator backend ignores click events reliably → all actions live in the context menu; the tooltip carries the next-contest countdown.
- **Notifications**: libnotify/GNOME; Do Not Disturb suppresses them (documented).
- **Autostart**: freedesktop `~/.config/autostart/kontest-tracker.desktop` written by the app itself (works unpackaged — Exec points at the electron binary).

## Security posture

- `contextIsolation` + `sandbox` on, `nodeIntegration` off; preload exposes an allowlisted `window.kontest` only.
- CSP with `connect-src 'none'` — enforceable because the renderer makes zero network requests.
- All remote strings rendered via `textContent`; `innerHTML` reserved for static SVG icons.
- URL allowlist (https + known platform hosts) enforced twice: contest normalization and `openExternal`.
- Custom protocol traversal guard: files only from `src/renderer`, `src/shared`, `assets`.

## Dev/test hooks

| Hook | Effect |
|---|---|
| `KONTEST_SIMULATE=offline` or `=codeforces,…` | force source failures to test error paths |
| `KONTEST_FAKE_NOW=<epoch>` | shift scheduler clock for reminder testing |
| `KONTEST_SHOT=<path>` | auto-screenshot the widget then quit |
| `npm run dev` / `npm run devtools` | DevTools |

## Future packaging

electron-builder (.deb/AppImage) is intentionally out of v1 — `npm start` keeps the dev loop instant. The autostart writer already produces a working .desktop entry for the unpackaged app.
