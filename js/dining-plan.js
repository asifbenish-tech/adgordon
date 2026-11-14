// סידור חדר האוכל: הלוגיקה בלבד (בלי תצוגה). הועבר מהעמוד "סידור חדר האוכל" באותה התנהגות.
// כיתה אחת = מסמך אחד: {name, students: [{id, name}], columns, teams, tables, roles, opts, today: {date, absent, plan}, hist: {תאריך: סידור}}.
// "תור" התפקידים, הצוותים הקודמים והשולחנות הכפולים נספרים מ-hist.
import {today} from "./util.js";

export const PALETTE = [["red", "אדום"], ["green", "ירוק"], ["blue", "כחול"], ["purple", "סגול"], ["orange", "כתום"], ["teal", "טורקיז"], ["pink", "ורוד"], ["brown", "חום"]];
export const ROLE_ICONS = [["cutlery", "סכו\"ם", "fa-utensils"], ["cup", "כוסות", "fa-glass-water"], ["cart", "עגלה", "fa-cart-shopping"], ["broom", "ניקיון", "fa-broom"], ["star", "אחר", "fa-star"]];
export const roleIcon = k => (ROLE_ICONS.find(x => x[0] === k) || ROLE_ICONS[4])[2];
export const HIST_MAX = 200;   // כמה ימים נשמרים (בערך שנת לימודים)

export const todayStr = today;
export const uid = p => p + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
export const clone = o => o == null ? o : JSON.parse(JSON.stringify(o));
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
export function stable(o) { if (Array.isArray(o)) return "[" + o.map(stable).join(",") + "]"; if (o && typeof o === "object") return "{" + Object.keys(o).sort().map(k => JSON.stringify(k) + ":" + stable(o[k])).join(",") + "}"; return JSON.stringify(o ?? null); }
export const cleanName = s => String(s || "").replace(/\s+/g, " ").trim().slice(0, 40);
export function rangeText(nums) {
  if (!nums.length) return "—";
  const out = []; let a = nums[0], b = nums[0];
  for (let i = 1; i <= nums.length; i++) {
    const n = nums[i];
    if (n === b + 1) { b = n; continue; }
    out.push(a === b ? `${a}` : b === a + 1 ? `${a}, ${b}` : `${a}–${b}`);
    a = b = n;
  }
  return out.join(", ");
}

