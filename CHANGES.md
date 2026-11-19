# Changes in this release

## 1. Faster group chat (messages reach other users in ~2 s)

**Cause.** Chat has no push on Netlify, so other users only saw a message on their next poll (every 5 s while the chat is open, so 0-5 s of waiting). On top of that, `GET /api/chat` read every channel one blob after another.

**Fix.**
- `netlify/functions/api.mjs`: the presence write, presence reads and all channel reads now run in parallel (`Promise.all`). Same number of blob calls and function calls, lower latency per poll.
- `GET /api/chat` now also returns `hot`: milliseconds since the last message (or since someone else started typing).
- `public/chat.js`: while `hot` is under 45 s (`HOT_MS`) an open chat polls every 2 s (`POLL.hot`); otherwise it stays at 5 s. Sending a message switches to the fast rate immediately.

**Netlify usage.** Quiet chats: unchanged. During a live conversation (and 45 s after it ends) polling is 2.5x as frequent. Minimized (30 s) and background-tab (60 s) rates are unchanged. Tune `POLL.hot` and `HOT_MS` at the top of `chat.js`.

**Limit.** The first message after a quiet period can still take up to 5 s. True instant delivery needs a push service (e.g. Ably, Pusher), because Netlify Functions cannot hold a connection open.

## 2. Log repeating task (Personal calendar)

- A **🔁 Log repeating task** button above the "Tip: press P / S / T" line. Visible only in Personal mode (pure CSS: `body[data-mode="shared"] .repbar{display:none}`).
- Clicking it opens a pane with: title, description, priority, **start date**, **end date**, weekday chips (Mon-Sun) with presets (Weekdays, M·W·F, T·Th, Every day, Clear), and a "Skip Philippine holidays" option.
- A live summary shows the number of notes and first/last date before anything is created, and explains problems (end before start, no weekday chosen, range over 366 days).
- **Create notes** adds one regular sticky note per matching day. They behave like any other note (move, pin, edit, complete, trash).
- Example: Start 1 Dec 2026, End 31 Dec 2026, Mon/Wed/Fri gives 13 notes (11 with holidays skipped).

**Performance (no slowdown).**
- Nothing runs at page load except attaching one click handler; the pane's DOM is built the first time it is opened.
- Dates are generated with a single loop of at most 366 steps using weekday arithmetic.
- All notes are pushed to the board in one pass, saved with **one** `PUT /api/board` (existing 350 ms debounce), and the calendar is redrawn **once**.
- A size guard refuses the run if the board would exceed the server's ~1 MB limit, with a message instead of a failed save.
- No server or API change.

**Files touched:** `public/repeat.js` (new), `public/index.html` (button + script tag), `public/app.js` (one line: keyboard shortcuts ignore keys while the pane is open), `public/style.css` (styles appended), `README.md`, `test/smoke.mjs`.

## Tests
- `npm test`: all existing checks pass, plus one for the new `hot` chat field.
- The repeating pane was checked in a real browser (Chromium) with a mocked API: correct weekdays and counts, holiday skipping, exactly one save request, new IDs unique, button hidden on Shared, validation messages, Esc closes, no console errors.
