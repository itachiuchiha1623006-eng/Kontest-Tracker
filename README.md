# Kontest Tracker

A small **always-on-top desktop widget** for Linux (built on Ubuntu GNOME/Wayland) that keeps every upcoming competitive programming contest one glance away — Codeforces, LeetCode, AtCoder, HackerRank, and optionally CodeChef, GeeksforGeeks, HackerEarth, Topcoder & CS Academy via clist.by.

No taskbar entry, no big window — just a compact widget that floats above your work, with live countdowns, filters, reminders, the LeetCode daily challenge, and themes.

![screenshot](docs/screenshot.png)

## Features

- **Live countdowns** to every upcoming contest; running contests pinned with a LIVE badge
- **Multi-source aggregation** with per-source health dots in the status bar (green ok / amber stale / red error)
- **Filters**: platform toggles, start-time window, max duration, hide-running, search, sort
- **Reminders**: desktop notifications 15 / 30 / 60 minutes before start (configurable), per-contest mute
- **LeetCode Daily**: today's problem, mark-done tracking, current + best streak, 14-day history strip
- **Themes**: dark/light × violet/teal/amber/rose accents, adjustable font size
- **Widget behavior**: frameless, always-on-top (toggleable), hides to tray on close/minimize, position remembered, optional launch-on-startup
- **Offline-safe**: everything cached to disk; a failed source never breaks the others

## Run it

```bash
npm install
npm start          # widget appears (top-right on first run)
```

Dev modes:

```bash
npm run dev        # opens DevTools
npm run devtools   # DevTools + detached
```

Quit via the **tray icon → Quit** (closing the window only hides it).

## Platforms & data sources

| Platform | Source | Key needed |
|---|---|---|
| Codeforces | official API (`codeforces.com/api/contest.list`) | no |
| LeetCode (+ daily challenge) | GraphQL (`leetcode.com/graphql`) | no |
| AtCoder | AtCoder Problems API (kenkoooo) | no |
| HackerRank | site REST endpoint | no |
| CodeChef, GeeksforGeeks, HackerEarth, Topcoder, CS Academy | [clist.by](https://clist.by) API v4 | free key |

For the clist-only platforms: register free at **clist.by → Settings → API**, then paste the username + key in the widget's *Settings* tab and hit **Test credentials**.

## Settings reference

| Setting | Where | Notes |
|---|---|---|
| Theme / accent / font size | Settings → Appearance | applied instantly, persisted |
| Refresh interval | Settings → Data | 15 min – 6 h (default 3 h) |
| Reminders + lead times | Settings → Reminders | "Send test notification" button included |
| clist.by credentials | Settings → clist.by | enables the extra platforms |
| Always on top / all workspaces | Settings → Behavior | pin button in the header mirrors always-on-top |
| Launch on startup | Settings → Behavior | writes `~/.config/autostart/kontest-tracker.desktop`, starts hidden in tray |

Data lives in `~/.config/Kontest Tracker/` (open it from Settings → Data folder). Delete it for a full reset.

## Troubleshooting

- **Tray icon missing** — Ubuntu needs the AppIndicator extension (preinstalled on stock GNOME; enable via Extensions app).
- **No notifications** — check Do Not Disturb is off (it suppresses `libnotify`).
- **Rounded corners** — the widget draws its own rounded frame; true window transparency is unreliable under Wayland, so corners are opaque by design.
- **GPU errors at launch** (`GPU process launch failed`) — already mitigated in-app via `--in-process-gpu`; see docs/TECH_STACK.md.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — processes, IPC surface, data flow, cache layout, scheduler/reminders, dedup rules
- [docs/TECH_STACK.md](docs/TECH_STACK.md) — stack choices, upstream endpoints and their quirks, security model

## Roadmap ideas

- electron-builder packaging (.deb / AppImage)
- Per-contest custom reminder times
- Google Calendar sync (beyond .ics export)

## License

MIT