// ---- הכיתה והחדר ----
export function normalizeClass(c) {
  c.name = c.name || "כיתה";
  c.students = Array.isArray(c.students) ? c.students : [];
  c.columns = Array.isArray(c.columns) && c.columns.length ? c.columns.map(n => Math.max(1, Math.min(14, n | 0))) : [7, 8, 7];
  c.teams = Array.isArray(c.teams) ? c.teams : [];
  c.roles = Array.isArray(c.roles) ? c.roles : [];
  c.tables = c.tables && typeof c.tables === "object" ? c.tables : {};
  c.opts = Object.assign({mode: "team", stage: "במה"}, c.opts || {});
  c.opts.mode = c.opts.mode === "personal" ? "personal" : "team";
  c.hist = c.hist && typeof c.hist === "object" ? c.hist : {};
  c.today = c.today && typeof c.today === "object" ? c.today : null;
  const valid = new Set(tableNums(c)), seenT = new Set();
  for (const r of c.roles) r.tables = (Array.isArray(r.tables) ? r.tables : []).map(Number).filter(n => valid.has(n) && !seenT.has(n) && seenT.add(n));
  for (const n of tableNums(c)) if (!c.tables[n]) c.tables[n] = {team: null, active: true};
  return c;
}
export function defaultLayout() {
  const columns = [7, 8, 7];
  const teams = [["red", "צוות אדום"], ["green", "צוות ירוק"], ["blue", "צוות כחול"], ["purple", "צוות סגול"]].map(([color, name]) => ({id: uid("tm_"), name, color}));
  const tables = {}, total = 22;
  for (let n = 1; n <= total; n++) tables[n] = {team: teams[Math.min(3, Math.floor((n - 1) * 4 / total))].id, active: true};
  const roles = [
    {id: "cutlery", name: "סידור סכו\"ם", icon: "cutlery", count: 1, fixed: null},
    {id: "cups", name: "סידור כוסות", icon: "cup", count: 1, fixed: null, tables: [1]}
  ];
  return {columns, teams, tables, roles, opts: {mode: "team", stage: "במה"}};
}
export function tableNums(c) { const out = []; let n = 1; for (const k of c.columns) for (let i = 0; i < k; i++) out.push(n++); return out; }
export function tableInfo(c, n) { return c.tables[n] || {team: null, active: true}; }
export const teamById = (c, id) => c.teams.find(t => t.id === id) || null;
export const teamShort = t => t ? t.name.replace(/^צוות\s+/, "") : "";
export const studentName = (c, sid) => (c.students.find(s => s.id === sid) || {}).name || "—";
export function activeTablesOf(c, tid) { const rt = roleTables(c); return tableNums(c).filter(n => { const t = tableInfo(c, n); return t.active !== false && t.team === tid && !rt[n]; }); }
export function allTablesOf(c, tid) { const rt = roleTables(c); return tableNums(c).filter(n => tableInfo(c, n).team === tid && !rt[n]); }
export const isPersonal = plan => !!plan && plan.kind === "personal";
// תפקיד יכול לקבל גם שולחן (כוסות -> שולחן 1, שמוכן אחרון). רק מי שבתפקיד אחראי עליו, ולכן הוא לא נכנס לחלוקה.
export function roleTables(c) { const m = {}; for (const r of c.roles) for (const n of r.tables || []) if (!m[n]) m[n] = r; return m; }
export function roleHolders(plan, r) { return plan ? ((r.extra ? plan.extras : plan.roles) || {})[r.id] || [] : []; }
export const tablesWord = ns => `${ns.length > 1 ? "שולחנות" : "שולחן"} ${ns.join(", ")}`;
export function activeAll(c) { return tableNums(c).filter(n => tableInfo(c, n).active !== false); }
function tablePos(c) { const pos = {}; let n = 1; c.columns.forEach((k, col) => { for (let row = 0; row < k; row++) pos[n++] = {col, row}; }); return pos; }
// השולחנות הפעילים בסדר "נחש" (למטה בעמודה אחת, למעלה בבאה), כך שרצף שעובר עמודה נשאר באותו קצה של המעבר.
export function snakeActive(c) {
  const out = [], rt = roleTables(c); let n = 1;
  c.columns.forEach((k, col) => {
    const nums = []; for (let r = 0; r < k; r++) nums.push(n++);
    if (col % 2) nums.reverse();
    nums.forEach(x => { if (tableInfo(c, x).active !== false && !rt[x]) out.push(x); });
  });
  return out;
}
export function dutyTables(c) { return snakeActive(c).sort((a, b) => a - b); }
export function ownedMap(plan) {
  const own = {};
  for (const [n, ids] of Object.entries((plan && plan.tables) || {})) for (const id of ids || []) (own[id] || (own[id] = [])).push(Number(n));
  for (const k in own) own[k].sort((a, b) => a - b);
  return own;
}
export function byName(c) { return c.students.slice().sort((a, b) => a.name.localeCompare(b.name, "he", {numeric: true})); }
// שינוי במבנה החדר: כל שולחן שנשאר באותו מקום שומר את הצוות שלו ואת מצבו, גם כשהמספר שלו משתנה
export function setColumns(c, cols) {
  const oldPos = {}; let n = 1;
  c.columns.forEach((k, ci) => { for (let r = 0; r < k; r++) oldPos[ci + ":" + r] = n++; });
  const tables = {}, renumber = {}; n = 1;
  cols.forEach((k, ci) => { for (let r = 0; r < k; r++) {
    const old = oldPos[ci + ":" + r], above = r > 0 ? tables[n - 1] : null;
    tables[n] = old ? Object.assign({}, c.tables[old]) : {team: above ? above.team : null, active: true};
    if (old) renumber[old] = n;
    n++;
  } });
  c.columns = cols; c.tables = tables;
  for (const r of c.roles) r.tables = (r.tables || []).map(x => renumber[x]).filter(Boolean);
  return {renumber};
}

