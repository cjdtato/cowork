# Co-Work v2.6 — Servers (Discord-style) · handoff notes

## Model
- **Server = namespace** for: custom roles (tags, e.g. COLLECTION/BILLING → private `<role>-chat`), chat channels+messages, shared-calendar tasks, and **positions** (admin=Head / host=Supervisor / staff).
- **CEPALCO Server** (`id:'cepalco'`) = the default server, created by default admin `u_admin`. It uses the ORIGINAL un-prefixed keys and the global `users[].role/hostIds/tagIds` → **no data migration**. Everyone with an account is in it.
- **User servers** (`id:'s_<8hex>'`): any user can create (max 5 owned, 100 members). Creator = Head + owner. Data keys prefixed `sv:<id>:` (`shared`, `tags`, `chat:*`).
- Still **global**: accounts/passwords, personal boards, friends, DMs, profiles/posts, notifications, avatars, sessions, presence.

## Storage
- `servers` = `[{id,name,ownerId,created,code,members:{<uid>:{role,hostIds,tagIds}}}]` (CEPALCO is implicit, not stored).
- `svKey(id,k)` maps `^(shared|tags|chat:)` → `sv:<id>:<k>` (non-default only).

## API (`netlify/functions/api.mjs`)
- Active server = request header **`X-Server`** (absent/`cepalco` = default). Non-member → 403 `You are not a member of that server.` (front end then resets to CEPALCO).
- `scoped(bs, ()=>SV)` wraps the blob store per request, so ALL existing chat/shared/tags routes work unchanged per server.
- After auth: `allUs` = all accounts; `us` = members of active server with `role/hostIds/tagIds` overlaid from membership; `me` = overlay of caller; `nameUs` = `us` + others (names of ex-members). Friends/DM routes use `allUs`.
- New routes (global, ignore X-Server):
  `GET /servers` · `POST /servers {name}` · `POST /servers/join {code}` · `PUT /servers/<id> {name}` (Head) · `POST /servers/<id>/invite` (new code, Head) · `POST /servers/<id>/leave` · `DELETE /servers/<id>` (owner only; wipes scoped keys).
- Inside a user server the admin-gated routes behave as: `POST /users {username,role,hostIds,tagIds}` = add EXISTING account; `PUT /users/<id>` = change position/roles; `DELETE /users/<id>` = remove member; `PUT/DELETE /tags/<id>` edit membership; `/backup` → 403; `/personal-all` + overview = CEPALCO only. `/me` returns `server:{id,name}`.
- Typing indicator stores `sv` in presence so it doesn't leak across servers. Deleting an account removes it from all servers.

## Front end
- `public/auth.js`: `api()` adds `X-Server` from `localStorage.stb_sv`; 403 "not a member" → clears it + reload.
- `public/servers.js` (new, loaded by index/users/overview): left rail (64px icons → 244px on hover, ☰ tab on phones), ＋ Add (create / join by code), ⓘ Server info (creator, members, invite code, rename, leave, delete, link to Users page). Switching = set `stb_sv` + reload. On `users.html` in a user server it hides name/password/active inputs and relabels the form "Add member (existing account)".

## Known limits / ideas
- Only the CEPALCO admin creates accounts; others join via invite code or username add.
- Server "Active" toggle/password fields on Users page are ignored in user servers.
- Server Heads can view hidden profiles of their members (same rule as CEPALCO Heads).
- Not done: server icons/uploads, per-server backups, transfer ownership, bans.

## Tests
`npm test` → all original checks + new server checks (isolation of chat/roles/tasks, join/leave/delete, permissions).
