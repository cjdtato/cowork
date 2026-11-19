// Dependency-free smoke test for the API.  Run:  npm test
// Runs the real netlify/functions/api.mjs against an in-memory stand-in for Netlify Blobs.
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const MOCK = `
const data = new Map(); let ver = 0;
export function getStore() { return {
  async get(k) { const r = data.get(k); return r ? structuredClone(r.v) : null; },
  async getWithMetadata(k) { const r = data.get(k); return r ? { data: structuredClone(r.v), etag: r.e } : null; },
  async setJSON(k, v, o = {}) { const r = data.get(k);
    if (o.onlyIfNew && r) return { modified: false };
    if (o.onlyIfMatch && (!r || r.e !== o.onlyIfMatch)) return { modified: false };
    data.set(k, { v: structuredClone(v), e: String(++ver) }); return { modified: true }; },
  async delete(k) { data.delete(k); } }; }`;

const here = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stb-'));
fs.writeFileSync(path.join(tmp, 'blobs-mock.mjs'), MOCK);
fs.writeFileSync(path.join(tmp, 'api.mjs'), fs.readFileSync(path.join(here, '../netlify/functions/api.mjs'), 'utf8').replace("'@netlify/blobs'", "'./blobs-mock.mjs'"));
process.env.ADMIN_INITIAL_PASSWORD = 'test-password-123';
const handler = (await import(pathToFileURL(path.join(tmp, 'api.mjs')).href)).default;

// a "browser": own cookie jar, calls the API exactly like public/auth.js (JSON header always, body only if given)
const browser = () => {
  let jar = '';
  return async (p, method = 'GET', body, rawBody) => {
    const res = await handler(new Request('https://x.test/api' + p, { method, headers: { 'Content-Type': 'application/json', ...(jar ? { cookie: jar } : {}) }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) }));
    const sc = res.headers.get('set-cookie');
    if (sc) { const [pair, ...a] = sc.split(/;\s*/); jar = a.some(x => /^Max-Age=0$/i.test(x)) ? '' : pair; }
    let d = {}; try { d = await res.json(); } catch {}
    return { status: res.status, d, cookie: jar };
  };
};

let failed = 0;
const check = (name, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + name); if (!ok) failed++; };
const ADMIN = { username: 'admin', password: 'test-password-123' };

console.log('Login / logout');
const A = browser();
check('wrong password is rejected (401)', (await A('/login', 'POST', { username: 'admin', password: 'nope-nope-1' })).status === 401);
check('login works', (await A('/login', 'POST', ADMIN)).status === 200);
check('/me works when logged in', (await A('/me')).status === 200);
const oldCookie = (await A('/me')).cookie;
check('logout with no body works (the original auto-login bug)', (await A('/logout', 'POST')).status === 200);
check('/me is 401 after logout, so the login page will not auto-login', (await A('/me')).status === 401);
const replay = browser(); await replay('/me');   // fresh jar, then replay the OLD cookie
const r = await handler(new Request('https://x.test/api/me', { headers: { cookie: oldCookie } }));
check('the old session cookie is revoked server-side', r.status === 401);
check('logout still succeeds with no session at all', (await browser()('/logout', 'POST')).status === 200);
check('malformed JSON is still rejected (400)', (await browser()('/login', 'POST', null, '{not json')).status === 400);

console.log('Board: no silent overwrite between devices');
const D1 = browser(), D2 = browser();
await D1('/login', 'POST', ADMIN); await D2('/login', 'POST', ADMIN);
const b1 = await D1('/board', 'PUT', { theme: 'white', tasks: [], rev: 0 });
check('first save returns revision 1', b1.status === 200 && b1.d.rev === 1);
const b2 = await D2('/board', 'PUT', { theme: 'white', tasks: [{ id: 'x', title: 'from device 2', date: '2026-01-02' }], rev: 0 });
check('a stale device is refused (409) instead of overwriting', b2.status === 409);
check('...and the first device\'s data is intact', (await D2('/me')).d.board.rev === 1);
const b3 = await D1('/board', 'PUT', { theme: 'white', tasks: [], rev: 1 });
check('saving with the current revision works (rev 2)', b3.status === 200 && b3.d.rev === 2);
check('an older client that sends no revision still works', (await D1('/board', 'PUT', { theme: 'white', tasks: [] })).status === 200);

