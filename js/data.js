// הנתונים החיים: צוות וקבוצות, שמירות, אירועים, לוח הודעות ושיחות פרטיות.
// המבנה ב-Firestore מתועד ב-INTEGRATION.md, וההרשאות ב-firestore.rules.
import {S, changed} from "./state.js";
import {watch, put, del} from "./store.js";
import {DEFAULT_GROUPS, TT_URL} from "./config.js";
import {ls, today, uidOf, nameOf, rid, heSort} from "./util.js";

const HOUSE = {A: "hA", B: "hB", C: "hC"};
let started = false, chans = new Map(), byChan = {}, chatUnsub = null, chatCid = null, registered = false;

export const isAdmin = () => !!S.user && S.user.role === "admin";
export const fullName = n => (S.T && S.T.full && S.T.full[n]) || n;
export const groups = () => (S.groupsDoc && Array.isArray(S.groupsDoc.list) ? S.groupsDoc.list : DEFAULT_GROUPS);
export const groupLabel = id => id === "all" ? "כל הצוות" : (groups().find(g => g.id === id) || {}).label || "";
export const myGroups = () => { const d = (S.staff || []).find(x => x.id === S.user.uid); return d ? (d.groups || []).filter(groupLabel) : []; };
const byWhen = (a, b) => (a.date + (a.from || a.time || "")).localeCompare(b.date + (b.from || b.time || ""));
export const upcoming = col => (S[col] || []).filter(x => x.date >= today()).sort(byWhen);
export const myDuties = () => upcoming("duties").filter(x => x.who === S.user.name);

// כל אנשי הצוות: מי שמוגדר במאגר + כל מי שמופיע במערכת השעות
export function people() {
  const m = new Map();
  for (const n of Object.keys((S.T && S.T.teachers) || {})) m.set(uidOf(n), {uid: uidOf(n), name: n, groups: [], off: false, doc: false});
  for (const d of S.staff || []) m.set(d.id, {uid: d.id, name: d.name || nameOf(d.id), groups: (d.groups || []).filter(groupLabel), off: !!d.off, doc: true});
  return [...m.values()].map(p => Object.assign(p, {full: fullName(p.name)})).sort((a, b) => heSort(a.full, b.full));
}
export const person = uid => people().find(p => p.uid === uid) || {uid, name: nameOf(uid), full: fullName(nameOf(uid)), groups: []};

export function loadTT() {
  fetch(TT_URL, {cache: "no-cache"}).then(r => r.json()).then(j => {
    const homes = {};   // מחנכ/ת -> {cls, house}: בסיס להצעת קבוצות אוטומטית
    for (const lvl of [j.elementary || {}, j.junior || {}]) for (const [cls, v] of Object.entries(lvl)) if (v.home) homes[v.home] = {cls};
    for (const x of j.index || []) if (x.type === "house") for (const [n, h] of Object.entries(homes)) if (x.classes.includes(h.cls)) h.house = x.id.split(":")[1];
    S.T = {g: j.generated, days: j.days, teachers: j.teachers, full: j.full_names, homes};
    ls("adgTT", S.T); changed();
  }).catch(() => {});
}

export function startData() {
  if (started) return; started = true;
  const col = (path, key) => watch(path, (list, err) => { if (err) S.err = "לא הצלחנו לטעון את הנתונים. לבדוק את האינטרנט ולפתוח שוב."; else S.err = ""; S[key] = list || S[key] || []; after(key); });
  col("staff", "staff"); col("duties", "duties"); col("events", "events");
  watch("meta", list => { S.groupsDoc = (list || []).find(x => x.id === "groups") || {}; after("groups"); });
  watch("chats", list => { S.chats = (list || []).sort((a, b) => ((b.last || {}).at || 0) - ((a.last || {}).at || 0)); syncChat(); changed(); }, {has: ["members", S.user.uid]});
  syncChannels();
}

function after(key) {
  if (key === "staff" || key === "groups") {
    // כניסה ראשונה: נרשמים למאגר הצוות (בלי קבוצות - אותן קובעת ההנהלה)
    if (key === "staff" && !registered && !S.err && !S.staff.some(x => x.id === S.user.uid)) { registered = true; put("staff", S.user.uid, {name: S.user.name, groups: []}).catch(() => {}); }
    syncChannels();
  }
  changed();
}