// ---- נוכחות והיסטוריה ----
export function absentSet(c) { const t = c.today; return new Set(t && t.date === todayStr() ? (t.absent || []) : []); }
export function todaysPlan(c) { const p = c.today && c.today.plan; return p && p.date === todayStr() ? p : null; }
export function histFor(c) { return Object.values(c.hist || {}).filter(Boolean).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0); }
export function roleStats(c, excludeDate) {
  const st = {};
  for (const h of histFor(c)) {
    if (h.date === excludeDate) continue;
    for (const src of [h.roles, h.extras]) for (const [rid, ids] of Object.entries(src || {})) for (const sid of ids || []) {
      if (!sid) continue;
      const r = st[sid] || (st[sid] = {}), x = r[rid] || (r[rid] = {n: 0, last: ""});
      x.n++; if (h.date > x.last) x.last = h.date;
    }
  }
  return st;
}
function prevPlan(c, date, kind) {
  const hs = histFor(c).filter(h => h.date < date && (!kind || (h.kind === "personal" ? "personal" : "team") === kind));
  return hs[hs.length - 1] || null;
}
// כמה ימים כל תלמיד קיבל יותר משולחן אחד (בחלוקה האישית), כדי שהכפולים יתחלפו
export function doubleCounts(c, excludeDate) {
  const d = {};
  for (const h of histFor(c)) {
    if (h.date === excludeDate || h.kind !== "personal") continue;
    for (const [id, ns] of Object.entries(ownedMap(h))) if (ns.length > 1) d[id] = (d[id] || 0) + 1;
  }
  return d;
}