console.log('Passwords revoke other sessions');
const P1 = browser(), P2 = browser();
await P1('/login', 'POST', ADMIN); await P2('/login', 'POST', ADMIN);
check('changing password succeeds', (await P1('/change-password', 'POST', { currentPassword: ADMIN.password, newPassword: 'new-password-456' })).status === 200);
check('the device that changed it stays signed in', (await P1('/me')).status === 200);
check('every other device is signed out', (await P2('/me')).status === 401);
check('the old password no longer works', (await browser()('/login', 'POST', ADMIN)).status === 401);
const N = browser(); check('the new password works', (await N('/login', 'POST', { username: 'admin', password: 'new-password-456' })).status === 200);

console.log('Admin reset signs the user out; dates use Manila time');
const real = Date.now, fake = Date.parse('2026-01-01T17:00:00Z');   // 01:00 on 2 Jan in Manila, still 1 Jan in UTC
Date.now = () => fake;
await N('/users', 'POST', { username: 'staff1', name: 'Staff One', role: 'staff', password: 'temp-pass-1' });
Date.now = real;
const created = (await N('/users')).d.users.find(u => u.username === 'staff1');
check('records created after midnight in Manila get the Manila date', created.created === '2026-01-02');
const S = browser(); check('staff can log in', (await S('/login', 'POST', { username: 'staff1', password: 'temp-pass-1' })).status === 200);
await N('/users/' + created.id, 'PUT', { name: 'Staff One', role: 'staff', active: true, hostIds: [], password: 'reset-pass-2' });
check('admin password reset signs that user out everywhere', (await S('/me')).status === 401);
check('admin changing their own password via Users keeps their session', (await N('/users/u_admin', 'PUT', { name: 'Administrator', role: 'admin', active: true, password: 'admin-new-789' })).status === 200 && (await N('/me')).status === 200);

console.log('Heads (admins) never receive tasks');
await N('/users', 'POST', { username: 'head2', name: 'Second Head', role: 'admin', password: 'head-pass-2' });
await N('/users', 'POST', { username: 'sup1', name: 'Supervisor', role: 'host', password: 'sup-pass-12' });
const users = (await N('/users')).d.users, id = u => users.find(x => x.username === u).id;
await N('/users', 'POST', { username: 'staff2', name: 'Staff Two', role: 'staff', password: 'staff-pass-2', hostIds: [id('sup1')] });
const staff2 = (await N('/users')).d.users.find(x => x.username === 'staff2').id;
const task = a => ({ title: 'Do it', description: '', priority: 'Now', date: '2026-02-01', assignees: a });
const people = (await N('/people')).d.people.map(x => x.username);
check("the Head's 'assign to' list excludes every Head (including the default admin)", !people.includes('admin') && !people.includes('head2'));
check("...but still lists supervisors and staff", people.includes('sup1') && people.includes('staff2'));
check('a Head cannot assign a task to themselves', (await N('/shared', 'POST', task(['u_admin']))).status === 403);
check('a Head cannot assign a task to another Head', (await N('/shared', 'POST', task([id('head2')]))).status === 403);
check('a Head cannot assign to [staff + a Head] together', (await N('/shared', 'POST', task([staff2, id('head2')]))).status === 403);
const ok = await N('/shared', 'POST', task([staff2, id('sup1')]));
check('a Head can still assign to staff and supervisors', ok.status === 201);
check('a Head cannot add a Head to an existing task', (await N('/shared/' + ok.d.id, 'PUT', { assignees: [staff2, 'u_admin'] })).status === 403);
const H2 = browser(); await H2('/login', 'POST', { username: 'head2', password: 'head-pass-2' });
check('a NEW Head cannot assign a task to the default admin', (await H2('/shared', 'POST', task(['u_admin']))).status === 403);
check('a NEW Head cannot assign a task to themselves', (await H2('/shared', 'POST', task([id('head2')]))).status === 403);
check('a NEW Head can assign to staff', (await H2('/shared', 'POST', task([staff2]))).status === 201);

