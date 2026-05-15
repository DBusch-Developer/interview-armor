# Interview Armor: Dev Mode

> A training ground for developer interviews. Pick your level, draw a question,
> speak your answer out loud, get AI coaching on what you actually said — not
> what you meant to say.

Interview Armor is a single-page web app for junior web developers preparing
for technical interviews. You record yourself answering a real interview
question, the app transcribes it, an AI coach grades clarity / structure /
confidence and tells you how to make the answer stronger. Everything stays in
your browser — no accounts, no backend, no data leaves your machine except the
audio sent to Groq for transcription and the transcript sent for coaching.

---

## Table of contents

- [Features](#features)
- [Stack](#stack)
- [Architecture at a glance](#architecture-at-a-glance)
- [Getting started](#getting-started)
- [How the API key works](#how-the-api-key-works)
- [Project layout](#project-layout)
- [Where the state lives](#where-the-state-lives)
- [Routing](#routing)
- [Design decisions worth calling out](#design-decisions-worth-calling-out)
- [Browser support](#browser-support)
- [Roadmap](#roadmap)

---

## Features

- **Question bank.** ~150 curated junior-developer questions across HTML, CSS,
  JavaScript, DOM, Git, React, TypeScript, Node, accessibility, system design,
  and behavioral — filterable by level (Beginner / Intermediate / Advanced) and
  category.
- **Per-question notes.** Each card opens an inline workspace for prep notes
  and a draft answer, autosaved to `localStorage` as you type.
- **AI suggestions.** "Get AI ideas" hits Groq's Llama 3.3 for 3–5 bullets on
  what to cover, tailored to your level.
- **Mock interview mode.** Press record, speak your answer, stop. The audio is
  sent to Groq Whisper for transcription, then to Llama 3.3 for coaching.
- **Coaching feedback.** Clarity / structure / confidence scored out of 10,
  plus a strength, a suggested improvement, a stronger-answer idea, and a
  delivery tip. Overall readiness is mapped to a belt: Needs Work / Almost
  Ready / Strong Answer.
- **Saved sessions.** Every saved transcript + feedback is on the Saved page,
  filterable by category and readiness. Re-run any saved question with one
  click.
- **Dojo sidebar stats.** Today's focus, current streak, sessions this week,
  rolling accuracy — computed from saved sessions, live-updates after every
  save or delete.

## Stack

| Layer       | Tech                                                           |
| ----------- | -------------------------------------------------------------- |
| Markup      | HTML5, semantic elements                                       |
| Styling     | Hand-rolled CSS, custom properties, no framework               |
| Scripting   | Vanilla JS, ES2020, no build step                              |
| Routing     | Custom SPA router on top of `history.pushState`                |
| Audio       | `MediaRecorder` API → WebM Opus blob                           |
| AI services | Groq Whisper Large v3 (speech-to-text), Llama 3.3 70B (coach)  |
| Persistence | `localStorage`                                                 |
| Deploy      | Any static host — Vercel, Netlify, GitHub Pages, plain `nginx` |

Zero dependencies. No `node_modules`. No build pipeline. Drop the folder on a
static host and it runs.

## Architecture at a glance

```
                    ┌──────────────────────────────────────────┐
                    │              SHELL (every page)          │
                    │  header • dojo sidebar • footer          │
                    │                                          │
                    │   ┌──────────── .content-stack ───────┐  │
                    │   │  swapped by the router            │  │
                    │   │  ┌─────────────────────────────┐  │  │
   click nav  ─────►│   │  │ Home / Practice / Mock /    │  │  │
                    │   │  │ Saved / About               │  │  │
   fetch + DOMSwap  │   │  │                             │  │  │
                    │   │  └─────────────────────────────┘  │  │
                    │   └────────────────────────────────────┘  │
                    └──────────────────────────────────────────┘
```

Every HTML file is a real, navigable page (graceful degradation — direct loads
and bookmarks work). The router intercepts in-app link clicks, fetches the
target HTML, extracts its `.content-stack`, swaps it into the current
document, updates the title and active nav, and calls the matching page's
`init()`. No full reload, no flash of the header, no remount of the sidebar.

## Getting started

```bash
git clone <this repo>
cd interview-armor

# Any static server works. The router needs real HTTP, not file://.
python3 -m http.server 5173
# or
npx serve .
```

Open <http://localhost:5173>.

To use the mock-interview features (transcription, AI coaching) you need a
Groq API key — see below.

## How the API key works

The app calls Groq directly from the browser. Two ways to provide the key:

1. **Use the in-browser prompt.** First time you click "Transcribe" or "Get AI
   ideas," the app prompts for a key and stashes it in `localStorage` for that
   browser. **Recommended.** Nothing on disk, nothing in git.
2. **Edit `js/config.js`.** Paste your key between the quotes. This file is
   checked in as an empty stub. If you put a key in it locally, treat the file
   the way you would a `.env` — don't commit it.

A copy of the empty stub lives at `js/config.example.js` in case you ever wipe
`config.js` and need to restore it.

> **Phase 2 plan:** move all Groq calls behind a backend proxy. Keys in the
> browser are a deliberate Phase-1 trade-off for fastest local iteration; not
> suitable for a public deploy.

## Project layout

```
interview-armor/
├── index.html              # Home
├── practice.html           # Question bank
├── mock.html               # Mock interview
├── saved.html              # Saved sessions
├── about.html              # About
│
├── css/
│   └── style.css           # All styles
│
├── js/
│   ├── storage-keys.js     # One frozen object — every localStorage key
│   ├── config.js           # window.GROQ_API_KEY (empty stub by default)
│   ├── config.example.js   # Template, copy if config.js is wiped
│   ├── questions.js        # The question bank + level/category lists
│   ├── practice.js         # initPractice() / teardownPractice()
│   ├── mock.js             # initMock() / teardownMock()
│   ├── saved.js            # initSaved() / teardownSaved()
│   ├── main.js             # Mobile nav + dojo-sidebar stats
│   └── router.js           # SPA router
│
└── assets/                 # Images, icons, watermarks, belts
```

## Where the state lives

Everything is in `localStorage`. Keys are defined in **one** place
(`js/storage-keys.js`) and read from `window.STORAGE_KEYS` everywhere else.

| Key                                | Shape                                          | Written by  | Read by                  |
| ---------------------------------- | ---------------------------------------------- | ----------- | ------------------------ |
| `interviewArmorSavedAnswers`       | `Array<SavedSession>`                          | `mock.js`   | `saved.js`, `main.js`    |
| `interviewArmorPracticeNotes`      | `Record<questionId, { notes, draft }>`         | `practice.js` | `practice.js`, `mock.js` |
| `interviewArmorMockDraft`          | `MockDraft` (current in-progress session)      | `mock.js`   | `mock.js`                |
| `interviewArmorGroqKey`            | `string` (Groq API key from prompt fallback)   | `practice.js`, `mock.js` | same |

A typo on the consumer side throws (the object is `Object.freeze`d) instead of
silently writing to the wrong slot.

## Routing

The router is ~120 lines of vanilla JS (`js/router.js`). It handles:

- Click interception on any `<a data-page="...">` link.
- `fetch()` + `DOMParser` to extract the target page's `.content-stack`.
- DOM swap with `replaceWith` so the surrounding shell (header / sidebar /
  footer) is untouched.
- `history.pushState` so back/forward buttons work; `popstate` reverses the
  swap.
- Per-page lifecycle: the outgoing page's `teardownXxx()` runs *before* its
  DOM is removed (so it can revoke blob URLs, stop the mic, release listeners);
  the incoming page's `initXxx()` runs *after* the swap.
- Modifier-key clicks (⌘ / Ctrl / shift / middle-click) fall through to the
  browser so "Open in new tab" still works.
- Fetch failures fall back to a hard navigation so a broken router never
  bricks the site.

Pages are mostly independent — adding a new one is one entry in the `ROUTES`
table plus a matching `window.initFoo()`.

## Design decisions worth calling out

### Search and filters never rebuild the grid
The question grid renders once. Search and filter changes toggle an
`.is-hidden` class on each card based on `data-level` / `data-category` /
`data-search` attributes. Typing in the search box doesn't cause innerHTML
rewrites, doesn't blow away focus or selection inside the workspace
textareas, and doesn't leak event listeners.

### Filter buttons use event delegation
One click listener on the level row, one on the category row — set once in
`wireInteraction()`. Filter changes re-paint the button markup (active state)
but never re-attach handlers. Old code re-bound listeners on every render,
which leaked one new handler per click; this fixes that.

### Blob URLs are revoked on every replacement
The mock page tracks the active `URL.createObjectURL` in `state.audioUrl`.
Before creating a new blob URL — or clearing the session, or unmounting the
page — it calls `revokeAudioUrl()`. The mic stream is also stopped on
teardown so navigating away during a recording doesn't leave the indicator
spinning.

### Page modules are init / teardown pairs
Each page module is an IIFE that exposes `window.initXxx()` and (where it
matters) `window.teardownXxx()`. State lives in a closure object; init resets
it on every mount; teardown clears timers, revokes URLs, and stops media so
SPA navigation can't leak anything across visits.

### Sidebar lives in the shell
The dojo sidebar is part of every page's HTML and is never swapped. After any
save or delete (or any nav), `window.refreshSidebarStats()` re-reads
`localStorage` and updates the four values in place.

### Graceful degradation
Each HTML page is a real, navigable file. Direct loads, bookmarks, browser
refresh, and "open in new tab" all land on a working page. The router is an
enhancement, not a requirement.

## Browser support

Tested on current Chrome, Edge, Firefox, and Safari. Mic recording uses
`MediaRecorder` and `navigator.mediaDevices.getUserMedia`, which require
HTTPS (or `localhost`).

## Roadmap

- Move Groq calls behind a backend proxy so the API key never lives in the
  browser.
- User accounts and a progress dashboard with score history.
- More question categories and a contribution flow.
- Personalized prep plans based on saved-session patterns.
- Backend persistence + cross-device sync.

---

<sub>A worthy answer is forged with preparation and delivered with purpose.</sub>