// ---- לוח ההודעות: ערוץ לכל קהל יעד. channels/<all | מזהה קבוצה | s_<uid> (הנשלחות שלי)>/msgs/<mid> ----
function syncChannels() {
  const want = new Set(["all", "s_" + S.user.uid, ...(isAdmin() ? groups().map(g => g.id) : S.staff ? myGroups() : [])]);
  for (const [ch, un] of chans) if (!want.has(ch)) { un(); chans.delete(ch); delete byChan[ch]; }
  for (const ch of want) if (!chans.has(ch)) chans.set(ch, watch("channels/" + ch + "/msgs", list => { byChan[ch] = list || []; merge(); }, {recent: 100}));
  merge();
}
function merge() {
  if (!byChan.all) return;   // עד שהערוץ הכללי נטען - "טוען"
  const m = new Map();
  for (const list of Object.values(byChan)) for (const x of list) m.set(x.mid || x.id, x);
  S.board = [...m.values()].sort((a, b) => b.at - a.at);
  changed();
}
export async function sendBoard(title, body, to) {
  const mid = rid(), doc = {mid, title, body, to, by: S.user.uid, byName: fullName(S.user.name), at: Date.now()};
  await Promise.all([...to, "s_" + S.user.uid].map(ch => put("channels/" + ch + "/msgs", mid, doc)));
}
export const delBoard = m => Promise.all([...(m.to || []), "s_" + m.by].map(ch => del("channels/" + ch + "/msgs", m.mid || m.id)));
export const unreadBoard = () => { const seen = ls("adgSeen") || 0; return (S.board || []).filter(m => m.at > seen && m.by !== S.user.uid).length; };

// ---- שיחות פרטיות: chats/<uidA__uidB> + chats/<cid>/msgs ----
export const cidOf = other => [S.user.uid, other].sort().join("__");
export const otherOf = chat => chat.members.find(u => u !== S.user.uid) || S.user.uid;
export const chatUnread = c => !!c.last && c.last.by !== S.user.uid && c.last.at > ((ls("adgChatSeen") || {})[c.id] || 0);
export const unreadChats = () => (S.chats || []).filter(chatUnread).length;
export function markChatSeen(cid) { const m = ls("adgChatSeen") || {}; m[cid] = Date.now(); ls("adgChatSeen", m); }
export function openChat(other) {
  if (S.chatWith === other) return;
  S.chatWith = other; S.chatMsgs = null;
  if (chatUnsub) { chatUnsub(); chatUnsub = null; } chatCid = null;
  syncChat();
}
// מאזינים להודעות רק אחרי שהשיחה קיימת (לפני ההודעה הראשונה אין מה לקרוא, והכללים חוסמים)
function syncChat() {
  if (!S.chatWith || !S.chats) return;
  const cid = cidOf(S.chatWith);
  if (!S.chats.some(c => c.id === cid)) { S.chatMsgs = []; return; }
  if (chatCid === cid) return;
  chatCid = cid;
  chatUnsub = watch("chats/" + cid + "/msgs", list => { S.chatMsgs = (list || []).sort((a, b) => a.at - b.at); changed(); }, {recent: 200});
}
export async function sendChat(other, text) {
  const me = S.user.uid, cid = cidOf(other), at = Date.now();
  await put("chats", cid, {members: [me, other].sort(), names: {[me]: S.user.name, [other]: person(other).name}, last: {text: text.slice(0, 80), at, by: me}}, true);
  await put("chats/" + cid + "/msgs", null, {by: me, text, at});
}

// ---- ניהול צוות (הנהלה) ----
export const saveStaff = (p, patch) => put("staff", p.uid, Object.assign({name: p.name}, patch), true);
export const saveGroups = list => put("meta", "groups", {list});
// הצעה ממערכת השעות: מחנכים -> "מחנכים" + הבית של הכיתה. רק מוסיף, לא מסיר.
export function suggestGroups() {
  const out = [];
  for (const p of people()) {
    const h = S.T && S.T.homes && S.T.homes[p.name]; if (!h) continue;
    const add = ["home", HOUSE[h.house]].filter(g => g && groupLabel(g) && !p.groups.includes(g));
    if (add.length) out.push({p, groups: [...p.groups, ...add]});
  }
  return out;
}
