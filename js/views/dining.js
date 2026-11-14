// "סידור חדר האוכל" (#/dining, נפתח מלשונית "כלים"). לפי העמוד "סידור חדר האוכל": נוכחות היום, חלוקה לצוותים
// (או "כל ילד שולחן או שניים"), תפקידים שעוברים בתור (סכו"ם, כוסות, עגלות), מפת חדר האוכל, תצוגה לכיתה ושליחה בוואטסאפ.
// כל מחנך שומר את הכיתות שלו ב-dining/<uid>/classes/<cid> (כולל ההיסטוריה). רק הוא רואה אותן.
// הלוגיקה (חלוקה, תיקון אחרי חיסור, תור התפקידים) ב-js/dining-plan.js.
import {S} from "../state.js";
import {$, esc, rid, ls} from "../util.js";
import {startDining, saveDining, delDining, startSeating, myHome} from "../data.js";
import {loading, empty, field, ui} from "../ui.js";
import {readNamesFile} from "../seat-io.js";
import {
  PALETTE, ROLE_ICONS, roleIcon, HIST_MAX, todayStr, uid, clone, stable, cleanName, rangeText,
  normalizeClass, defaultLayout, tableNums, tableInfo, teamById, teamShort, studentName, activeTablesOf, allTablesOf, isPersonal,
  roleTables, roleHolders, tablesWord, activeAll, dutyTables, ownedMap, byName, setColumns,
  absentSet, todaysPlan, histFor, roleStats, doubleCounts, fixPersonal, personalDuty, slotLabel, rebalance,
  makePlan, repair, locate, isImbalanced, swapIds, removeId, fmtDay, planText
} from "../dining-plan.js";

const TABS = [["plan", "סידור היום"], ["students", "תלמידים"], ["tables", "שולחנות וצוותים"], ["roles", "תפקידים"], ["history", "היסטוריה"]];
const ICO_COLOR = {cutlery: "slate", cup: "gold", cart: "green", broom: "teal", star: "blue"};
// C = הכיתה הפתוחה (עותק עבודה). sel = תלמיד שנבחר להעברה. sheet = שולחן שנפתח לעריכה.
let C = null, view = ls("adgDinView") || "plan", sel = null, sheet = null, display = false, copyText = null, attOpen = null;
let saveT = 0, pend = 0, status = {t: "", err: false}, toastT = 0;
if (!TABS.some(t => t[0] === view)) view = "plan";

const saved = () => (S.dining || []).slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "he", {numeric: true}));
function load(d) { C = normalizeClass(clone(d)); C.id = d.id; sel = null; sheet = null; attOpen = null; ls("adgDinCid", d.id); }
function init() { const l = saved(), want = ls("adgDinCid"), d = l.find(x => x.id === want) || l[0]; if (d) load(d); else C = null; }

// ---- שמירה: רגע אחרי השינוי האחרון. כל כתיבה נשלחת מיד (Firestore שומר על הסדר), כך ששום שינוי לא הולך לאיבוד ----
function setStatus(t, err) { status = {t, err: !!err}; const el = $("dstate"); if (el) { el.textContent = t; el.className = "hint" + (err ? " bad" : ""); } }
function changed() { clearTimeout(saveT); saveT = setTimeout(save, 700); setStatus("שומר…"); }
function snap() { const o = clone(C); delete o.id; return o; }
function save() {
  clearTimeout(saveT); saveT = 0; if (!C) return;
  C.updated = Date.now(); pend++;
  if (!navigator.onLine) setStatus("נשמר במכשיר. יישלח כשיחזור האינטרנט.");
  saveDining(C.id, snap()).then(() => { if (--pend === 0 && !saveT) setStatus("נשמר. הכיתות שלך זמינות מכל מכשיר שנכנסת ממנו."); },
    () => { pend--; setStatus("לא נשמר. לבדוק את האינטרנט ולנסות שוב.", true); });
}
const flush = () => { if (saveT) save(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) flush(); });

function toast(t) {
  const el = $("dtoast"); if (!el) return;
  el.textContent = t; el.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { el.hidden = true; }, 3600);
}