// ---- חלוקה אישית ----
// מההתחלה: כל תלמיד מקבל רצף של שולחנות סמוכים (אחד או שניים), או, כשיש יותר תלמידים משולחנות, שולחן לאחד או לשניים.
function assignPersonal(c, duty, prevP, dbl) {
  const order = snakeActive(c), T = order.length, K = duty.length;
  const empty = {}; order.forEach(n => empty[n] = []);
  if (!T) return {tables: empty, unassigned: duty.slice()};
  if (!K) return {tables: empty, unassigned: []};
  let groups = [];
  if (T >= K) {
    // כמה סדרים של גדלי קבוצות, ונשאר זה שבו הכי מעט רצפים עוברים לעמודה אחרת
    const pos = tablePos(c), q = Math.floor(T / K), extra = T % K;
    const base = Array.from({length: K}, (_, i) => i < extra ? q + 1 : q);
    let bestSizes = base, bestCross = Infinity;
    for (let t = 0; t < 80; t++) {
      const sizes = shuffle(base); let k = 0, cross = 0;
      for (const sz of sizes) { if (new Set(order.slice(k, k + sz).map(n => pos[n].col)).size > 1) cross++; k += sz; }
      if (cross < bestCross) { bestCross = cross; bestSizes = sizes; if (!cross) break; }
    }
    let k = 0; for (const sz of bestSizes) { groups.push(order.slice(k, k + sz)); k += sz; }
  } else groups = shuffle(order.map(n => [n]));
  const prevTables = ownedMap(prevP);
  let best = null, bestScore = Infinity;
  for (let it = 0; it < 300; it++) {
    const kids = shuffle(duty), out = {}; let score = 0;
    order.forEach(n => out[n] = []);
    kids.forEach((id, i) => {
      const g = groups[i % groups.length];
      g.forEach(n => { out[n].push(id); if ((prevTables[id] || []).includes(n)) score += 1; });
      if (g.length > 1) score += 0.6 * ((dbl && dbl[id]) || 0);
    });
    if (score < bestScore) { best = out; bestScore = score; if (!score) break; }
  }
  return {tables: best, unassigned: []};
}
// שומרים על מה שכבר יש: רק שולחנות בלי אחראי ותלמידים בלי שולחן מתחלפים, ואז מאזנים כך שלאף אחד אין שני שולחנות יותר מאחר.
export function fixPersonal(c, tablesIn, duty) {
  const order = snakeActive(c), pos = tablePos(c), T = order.length, K = duty.length, dutySet = new Set(duty);
  const tables = {}; order.forEach(n => tables[n] = []);
  for (const n of order) for (const id of (tablesIn[n] || [])) if (dutySet.has(id) && !tables[n].includes(id)) tables[n].push(id);
  if (!T) return {tables, unassigned: duty.slice()};
  if (!K) return {tables, unassigned: []};
  const owned = id => order.filter(n => tables[n].includes(id));
  const dist = (a, b) => Math.abs(pos[a].col - pos[b].col) * 3 + Math.abs(pos[a].row - pos[b].row);
  const near = (id, n) => { const ns = owned(id); return ns.length ? Math.min(...ns.map(m => dist(m, n))) : 99; };
  const spread = id => { const ns = owned(id).sort((x, y) => pos[x].col - pos[y].col || pos[x].row - pos[y].row); let sp = 0; for (let i = 1; i < ns.length; i++) sp += dist(ns[i - 1], ns[i]) - 1; return sp; };
  const loads = () => { const L = {}; duty.forEach(id => L[id] = 0); order.forEach(n => tables[n].forEach(id => L[id]++)); return L; };
  const touched = new Set(), give = (n, id) => { tables[n] = [id]; touched.add(id); };
  if (T >= K) {
    for (const n of order) if (tables[n].length > 1) tables[n] = tables[n].slice(0, 1);
    for (const id of shuffle(duty)) {
      const L = loads(); if (L[id] > 0) continue;
      const open = order.filter(n => !tables[n].length);
      if (open.length) { give(open[0], id); continue; }
      const max = duty.reduce((m, x) => L[x] > L[m] ? x : m, duty[0]);
      if (L[max] < 2) break;
      const theirs = owned(max); give(theirs[theirs.length - 1], id);
    }
    for (const n of order) {
      if (tables[n].length) continue;
      const L = loads(), min = Math.min(...duty.map(id => L[id]));
      give(n, duty.filter(id => L[id] === min).sort((a, b) => near(a, n) - near(b, n))[0]);
    }
    for (let g = 0; g < 200; g++) {
      const L = loads();
      const max = duty.reduce((m, x) => L[x] > L[m] ? x : m, duty[0]), min = duty.reduce((m, x) => L[x] < L[m] ? x : m, duty[0]);
      if (L[max] - L[min] < 2) break;
      give(owned(max).sort((a, b) => near(min, a) - near(min, b))[0], min);
    }
    // מי שקיבל עכשיו שולחן שני רחוק מהראשון יכול להתחלף עם מישהו קרוב
    for (let round = 0; round < 3; round++) {
      let improved = false;
      for (const a of [...touched]) {
        if (!spread(a)) continue;
        for (const ta of owned(a)) for (const n of order) {
          const b = tables[n][0];
          if (!b || b === a || !tables[ta].includes(a)) continue;
          const before = spread(a) + spread(b);
          tables[ta] = [b]; tables[n] = [a];
          if (spread(a) + spread(b) < before) { improved = true; break; }
          tables[ta] = [a]; tables[n] = [b];
        }
      }
      if (!improved) break;
    }
  } else {
    const seen = new Set();
    for (const n of order) tables[n] = tables[n].filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });
    const free = shuffle(duty.filter(id => !seen.has(id)));
    for (const n of order) {
      if (tables[n].length) continue;
      if (free.length) { tables[n].push(free.pop()); continue; }
      const crowded = order.reduce((m, x) => tables[x].length > tables[m].length ? x : m, order[0]);
      if (tables[crowded].length < 2) break;
      tables[n].push(tables[crowded].pop());
    }
    for (const id of free) { const n = order.reduce((m, x) => tables[x].length < tables[m].length ? x : m, order[0]); tables[n].push(id); }
    for (let g = 0; g < 200; g++) {
      const mx = order.reduce((m, x) => tables[x].length > tables[m].length ? x : m, order[0]);
      const mn = order.reduce((m, x) => tables[x].length < tables[m].length ? x : m, order[0]);
      if (tables[mx].length - tables[mn].length < 2) break;
      tables[mn].push(tables[mx].pop());
    }
  }
  return {tables, unassigned: []};
}
export function personalDuty(c, plan, ab) {
  const busy = new Set(Object.values((plan && plan.roles) || {}).flat());
  return c.students.map(s => s.id).filter(id => !ab.has(id) && !busy.has(id));
}

