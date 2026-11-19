# Co-Work

One app, two calendars:

| | 👤 **Personal** | 👥 **Shared** |
|---|---|---|
| Who sees it | Only you | You + the people involved |
| What it is | Your own sticky-note board per date | Tasks a supervisor/head **assigns** to staff |
| Who can add | Everyone | Supervisors and the Head only |

Switch with the two big buttons under the header (or press **P** / **S**). Your last choice is remembered.

## Roles
- **Head (admin)** – assigns tasks to Supervisors and Staff (never to themselves or any other Head, including the default `admin`), manages users, links staff to supervisors, exports/imports backups.
- **Supervisor (host)** – assigns tasks to *their own* staff, edits/closes/trashes them, sees progress per person.
- **Staff** – sees tasks assigned to them, taps **✔ Mark done** for their part. A staff member can report to several supervisors.

A task assigned to several people is complete when **everyone** has marked their part done (shown as `1/3 done`); a supervisor can also **Close** it for everyone.

## Features
Group chat dock (bottom-right) · Philippine holiday calendar · date boards with drag & drop (Now / Next / Later, Complete, Trash) · "coming up" list · filter shared tasks by person · 4 themes · password change · login lockout (5 tries → 15 min) · admin user manager · full backup/restore.

## Deploy (GitHub → Netlify)
1. Push this folder to a GitHub repo.
2. Netlify → **Add new site → Import from Git**. Settings come from `netlify.toml` (no build command, publish dir `public`).
3. Add the environment variable **`ADMIN_INITIAL_PASSWORD`** (8+ chars) under *Site configuration → Environment variables*, then deploy.
4. Open the site, log in as `admin` with that password.
5. **Users** page → add Supervisors, then Staff (tick who they report to). New/reset passwords are temporary; people must choose their own at first login.

> Must deploy from Git or the Netlify CLI (not drag-and-drop) so the function's dependency installs.

## Local dev
```
npm install
npm i -g netlify-cli
echo ADMIN_INITIAL_PASSWORD=choose-one-123 > .env
netlify dev
```

## Tests
```
npm test
```
Runs 111 checks against the real API with an in-memory stand-in for Netlify Blobs (no network, no extra dependencies).
See `IMPROVEMENTS.md` for the review, the logout fix, and what changed in v2.2.

## Custom roles & private role chats
Besides Head / Supervisor / Staff, a Head can create any number of **custom roles** (e.g. `DSD`) on the **Users** page and give them to as many people as they like.
- **Create:** Users → *Custom roles* → type a name → **Create role**. Up to 20 roles.
- **Give it to people:** tick it in a user's *Add / Edit* form, or click **👥 Members** on the role to tick many people at once.
- **Chat:** every role gets a private channel named `<role>-chat` (e.g. `🔒 # dsd-chat`). Only people holding the role can see it, read it, post in it, or see its unread badge. Removing someone from the role removes the channel from them on their next refresh.
- **Heads are not added automatically.** A Head who isn't tagged can't see a role channel (tag yourself to join). Heads can't delete a role channel directly; **deleting the role** deletes its channel and messages.
- Role channels don't count toward the 6-channel limit. Inside a role channel the *Online now* list shows only that role's members.
- Backups (v5) include the roles and who holds them; chat messages are still not part of a backup. Older backups restore fine (current roles are kept).
- Storage: `tags` = `[{id,name}]`, `users[].tagIds`, and role channels are entries in `chat:channels` with a `tag` field. API: `GET/POST /api/tags`, `PUT /api/tags/<id>` (`{userIds}`), `DELETE /api/tags/<id>`; `tagIds` is accepted by `POST/PUT /api/users`.

## Group chat
A small 💬 **Group chat** pill sits in the bottom-right corner of every page (like the Facebook chat dock). Click it to open the chat, or drag it anywhere you like (position is remembered).
- **Drag the chat window** by its header and the **Online now** list pops out beside it (Discord-style member list, grouped Heads / Supervisors / Staff, with a typing indicator). On touch screens use the 👥 button. Double-click the header to snap the window back to the corner.
- **Channels** (`# general` always exists). Heads can add or remove channels (＋ / 🗑); up to 6.
- Everyone can **edit** their own messages and **delete** their own; Heads can delete anyone's. Links are clickable, messages are plain text (no HTML), 1000 characters max, last 300 kept per channel.
- Unread badges per channel and on the pill. Works with all four themes; on phones it becomes a bottom sheet.
- **How it updates:** Netlify has no websockets, so the browser polls `GET /api/chat` (every 5 s while the chat is open, 30 s while minimized, 60 s in a background tab; change `POLL` at the top of `public/chat.js`). Each poll is one function call, so a busy team uses noticeably more Netlify function calls than before. "Online" means polled in the last 75 s.
- Storage (same `taskboard` blob store): `chat:channels`, `chat:<channel>`, `pres:<userId>`. Chat is not part of the Users-page backup/restore.
- Files: `public/chat.js`, `public/chat.css`, chat routes in `api.mjs`, plus `GET /api/avatar/<id>` so teammates' profile pictures show in the chat.

## Log repeating task (Personal calendar)
On the **Personal** calendar a **🔁 Log repeating task** button sits just above the keyboard-shortcut tip (it is hidden on Shared). It opens a pane where you enter a title (and optional description / priority), a **start** and **end** date, and the **weekdays** to repeat on (quick presets: Weekdays, M·W·F, T·Th, Every day). A live line shows how many sticky notes will be created; optionally skip Philippine holidays. **Create notes** adds one normal sticky note per matching day (max 366 days per run).
- Speed: the pane is built only when first opened; all notes are created in memory and saved with **one** `PUT /api/board` request, then the calendar redraws once. No server change.
- Files: `public/repeat.js` (logic), a button in `public/index.html`, styles at the end of `public/style.css`. Details in `CHANGES.md`.

## Upgrading from the earlier calendar-only version
Same storage name, so existing accounts and personal boards carry over. Old `user` accounts become **Staff**; everyone is logged out once (new cookie sessions). Existing admin passwords are unchanged (`ADMIN_INITIAL_PASSWORD` is only used when no users exist yet).

## Layout
```
public/                static site (index, login, users, app.js, repeat.js, style.css)
netlify/functions/api.mjs   API at /api/*  (Netlify Blobs storage)
```
Data keys in the `taskboard` blob store: `users`, `shared`, `board:<userId>` (includes a `rev` revision number), `sess:<token>` (includes the user's password version `pv`).

## Profile picture
Click **👤 Profile** in the header to see your photo and upload a new one (JPG/PNG/WebP, auto-cropped square and resized). The first upload is free; after that it can only be changed **once every 15 days** (enforced by the server). The photo also shows beside your name in the header.