// ---- פעולות על הכיתה ----
function saveToday(patch, writeHist) {
  const t = C.today || {};
  C.today = {date: todayStr(), absent: patch.absent !== undefined ? patch.absent : [...absentSet(C)], plan: patch.plan !== undefined ? patch.plan : (t.plan || null)};
  const p = C.today.plan;
  if (writeHist && p && p.date === todayStr()) {
    const h = {date: p.date, kind: p.kind || "team", roles: p.roles || {}, teams: p.teams || {}, extras: p.extras || {}};
    if (isPersonal(p)) h.tables = p.tables || {};
    C.hist[p.date] = clone(h);
    const ds = Object.keys(C.hist).sort(); for (const d of ds.slice(0, Math.max(0, ds.length - HIST_MAX))) delete C.hist[d];
  }
}
// שינוי בכיתה או בחדר: הסידור של היום מתעדכן איתו (שולחן שנסגר, תלמיד שנמחק...)
function edit(fn) {
  const res = fn(C); normalizeClass(C);
  const plan = todaysPlan(C);
  if (plan) {
    let base = plan;
    if (res && res.renumber && plan.tables) { base = clone(plan); base.tables = {}; for (const [n, ids] of Object.entries(plan.tables)) if (res.renumber[n]) base.tables[res.renumber[n]] = ids; }
    const fixed = repair(base, C, absentSet(C));
    if (stable(fixed) !== stable(plan)) saveToday({plan: fixed}, true);
  }
  changed(); paint();
}
function commit(plan) { saveToday({plan}, true); changed(); paint(); }
function generate() {
  if (!C.students.length) { toast("קודם מוסיפים תלמידים בלשונית \"תלמידים\"."); return; }
  const plan = makePlan(C, absentSet(C), todayStr());
  sel = null; attOpen = false; commit(plan);
  toast(plan.unassigned.length ? (isPersonal(plan) ? "אין שולחנות פעילים, אז התלמידים לא קיבלו שולחנות." : "אין שולחנות פעילים עם צוות, אז התלמידים לא חולקו לצוותים.") : "חולק סידור חדש להיום");
}
function reuse() {
  const old = C.today && C.today.plan; if (!old) return;
  commit(repair(Object.assign(clone(old), {date: todayStr()}), C, absentSet(C)));
  toast("הסידור הקודם הועתק להיום");
}
function toggleAttendance(sid) {
  const c = C, ab = absentSet(c), goingAway = !ab.has(sid);
  goingAway ? ab.add(sid) : ab.delete(sid);
  let plan = todaysPlan(c), msg = null;
  if (plan) {
    const before = locate(plan, sid);
    const xBefore = c.roles.filter(r => r.extra).map(r => ({r, i: ((plan.extras || {})[r.id] || []).indexOf(sid)})).filter(x => x.i >= 0);
    const next = repair(plan, c, ab);
    if (goingAway && before && before.kind === "role") {
      const role = c.roles.find(r => r.id === before.id), repl = (next.roles[before.id] || []).filter(x => !(plan.roles[before.id] || []).includes(x));
      if (role && repl.length) msg = `${studentName(c, repl[0])} מחליפ/ה את ${studentName(c, sid)} ב${role.name}`;
    }
    if (goingAway) for (const {r, i} of xBefore) {
      const nw = ((next.extras || {})[r.id] || [])[i];
      if (nw) msg = (msg ? msg + ". " : "") + `${studentName(c, nw)} מחליפ/ה את ${studentName(c, sid)} ב${slotLabel(r, i)}`;
    }
    if (goingAway && before && before.kind === "tables" && isPersonal(next)) {
      const to = {};
      for (const n of before.tables) for (const x of ((next.tables || {})[n] || [])) (to[x] || (to[x] = [])).push(n);
      const parts = Object.entries(to).map(([x, ns]) => `${ns.length > 1 ? "שולחנות" : "שולחן"} ${ns.join(", ")} ${ns.length > 1 ? "עברו" : "עבר"} ל${studentName(c, x)}`);
      if (parts.length) msg = (msg ? msg + ". " : "") + parts.join(". ");
    }
    if (!goingAway) {
      const after = locate(next, sid);
      if (after && after.kind === "tables") msg = `${studentName(c, sid)} קיבל/ה את ${tablesWord(after.tables)}`;
      if (after && after.kind === "team") { const tm = teamById(c, after.id); if (tm) msg = `${studentName(c, sid)} צורפ/ה ל${tm.name}`; }
      if (after && after.kind === "role") { const r = c.roles.find(x => x.id === after.id); if (r) msg = `${studentName(c, sid)} קיבל/ה את ${r.name}`; }
    }
    plan = next;
  }
  if (plan) saveToday({absent: [...ab], plan}, true); else saveToday({absent: [...ab]}, false);
  changed(); paint();
  if (msg) toast(msg);
}
function allPresent() {
  const plan = todaysPlan(C);
  if (plan) saveToday({absent: [], plan: repair(plan, C, new Set())}, true); else saveToday({absent: []}, false);
  changed(); paint();
}
function swapKids(a, b) {
  const plan = clone(todaysPlan(C)); if (!plan || !locate(plan, a) || !locate(plan, b)) return;
  swapIds(plan, a, b); commit(plan);
  toast(`${studentName(C, a)} ו${studentName(C, b)} התחלפו`);
}
function assignTable(sid, n) {
  const plan = clone(todaysPlan(C)); if (!isPersonal(plan)) return;
  const active = dutyTables(C);
  if (!active.includes(n)) { toast(`שולחן ${n} סגור`); return; }
  const tables = plan.tables || (plan.tables = {});
  if ((tables[n] || []).includes(sid)) return;
  for (const r of Object.keys(plan.roles || {})) plan.roles[r] = plan.roles[r].filter(x => x !== sid);
  const duty = new Set([...Object.values(tables).flat(), ...(plan.unassigned || []), sid]);
  plan.unassigned = (plan.unassigned || []).filter(x => x !== sid);
  if (active.length >= duty.size) tables[n] = [sid];
  else { for (const k of Object.keys(tables)) tables[k] = tables[k].filter(x => x !== sid); tables[n] = (tables[n] || []).concat(sid); }
  commit(plan);
  toast(`שולחן ${n} אצל ${studentName(C, sid)}`);
}
function moveToTeam(sid, tid) {
  const plan = clone(todaysPlan(C)); if (!plan) return;
  const l = locate(plan, sid); if (!l || l.id === tid || !l.arr) return;
  l.arr.splice(l.arr.indexOf(sid), 1);
  (plan.teams[tid] || (plan.teams[tid] = [])).push(sid);
  commit(plan);
  const tm = teamById(C, tid); toast(`${studentName(C, sid)} עבר/ה ל${tm ? tm.name : "צוות"}`);
}
function moveToRole(sid, rid) {
  const plan = clone(todaysPlan(C)); if (!plan) return;
  const role = C.roles.find(r => r.id === rid); if (!role) return;
  const holders = (plan.roles || {})[rid] || [];
  if (holders.includes(sid) || !locate(plan, sid)) return;
  if (holders.length < (role.count || 1)) { removeId(plan, sid); plan.roles = plan.roles || {}; plan.roles[rid] = (plan.roles[rid] || []).concat(sid); }
  else swapIds(plan, sid, holders[holders.length - 1]);
  commit(plan);
  toast(`${studentName(C, sid)} ב${role.name}`);
}
function setExtra(sid, rid, i) {
  const plan = clone(todaysPlan(C)); if (!plan) return;
  const r = C.roles.find(x => x.id === rid && x.extra); if (!r) return;
  plan.extras = plan.extras || {};
  for (const k of Object.keys(plan.extras)) plan.extras[k] = (plan.extras[k] || []).map(x => x === sid ? null : x);
  const arr = plan.extras[rid] || (plan.extras[rid] = []);
  while (arr.length < (r.count || 1)) arr.push(null);
  arr[i] = sid;
  commit(plan);
  toast(`${studentName(C, sid)} ב${slotLabel(r, i)}`);
}
function balance() {
  const plan = clone(todaysPlan(C)); if (!plan) return;
  if (isPersonal(plan)) {
    const res = fixPersonal(C, plan.tables || {}, personalDuty(C, plan, absentSet(C)));
    plan.tables = res.tables; plan.unassigned = res.unassigned;
    commit(plan); toast("כל שולחן פעיל קיבל אחראי, והשולחנות מחולקים שווה");
    return;
  }
  for (const t of C.teams) plan.teams[t.id] = plan.teams[t.id] || [];
  rebalance(C, plan.teams, 2);
  commit(plan); toast("הצוותים אוזנו לפי מספר השולחנות הפעילים");
}
function createClass(name) {
  const base = C;
  const layout = base ? {columns: base.columns.slice(), teams: clone(base.teams), tables: clone(base.tables), roles: base.roles.map(r => Object.assign({}, r, {fixed: null})), opts: clone(base.opts)} : defaultLayout();
  flush();
  C = normalizeClass(Object.assign({id: "d" + rid(), name: cleanName(name) || "כיתה חדשה", students: [], hist: {}, today: null}, layout));
  ls("adgDinCid", C.id); sel = null; sheet = null; attOpen = null; setView("students");
  save(); paint();
  const f = $("dcname"); if (f) f.focus();
}
function newName() { const h = myHome(); return h && !saved().some(x => x.name === h) ? h : "כיתה חדשה"; }
function setView(v) { view = v; sel = null; ls("adgDinView", v); }
function addNames(list, from) {
  const have = new Set(C.students.map(s => s.name)), add = [];
  for (const line of list) { const n = cleanName(line); if (n && !have.has(n)) { have.add(n); add.push(n); } }
  if (!add.length) { toast("לא נמצאו שמות חדשים" + (from ? " ב" + from : "")); return 0; }
  edit(x => { for (const n of add) x.students.push({id: uid("s_"), name: n}); });
  toast(add.length === 1 ? add[0] + " נוסף/ה לכיתה" : "נוספו " + add.length + " תלמידים");
  return add.length;
}
async function share() {
  const text = planText(C);
  const fallback = () => { copyText = text; paint(); setTimeout(() => { const ta = $("dcopy"); if (ta) { ta.focus(); ta.select(); } }, 30); };
  // בטלפון: תפריט השיתוף של המערכת (וואטסאפ וכו'). במחשב: העתקה
  if (matchMedia("(pointer:coarse)").matches && navigator.share) { try { await navigator.share({text}); } catch (e) { if (e && e.name !== "AbortError") fallback(); } return; }
  try { await navigator.clipboard.writeText(text); toast("הסידור הועתק. אפשר להדביק בוואטסאפ."); } catch (e) { fallback(); }
}

