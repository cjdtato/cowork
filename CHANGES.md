# Unread chat badges on the server icons (Discord style)
Every server icon in the left rail now shows a red badge with the number of unread chat messages in that server, from **any channel you can see there** (`#general`, other channels, and private role chats such as `billing-chat`). Your own messages never count; role chats count only if you hold the role. The count clears as you read it in the chat; the open server updates instantly, the others refresh about once a minute (only while the tab is visible) and when you return to the tab. Works on every page that has the rail, including the Cross-server Calendar.
- API: `POST /api/servers/unread` `{seen:{<serverId>:"ch:ts,..."}}` -> `{servers:{<id>:{unread,last:{<ch>:ts}}}}` (global, ignores `X-Server`; one small request a minute per open tab).
- A server this browser has never opened starts at 0 (what is already there counts as read), so nothing lights up on first use.
- Fix that came with it: what you have read is now remembered **per server** (`cw_seen` for CEPALCO, `cw_seen_<serverId>` for others). Before, `#general` of every server shared one marker, so reading it in one server could hide new messages in another.
- Private messages are not tied to a server: they keep their badge on the **Friends** button.
- Files: `netlify/functions/api.mjs`, `public/servers.js`, `public/chat.js`, `test/smoke.mjs` (+13 checks).

# Friends & chat on the Cross-server Calendar page
`cross.html` did not load the chat/friends scripts, so the rail's **Friends** button (and "My profile", friend/post notifications) fell back to opening `index.html`, i.e. a server page. The page now loads `chat.css`, `friends.css`, `posts.css`, `chat.js`, `friends.js` and `posts.js` like every other page, so the Friends panel, private-message pop-outs and profile viewer open right there. "My profile" opens the in-place profile viewer (your posts included). Only `public/cross.html` changed.
The group-chat pill on this page works for the server you last opened, same as on the Users/Overview pages; private messages and friends are not tied to any server.

# v2.7.0
- Default admin: new Admin entry in the server list (`admin-servers.html`) to view, create, rename, transfer, delete and enter any server as Head. He remains Head of CEPALCO Server.
- Tests: 14 new checks; 3 old checks updated (the default admin is no longer treated as an outsider).

# v2.6.0 — Servers
New: CEPALCO Server (default) + user-created servers; left hover rail (`public/servers.js`); per-server roles, positions, chat and shared tasks; `X-Server` header; `/api/servers*` routes. No migration. See `SERVERS.md`.

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

## 3. Profile pictures in chat messages

**Cause.** In `public/chat.js`, the avatar for a message was built from the message object, so it asked the server for `/api/avatar/<message id>` instead of `/api/avatar/<sender's user id>`. That always returned 404, so only the initials showed. (The "Online now" list worked because those entries carry the user id.)

**Fix.** `renderLog()` now passes the sender (`m.uid`, name, avatarAt) to `avatar()`. Anyone with a profile picture now shows it beside their messages; people without one still show initials. No server change.

## 4. Repeating-task button no longer shifts the layout

**Cause.** `.repbar` was a normal block (button height + 8px margin), so Personal mode was taller than before and Shared mode (button hidden) was not, pushing the calendar down and making it jump when switching modes.

**Fix.** `public/style.css` only: `.repbar` now has height 0 and no margin, and the button floats over the existing "Tip: press P / S / T" row (right side on desktop). Every element keeps its original position in both modes. On phones (<=700px) the keyboard tip is hidden in Personal mode (its space is kept) and the button is centred there.

## 5. Logo and taglines

- Header tagline "Philippine calendar · tap a date..." and login line "Log in to open your calendar" replaced with italic *your cowork choice!*; "Version 1.0.0" (not italic) added: after it in the header, on its own line on the login page. Same single line height, so nothing shifts.
- New logo: calendar-with-checkmark mark (inline SVG that follows the theme/mode accent colour) plus a "Co-Work" wordmark with an accent hyphen. Also used as the favicon (`public/logo.svg`). Replaces the 🗓️ emoji.

# Friends & private messages
See README ("Friends & private messages"). New: friends.js, friends.css; changed: api.mjs, chat.js, app.js, the three HTML pages, test/smoke.mjs (+41 checks).

# Profile posts (Threads style)
See README ("Profile posts"). New: `posts.js`, `posts.css`; changed: `api.mjs` (routes, limits, account-delete cleanup), `app.js` (own profile mount, bell text/icon/click), `chat.js` (profile viewer mount), the three HTML pages (stylesheet + script), `test/smoke.mjs` (+23 checks). The profile dialog is now wider (480 px) and scrolls when the posts are long.