console.log('All-users personal overview (default admin only)');
check('the default admin is flagged for the overview', (await N('/me')).d.user.overview === true);
check('a NEW Head is not flagged', (await H2('/me')).d.user.overview === false);
check('a NEW Head is refused the overview (403)', (await H2('/personal-all')).status === 403);
check('logged-out visitors are refused (401)', (await browser()('/personal-all')).status === 401);
const hb = await H2('/me');
check('a user can save a personal note', (await H2('/board', 'PUT', { theme: 'white', tasks: [{ id: 'ov1', title: 'head2 private note', date: '2026-03-05' }], rev: hb.d.board?.rev ?? 0 })).status === 200);
const ov = await N('/personal-all');
check('the default admin sees every user and their notes', ov.status === 200 && ov.d.users.length >= 2 && ov.d.tasks.some(t => t.title === 'head2 private note' && t.userId === id('head2')));
check('the overview also returns every shared task (incl. ones the admin is not assigned to)', Array.isArray(ov.d.shared) && ov.d.shared.length >= 2 && ov.d.shared.every(x => x.assignees && x.createdByName));
check('the overview never exposes password hashes', !JSON.stringify(ov.d).includes('hash') && !JSON.stringify(ov.d).includes('salt'));
check('the overview is read-only (no write route)', (await N('/personal-all', 'PUT', {})).status === 404);

console.log('Profile picture');
const PNG = 'data:image/png;base64,' + Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,0]).toString('base64');
check('avatar: no picture yet -> 404', (await H2('/avatar')).status === 404);
check('avatar: non-image is rejected', (await H2('/avatar', 'POST', { image: 'data:text/html;base64,PGI+' })).status === 400);
check('avatar: fake image bytes are rejected', (await H2('/avatar', 'POST', { image: 'data:image/png;base64,AAAAAAAA' })).status === 400);
const up1 = await H2('/avatar', 'POST', { image: PNG });
check('avatar: first upload works', up1.status === 200 && up1.d.avatarNext > Date.now() + 14 * 864e5);
check('avatar: /me shows avatarAt', (await H2('/me')).d.user.avatarAt > 0);
check('avatar: can be fetched back', (await H2('/avatar')).status === 200);
const up2 = await H2('/avatar', 'POST', { image: PNG });
check('avatar: second change within 15 days is refused (429)', up2.status === 429);
check('avatar: logged-out visitors are refused', (await browser()('/avatar', 'POST', { image: PNG })).status === 401);