// ---- תצוגה ----
const lookOf = (c, plan) => plan ? (isPersonal(plan) ? "personal" : "team") : c.opts.mode;
const btn = (act, label, extra, cls) => '<button type="button" class="' + (cls || "btn ghost small") + '" data-act="' + act + '"' + (extra || "") + ">" + label + "</button>";
const ic = n => '<i class="fa-solid ' + n + '"></i> ';
function tile(c, n, plan, assignees, interactive, look) {
  const t = tableInfo(c, n), off = t.active === false, personal = look === "personal";
  const lead = !off ? roleTables(c)[n] : null, tm = personal || lead ? null : teamById(c, t.team);
  let body = "", extra = "";
  if (off) body = "סגור";
  else if (lead) { const who = roleHolders(plan, lead).filter(Boolean).map(s => studentName(c, s)); body = '<span class="dlead"><i class="fa-solid ' + roleIcon(lead.icon) + '"></i>' + esc(who.length ? who.join(" ו") : lead.name) + "</span>"; }
  else if (personal) { const who = assignees[n] || []; if (plan && !who.length) { body = "אין אחראי"; extra = " open"; } else body = who.map(s => '<span class="who">' + esc(studentName(c, s)) + "</span>").join(""); }
  else body = tm ? esc(teamShort(tm)) : "ללא צוות";
  const pick = interactive && (personal || lead) && !off && sel && view === "plan" && plan && plan.date === todayStr();
  const cls = "dtbl" + (off ? " off" : "") + (!off && !personal && !lead && !tm ? " none" : "") + extra + (pick ? " pick" : "");
  const style = "--team:" + (lead ? "var(--amber)" : personal ? "var(--i-blue)" : "var(--t-" + (tm ? tm.color : "none") + ")");
  const label = `שולחן ${n}${off ? ", סגור" : ""}${lead ? ", באחריות " + lead.name : ""}${tm ? ", " + tm.name : ""}${personal && (assignees[n] || []).length ? ", " + assignees[n].map(s => studentName(c, s)).join(" ו") : ""}`;
  const inner = '<span class="tnum">' + n + '</span><span class="tbody">' + body + "</span>";
  return interactive ? '<button type="button" class="' + cls + '" style="' + style + '" data-act="table" data-n="' + n + '" aria-label="' + esc(label) + '">' + inner + "</button>"
    : '<div class="' + cls + '" style="' + style + '" aria-label="' + esc(label) + '">' + inner + "</div>";
}
function hall(c, plan, interactive, look) {
  look = look || lookOf(c, plan);
  const as = isPersonal(plan) ? (plan.tables || {}) : {};
  let n = 1;
  const cols = c.columns.map(k => { const ts = []; for (let i = 0; i < k; i++) ts.push(tile(c, n++, plan, as, interactive, look)); return '<div class="dcol">' + ts.join("") + "</div>"; }).join("");
  return '<div class="dmapwrap"><div class="dhall" style="--cols:' + c.columns.length + '"><div class="dstage">' + esc(c.opts.stage || "במה") + '</div><div class="dcols">' + cols + "</div></div></div>";
}
function legend(c, look, plan) {
  const closed = tableNums(c).filter(n => tableInfo(c, n).active === false).length;
  let items;
  if (look === "personal") {
    const act = dutyTables(c);
    items = ['<span style="--team:var(--i-blue)"><i class="ddot"></i>פעילים · ' + act.length + "</span>"];
    const unc = plan ? act.filter(n => !((plan.tables || {})[n] || []).length).length : 0;
    if (unc) items.push('<span style="--team:var(--amber)"><i class="ddot"></i>בלי אחראי · ' + unc + "</span>");
  } else items = c.teams.map(t => '<span style="--team:var(--t-' + t.color + ')"><i class="ddot"></i>' + esc(t.name) + " · " + activeTablesOf(c, t.id).length + "</span>");
  for (const r of c.roles) {
    const ns = (r.tables || []).filter(n => tableInfo(c, n).active !== false);
    if (ns.length) items.push('<span style="--team:var(--amber)"><i class="ddot"></i>' + esc(tablesWord(ns)) + " · באחריות " + esc(r.name) + "</span>");
  }
  if (closed) items.push('<span><i class="ddot off"></i>סגורים · ' + closed + "</span>");
  return '<div class="dlegend">' + items.join("") + "</div>";
}
function kid(c, sid, o) {
  o = o || {};
  const on = sel === sid, extra = o.tables ? '<span class="tt">' + o.tables + "</span>" : "", cls = "dkid" + (on ? " sel" : "") + (o.gone ? " gone" : "");
  return o.edit ? '<button type="button" class="' + cls + '" data-act="kid" data-sid="' + esc(sid) + '" aria-pressed="' + on + '">' + esc(studentName(c, sid)) + extra + "</button>"
    : '<span class="' + cls + '">' + esc(studentName(c, sid)) + extra + "</span>";
}
function rolesRow(c, plan, edit, ab) {
  const st = plan ? roleStats(c, plan.date) : {};
  const times = (sid, r) => plan ? '<span class="times">פעם ' + (((st[sid] && st[sid][r] && st[sid][r].n) || 0) + 1) + "</span>" : "";
  return '<div class="droles">' + c.roles.map(r => {
    const iconEl = '<span class="ico ' + (ICO_COLOR[r.icon] || "blue") + '"><i class="fa-solid ' + roleIcon(r.icon) + '"></i></span>';
    const lab = '<span class="role-l">' + esc(r.name) + (r.extra ? '<span class="xtag">בנוסף לצוות</span>' : "") + ((r.tables || []).length ? '<span class="xtag">גם ' + esc(tablesWord(r.tables)) + "</span>" : "") + "</span>";
    const n = r.count || 1, fill = '<button type="button" class="btn ghost small dfill" data-act="fill-role">בחירה לפי התור</button>';
    if (r.extra) {
      const holders = plan ? ((plan.extras || {})[r.id] || []) : [], slots = [];
      for (let i = 0; i < n; i++) {
        const sid = holders[i] || null, label = r.unit ? `${r.unit} ${i + 1}` : n > 1 ? `${i + 1}` : "", labEl = label ? '<span class="sl">' + esc(label) + "</span>" : "";
        if (edit && sel && sid !== sel) slots.push('<button type="button" class="dslot target" data-act="extra-slot" data-rid="' + esc(r.id) + '" data-i="' + i + '" aria-label="' + esc(studentName(c, sel) + " ל" + slotLabel(r, i)) + '">' + labEl + "<span>" + (sid ? esc(studentName(c, sid)) : "ריק") + "</span></button>");
        else slots.push('<span class="dslot">' + labEl + (sid ? kid(c, sid, {gone: ab.has(sid)}) + times(sid, r.id) : '<span class="empty-n">' + (plan ? "לא נקבע" : "טרם נקבע") + "</span>") + "</span>");
      }
      const short = plan && holders.filter(Boolean).length < n;
      return '<div class="drole">' + iconEl + '<span class="role-b">' + lab + '<span class="role-n">' + slots.join("") + "</span></span>" + (edit && short && !sel ? fill : "") + "</div>";
    }
    const holders = plan ? ((plan.roles || {})[r.id] || []) : [], short = plan && holders.length < n, target = edit && sel && !holders.includes(sel);
    const names = holders.length ? holders.map(sid => "<span>" + kid(c, sid, {edit: edit && !target, gone: ab.has(sid)}) + times(sid, r.id) + "</span>").join("") : '<span class="empty-n">' + (plan ? "לא נקבע" : "טרם נקבע") + "</span>";
    const inner = iconEl + '<span class="role-b">' + lab + '<span class="role-n">' + names + "</span></span>" + (edit && short && !sel ? fill : "");
    return target ? '<button type="button" class="drole target" data-act="role-slot" data-rid="' + esc(r.id) + '" aria-label="העברה ל' + esc(r.name) + '">' + inner + "</button>" : '<div class="drole">' + inner + "</div>";
  }).join("") + "</div>";
}
function teamsGrid(c, plan, edit, ab) {
  const selLoc = sel ? locate(plan, sel) : null;
  const cards = c.teams.map(t => {
    const act = activeTablesOf(c, t.id), all = allTablesOf(c, t.id), mem = plan ? ((plan.teams || {})[t.id] || []) : [];
    const sub = all.length ? "שולחנות " + rangeText(act) + (act.length < all.length ? " · " + (all.length - act.length) + " סגורים" : "") + " · " + mem.length + " תלמידים" : "אין שולחנות לצוות";
    const canMove = edit && sel && act.length && !(selLoc && selLoc.kind === "team" && selLoc.id === t.id);
    const chips = mem.map(s => kid(c, s, {edit, gone: ab.has(s)})).join("");
    return '<div class="dteam' + (act.length ? "" : " dim") + '" style="--team:var(--t-' + t.color + ')"><div class="team-h"><span class="swatch"></span><div class="grow"><h4>' + esc(t.name) + '</h4><span class="sub">' + sub + "</span></div>" +
      (canMove ? btn("move-team", "העברה לכאן", ' data-tid="' + esc(t.id) + '"') : "") + "</div>" +
      '<div class="team-b">' + (chips || '<span class="hint">' + (plan ? (act.length ? "אין תלמידים בצוות" : "כל השולחנות של הצוות סגורים") : "יתמלא בחלוקה") + "</span>") + "</div></div>";
  });
  if (plan && (plan.unassigned || []).length) cards.push('<div class="dteam"><div class="team-h"><span class="swatch"></span><div class="grow"><h4>בלי צוות</h4><span class="sub">אין שולחן פעיל עם צוות</span></div></div><div class="team-b">' + plan.unassigned.map(s => kid(c, s, {edit, gone: ab.has(s)})).join("") + "</div></div>");
  return '<div class="dteams">' + cards.join("") + "</div>";
}
function dutyGrid(c, plan, edit, ab) {
  const act = dutyTables(c), actSet = new Set(act);
  if (!plan) return '<div class="card dcard"><h4>מי אחראי על איזה שולחן</h4><p class="hint">אחרי החלוקה יופיע כאן מי אחראי על איזה שולחן (' + act.length + " שולחנות פעילים).</p></div>";
  const own = ownedMap(plan);
  for (const k of Object.keys(own)) { own[k] = own[k].filter(n => actSet.has(n)); if (!own[k].length) delete own[k]; }
  const busy = new Set(Object.values(plan.roles || {}).flat()), onDuty = byName(c).filter(s => own[s.id]);
  const free = plan.date === todayStr() ? byName(c).filter(s => !own[s.id] && !busy.has(s.id) && !ab.has(s.id)) : [];
  const chips = onDuty.map(s => kid(c, s.id, {edit, gone: ab.has(s.id), tables: tablesWord(own[s.id])})).join("");
  return '<div class="card dcard"><h4>מי אחראי על איזה שולחן <span class="sub">' + onDuty.length + " תלמידים · " + act.length + " שולחנות</span></h4>" +
    (chips ? '<div class="dduty">' + chips + "</div>" : '<p class="hint">אין שולחנות פעילים.</p>') +
    (free.length ? '<div class="dfree"><span class="lbl">בלי שולחן</span>' + free.map(s => kid(c, s.id, {edit})).join("") + "</div>" : "") + "</div>";
}
function attendanceCard(c, plan, ab, isToday) {
  const list = byName(c), roleOf = {};
  if (plan) for (const r of c.roles) for (const s of (r.extra ? (plan.extras || {})[r.id] : (plan.roles || {})[r.id]) || []) if (s) (roleOf[s] || (roleOf[s] = [])).push(r);
  const rows = list.map(s => {
    const absent = ab.has(s.id), r = roleOf[s.id];
    return '<button type="button" class="datt' + (absent ? " absent" : "") + '" role="switch" aria-checked="' + !absent + '" data-act="att" data-sid="' + esc(s.id) + '"><span class="nm">' + esc(s.name) + "</span>" +
      (r && !absent ? r.map(x => '<i class="fa-solid ' + roleIcon(x.icon) + ' ri" title="' + esc(x.name) + '"></i>').join("") : "") + (absent ? '<span class="tag red">חסר/ה</span>' : "") + '<span class="dsw" aria-hidden="true"></span></button>';
  }).join("");
  const here = list.length - list.filter(s => ab.has(s.id)).length;
  const open = matchMedia("(min-width:900px)").matches || (attOpen == null ? !isToday : attOpen);
  return '<details class="card scard datt-card" id="datt"' + (open ? " open" : "") + '><summary><h3><i class="fa-solid fa-user-check"></i>נוכחות היום <span class="dcount">' + here + "/" + list.length + "</span></h3>" +
    (ab.size ? '<span class="hint">' + ab.size + " חסרים</span>" : "") + '<i class="fa-solid fa-chevron-down"></i></summary>' +
    (list.length ? '<p class="hint">לוחצים על מי שלא הגיע/ה. אם כבר חולק סידור, הוא מתעדכן לבד.</p><div class="list">' + rows + "</div>" : '<p class="hint">אין עדיין תלמידים בכיתה.</p>') +
    (ab.size ? btn("all-present", ic("fa-check-double") + "כולם נוכחים") : "") + "</details>";
}
const note = (t, warn, extra) => '<div class="dnote' + (warn ? " warn" : "") + '"><p>' + t + "</p>" + (extra || "") + "</div>";
function planView(c) {
  const plan = (c.today && c.today.plan) || null, isToday = !!plan && plan.date === todayStr(), ab = absentSet(c), edit = isToday;
  const look = lookOf(c, plan), personal = look === "personal", nums = tableNums(c), rt = roleTables(c);
  const activeN = personal ? activeAll(c).length : nums.filter(n => { const x = tableInfo(c, n); return x.active !== false && (teamById(c, x.team) || rt[n]); }).length;
  const present = c.students.filter(s => !ab.has(s.id)).length;
  let banner = "";
  if (!c.students.length) banner = note("אין עדיין תלמידים בכיתה. מוסיפים אותם בלשונית \"תלמידים\", אפשר גם מקובץ או מסידור הישיבה.", false, btn("tab", ic("fa-user-plus") + "הוספת תלמידים", ' data-v="students"'));
  else if (!plan) banner = note("עוד לא חולק סידור להיום. מסמנים מי נוכח, בודקים אילו שולחנות פתוחים, ולוחצים על \"חלוקה חדשה\".");
  else if (!isToday) banner = note("מוצג הסידור של " + esc(fmtDay(plan.date)) + ". אפשר לחלק סידור חדש להיום, או להמשיך עם אותו סידור.", true, btn("reuse", "להמשיך עם הסידור הזה היום"));
  else if (!activeN) banner = note((personal ? "כל השולחנות סגורים." : "כל השולחנות סגורים או בלי צוות.") + " פותחים שולחנות בלחיצה על שולחן במפה.", true);
  const imbalanced = edit && isImbalanced(c, plan, ab);
  const modebar = '<div class="dmode"><span class="lbl">איך מחלקים</span><div class="seg" role="group" aria-label="איך מחלקים">' +
    '<button type="button" data-act="mode" data-v="team" aria-pressed="' + (c.opts.mode === "team") + '">בצוותים</button>' +
    '<button type="button" data-act="mode" data-v="personal" aria-pressed="' + (c.opts.mode === "personal") + '">כל ילד שולחן או שניים</button></div></div>';
  const acts = plan ? '<div class="dacts">' + btn("display-open", ic("fa-display") + "תצוגה לכיתה") + btn("share", ic("fa-share-nodes") + "שליחת הסידור") +
    (imbalanced ? btn("balance", ic("fa-scale-balanced") + (personal ? "איזון השולחנות" : "איזון הצוותים")) : "") + "</div>" : "";
  return banner + '<div class="dplan"><aside>' + attendanceCard(c, plan, ab, isToday) + "</aside>" +
    '<section class="dmain" aria-label="הסידור">' + modebar +
    '<button type="button" class="btn gold" data-act="gen">' + ic("fa-shuffle") + (isToday ? "חלוקה מחדש" : "חלוקה חדשה") + "</button>" +
    '<p class="dstat"><b>' + present + "</b>/" + c.students.length + " נוכחים · <b>" + activeN + "</b>/" + nums.length + " שולחנות פעילים</p>" + acts +
    (c.roles.length ? rolesRow(c, plan, edit, ab) : "") +
    "<div>" + hall(c, plan, true, look) + legend(c, look, plan) + '<p class="hint">לחיצה על שולחן: פתוח או סגור היום, ולאיזה צוות הוא שייך.</p></div>' +
    (personal ? dutyGrid(c, plan, edit, ab) : teamsGrid(c, plan, edit, ab)) + "</section></div>";
}
function studentsView(c) {
  const st = roleStats(c, null);
  const rows = byName(c).map((s, i) => {
    const counts = c.roles.map(r => r.name.replace(/^סידור /, "") + " " + ((st[s.id] && st[s.id][r.id] && st[s.id][r.id].n) || 0)).join(" · ");
    return '<div class="item dsrow"><span class="idx">' + (i + 1) + '</span><div><input id="dsn-' + esc(s.id) + '" data-ch="student-name" data-sid="' + esc(s.id) + '" value="' + esc(s.name) + '" aria-label="שם התלמיד/ה" maxlength="40">' +
      (counts ? "<span>" + esc(counts) + "</span>" : "") + '</div><button type="button" class="del" data-act="del-student" data-sid="' + esc(s.id) + '" aria-label="מחיקת ' + esc(s.name) + '"><i class="fa-solid fa-trash-can"></i></button></div>';
  }).join("");
  const seats = (S.seating || []).filter(x => (x.students || []).length);
  return '<section class="card scard"><h3><i class="fa-solid fa-school"></i>הכיתה</h3>' +
    field("שם הכיתה (מופיע בתצוגה לכיתה ובהודעה)", '<input id="dcname" data-ch="class-name" maxlength="40" value="' + esc(c.name) + '">') +
    btn("del-class", ic("fa-trash-can") + "מחיקת הכיתה וההיסטוריה שלה", "", "btn danger small") + "</section>" +
    '<section class="card scard"><h3><i class="fa-solid fa-user-plus"></i>הוספת תלמידים</h3>' +
    '<div class="srow">' + field("תלמיד/ה אחד/ת", '<input id="dnew" maxlength="40" placeholder="שם התלמיד/ה" enterkeyhint="done">') + btn("add-student", "הוספה", "", "btn small") + "</div>" +
    field("או רשימה שלמה: שם בכל שורה (אפשר להעתיק עמודה מגיליון)", '<textarea id="dbulk" rows="5" placeholder="נועה כהן&#10;יונתן לוי&#10;..."></textarea>') +
    btn("bulk-add", ic("fa-list") + "הוספת כל השמות מהרשימה") +
    '<div class="srow">' + btn("file-btn", ic("fa-file-arrow-up") + "העלאת רשימה (Word / PDF / Excel)") + '<input id="dfile" data-ch="file" type="file" accept=".docx,.pdf,.xlsx,.csv,.txt" hidden></div><p id="dfilest" class="hint" aria-live="polite"></p>' +
    (seats.length ? '<span class="lbl">מסידור הישיבה שלך</span><div class="dimp">' + seats.map((x, i) => btn("import-seat", ic("fa-chair") + esc(x.className || "כיתה ללא שם") + " (" + x.students.length + ")", ' data-i="' + i + '"')).join("") + "</div>" : "") +
    '<p class="hint">שמות שכבר ברשימה לא יתווספו שוב.</p></section>' +
    '<section class="scard dstud"><h3 class="dh"><i class="fa-solid fa-users"></i>תלמידי הכיתה <span class="dcount">' + c.students.length + "</span></h3>" +
    '<p class="hint">שינוי שם נשמר כשיוצאים מהשדה. מתחת לכל שם: כמה פעמים כבר קיבל/ה כל תפקיד.</p>' +
    (rows ? '<div class="list">' + rows + "</div>" : empty("עוד אין תלמידים", "מוסיפים אותם כאן למעלה.", "fa-users")) + "</section>";
}
function stepper(label, val, actInc, actDec, data) {
  return '<div><span class="lbl">' + esc(label) + '</span><div class="ctl"><button type="button" data-act="' + actInc + '"' + data + ' aria-label="' + esc(label) + ': יותר">+</button><output>' + val + '</output><button type="button" data-act="' + actDec + '"' + data + ' aria-label="' + esc(label) + ': פחות">−</button></div></div>';
}
function tablesView(c) {
  const colsEd = c.columns.map((k, i) => '<div class="dcolrow">' + stepper("עמודה " + (i + 1) + (i === 0 ? " (שמאל)" : i === c.columns.length - 1 ? " (ימין)" : ""), k, "col-inc", "col-dec", ' data-i="' + i + '"') +
    (c.columns.length > 1 ? '<button type="button" class="link" data-act="col-del" data-i="' + i + '">הסרת העמודה</button>' : "") + "</div>").join("");
  const teamsEd = c.teams.map(t => '<div class="dteamed" style="--team:var(--t-' + t.color + ')"><div class="srow"><span class="swatch"></span>' +
    '<input id="dtn-' + esc(t.id) + '" data-ch="team-name" data-tid="' + esc(t.id) + '" value="' + esc(t.name) + '" maxlength="40" aria-label="שם הצוות">' +
    '<span class="hint">' + allTablesOf(c, t.id).length + ' שולחנות</span><button type="button" class="del" data-act="del-team" data-tid="' + esc(t.id) + '" aria-label="מחיקת ' + esc(t.name) + '"><i class="fa-solid fa-trash-can"></i></button></div>' +
    '<div class="dcolors" role="group" aria-label="צבע">' + PALETTE.map(([col, nm]) => '<button type="button" class="cbtn" style="--team:var(--t-' + col + ')" data-act="team-color" data-tid="' + esc(t.id) + '" data-color="' + col + '" aria-pressed="' + (t.color === col) + '" aria-label="' + nm + '" title="' + nm + '"></button>').join("") + "</div></div>").join("");
  const mode = c.opts.mode;
  return '<section class="card scard"><h3><i class="fa-solid fa-map"></i>מפת חדר האוכל</h3>' +
    '<p class="hint">לחיצה על שולחן פותחת אותו לעריכה: פעיל או סגור, ולאיזה צוות הוא שייך. שולחן סגור לא נכנס לחלוקה. בחלוקה בצוותים התלמידים מתחלקים לפי מספר השולחנות הפעילים של כל צוות.</p>' +
    '<div class="dacts">' + btn("all-on", ic("fa-lock-open") + "פתיחת כל השולחנות") + btn("all-off", ic("fa-lock") + "סגירת כל השולחנות") + "</div>" +
    hall(c, null, true, "team") + legend(c, "team", null) + "</section>" +
    '<section class="card scard"><h3><i class="fa-solid fa-shuffle"></i>איך מחלקים</h3>' +
    '<p class="hint">אפשר לעבור בכל רגע, גם מ"סידור היום". במעבר התפקידים והעגלות נשארים, ורק החלוקה לשולחנות נעשית מחדש.</p><div class="dmodes">' +
    '<button type="button" class="dmodebtn" data-act="mode" data-v="team" aria-pressed="' + (mode === "team") + '"><span class="radio"></span><span><b>בצוותים</b><small>כל תלמידי הצוות הירוק מטפלים יחד בכל השולחנות הירוקים.</small></span></button>' +
    '<button type="button" class="dmodebtn" data-act="mode" data-v="personal" aria-pressed="' + (mode === "personal") + '"><span class="radio"></span><span><b>כל ילד אחראי על שולחן או שניים</b><small>בלי צוותים. כל תלמיד/ה מקבל/ת שולחן משלו, ואם יש יותר שולחנות מתלמידים חלק מקבלים שני שולחנות צמודים. מי שקיבל שניים מקבל פחות פעמים שניים בימים הבאים.</small></span></button></div>' +
    field("הכיתוב בראש המפה", '<input id="dstagein" data-ch="stage" maxlength="40" value="' + esc(c.opts.stage) + '">') + "</section>" +
    '<section class="card scard"><h3><i class="fa-solid fa-people-group"></i>צוותים</h3><p class="hint">לכל צוות צבע ושם. משייכים שולחנות לצוות דרך המפה. הצוותים משמשים רק בחלוקה בצוותים.</p>' +
    teamsEd + btn("add-team", ic("fa-plus") + "צוות חדש") + "</section>" +
    '<section class="card scard"><h3><i class="fa-solid fa-table-columns"></i>מבנה החדר</h3><p class="hint">כמה שולחנות יש בכל עמודה, משמאל לימין כפי שרואים מהבמה. המספור רץ לאורך העמודות.</p>' +
    '<div class="stp dcolsed">' + colsEd + "</div>" + (c.columns.length < 6 ? btn("col-add", ic("fa-plus") + "עמודה") : "") + "</section>";
}
function rolesView(c) {
  const opt = (v, t, on) => '<option value="' + esc(v) + '"' + (on ? " selected" : "") + ">" + esc(t) + "</option>";
  const roleEd = c.roles.map(r => {
    const id = esc(r.id), d = ' data-rid="' + id + '"';
    return '<div class="droled card">' +
      '<div class="srow"><span class="ico ' + (ICO_COLOR[r.icon] || "blue") + '"><i class="fa-solid ' + roleIcon(r.icon) + '"></i></span>' +
      field("שם התפקיד", '<input id="drn-' + id + '" data-ch="role-name"' + d + ' maxlength="40" value="' + esc(r.name) + '">') +
      '<button type="button" class="del" data-act="del-role"' + d + ' aria-label="מחיקת ' + esc(r.name) + '"><i class="fa-solid fa-trash-can"></i></button></div>' +
      '<div class="two">' + field("סמל", '<select id="dri-' + id + '" data-ch="role-icon"' + d + ">" + ROLE_ICONS.map(([k, nm]) => opt(k, nm, r.icon === k)).join("") + "</select>") +
      '<div class="stp">' + stepper("כמה תלמידים", r.count || 1, "role-inc", "role-dec", d) + "</div></div>" +
      '<div class="two">' + field("ביחס לצוות", '<select id="drx-' + id + '" data-ch="role-extra"' + d + ">" + opt("0", "במקום צוות", !r.extra) + opt("1", "בנוסף לצוות", r.extra) + "</select>") +
      field("אחראי/ת גם על שולחן", '<input id="drt-' + id + '" data-ch="role-tables"' + d + ' inputmode="numeric" placeholder="למשל 1" value="' + esc((r.tables || []).join(", ")) + '">') + "</div>" +
      field("מי מקבל את התפקיד", '<select id="drf-' + id + '" data-ch="role-fixed"' + d + ">" + opt("", "כל פעם מישהו אחר (לפי התור)", !r.fixed) + byName(c).map(s => opt(s.id, "תמיד " + s.name, r.fixed === s.id)).join("") + "</select>") + "</div>";
  }).join("");
  const st = roleStats(c, null), dbl = doubleCounts(c, null), showDbl = c.opts.mode === "personal" || Object.keys(dbl).length > 0;
  const fair = byName(c).map(s => "<tr><td>" + esc(s.name) + "</td>" + c.roles.map(r => { const x = st[s.id] && st[s.id][r.id]; return '<td class="n">' + (x ? x.n : 0) + '</td><td class="d">' + (x ? esc(fmtDay(x.last)) : "—") + "</td>"; }).join("") + (showDbl ? '<td class="n">' + (dbl[s.id] || 0) + "</td>" : "") + "</tr>").join("");
  return '<section class="scard"><h3 class="dh"><i class="fa-solid fa-star"></i>תפקידים</h3>' +
    '<p class="hint">תפקיד "במקום צוות" (כמו סכו"ם וכוסות) מוציא את התלמיד/ה מהצוות באותו יום. תפקיד "בנוסף לצוות" (כמו העגלות) נופל על כל תלמיד/ה, שנשאר/ת גם בצוות. בכל חלוקה התפקיד עובר למי שעשה אותו הכי מעט פעמים. אם בחרתם "תמיד" ותלמיד/ה חסר/ה, התפקיד עובר לפי התור.</p>' +
    '<p class="hint">אפשר לתת לתפקיד גם שולחן, למשל סידור כוסות ושולחן 1 שמוכן אחרון: רק מי שבתפקיד אחראי/ת עליו, והוא לא נכנס לחלוקה.</p>' +
    roleEd + btn("add-role", ic("fa-plus") + "תפקיד חדש") + "</section>" +
    '<section class="card scard"><h3><i class="fa-solid fa-scale-balanced"></i>מי כבר עשה מה</h3><p class="hint">ספירה מכל הימים השמורים בהיסטוריה, כולל היום.</p>' +
    (c.students.length && c.roles.length ? '<div class="dfairwrap"><table class="dfair"><thead><tr><th>תלמיד/ה</th>' + c.roles.map(r => "<th>" + esc(r.name) + "</th><th>פעם אחרונה</th>").join("") + (showDbl ? "<th>שני שולחנות</th>" : "") + "</tr></thead><tbody>" + fair + "</tbody></table></div>" : '<p class="hint">אין עדיין נתונים.</p>') + "</section>";
}
function historyView(c) {
  const hs = histFor(c).slice().reverse();
  if (!hs.length) return empty("עוד אין ימים שמורים", "כל סידור שמחלקים נשמר כאן לפי תאריך (אחד ליום). מכאן נספר התור של התפקידים.", "fa-clock-rotate-left");
  return '<p class="hint">' + hs.length + " ימים שמורים. מחיקת יום מורידה אותו גם מספירת התפקידים.</p>" + hs.map(h => {
    const roles = c.roles.map(r => '<div class="line"><span class="lab">' + esc(r.name) + "</span><span>" + (((h.roles || {})[r.id] || (h.extras || {})[r.id] || []).filter(Boolean).map(s => esc(studentName(c, s))).join(", ") || "—") + "</span></div>").join("");
    const own = h.kind === "personal" ? ownedMap(h) : null;
    const teams = own ? '<div class="line"><span class="lab">שולחנות</span><span>' + (byName(c).filter(s => own[s.id]).map(s => esc(s.name) + " (" + own[s.id].join(", ") + ")").join(", ") || "—") + "</span></div>"
      : c.teams.filter(t => ((h.teams || {})[t.id] || []).length).map(t => '<div class="line" style="--team:var(--t-' + t.color + ')"><span class="lab"><i class="ddot"></i> ' + esc(t.name) + "</span><span>" + h.teams[t.id].map(s => esc(studentName(c, s))).join(", ") + "</span></div>").join("");
    return '<div class="card dhist"><div class="srow"><h4>' + esc(fmtDay(h.date)) + (h.date === todayStr() ? " · היום" : "") + '</h4><button type="button" class="del" data-act="del-hist" data-d="' + esc(h.date) + '" aria-label="מחיקת היום"><i class="fa-solid fa-trash-can"></i></button></div>' + roles + teams + "</div>";
  }).join("");
}
function emptyView() {
  const demo = normalizeClass(Object.assign({name: "", students: []}, defaultLayout()));
  return empty("עוד אין לך כיתה בחדר האוכל", "יוצרים כיתה, מוסיפים את שמות התלמידים ומסמנים אילו שולחנות פתוחים. כל יום מסמנים מי נוכח ולוחצים על \"חלוקה חדשה\".", "fa-utensils") +
    '<section class="card scard"><h3><i class="fa-solid fa-plus"></i>כיתה חדשה</h3>' + field("שם הכיתה", '<input id="dnewcls" maxlength="40" placeholder="למשל: ו׳2" value="' + esc(myHome()) + '" enterkeyhint="done">') +
    btn("create-class", ic("fa-plus") + "יצירת כיתה", "", "btn") + '<p class="hint">הכיתה מתחילה עם חדר אוכל של 22 שולחנות בשלוש עמודות וארבעה צוותים. משנים את זה אחר כך.</p></section>' +
    '<div class="dghost" aria-hidden="true">' + hall(demo, null, false, "team") + "</div>";
}
function sheetView() {
  if (sheet == null) return "";
  const n = sheet, t = tableInfo(C, n), active = t.active !== false, rr = roleTables(C)[n];
  return '<div class="dback" data-act="sheet-close"></div><div class="dsheet" role="dialog" aria-modal="true" aria-label="שולחן ' + n + '">' +
    '<div class="srow"><h3>שולחן ' + n + "</h3>" + btn("sheet-close", "סגירה", "", "btn ghost small") + "</div>" +
    '<div class="seg" role="group" aria-label="מצב השולחן"><button type="button" data-act="sheet-active" data-v="1" aria-pressed="' + active + '"><i class="fa-solid fa-lock-open"></i> פעיל</button><button type="button" data-act="sheet-active" data-v="0" aria-pressed="' + !active + '"><i class="fa-solid fa-lock"></i> סגור</button></div>' +
    (rr ? '<p class="hint">השולחן הזה באחריות מי שב' + esc(rr.name) + ' בלבד, ולא נכנס לחלוקה. משנים את זה בלשונית "תפקידים".</p>' : "") +
    '<span class="lbl">שייך לצוות</span><div class="dtpick">' + C.teams.map(tm => '<button type="button" class="tp" style="--team:var(--t-' + tm.color + ')" data-act="sheet-team" data-tid="' + esc(tm.id) + '" aria-pressed="' + (t.team === tm.id) + '"><span class="swatch"></span>' + esc(tm.name) + "</button>").join("") +
    '<button type="button" class="tp" data-act="sheet-team" data-tid="" aria-pressed="' + !t.team + '">בלי צוות</button></div></div>';
}
function displayView() {
  if (!display) return "";
  const plan = C.today && C.today.plan; if (!plan) return "";
  const ab = absentSet(C);
  return '<div class="ddisplay" role="dialog" aria-modal="true" aria-label="תצוגה לכיתה"><div class="srow ddisp-h"><div><span class="hint">' + esc(fmtDay(plan.date)) + "</span><h2>חדר האוכל · " + esc(C.name) + "</h2></div>" +
    btn("display-close", ic("fa-xmark") + "סגירת התצוגה", "", "btn ghost small") + '</div><div class="ddisp-g"><div>' + hall(C, plan, false) + "</div><div class=\"ddisp-side\">" +
    (C.roles.length ? rolesRow(C, plan, false, ab) : "") + (isPersonal(plan) ? dutyGrid(C, plan, false, ab) : teamsGrid(C, plan, false, ab)) + "</div></div></div>";
}
function selBar() {
  if (!sel || view !== "plan") return "";
  const how = isPersonal(todaysPlan(C)) ? "לוחצים על שולחן כדי לתת אותו, על תלמיד/ה אחר/ת כדי להחליף, או על תפקיד" : "לוחצים על תלמיד/ה אחר/ת כדי להחליף, על \"העברה לכאן\" בצוות, או על תפקיד";
  return '<div class="ssel" role="status"><i class="fa-solid fa-hand-pointer"></i><div><b>' + esc(studentName(C, sel)) + "</b><span>" + how + '</span></div><button type="button" data-act="sel-cancel" aria-label="ביטול הבחירה"><i class="fa-solid fa-xmark"></i></button></div>';
}
function copyModal() {
  if (copyText == null) return "";
  return '<div class="dback" data-act="copy-close"></div><div class="dsheet" role="dialog" aria-modal="true" aria-label="הסידור כטקסט"><div class="srow"><h3>הסידור כטקסט</h3>' + btn("copy-close", "סגירה", "", "btn ghost small") + "</div>" +
    '<p class="hint">ההעתקה האוטומטית לא עבדה כאן. מסמנים את הטקסט ומעתיקים.</p><textarea id="dcopy" class="dcopy" rows="10" readonly>' + esc(copyText) + "</textarea></div>";
}
function body() {
  if (!C) return emptyView();
  const l = saved(), opts = l.map(x => [x.id, (x.id === C.id ? C.name : x.name) || "כיתה"]);
  if (!l.some(x => x.id === C.id)) opts.unshift([C.id, C.name]);
  opts.push(["__new", "＋ כיתה חדשה"]);
  const top = '<div class="dtop">' + field("הכיתה", '<select id="dpick" data-ch="pick">' + opts.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === C.id ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("") + "</select>") +
    '<p id="dstate" class="hint' + (status.err ? " bad" : "") + '" aria-live="polite">' + esc(status.t) + "</p></div>";
  const tabs = '<div class="chips dtabs" role="tablist" aria-label="מסכים">' + TABS.map(([k, nm]) => '<button type="button" role="tab" aria-selected="' + (view === k) + '" aria-pressed="' + (view === k) + '" data-act="tab" data-v="' + k + '">' + nm + "</button>").join("") + "</div>";
  const v = view === "students" ? studentsView(C) : view === "tables" ? tablesView(C) : view === "roles" ? rolesView(C) : view === "history" ? historyView(C) : planView(C);
  return top + tabs + v + sheetView() + selBar() + displayView() + copyModal();
}
// ציור מחדש של המסך, בלי לאבד את השדה שבו מקלידים ואת מקום הגלילה
function paint() {
  const box = $("dn"); if (!box) return;
  const a = document.activeElement, fid = a && a.id && box.contains(a) ? a.id : null;
  let s0 = null, s1 = null, val;
  if (fid && (a.tagName === "TEXTAREA" || a.tagName === "INPUT" && a.type !== "file")) { val = a.value; try { s0 = a.selectionStart; s1 = a.selectionEnd; } catch (e) {} }
  const y = window.scrollY;
  box.innerHTML = body();
  if (fid) { const e = $(fid); if (e) { if (val !== undefined) e.value = val; try { e.focus({preventScroll: true}); } catch (x) {} try { if (s0 != null) e.setSelectionRange(s0, s1); } catch (x) {} } }
  if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
}

