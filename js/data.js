// הנתונים החיים: צוות וקבוצות, שמירות, אירועים, לוח הודעות ושיחות פרטיות.
// המבנה ב-Firestore מתועד ב-INTEGRATION.md, וההרשאות ב-firestore.rules.
import {S, changed} from "./state.js";
import {watch, put, del} from "./store.js";
import {DEFAULT_GROUPS, TT_URL, EVENTS_URL} from "./config.js";
import {ls, today, uidOf, nameOf, rid, heSort, norm, iso, DAYN} from "./util.js";

const HOUSE = {A: "hA", B: "hB", C: "hC"};
let started = false, chans = new Map(), byChan = {}, chatUnsub = null, chatCid = null, registered = false;

export const isAdmin = () => !!S.user && S.user.role === "admin";
export const fullName = n => (S.T && S.T.full && S.T.full[n]) || n;
export const groups = () => (S.groupsDoc && Array.isArray(S.groupsDoc.list) ? S.groupsDoc.list : DEFAULT_GROUPS);
export const groupLabel = id => id === "all" ? "כל הצוות" : (groups().find(g => g.id === id) || {}).label || "";
export const myGroups = () => { const d = (S.staff || []).find(x => x.id === S.user.uid); return d ? (d.groups || []).filter(groupLabel) : []; };
const byWhen = (a, b) => (a.date + (a.from || a.time || "")).localeCompare(b.date + (b.from || b.time || ""));
export const upcoming = col => (S[col] || []).filter(x => x.date >= today()).sort(byWhen);

// כל אנשי הצוות: מי שמוגדר במאגר + כל מי שמופיע במערכת השעות
export function people() {
  const m = new Map();
  for (const n of Object.keys((S.T && S.T.teachers) || {})) m.set(uidOf(n), {uid: uidOf(n), name: n, groups: [], off: false, doc: false});
  for (const d of S.staff || []) m.set(d.id, {uid: d.id, name: d.name || nameOf(d.id), groups: (d.groups || []).filter(groupLabel), off: !!d.off, doc: true, fullSet: d.full || "", aliases: d.aliases || []});
  return [...m.values()].map(p => Object.assign({aliases: [], fullSet: ""}, p, {full: p.fullSet || fullName(p.name)})).sort((a, b) => heSort(a.full, b.full));
}
export const myFull = () => person(S.user.uid).full;

// ---- התאמת שם חופשי (כמו שנכתב בגיליון של אפליקציה אחרת) לאיש צוות ----
// סדר: כינוי שההנהלה הגדירה > שם בלוח / שם מלא > שם פרטי + תחילת שם משפחה > שם פרטי יחיד.
export function resolver() {
  const ps = people(), exact = new Map();
  for (const p of ps) { exact.set(norm(p.name), p); exact.set(norm(p.full), p); }
  for (const p of ps) for (const a of p.aliases) exact.set(norm(a), p);
  const toks = p => norm(p.full).split(" "), cache = new Map();
  return raw => {
    const k = norm(raw); if (cache.has(k)) return cache.get(k);
    let hit = exact.get(k) || null;
    if (!hit) {
      const [first, ...rest] = k.split(" "), cands = ps.filter(p => toks(p)[0] === first || norm(p.name).split(" ")[0] === first);
      // כתיב חסר/מלא ("קרימר" / "קריימר") לא מפריד בין שמות משפחה
      const loose = t => t.replace(/[יו]/g, ""), sur = p => toks(p).slice(1);
      const fit = rest.length ? cands.filter(p => rest.every(r => sur(p).some(t => loose(t).startsWith(loose(r))))) : cands.filter(p => norm(p.name) === first);
      // מועמד יחיד בלי התאמת שם משפחה: רק אם אין שם משפחה שסותר (לא ידוע אצלנו, או לא נכתב בגיליון)
      hit = fit.length === 1 ? fit[0] : cands.length === 1 && (!rest.length || !sur(cands[0]).length) ? cands[0] : null;
    }
    cache.set(k, hit); return hit;
  };
}