console.log('Group chat');
const SS = browser(); await SS('/login', 'POST', { username: 'staff2', password: 'staff-pass-2' });
check('chat: logged-out visitors are refused (401)', (await browser()('/chat')).status === 401);
const c0 = await SS('/chat?ch=general&rev=-1');
check('chat: starts with a general channel and nobody else online yet', c0.status === 200 && c0.d.channels[0].id === 'general' && c0.d.msgs.length === 0);
check('chat: the poller counts as online', c0.d.online.some(u => u.name === 'Staff Two'));
check('chat: empty messages are refused', (await SS('/chat/send', 'POST', { ch: 'general', text: '   ' })).status === 400);
check('chat: unknown channel is refused', (await SS('/chat/send', 'POST', { ch: 'nope', text: 'hi' })).status === 404);
const m1 = await SS('/chat/send', 'POST', { ch: 'general', text: 'hello <b>team</b>' });
check('chat: staff can send a message', m1.status === 201 && m1.d.mine === true && m1.d.canDel === true);
const seenNow = 'general:' + (m1.d.ts - 1);
const hp1 = await H2('/chat?ch=general&rev=-1&seen=' + seenNow);
check("chat: another user sees it with the sender's name and role", hp1.d.msgs.length === 1 && hp1.d.msgs[0].name === 'Staff Two' && hp1.d.msgs[0].mine === false);
check('chat: the other user gets an unread count', hp1.d.channels[0].unread === 1);
check('chat: unread clears once seen', (await H2('/chat?ch=general&rev=-1&seen=general:' + m1.d.ts)).d.channels[0].unread === 0);
check('chat: an up-to-date client (same rev) is not resent the messages', (await H2('/chat?ch=general&rev=' + hp1.d.rev)).d.msgs === undefined);
check('chat: online list shows both people, Heads first', (await H2('/chat')).d.online.map(u => u.role).join() === 'admin,staff');
check('chat: typing shows to others', (await SS('/chat?ch=general&typing=general')).status === 200 && (await H2('/chat?ch=general')).d.online.find(u => u.name === 'Staff Two').typing === true);
check('chat: typing in another channel is not shown here', (await SS('/chat?ch=general')) && (await H2('/chat?ch=general')).d.online.find(u => u.name === 'Staff Two').typing === false);
check("chat: nobody can edit someone else's message", (await H2('/chat/msg/' + m1.d.id + '?ch=general', 'PUT', { text: 'hacked' })).status === 403);
const ed = await SS('/chat/msg/' + m1.d.id + '?ch=general', 'PUT', { text: 'edited' });
check('chat: the author can edit (and it is marked edited)', ed.status === 200 && ed.d.edited === true && ed.d.text === 'edited');
check('chat: an edit bumps the revision so others refresh', (await H2('/chat?ch=general&rev=' + hp1.d.rev)).d.msgs?.[0].text === 'edited');
const hotPoll = await SS('/chat?ch=general&rev=-1');
check('chat: poll reports "hot" (ms since last activity) so the browser can poll faster during a live conversation', typeof hotPoll.d.hot === 'number');
const other = await SS('/chat/send', 'POST', { ch: 'general', text: 'second' });
check("chat: a regular user cannot delete someone else's message", (await H2('/chat/send', 'POST', { ch: 'general', text: 'from head2' })).status === 201 && (await SS('/chat/msg/' + (await H2('/chat?ch=general&rev=-1')).d.msgs.at(-1).id + '?ch=general', 'DELETE')).status === 403);
check('chat: a Head can delete anyone\'s message', (await N('/chat/msg/' + other.d.id + '?ch=general', 'DELETE')).status === 200);
check('chat: the author can delete their own', (await SS('/chat/msg/' + m1.d.id + '?ch=general', 'DELETE')).status === 200);
check('chat: deleted messages are gone', !(await SS('/chat?ch=general&rev=-1')).d.msgs.some(x => x.id === m1.d.id || x.id === other.d.id));
check('chat: staff cannot add channels', (await SS('/chat/channels', 'POST', { name: 'random' })).status === 403);
check('chat: a Head can add a channel', (await N('/chat/channels', 'POST', { name: 'Random Stuff!' })).d.id === 'random-stuff');
check('chat: duplicate channel names are refused', (await N('/chat/channels', 'POST', { name: 'random-stuff' })).status === 400);
check('chat: new channel shows for everyone', (await SS('/chat')).d.channels.map(c => c.id).join() === 'general,random-stuff');
check('chat: messages go to the right channel', (await SS('/chat/send', 'POST', { ch: 'random-stuff', text: 'off topic' })).status === 201 && (await SS('/chat?ch=general&rev=-1')).d.msgs.every(x => x.text !== 'off topic'));
check('chat: general cannot be removed', (await N('/chat/channels/general', 'DELETE')).status === 400);
check('chat: a Head can remove a channel', (await N('/chat/channels/random-stuff', 'DELETE')).status === 200 && (await SS('/chat')).d.channels.length === 1);
await N('/chat/channels', 'POST', { name: 'quiet' });
check('chat: an empty channel seen at 0 still counts later messages as unread (regression)', (await SS('/chat/send', 'POST', { ch: 'quiet', text: 'first!' })).status === 201 && (await H2('/chat?seen=general:0,quiet:0')).d.channels.find(c => c.id === 'quiet').unread === 1);
check('chat: a channel missing from a known "seen" list counts as all-unread; a brand-new browser (no list) sees 0', (await H2('/chat?seen=general:0')).d.channels.find(c => c.id === 'quiet').unread === 1 && (await H2('/chat')).d.channels.find(c => c.id === 'quiet').unread === 0);
await N('/chat/channels/quiet', 'DELETE');
check('chat: 1000+ character messages are trimmed', (await SS('/chat/send', 'POST', { ch: 'general', text: 'x'.repeat(5000) })).d.text.length === 1000);
check("chat: teammates' profile pictures can be fetched", (await N('/avatar/' + id('head2'))).status === 200);
check('chat: a stranger cannot fetch profile pictures', (await browser()('/avatar/' + id('head2'))).status === 401);

