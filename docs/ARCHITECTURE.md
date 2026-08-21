# Kontest Tracker — Implementation Architecture

## Big picture

Three isolated layers, standard Electron security posture:

```
┌────────────────────────────────────────────────────────────┐
│ MAIN PROCESS (CommonJS)                                    │
│  main.js ─ boot, single-instance lock, lifecycle           │
│  ├── protocol.js    app:// scheme (renderer + shared ESM)  │
│  ├── window.js      frameless widget window, tray-hide     │
│  ├── tray.js        tray menu + next-contest tooltip       │
│  ├── scheduler.js   refresh loop + 15s reminder tick       │
│  ├── reminders.js   due-notification engine (dedup on disk)│
│  ├── sources/*      5 adapters → normalized Contest[]      │
│  ├── merge.js       clist overlay dedup                    │
│  ├── normalize.js   validation/clamps (URL allowlist)      │
│  ├── cache.js       per-source JSON cache (atomic writes)  │
│  ├── settings.js    defaults + merge + persist             │
│  ├── dailyProgress  done-dates + streak derivation         │
│  ├── autostart.js   ~/.config/autostart .desktop writer    │
│  └── ipc.js         every ipcMain.handle channel           │
└──────────────┬─────────────────────────────────────────────┘
               │ contextBridge (preload.js → window.kontest)
┌──────────────▼─────────────────────────────────────────────┐
│ PRELOAD — allowlisted invoke wrappers + 4 push channels    │
└──────────────┬─────────────────────────────────────────────┘
┌──────────────▼─────────────────────────────────────────────┐
│ RENDERER (ES modules, sandboxed, zero Node)                │
│  app.js boot → store patches → views re-render             │
│  views: contests | daily | filters | settings              │
│  countdownTicker: one 1s interval for ALL live timers      │
└────────────────────────────────────────────────────────────┘
```

**The renderer never touches the network.** All fetching, merging, caching, and notification scheduling happen in main; the renderer only renders and sends intents.

## Data contract

### Contest (produced only by `normalize.js`)

```js
{
  id: 'codeforces:2143',       // `${sourceKey}:${sourceId}` — stable across refreshes
  source: 'codeforces',
  sourceId: '2143',
  platformKey: 'codeforces',   // canonical filter key (shared/platforms.mjs)
  platformLabel: 'Codeforces',
  name: 'Codeforces Round …',
  url: 'https://codeforces.com/contests/2143',   // https + host allowlist only
  start: 1770000000,           // unix epoch SECONDS everywhere
  end: 1770036000,
  durationSeconds: 36000,
  rated: true,                 // boolean | null (unknown)
  sources: ['codeforces', 'clist'],              // after merge
}

```

`status` (upcoming / running / finished) is **derived at render time**, never stored — sleep/resume and stale caches can't corrupt it.

### SourceStatus (one per source, rendered as status-bar dots)

`{ key, label, enabled, state: ok|stale|error|disabled|empty, fetchedAt, error, count }`

### DailyChallenge