// ---- תפקידים ----
function pickForRole(cands, rid, st, prev, busy) {
  if (!cands.length) return null;
  const prevHolders = new Set([...Object.values((prev && prev.roles) || {}).flat(), ...Object.values((prev && prev.extras) || {}).flat()]);
  return cands.map((id, i) => ({id, i, b: busy && busy.has(id) ? 1 : 0, n: (st[id] && st[id][rid] && st[id][rid].n) || 0, last: (st[id] && st[id][rid] && st[id][rid].last) || "", recent: prevHolders.has(id) ? 1 : 0}))
    .sort((a, b) => a.b - b.b || a.n - b.n || a.recent - b.recent || (a.last < b.last ? -1 : a.last > b.last ? 1 : 0) || a.i - b.i)[0].id;
}
export const slotLabel = (r, i) => r.unit ? `${r.unit} ${i + 1}` : r.name;
// תפקידים "בנוסף לצוות" (למשל העגלות) נופלים על כל תלמיד נוכח, שנשאר גם בצוות. כל מקום שומר על המיקום שלו.
function fillExtras(c, plan, ok, st, prev) {
  const xr = c.roles.filter(r => r.extra), out = {}, taken = new Set();
  for (const r of xr) {
    const n = r.count || 1;
    const arr = ((plan.extras || {})[r.id] || []).slice(0, n).map(id => id && ok(id) && !taken.has(id) ? id : null);
    while (arr.length < n) arr.push(null);
    arr.forEach(id => { if (id) taken.add(id); });
    out[r.id] = arr;
  }
  const main = new Set(Object.values(plan.roles || {}).flat()), pool = shuffle(c.students.map(s => s.id).filter(ok));
  for (const r of xr) {
    const arr = out[r.id];
    for (let i = 0; i < arr.length; i++) {
      if (arr[i]) continue;
      const pick = r.fixed && ok(r.fixed) && !taken.has(r.fixed) ? r.fixed : pickForRole(pool.filter(id => !taken.has(id)), r.id, st, prev, main);
      if (!pick) break;
      arr[i] = pick; taken.add(pick);
    }
  }
  return out;
}

