# Co-Work v2.13.0 — Deploy Guide (GitHub → Netlify)

## 1. Push to GitHub
```
git init && git add . && git commit -m "Co-Work v2.13.0"
git branch -M main
git remote add origin <your-repo-url> && git push -u origin main
```

## 2. Create the Netlify site
1. Netlify → **Add new site → Import from Git** → pick the repo.
2. Settings are read from `netlify.toml` (no build command, publish dir `public`, functions in `netlify/functions`).
3. **Site configuration → Environment variables** → add `ADMIN_INITIAL_PASSWORD` (8+ characters).
4. **Deploy site.**

> Deploy from Git or the Netlify CLI. Drag-and-drop will NOT install `@netlify/blobs`.

## 3. First login
Open the site → log in as `admin` with your `ADMIN_INITIAL_PASSWORD` → **Admin → 👥 Accounts & backup** → create accounts, then set positions/roles per server (Admin → Manage people & roles). Temporary passwords must be changed at first login.

## 4. Verify (2 minutes)
- `https://<site>/api/` responds (JSON error or data, not a 404 page).
- Login works, both calendars (Personal / Shared) load.
- Group chat dock opens; create a Server and join with its invite code.

## Local check before pushing
```
npm install
npm test        # runs the full check suite, no network needed
```

## Troubleshooting
| Symptom | Fix |
|---|---|
| "Setup needed: set ADMIN_INITIAL_PASSWORD" | Add the variable in Netlify, then **Trigger deploy**. |
| 404 on `/api/...` | Site was drag-dropped; redeploy from Git. |
| Locked out (5 tries) | Wait 15 minutes. |
| Changed the env password but admin still uses the old one | The variable only seeds the first admin; change the password inside the app. |

Docs: `README.md` (features/roles), `SERVERS.md` (servers feature), `CHANGES.md` (v2.6 changes).