`{ date, questionId, title, titleSlug, url }` — `date` (LeetCode's own string) doubles as the progress key.

## IPC surface

Invoke channels (`ipcMain.handle`), all wrapped so throws become `{ error }`:

| Channel | Purpose |
|---|---|
| `settings:get / set / reset` | merged settings; `set` triggers side effects (window flags, autostart file, refresh, loop restart) |
| `clist:test` | live credential probe |
| `contests:get` | cache-only snapshot `{ contests, sources, nowSec }` |
| `contests:refresh` | fetch all enabled sources, merge, cache, broadcast |
| `daily:get / refresh / markDone` | daily challenge + progress |
| `win:hide / setAlwaysOnTop / getState` | widget window control |
| `app:openExternal` | **allowlist-enforced** (https + known platform hosts only) |
| `reminders:test` | sample notification |
| `app:getVersions / openDataFolder / quit` | about + lifecycle |

Push channels (`webContents.send`): `push:contests-updated`, `push:daily-updated`, `push:settings-changed`, `push:resync`.

The preload exposes exactly these as `window.kontest`; nothing else crosses the bridge.

## Refresh pipeline

```
scheduler.refreshAll()
  → sources.fetchAllSources(settings)      # Promise.all, per-source isolation
      adapter → normalizeContest() → { contests }
      success → cache.writeSourceResult()  # written immediately, per source
      failure → cache.writeSourceError()   # merge still uses stale cache
  → mergeContests(bySource, now)           # dedup, sort, cap 200
  → broadcast push:contests-updated
  → reminders.fireDueReminders(contests)
  → tray tooltip update
```

Boot: `loadSnapshotFromCache()` renders instantly from disk; a background refresh fires only if any enabled source is older than the refresh interval. System resume (`powerMonitor`) re-ticks reminders, re-syncs the renderer, and refreshes if stale.

## Dedup rules (when clist.by is enabled)

Keyless sources are the **base**; clist is an **overlay**:

1. **URL** — normalized (lowercase host minus `www`, path minus trailing slash) match → merge.
2. **Platform + normalized name** exact match → merge.
3. **Fuzzy** — same platform, |Δstart| ≤ 15 min, one normalized name contains the other → merge.
4. Otherwise append (this is how CodeChef/GfG/HackerEarth/Topcoder/CS Academy enter).

Merge keeps the base contest's stable `id`/`url`/`name`, unions `sources`, fills missing `rated`/`end`.

## Reminders

- 15 s tick computes due `(contestId, leadMinutes)` pairs: `start > now` (never announce an already-started contest) and `start - now ≤ lead*60` (with a 90 s grace against missed windows).
- Fired keys persist to `state/reminders.json` → **restarting inside the reminder window never duplicates** a notification.
- Per-contest mute (`reminders.mutedContests`) and a master switch.
- Notification click → `shell.openExternal` through the same URL allowlist.

## Persistence layout (`app.getPath('userData')`)

```
~/.config/Kontest Tracker/
├── settings.json              # debounced atomic writes
├── cache/
│   ├── contests.json          # { version, sources: { <key>: {fetchedAt, etag, error, contests[]} } }
│   └── daily.json
└── state/
    ├── reminders.json         # { fired: { "<contestId>:<lead>": ts } }
    └── daily-progress.json    # { done: { "YYYY-MM-DD": { doneAt } } }
```

All writes are atomic (tmp + rename) through a single promise chain. Corrupt/missing files fall back to defaults — the app never crashes on bad JSON. Streaks are **computed** from done-dates, never stored.

## Window & tray behavior (GNOME Wayland)

- Frameless, opaque, rounded by CSS; `skipTaskbar`, always-on-top (toggle), `minimizable/maximizable/fullscreenable: false`.
- **Close and minimize both hide to tray**; quit exists only via tray menu or Settings. `window-all-closed` is a no-op.
- Bounds persist on move/resize (debounced) and are clamped into the nearest display's work area on restore; `display-removed` re-clamps.
- Header is the `-webkit-app-region: drag` region; every control opts out.
- Electron 38 runs **native Wayland** here; the GPU process is bypassed with `--in-process-gpu` because it fails to launch on some NVIDIA/Wayland setups (see TECH_STACK.md).
- Tray: all actions live in the context menu (click events are unreliable on AppIndicator); tooltip shows the next-contest countdown.

## Security model

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`; preload exposes only allowlisted wrappers.
- CSP: `default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'none'` — `connect-src 'none'` is possible because the renderer never fetches.
- All external strings enter the DOM via `textContent` (`el()` helper); `innerHTML` only for static SVG icons.
- Every contest URL must be `https:` on a known platform host **at normalize time**; `openExternal` re-checks the same allowlist.
- Custom `app://` protocol serves only from `src/renderer`, `src/shared`, `assets` with a traversal guard.

## Test hooks

- `KONTEST_SIMULATE=offline|codeforces,atcoder,…` — force source failures (error paths, offline banner).
- `KONTEST_FAKE_NOW=<epoch sec>` — shift the scheduler's clock (reminder testing without waiting).
- `KONTEST_SHOT=<path>` — capture the window to PNG after boot, then quit (visual verification).
- `npm run dev` — open DevTools.