console.log('Custom roles & private role chats');
const sup = browser(); await sup('/login', 'POST', { username: 'sup1', password: 'sup-pass-12' });
check('roles: staff cannot list or create roles (403)', (await SS('/tags')).status === 403 && (await SS('/tags', 'POST', { name: 'DSD' })).status === 403);
check('roles: empty names are refused', (await N('/tags', 'POST', { name: '  !!  ' })).status === 400);
const t1 = await N('/tags', 'POST', { name: 'DSD' });
check('roles: a Head can create a role; it gets a dsd-chat channel', t1.status === 201 && t1.d.id === 'dsd' && t1.d.channel === 'dsd-chat');
check('roles: duplicate role is refused', (await N('/tags', 'POST', { name: 'dsd' })).status === 400);
check('roles: a role nobody holds is invisible in everyone\'s chat', (await SS('/chat')).d.channels.every(c => c.id !== 'dsd-chat') && (await N('/chat')).d.channels.every(c => c.id !== 'dsd-chat'));
check('roles: tag staff2 + sup1 at once ("distribute to many users")', (await N('/tags/dsd', 'PUT', { userIds: [staff2, id('sup1')] })).status === 200);
check('roles: users list shows who holds it', (await N('/users')).d.users.find(u => u.id === staff2).tagIds.join() === 'dsd' && (await N('/tags')).d.tags[0].members === 2);
const dsd = await SS('/chat?ch=dsd-chat&rev=-1');
check('roles: a holder sees dsd-chat (marked private)', dsd.d.channels.some(c => c.id === 'dsd-chat' && c.tag === 'dsd') && dsd.d.ch === 'dsd-chat');
check('roles: ...and can post in it', (await SS('/chat/send', 'POST', { ch: 'dsd-chat', text: 'dsd only' })).status === 201);
check('roles: another holder can read it', (await sup('/chat?ch=dsd-chat&rev=-1')).d.msgs.some(m => m.text === 'dsd only'));
const outsider = await H2('/chat?ch=dsd-chat&rev=-1');
check('roles: a user WITHOUT the role does not see the channel, its messages or its unread count', outsider.d.channels.every(c => c.id !== 'dsd-chat') && outsider.d.msgs === undefined && outsider.d.ch === null);
check('roles: ...cannot post to it (404)', (await H2('/chat/send', 'POST', { ch: 'dsd-chat', text: 'sneaky' })).status === 404);
const dm = (await SS('/chat?ch=dsd-chat&rev=-1')).d.msgs.at(-1);
check('roles: ...cannot edit or delete its messages (404)', (await H2('/chat/msg/' + dm.id + '?ch=dsd-chat', 'PUT', { text: 'x' })).status === 404 && (await H2('/chat/msg/' + dm.id + '?ch=dsd-chat', 'DELETE')).status === 404);
check('roles: a Head who does not hold the role is also locked out', (await N('/chat?ch=dsd-chat&rev=-1')).d.msgs === undefined && (await N('/chat/send', 'POST', { ch: 'dsd-chat', text: 'x' })).status === 404);
const onl = (await SS('/chat?ch=dsd-chat')).d.online.map(u => u.name);
check('roles: the online list inside a role channel only shows its members', onl.includes('Staff Two') && !onl.includes('Second Head'));
check('roles: general is still visible to everyone', (await H2('/chat')).d.channels.some(c => c.id === 'general'));
check('roles: a role channel cannot be removed on its own', (await N('/chat/channels/dsd-chat', 'DELETE')).status === 400);
check('roles: a manual channel cannot steal a role channel name', (await N('/chat/channels', 'POST', { name: 'dsd-chat' })).status === 400);
check('roles: unknown role ids are ignored when tagging a user', (await N('/users/' + staff2, 'PUT', { name: 'Staff Two', role: 'staff', active: true, hostIds: [id('sup1')], tagIds: ['dsd', 'ghost'] })).status === 200 && (await N('/users')).d.users.find(u => u.id === staff2).tagIds.join() === 'dsd');
check('roles: editing a user without tagIds keeps their roles', (await N('/users/' + staff2, 'PUT', { name: 'Staff Two', role: 'staff', active: true, hostIds: [id('sup1')] })).status === 200 && (await N('/users')).d.users.find(u => u.id === staff2).tagIds.join() === 'dsd');
check('roles: an existing user can be tagged from the edit form', (await N('/users/' + id('head2'), 'PUT', { name: 'Second Head', role: 'admin', active: true, tagIds: ['dsd'] })).status === 200 && (await H2('/chat?ch=dsd-chat&rev=-1')).d.msgs?.some(m => m.text === 'dsd only'));
await N('/tags', 'POST', { name: 'Billing Team' });
check('roles: new users can be created with roles', (await N('/users', 'POST', { username: 'bill1', name: 'Bill', role: 'staff', password: 'bill-pass-12', tagIds: ['billing-team', 'nope'] })).status === 200 && (await N('/users')).d.users.find(u => u.username === 'bill1').tagIds.join() === 'billing-team');
const BB = browser(); await BB('/login', 'POST', { username: 'bill1', password: 'bill-pass-12' });
check('roles: a user in a different role sees only their own role channel', (await BB('/chat')).d.channels.map(c => c.id).join() === 'general,billing-team-chat');
check('roles: removing someone from a role removes the channel from them at once', (await N('/tags/dsd', 'PUT', { userIds: [staff2] })).status === 200 && (await H2('/chat?ch=dsd-chat&rev=-1')).d.channels.every(c => c.id !== 'dsd-chat') && (await sup('/chat')).d.channels.every(c => c.id !== 'dsd-chat'));
check('roles: role channels do not count toward the 6-channel limit', (await Promise.all(['a1', 'a2', 'a3', 'a4', 'a5'].map(n => N('/chat/channels', 'POST', { name: n })))).every(r => r.status === 201) && (await N('/chat/channels', 'POST', { name: 'a6' })).status === 400);
for (const n of ['a1', 'a2', 'a3', 'a4', 'a5']) await N('/chat/channels/' + n, 'DELETE');
const bk = await N('/backup');
check('roles: backups include the roles', bk.d.version === 5 && bk.d.tags.length === 2);
check('roles: deleting a role removes it from users and deletes its channel + messages', (await N('/tags/dsd', 'DELETE')).status === 200
  && (await N('/users')).d.users.every(u => !u.tagIds.includes('dsd')) && (await SS('/chat')).d.channels.every(c => c.id !== 'dsd-chat'));