// ---- תורנות שמירה: לוח שבועי קבוע מ-data/duty.json ----
export function loadDuty() {
  fetch("data/duty.json", {cache: "no-cache"}).then(r => r.json()).then(j => { S.duty = j; ls("adgDuty", j); changed(); }).catch(() => { S.duty = S.duty || ls("adgDuty") || {rows: []}; changed(); });
}
// כל המשבצות: {day, from, to, places: [...], raw, p: איש הצוות או null}. אותו אדם באותה הפסקה בכמה מקומות = משבצת אחת.
export function dutySlots() {
  const res = resolver(), m = new Map();
  for (const r of (S.duty && S.duty.rows) || []) r.days.forEach((names, day) => names.forEach(raw => {
    const k = day + "|" + r.from + "|" + norm(raw);
    if (!m.has(k)) m.set(k, {day, from: r.from, to: r.to, places: [], raw, p: res(raw)});
    m.get(k).places.push(r.place);
  }));
  return [...m.values()].sort((a, b) => a.day - b.day || a.from.localeCompare(b.from));
}
export const myDuty = () => dutySlots().filter(x => x.p && x.p.uid === S.user.uid);
// השמירה הבאה שלי: {slot, date, when: "היום" / "מחר" / "יום שלישי"}
export function nextDuty() {
  const now = new Date(), hm = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
  let best = null;
  for (const x of myDuty()) {
    let d = (x.day - now.getDay() + 7) % 7; if (d === 0 && x.to <= hm) d = 7;
    if (!best || d < best.d || (d === best.d && x.from < best.slot.from)) best = {slot: x, d};
  }
  if (!best) return null;
  const date = new Date(now); date.setDate(date.getDate() + best.d);
  return {slot: best.slot, date: iso(date), when: best.d === 0 ? "היום" : best.d === 1 ? "מחר" : "יום " + DAYN[best.slot.day]};
}
export const dutyUnmatched = () => [...new Set(dutySlots().filter(x => !x.p).map(x => x.raw))].sort(heSort);
// ההנהלה קובעת ששם מהגיליון הוא איש צוות מסוים: נשמר ככינוי אצלו (ומוסר מאחרים)
export async function setAlias(raw, uid) {
  for (const p of people()) if (p.uid !== uid && p.aliases.some(a => norm(a) === norm(raw))) await saveStaff(p, {aliases: p.aliases.filter(a => norm(a) !== norm(raw))});
  if (uid) { const p = person(uid); await saveStaff(p, {aliases: [...p.aliases.filter(a => norm(a) !== norm(raw)), raw]}); }
}
export const person = uid => people().find(p => p.uid === uid) || {uid, name: nameOf(uid), full: fullName(nameOf(uid)), groups: [], aliases: []};

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
  col("staff", "staff"); col("events", "events");
  S.duty = ls("adgDuty"); loadDuty(); loadSheet();
  watch("photos", list => { S.photos = {}; for (const x of list || []) S.photos[x.id] = x.data; changed(); });
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
  const mid = rid(), doc = {mid, title, body, to, by: S.user.uid, byName: myFull(), at: Date.now()};
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

// ---- לוח אירועים והערכות: נקרא חי מהגיליון (gviz), עם עותק אחרון במכשיר למקרה שאין רשת ----
// מבנה הגיליון: תאריך | יום | פעילויות ואירועים (שורה לכל אירוע) | הערות | עמודה לכל כיתה (הערכות).
const kindOf = t => /חופש|גשר|פגרה/.test(t) ? "vac" : /טיול|סיור|של"ח|מסע/.test(t) ? "trip" : "event";
const testKind = t => /מבחן|מיצ"ב|בחינ/.test(t) ? "test" : /בוחן/.test(t) ? "quiz" : "work";
export function parseSheet(text) {
  const j = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1)), rows = j.table.rows.map(r => r.c.map(c => c && c.v != null ? c : null));
  const str = c => c ? String(c.f != null && typeof c.v !== "string" ? c.f : c.v).trim() : "", lines = c => str(c).split(/\n+/).map(x => x.trim()).filter(Boolean);
  let classes = [], days = [];
  for (const r of rows) {
    const h = r.findIndex(c => str(c) === "הערות");   // שורת הכותרת: אחרי "הערות" באות הכיתות
    if (h >= 0 && !classes.length) { classes = r.slice(h + 1).map(str); continue; }
    const i = r.findIndex(c => c && /^Date\(\d+,\d+,\d+/.test(String(c.v)));
    if (i < 0) continue;
    const [y, m, d] = String(r[i].v).match(/\d+/g).map(Number), date = y + "-" + String(m + 1).padStart(2, "0") + "-" + String(d).padStart(2, "0");
    const acts = lines(r[i + 2]).map(t => ({t, k: kindOf(t)})), note = str(r[i + 3]);
    const tests = r.slice(i + 4).flatMap((c, k) => lines(c).map(t => ({cls: classes[k] || "", t, k: testKind(t)})));
    if (acts.length || note || tests.length) days.push({date, acts, note, tests});
  }
  return {days: days.sort((a, b) => a.date.localeCompare(b.date)), classes: classes.filter(Boolean), at: Date.now()};
}
export function loadSheet() {
  S.sheet = S.sheet || ls("adgSheet");
  fetch(EVENTS_URL, {cache: "no-store"}).then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => {
    const d = parseSheet(t); if (!d.days.length) throw 0;
    S.sheet = d; ls("adgSheet", d); changed();
  }).catch(() => { S.sheet = S.sheet ? Object.assign(S.sheet, {err: true}) : {days: [], classes: [], err: true}; changed(); });
}
// הימים הקרובים שיש בהם משהו: הגיליון + אירועים שנוספו ידנית באפליקציה
export function calDays() {
  const m = new Map();
  for (const d of (S.sheet && S.sheet.days) || []) if (d.date >= today()) m.set(d.date, {date: d.date, acts: d.acts.slice(), note: d.note, tests: d.tests});
  for (const e of S.events || []) if (e.date >= today()) {
    if (!m.has(e.date)) m.set(e.date, {date: e.date, acts: [], note: "", tests: []});
    m.get(e.date).acts.push({t: e.title + (e.time ? " · " + e.time : "") + (e.place ? " · " + e.place : "") + (e.note ? " · " + e.note : ""), k: kindOf(e.title), id: e.id});
  }
  return [...m.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ---- תמונת פרופיל: photos/<uid> = {data: dataURL של JPEG קטן, at} ----
export const savePhoto = data => put("photos", S.user.uid, {data, at: Date.now()});
export const delPhoto = () => del("photos", S.user.uid);

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