// ---- צוותים ----
function teamTargets(c, total, prefer) {
  const out = {}; c.teams.forEach(t => out[t.id] = 0);
  const ws = c.teams.map(t => ({id: t.id, w: activeTablesOf(c, t.id).length})), W = ws.reduce((s, t) => s + t.w, 0);
  if (!W || !total) return {targets: out, W};
  const rows = ws.map(t => { const q = total * t.w / W, n = Math.floor(q + 1e-9); return {id: t.id, w: t.w, n, rem: q - n, cur: (prefer && prefer[t.id]) || 0, r: Math.random()}; });
  const left = total - rows.reduce((s, r) => s + r.n, 0);
  rows.filter(r => r.w > 0).sort((a, b) => (b.rem - a.rem > 1e-9 ? 1 : a.rem - b.rem > 1e-9 ? -1 : 0) || b.cur - a.cur || a.r - b.r).slice(0, left).forEach(r => r.n++);
  rows.forEach(r => out[r.id] = r.n);
  return {targets: out, W};
}
function distribute(c, ids, prev) {
  const {targets} = teamTargets(c, ids.length), order = c.teams.map(t => t.id), prevTeam = {}, prevPairs = new Set();
  if (prev) for (const [tid, arr] of Object.entries(prev.teams || {})) {
    (arr || []).forEach(s => prevTeam[s] = tid);
    for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) prevPairs.add([arr[i], arr[j]].sort().join("|"));
  }
  let best = null, bestScore = Infinity;
  for (let it = 0; it < 400; it++) {
    const sh = shuffle(ids), out = {}; let k = 0, score = 0;
    for (const tid of order) { out[tid] = sh.slice(k, k + targets[tid]); k += targets[tid]; }
    for (const [tid, arr] of Object.entries(out)) {
      arr.forEach(s => { if (prevTeam[s] === tid) score += 1; });
      for (let i = 0; i < arr.length; i++) for (let j = i + 1; j < arr.length; j++) if (prevPairs.has([arr[i], arr[j]].sort().join("|"))) score += 0.3;
    }
    if (score < bestScore) { best = out; bestScore = score; if (score === 0) break; }
  }
  return best || {};
}
export function rebalance(c, teams, threshold) {
  const total = Object.values(teams).reduce((s, a) => s + a.length, 0), sizes = {};
  for (const t of c.teams) sizes[t.id] = teams[t.id].length;
  const {targets} = teamTargets(c, total, sizes);
  for (let guard = 0; guard < 200; guard++) {
    let over = null, under = null;
    for (const t of c.teams) {
      const ex = teams[t.id].length - targets[t.id];
      if (ex > 0 && (!over || ex > over.ex)) over = {id: t.id, ex};
      if (ex < 0 && (!under || -ex > under.de)) under = {id: t.id, de: -ex};
    }
    if (!over || !under) break;
    const emptyTeam = teams[under.id].length === 0 && teams[over.id].length >= 2;
    if (!(over.ex + under.de >= threshold || emptyTeam)) break;
    teams[under.id].push(teams[over.id].pop());
  }
  return teams;
}