// ---- אירועים ----
function onClick(e) {
  const el = e.target.closest("[data-act]"); if (!el || !$("dn").contains(el)) return;
  const act = el.dataset.act, c = C;
  switch (act) {
    case "tab": setView(el.dataset.v); paint(); window.scrollTo(0, 0); break;
    case "create-class": { const inp = $("dnewcls"), name = cleanName(inp && inp.value); if (!name) { toast("כותבים שם לכיתה"); inp && inp.focus(); break; } createClass(name); break; }
    case "gen": generate(); break;
    case "reuse": reuse(); break;
    case "balance": balance(); break;
    case "fill-role": { const plan = todaysPlan(c); if (plan) commit(repair(plan, c, absentSet(c))); break; }
    case "att": toggleAttendance(el.dataset.sid); break;
    case "all-present": allPresent(); break;
    case "display-open": display = true; sel = null; paint(); try { const p = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); if (p && p.catch) p.catch(() => {}); } catch (x) {} break;
    case "display-close": display = false; try { if (document.fullscreenElement) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => {}); } } catch (x) {} paint(); break;
    case "share": share(); break;
    case "copy-close": copyText = null; paint(); break;
    case "kid": { const sid = el.dataset.sid; if (!sel) sel = sid; else if (sel === sid) sel = null; else { const a = sel; sel = null; swapKids(a, sid); } paint(); break; }
    case "sel-cancel": sel = null; paint(); break;
    case "move-team": if (sel) { const a = sel; sel = null; moveToTeam(a, el.dataset.tid); } break;
    case "role-slot": if (sel) { const a = sel; sel = null; moveToRole(a, el.dataset.rid); } break;
    case "extra-slot": if (sel) { const a = sel; sel = null; setExtra(a, el.dataset.rid, +el.dataset.i); } break;
    case "table": {
      const n = Number(el.dataset.n);
      if (sel && view === "plan" && todaysPlan(c)) {
        const rr = roleTables(c)[n], a = sel;
        if (rr && tableInfo(c, n).active !== false) { sel = null; rr.extra ? setExtra(a, rr.id, 0) : moveToRole(a, rr.id); paint(); break; }
        if (isPersonal(todaysPlan(c))) { sel = null; assignTable(a, n); paint(); break; }
      }
      sheet = n; paint(); break;
    }
    case "sheet-close": sheet = null; paint(); break;
    case "sheet-active": { const n = sheet, on = el.dataset.v === "1"; edit(x => { x.tables[n] = Object.assign({}, x.tables[n], {active: on}); }); toast(`שולחן ${n} ${on ? "פעיל" : "סגור"}`); break; }
    case "sheet-team": { const n = sheet, tid = el.dataset.tid || null; edit(x => { x.tables[n] = Object.assign({}, x.tables[n], {team: tid}); }); break; }
    case "all-on": edit(x => { for (const n of tableNums(x)) x.tables[n].active = true; }); break;
    case "all-off": edit(x => { for (const n of tableNums(x)) x.tables[n].active = false; }); break;
    case "mode": {
      if (c.opts.mode === el.dataset.v) break;
      const had = !!todaysPlan(c), v = el.dataset.v;
      sel = null; edit(x => { x.opts.mode = v; });
      toast(v === "personal" ? (had ? "הסידור של היום חולק מחדש: כל ילד/ה קיבל/ה שולחן או שניים. התפקידים והעגלות נשארו." : "מעכשיו כל ילד/ה מקבל/ת שולחן או שניים")
        : (had ? "הסידור של היום חולק מחדש לצוותים. התפקידים והעגלות נשארו." : "מעכשיו מחלקים בצוותים"));
      break;
    }
    case "add-student": {
      const inp = $("dnew"), name = cleanName(inp && inp.value); if (!name) { inp && inp.focus(); break; }
      if (c.students.some(s => s.name === name)) { toast(name + " כבר ברשימה"); break; }
      inp.value = ""; addNames([name]); const f = $("dnew"); if (f) f.focus(); break;
    }
    case "bulk-add": { const ta = $("dbulk"); if (!ta) break; const v = ta.value; ta.value = ""; if (!addNames(v.split(/[\n\t]+/), "רשימה")) ta.value = v; break; }
    case "file-btn": $("dfile").click(); break;
    case "import-seat": { const x = (S.seating || []).filter(s => (s.students || []).length)[+el.dataset.i]; if (x) addNames(x.students, "סידור הישיבה"); break; }
    case "del-student": {
      const sid = el.dataset.sid, nm = studentName(c, sid);
      if (!confirm("להסיר את " + nm + " מהכיתה?")) break;
      edit(x => { x.students = x.students.filter(s => s.id !== sid); x.roles.forEach(r => { if (r.fixed === sid) r.fixed = null; }); });
      toast(nm + " הוסר/ה מהכיתה"); break;
    }
    case "del-class": {
      if (!confirm("למחוק את הכיתה \"" + c.name + "\" ואת ההיסטוריה שלה? אי אפשר לבטל.")) break;
      clearTimeout(saveT); saveT = 0;
      const id = c.id;
      delDining(id).catch(() => alert("המחיקה נכשלה. לבדוק את האינטרנט ולנסות שוב."));
      const rest = saved().filter(x => x.id !== id);
      if (rest.length) load(rest[0]); else { C = null; ls("adgDinCid", null); }
      setView("plan"); setStatus("הכיתה נמחקה."); paint(); break;
    }
    case "add-team": edit(x => { const used = new Set(x.teams.map(t => t.color)), col = PALETTE.find(p => !used.has(p[0])) || PALETTE[0]; x.teams.push({id: uid("tm_"), name: "צוות " + col[1], color: col[0]}); }); break;
    case "team-color": edit(x => { const t = x.teams.find(t => t.id === el.dataset.tid); if (t) t.color = el.dataset.color; }); break;
    case "del-team": {
      const tid = el.dataset.tid, t = teamById(c, tid);
      if (!confirm("למחוק את " + (t ? t.name : "הצוות") + "? השולחנות שלו יישארו בלי צוות.")) break;
      edit(x => { x.teams = x.teams.filter(t => t.id !== tid); for (const n of tableNums(x)) if (x.tables[n].team === tid) x.tables[n].team = null; });
      break;
    }
    case "col-inc": case "col-dec": edit(x => { const cols = x.columns.slice(), i = +el.dataset.i; cols[i] = Math.max(1, Math.min(14, cols[i] + (act === "col-inc" ? 1 : -1))); return setColumns(x, cols); }); break;
    case "col-add": edit(x => setColumns(x, x.columns.concat([5]))); break;
    case "col-del": if (confirm("להסיר את עמודה " + (+el.dataset.i + 1) + " ואת השולחנות שבה?")) edit(x => { const cols = x.columns.slice(); cols.splice(+el.dataset.i, 1); return setColumns(x, cols); }); break;
    case "add-role": edit(x => { x.roles.push({id: uid("r_"), name: "תפקיד חדש", icon: "star", count: 1, fixed: null}); }); break;
    case "role-inc": case "role-dec": edit(x => { const r = x.roles.find(r => r.id === el.dataset.rid); if (r) r.count = Math.max(1, Math.min(10, (r.count || 1) + (act === "role-inc" ? 1 : -1))); }); break;
    case "del-role": { const r = c.roles.find(r => r.id === el.dataset.rid); if (r && confirm("למחוק את התפקיד \"" + r.name + "\"?")) edit(x => { x.roles = x.roles.filter(y => y.id !== r.id); }); break; }
    case "del-hist": { const d = el.dataset.d; if (confirm("למחוק את " + fmtDay(d) + " מההיסטוריה?")) { delete c.hist[d]; changed(); paint(); } break; }
  }
}
function onChange(e) {
  const el = e.target.closest("[data-ch]"); if (!el) return;
  const ch = el.dataset.ch, c = C;
  if (ch === "pick") {
    flush();
    if (el.value === "__new") { createClass(newName()); return; }
    const d = saved().find(x => x.id === el.value); if (d) { load(d); setStatus(""); paint(); }
    return;
  }
  if (!c) return;
  if (ch === "file") { readFile(el); return; }
  if (ch === "class-name") { const v = cleanName(el.value); if (v && v !== c.name) edit(x => { x.name = v; }); else el.value = c.name; }
  else if (ch === "student-name") {
    const v = cleanName(el.value), sid = el.dataset.sid;
    if (!v) { el.value = studentName(c, sid); return; }
    if (c.students.some(s => s.name === v && s.id !== sid)) { toast(v + " כבר ברשימה"); el.value = studentName(c, sid); return; }
    edit(x => { const s = x.students.find(s => s.id === sid); if (s) s.name = v; });
  }
  else if (ch === "team-name") { const v = cleanName(el.value); if (v) edit(x => { const t = x.teams.find(t => t.id === el.dataset.tid); if (t) t.name = v; }); }
  else if (ch === "stage") { const v = cleanName(el.value); edit(x => { x.opts.stage = v || "במה"; }); }
  else if (ch === "role-name") { const v = cleanName(el.value); if (v) edit(x => { const r = x.roles.find(r => r.id === el.dataset.rid); if (r) r.name = v; }); }
  else if (ch === "role-icon") edit(x => { const r = x.roles.find(r => r.id === el.dataset.rid); if (r) r.icon = el.value; });
  else if (ch === "role-extra") edit(x => { const r = x.roles.find(r => r.id === el.dataset.rid); if (r) r.extra = el.value === "1"; });
  else if (ch === "role-tables") {
    const nums = [...new Set(el.value.split(/[^0-9]+/).filter(Boolean).map(Number))].filter(n => tableNums(c).includes(n));
    edit(x => { for (const r of x.roles) { if (r.id === el.dataset.rid) r.tables = nums; else r.tables = (r.tables || []).filter(n => !nums.includes(n)); } });
  }
  else if (ch === "role-fixed") edit(x => { const r = x.roles.find(r => r.id === el.dataset.rid); if (r) r.fixed = el.value || null; });
}
async function readFile(inp) {
  const f = inp.files[0]; inp.value = ""; if (!f) return;
  const st = $("dfilest"); st.className = "hint"; st.textContent = "קורא את " + f.name + "…";
  try {
    const names = await readNamesFile(f);
    if (!names.length) { st.textContent = /\.pdf$/i.test(f.name) ? "לא נמצא טקסט בקובץ. ייתכן שזה PDF סרוק (תמונה). אפשר להדביק את השמות בתיבה." : "לא זוהו שמות בקובץ. אפשר להדביק אותם בתיבה."; return; }
    const n = addNames(names, f.name);
    const s2 = $("dfilest"); if (s2) { s2.className = "hint good"; s2.textContent = "זוהו " + names.length + " שמות מתוך " + f.name + (n < names.length ? " (" + n + " חדשים)" : "") + ". כדאי לעבור על הרשימה ולתקן אם צריך."; }
  } catch (err) { st.textContent = err && /[א-ת]/.test(err.message || "") ? err.message : "לא הצלחנו לקרוא את הקובץ. אפשר להדביק את השמות בתיבה."; }
}
function onKey(e) {
  if (e.key !== "Enter" || !e.target) return;
  const id = e.target.id;
  if (id === "dnew" || id === "dnewcls") { e.preventDefault(); const b = document.querySelector('#dn [data-act="' + (id === "dnew" ? "add-student" : "create-class") + '"]'); if (b) b.click(); }
}
document.addEventListener("keydown", e => {
  if (e.key !== "Escape" || !$("dn")) return;
  if (copyText != null) copyText = null; else if (sheet != null) sheet = null; else if (display) display = false; else if (sel) sel = null; else return;
  paint();
});