check('roles: re-creating the role starts with an empty channel', (await N('/tags', 'POST', { name: 'DSD' })).status === 201 && (await N('/tags/dsd', 'PUT', { userIds: [staff2] })).status === 200 && (await SS('/chat?ch=dsd-chat&rev=-1')).d.msgs.length === 0);
check('roles: restoring a backup brings the roles and who holds them back', (await N('/backup', 'POST', bk.d)).status === 200 && (await N('/tags')).d.tags.length === 2 && (await N('/users')).d.users.find(u => u.id === staff2).tagIds.join() === 'dsd');
check('roles: an older backup (no roles) still restores and drops stale role ids', (await N('/backup', 'POST', { ...bk.d, version: 4, tags: undefined, users: bk.d.users.map(u => ({ ...u, tagIds: ['dsd', 'zzz'] })) })).status === 200 && (await N('/users')).d.users.every(u => u.tagIds.every(t => ['dsd', 'billing-team'].includes(t))));


console.log('Profiles: view online/offline users, hide profile');
const s1id = (await N('/users')).d.users.find(x => x.username === 'staff1').id;
const V = browser(); await V('/login', 'POST', { username: 'sup1', password: 'sup-pass-12' });   // a plain viewer
await SS('/chat');   // staff2 heartbeat -> online
const pOn = await V('/profile/' + staff2), pOff = await SS('/profile/' + s1id);
check('profile: anyone can view an online user', pOn.status === 200 && pOn.d.online === true && pOn.d.username === 'staff2' && !pOn.d.hidden);
check('profile: anyone can view an offline user (with last seen when known)', pOff.status === 200 && pOff.d.online === false && pOff.d.hidden === false);
check('profile: chat lists offline people too', (await SS('/chat')).d.offUsers.some(u => u.id === s1id));
check('profile: unknown id is 404', (await V('/profile/nope')).status === 404);
check('profile: hiding needs login', (await browser()('/profile-visibility', 'POST', { hidden: true })).status === 401);
check('profile: a user can hide their own profile', (await SS('/profile-visibility', 'POST', { hidden: true })).d.profileHidden === true && (await SS('/me')).d.user.profileHidden === true);
const hv = await V('/profile/' + staff2);
check('profile: others then see only name + role', hv.d.hidden === true && hv.d.name && hv.d.role && !hv.d.username && !hv.d.lastSeen && !('avatarAt' in hv.d));
check('profile: the owner still sees their own full profile', (await SS('/profile/' + staff2)).d.hidden === false);
check('profile: a Head can still see a hidden profile', (await N('/profile/' + staff2)).d.hidden === false);
check('profile: hidden photo is not served to others', (await V('/avatar/' + staff2)).status === 404);
check('profile: chat cards drop the hidden photo version for others', !((await V('/chat')).d.avs || {})[staff2]);
check('profile: un-hiding works', (await SS('/profile-visibility', 'POST', { hidden: false })).d.profileHidden === false && (await V('/profile/' + staff2)).d.hidden === false);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(failed ? `\n${failed} check(s) FAILED` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