// ---- חלוקה חדשה, ותיקון של חלוקה קיימת (אחרי שינוי בנוכחות או בחדר) ----
export function makePlan(c, absent, date) {
  const present = c.students.filter(s => !absent.has(s.id)).map(s => s.id);
  const st = roleStats(c, date), prev = prevPlan(c, date);
  const plan = {date, roles: {}, teams: {}, unassigned: [], extras: {}};
  const used = new Set(), pool = shuffle(present);
  for (const role of c.roles.filter(r => !r.extra)) {
    const holders = [];
    if (role.fixed && pool.includes(role.fixed) && !used.has(role.fixed)) { holders.push(role.fixed); used.add(role.fixed); }
    while (holders.length < (role.count || 1)) {
      const pick = pickForRole(pool.filter(id => !used.has(id)), role.id, st, prev);
      if (!pick) break; holders.push(pick); used.add(pick);
    }
    plan.roles[role.id] = holders;
  }
  const rest = pool.filter(id => !used.has(id));
  if (c.opts.mode === "personal") {
    const res = assignPersonal(c, rest, prevPlan(c, date, "personal"), doubleCounts(c, date));
    Object.assign(plan, {kind: "personal", teams: {}, tables: res.tables, unassigned: res.unassigned});
  } else {
    plan.kind = "team";
    const {W} = teamTargets(c, rest.length);
    c.teams.forEach(t => plan.teams[t.id] = []);
    if (!W) plan.unassigned = rest;
    else Object.assign(plan.teams, distribute(c, rest, prevPlan(c, date, "team")));
  }
  const presentSet = new Set(present);
  plan.extras = fillExtras(c, plan, id => presentSet.has(id), st, prev);
  return plan;
}
export function repair(plan0, c, absent) {
  const plan = clone(plan0), known = new Set(c.students.map(s => s.id)), ok = id => known.has(id) && !absent.has(id);
  const st = roleStats(c, plan.date), prev = prevPlan(c, plan.date);
  const placed = new Set(), roles = {}, teams = {}, homeless = [], mainRoles = c.roles.filter(r => !r.extra);
  const was = isPersonal(plan) ? "personal" : "team";
  for (const role of mainRoles) {
    roles[role.id] = ((plan.roles || {})[role.id] || []).filter(id => ok(id) && !placed.has(id)).slice(0, role.count || 1);
    roles[role.id].forEach(id => placed.add(id));
  }
  if (c.opts.mode === "personal") {
    const isHolder = id => Object.values(roles).some(a => a.includes(id));
    for (const role of mainRoles) {
      while (roles[role.id].length < (role.count || 1)) {
        const pick = role.fixed && ok(role.fixed) && !isHolder(role.fixed) ? role.fixed
          : pickForRole(shuffle(c.students.map(s => s.id).filter(id => ok(id) && !isHolder(id))), role.id, st, prev);
        if (!pick) break;
        roles[role.id].push(pick);
      }
    }
    const duty = c.students.map(s => s.id).filter(id => ok(id) && !isHolder(id));
    const res = was === "personal" ? fixPersonal(c, plan.tables || {}, duty) : assignPersonal(c, duty, prevPlan(c, plan.date, "personal"), doubleCounts(c, plan.date));
    Object.assign(plan, {kind: "personal", roles, teams: {}, tables: res.tables, unassigned: res.unassigned});
    plan.extras = fillExtras(c, plan, ok, st, prev);
    return plan;
  }
  for (const t of c.teams) teams[t.id] = [];
  for (const [tid, arr] of Object.entries(was === "team" ? (plan.teams || {}) : {})) for (const id of arr || []) {
    if (!ok(id) || placed.has(id)) continue;
    placed.add(id); (teams[tid] || homeless).push(id);
  }
  for (const id of plan.unassigned || []) if (ok(id) && !placed.has(id)) { placed.add(id); homeless.push(id); }
  for (const s of c.students) if (ok(s.id) && !placed.has(s.id)) { placed.add(s.id); homeless.push(s.id); }
  const take = id => { let i = homeless.indexOf(id); if (i >= 0) { homeless.splice(i, 1); return; } for (const arr of Object.values(teams)) { i = arr.indexOf(id); if (i >= 0) { arr.splice(i, 1); return; } } };
  for (const role of mainRoles) {
    while (roles[role.id].length < (role.count || 1)) {
      const isHolder = id => Object.values(roles).some(a => a.includes(id));
      const pick = role.fixed && ok(role.fixed) && !isHolder(role.fixed) ? role.fixed : pickForRole(shuffle(homeless.concat(...Object.values(teams))), role.id, st, prev);
      if (!pick) break;
      take(pick); roles[role.id].push(pick);
    }
  }
  const {W} = teamTargets(c, 1);
  if (!W) {
    plan.unassigned = homeless.concat(...Object.values(teams));
    for (const k in teams) teams[k] = [];
  } else {
    plan.unassigned = [];
    if (was === "personal") {
      const d = distribute(c, homeless.splice(0), prevPlan(c, plan.date, "team"));
      for (const t of c.teams) teams[t.id] = d[t.id] || [];
    }
    for (const t of c.teams) if (!activeTablesOf(c, t.id).length) homeless.push(...teams[t.id].splice(0));
    const total = homeless.length + Object.values(teams).reduce((s, a) => s + a.length, 0), sizes = {};
    for (const t of c.teams) sizes[t.id] = teams[t.id].length;
    const {targets} = teamTargets(c, total, sizes);
    for (const id of shuffle(homeless)) {
      let best = null;
      for (const t of c.teams) { if (!activeTablesOf(c, t.id).length) continue; const d = targets[t.id] - teams[t.id].length; if (!best || d > best.d) best = {id: t.id, d}; }
      teams[best.id].push(id);
    }
    rebalance(c, teams, 3);
  }
  plan.roles = roles; plan.teams = teams; plan.kind = "team";
  delete plan.tables;
  plan.extras = fillExtras(c, plan, ok, st, prev);
  return plan;
}
export function locate(plan, sid) {
  if (!plan) return null;
  for (const [rid, a] of Object.entries(plan.roles || {})) if ((a || []).includes(sid)) return {kind: "role", id: rid, arr: a};
  for (const [tid, a] of Object.entries(plan.teams || {})) if ((a || []).includes(sid)) return {kind: "team", id: tid, arr: a};
  const mine = ownedMap(plan)[sid];
  if (mine) return {kind: "tables", tables: mine};
  if ((plan.unassigned || []).includes(sid)) return {kind: "none", id: null, arr: plan.unassigned};
  return null;
}
export function isImbalanced(c, plan, ab) {
  if (!plan) return false;
  if (isPersonal(plan)) {
    const cur = {}; for (const n of snakeActive(c)) cur[n] = ((plan.tables || {})[n] || []).slice();
    return stable(cur) !== stable(fixPersonal(c, plan.tables || {}, personalDuty(c, plan, ab)).tables);
  }
  const teams = {}; for (const t of c.teams) teams[t.id] = ((plan.teams || {})[t.id] || []).slice();
  return stable(teams) !== stable(rebalance(c, teams, 2));
}
// החלפה בין שני תלמידים בכל מקום (תפקיד, צוות, שולחנות). העגלות נשארות עם התלמיד.
export function swapIds(plan, a, b) {
  const sw = arr => { if (arr) arr.forEach((x, i) => { if (x === a) arr[i] = b; else if (x === b) arr[i] = a; }); };
  for (const src of [plan.roles, plan.teams, plan.tables]) for (const arr of Object.values(src || {})) sw(arr);
  sw(plan.unassigned);
}
export function removeId(plan, sid) {
  for (const src of [plan.roles, plan.teams, plan.tables]) for (const k of Object.keys(src || {})) src[k] = (src[k] || []).filter(x => x !== sid);
  if (plan.unassigned) plan.unassigned = plan.unassigned.filter(x => x !== sid);
}