export default {
  parent: "tools", tab: "tools", live: true, wide: true,
  title: () => "סידור חדר האוכל",
  html() {
    startDining(); startSeating();
    if (S.dining == null) return loading;
    if (!C) init();
    else { const d = saved().find(x => x.id === C.id); if (d && !saveT && !pend && (d.updated || 0) > (C.updated || 0)) load(d); }
    return '<p class="lead">חלוקת התורנות בחדר האוכל: מסמנים מי נוכח, והאפליקציה מחלקת צוותים ותפקידים בתור הוגן. נשמר אצלך בלבד.</p>' +
      (S.diningErr ? '<div class="err" role="alert">לא הצלחנו לטעון את הכיתות השמורות. לבדוק את האינטרנט ולפתוח שוב.</div>' : "") +
      '<div id="dn" class="dn">' + body() + '</div><div class="dtoast" id="dtoast" role="status" hidden></div>';
  },
  bind() {
    const box = $("dn"); if (!box) return;
    box.addEventListener("click", onClick);
    box.addEventListener("change", onChange);
    box.addEventListener("keydown", onKey);
    box.addEventListener("toggle", e => { if (e.target.id === "datt") attOpen = e.target.open; }, true);
  },
  // עדכון ברקע (נשמר, או שינוי ממכשיר אחר): טוענים מחדש רק אם אין שינוי שלנו שעוד לא נשמר
  update() {
    if (!$("dn")) { ui.render(); return; }
    if (!C) { if (saved().length) { init(); paint(); } return; }
    const d = saved().find(x => x.id === C.id);
    if (d && !saveT && !pend && (d.updated || 0) > (C.updated || 0)) { load(d); paint(); }
    else if (view === "students" && !document.activeElement.closest("#dn input, #dn textarea")) paint();   // רשימת סידורי הישיבה לייבוא
  }
};