// ---- הסידור כטקסט (לשליחה בוואטסאפ) ----
export function fmtDay(s) { if (!s) return ""; const [y, m, d] = s.split("-").map(Number), dt = new Date(y, m - 1, d); return `יום ${["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"][dt.getDay()]}, ${d}.${m}`; }
export function planText(c) {
  const plan = c.today && c.today.plan; if (!plan) return "";
  const ab = absentSet(c), L = [`סידור חדר האוכל · ${c.name} · ${fmtDay(plan.date)}`, ""];
  for (const r of c.roles) {
    if (r.extra) {
      const arr = (plan.extras || {})[r.id] || [], parts = [];
      for (let i = 0; i < (r.count || 1); i++) { const s = arr[i]; parts.push(r.unit ? `${r.unit} ${i + 1}: ${s ? studentName(c, s) : "—"}` : (s ? studentName(c, s) : "—")); }
      L.push(`${r.name}: ${parts.join(", ")}`);
    } else {
      const ns = (r.tables || []).filter(n => tableInfo(c, n).active !== false);
      L.push(`${r.name}: ${((plan.roles || {})[r.id] || []).map(s => studentName(c, s)).join(", ") || "—"}${ns.length ? ` (אחראי/ת גם על ${tablesWord(ns)})` : ""}`);
    }
  }
  L.push("");
  if (isPersonal(plan)) {
    const duty = new Set(dutyTables(c)), own = ownedMap(plan);
    for (const s of byName(c)) { const ns = (own[s.id] || []).filter(n => duty.has(n)); if (ns.length) L.push(`${s.name}: ${tablesWord(ns)}`); }
    const unc = [...duty].filter(n => !((plan.tables || {})[n] || []).length).sort((a, b) => a - b);
    if (unc.length) L.push("", `שולחנות בלי אחראי: ${rangeText(unc)}`);
  } else for (const tm of c.teams) {
    const tabs = activeTablesOf(c, tm.id), mem = (plan.teams || {})[tm.id] || [];
    if (!tabs.length && !mem.length) continue;
    L.push(`${tm.name} · שולחנות ${rangeText(tabs)}: ${mem.map(s => studentName(c, s)).join(", ") || "—"}`);
  }
  const closed = tableNums(c).filter(n => tableInfo(c, n).active === false);
  if (closed.length) L.push("", `שולחנות סגורים: ${rangeText(closed)}`);
  if (ab.size) L.push(`חסרים היום: ${byName(c).filter(s => ab.has(s.id)).map(s => s.name).join(", ")}`);
  return L.join("\n");
}
