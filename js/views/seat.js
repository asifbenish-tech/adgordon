// "סידור ישיבה" (#/seat, נפתח מלשונית "כלים"). לפי העמוד "סידור ישיבה": צורת הכיתה (טורים / קבוצות / ח׳),
// רשימת תלמידים (הקלדה או קובץ), מפת הכיתה שבה מעבירים ומחליפים מקומות בלחיצה, ודף להדפסה (PDF).
// כל איש צוות שומר כמה כיתות שירצה, ב-seating/<uid>/classes/<cid>. רק הוא רואה אותן.
import {S} from "../state.js";
import {$, esc, rid, ls} from "../util.js";
import {startSeating, saveSeating, delSeating, myHome, myFull} from "../data.js";
import {loading, field, ui} from "../ui.js";
import {readNamesFile, jpegPdf} from "../seat-io.js";

const EXAMPLE = ["נועה א׳", "איתי ב׳", "מאיה ג׳", "יונתן ד׳", "תמר ה׳", "אורי ו׳", "שירה ז׳", "עידו ח׳", "יעל ט׳", "דניאל י׳", "רוני כ׳", "עומר ל׳", "הילה מ׳",
  "גיא נ׳", "ליה ס׳", "אלון ע׳", "מיכל פ׳", "נדב צ׳", "עדי ק׳", "יובל ר׳", "אביגיל ש׳", "רועי ת׳", "טל א׳", "שחר ב׳", "ענבל ג׳", "אסף ד׳"];
const EX_NAME = "כיתה לדוגמה";
const LAYOUT = {type: "cols", cols: 4, rows: 4, perCol: [4, 4, 4, 4], groups: 6, perGroup: 2, perRow: 3, uSide: 3, uBack: 4};
const TYPES = [["cols", "טורים"], ["groups", "קבוצות"], ["u", "צורת ח׳"]];
const clone = o => JSON.parse(JSON.stringify(o));
const blank = () => ({id: "c" + rid(), className: "", teacher: "", students: [], layout: clone(LAYOUT), seats: [], nameMode: "short", nameOrder: "lf", example: false});

// בטלפון: "big" = מקום ישיבה בגובה 44px לפחות והמפה נגללת הצידה; "fit" = כל הכיתה ברוחב המסך
let zoom = ls("adgSeatZoom") || "big";
let rt = 0, C = null, sel = null, touched = false, saveT = 0, saving = false, again = false, status = {t: "", err: false}, preview = "";

const saved = () => (S.seating || []).slice().sort((a, b) => (b.updated || 0) - (a.updated || 0));
function load(d) {
  C = Object.assign(blank(), clone(d), {id: d.id, example: false});
  C.layout = Object.assign(clone(LAYOUT), C.layout);
  sel = null; preview = "";
}
function exampleClass() {
  C = blank(); C.className = EX_NAME; C.teacher = myFull(); C.students = EXAMPLE.slice(); C.nameOrder = "fl"; C.example = true; fillSeats(C.students);
}
function init() { const l = saved(); if (l.length) load(l[0]); else exampleClass(); }
// הכיתה לדוגמה הופכת לכיתה אמיתית ברגע שמכניסים שמות
function unExample() {
  if (!C.example) return;
  C.example = false;
  if (C.className === EX_NAME) { C.className = myHome(); const f = $("scls"); if (f) f.value = C.className; }
  C.nameOrder = "lf"; const o = $("sorder"); if (o) o.value = "lf";   // ברשימות של בית הספר: שם משפחה קודם
  const b = $("sex"); if (b) b.hidden = true;
}

// ---- שמירה: שנייה אחרי השינוי האחרון ----
function setStatus(t, err) { status = {t, err: !!err}; const el = $("sstate"); if (el) { el.textContent = t; el.className = "hint" + (err ? " bad" : ""); } }
function changed() {
  touched = true;
  if (C.example) return;
  clearTimeout(saveT); saveT = setTimeout(save, 1000); setStatus("שומר…");
}
const snap = () => ({className: C.className, teacher: C.teacher, students: C.students.slice(), layout: clone(C.layout), seats: C.seats.slice(), nameMode: C.nameMode, nameOrder: C.nameOrder, updated: Date.now()});
async function save() {
  saveT = 0;
  if (saving) { again = true; return; }
  saving = true;
  const p = saveSeating(C.id, snap());   // התמונה נלקחת עכשיו, לפני שמחליפים כיתה
  if (!navigator.onLine) setStatus("נשמר במכשיר. יישלח כשיחזור האינטרנט.");
  try { await p; setStatus("נשמר. הכיתות שלך זמינות מכל מכשיר שנכנסת ממנו."); }
  catch (e) { setStatus("לא נשמר. לבדוק את האינטרנט ולנסות שוב.", true); }
  saving = false; if (again) { again = false; save(); }
}
function flush() { if (saveT) { clearTimeout(saveT); save(); } }

// ---- גאומטריה (יחידות: מקום ישיבה = 100 x 60, שולחן = שני מקומות) ----
function geometry(L) {
  const seats = [], desks = [], labels = [];
  const hDesk = (x, y, chair) => { const d = desks.length; desks.push({x, y, w: 200, h: 60, split: "v", chair}); seats.push({x: x + 100, y, desk: d}, {x, y, desk: d}); };
  const vDesk = (x, y, chair) => { const d = desks.length; desks.push({x, y, w: 100, h: 120, split: "h", chair}); seats.push({x, y, desk: d}, {x, y: y + 60, desk: d}); };
  if (L.type === "cols") {
    const n = L.cols, max = Math.max(...L.perCol.slice(0, n));
    for (let r = 0; r < max; r++) for (let c = 0; c < n; c++) if (r < L.perCol[c]) hDesk((n - 1 - c) * 260, r * 100, "down");
  } else if (L.type === "groups") {
    const k = L.perGroup, bw = k === 4 ? 400 : 200, bh = k === 4 ? 120 : 60 * k, cw = bw + 90, ch = bh + 125, pr = Math.min(L.perRow, L.groups);
    for (let g = 0; g < L.groups; g++) {
      const row = Math.floor(g / pr), col = g % pr, x = (pr - 1 - col) * cw, y = row * ch + 46;
      labels.push({x: x + bw / 2, y: y - 26, text: "קבוצה " + (g + 1)});
      if (k === 4) { hDesk(x + 200, y, "up"); hDesk(x, y, "up"); hDesk(x + 200, y + 60, "down"); hDesk(x, y + 60, "down"); }
      else for (let i = 0; i < k; i++) hDesk(x, y + i * 60, k === 1 ? "down" : i === 0 ? "up" : i === k - 1 ? "down" : null);
    }
  } else {
    const s = L.uSide, b = L.uBack, bx = 150, bwid = b * 212 - 12, rx = bx + bwid + 30, by = s * 132 + 6;
    for (let i = 0; i < s; i++) vDesk(rx, i * 132, "right");
    for (let j = 0; j < b; j++) hDesk(bx + (b - 1 - j) * 212, by, "down");
    for (let i = s - 1; i >= 0; i--) vDesk(20, i * 132, "left");
  }
  const chairs = [];
  for (const s of seats) {
    const d = desks[s.desk];
    if (d.chair === "down") chairs.push({x: s.x + 22, y: d.y + d.h + 4, w: 56, h: 13});
    else if (d.chair === "up") chairs.push({x: s.x + 22, y: d.y - 17, w: 56, h: 13});
    else if (d.chair === "right") chairs.push({x: d.x + d.w + 4, y: s.y + 10, w: 13, h: 40});
    else if (d.chair === "left") chairs.push({x: d.x - 17, y: s.y + 10, w: 13, h: 40});
  }
  let w = 0, h = 0; for (const d of desks.concat(chairs)) { w = Math.max(w, d.x + d.w); h = Math.max(h, d.y + d.h); }
  return {seats, desks, labels, chairs, w, h};
}
// החדר סביב השולחנות: הלוח בקיר הקדמי, הדלת מימין לו, חלונות לאורך הקיר השמאלי, לוקרים מאחור
function room(g) {
  let padL = 90, padR = 65; const padT = 125, padB = 100; let rw = g.w + padL + padR;
  if (rw < 660) { const e = (660 - rw) / 2; padL += e; padR += e; rw = 660; }
  const x0 = -padL, y0 = -padT, x1 = g.w + padR, y1 = g.h + padB;
  const bw = Math.min(rw * .5, rw - 260), bcx = (x0 + x1) / 2;
  const wins = [], top = y0 + 55, len = (y1 - 35) - top, n = Math.max(2, Math.round(len / 200)), wl = (len - (n - 1) * 28) / n;
  for (let i = 0; i < n; i++) wins.push({y: top + i * (wl + 28), h: wl});
  const ln = Math.max(4, Math.round((rw - 90) / 48)), lw = (rw - 90) / ln, lockers = [];
  for (let i = 0; i < ln; i++) lockers.push({x: x0 + 45 + i * lw, y: y1 - 39, w: lw, h: 33});
  return {x0, y0, x1, y1, w: rw, h: y1 - y0, board: {x: bcx - bw / 2, y: y0 + 5, w: bw, h: 44}, door: {t: y0 + 28, r: 85}, lockers, wins};
}
// איך השם מופיע על השולחן. "short" = שם פרטי + אותיות מהמשפחה, כמה שצריך כדי שלא יהיו שני שמות זהים
function displayMap() {
  const mode = C.nameMode || "short", m = new Map();
  if (mode === "full") { for (const n of C.students) m.set(n, n); return m; }
  const lf = (C.nameOrder || "lf") === "lf";
  const mk = (n, k) => {
    let p = n.split(" "); if (lf && p.length > 1) p = [p[p.length - 1]].concat(p.slice(0, -1));
    if (p.length < 2 || mode === "first" && k === 0) return p[0];
    if (mode === "first") k--;
    return p[0] + " " + [...p[1]].slice(0, k + 1).join("") + "׳";
  };
  let k = 0, pending = C.students.slice();
  while (pending.length && k < 3) {
    const c = new Map(); for (const n of pending) { const d = mk(n, k); c.set(d, (c.get(d) || 0) + 1); }
    const next = [];
    for (const n of pending) { const d = mk(n, k); if (c.get(d) === 1 || n.split(" ").length < 2 && mode !== "first") m.set(n, d); else next.push(n); }
    pending = next; k++;
  }
  for (const n of pending) m.set(n, n);
  return m;
}
const FAM = "Rubik, Arial, sans-serif", mctx = document.createElement("canvas").getContext("2d");
const tw = (t, size) => { mctx.font = "600 " + size + "px " + FAM; return mctx.measureText(t).width; };
function fit(name) {
  const maxW = 90;
  for (let s = 24; s >= 15; s--) if (tw(name, s) <= maxW) return {lines: [name], size: s};
  const parts = name.split(/\s+/);
  if (parts.length > 1) {
    let best = null;
    for (let i = 1; i < parts.length; i++) { const a = parts.slice(0, i).join(" "), b = parts.slice(i).join(" "), m = Math.max(tw(a, 20), tw(b, 20)); if (!best || m < best.m) best = {a, b, m}; }
    for (let s = 20; s >= 9; s--) if (Math.max(tw(best.a, s), tw(best.b, s)) <= maxW) return {lines: [best.a, best.b], size: s};
    return {lines: [best.a, best.b], size: 9};
  }
  for (let s = 14; s >= 8; s--) if (tw(name, s) <= maxW) return {lines: [name], size: s};
  return {lines: [name], size: 8};
}

// ---- המקומות ----
const capacity = () => geometry(C.layout).seats.length;
function normalizeSeats() {
  const cap = capacity(), left = C.students.slice(), out = [];
  for (const n of C.seats) { if (n == null) { out.push(null); continue; } const i = left.indexOf(n); if (i >= 0) { left.splice(i, 1); out.push(n); } else out.push(null); }
  C.seats = out;
  if (C.seats.length > cap) { const extra = C.seats.slice(cap).filter(Boolean); C.seats.length = cap; for (const n of extra) { const i = C.seats.indexOf(null); if (i >= 0) C.seats[i] = n; } }
  while (C.seats.length < cap) C.seats.push(null);
}
function unseated() { const left = C.students.slice(); for (const n of C.seats) { if (n == null) continue; const i = left.indexOf(n); if (i >= 0) left.splice(i, 1); } return left; }
function fillSeats(list) { const cap = capacity(); C.seats = []; for (let i = 0; i < cap; i++) C.seats.push(i < list.length ? list[i] : null); }
const reflow = () => fillSeats(C.seats.filter(Boolean));

// ---- המפה (SVG) ----
const NS = "http://www.w3.org/2000/svg";
function el(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
function renderPlan() {
  const svg = $("splan"); if (!svg) return;
  normalizeSeats();
  const g = geometry(C.layout), R = room(g), dm = displayMap(), fl = $("sfloor");
  svg.textContent = "";
  svg.setAttribute("viewBox", (R.x0 - 10) + " " + (R.y0 - 10) + " " + (R.w + 20) + " " + (R.h + 20));
  // מסך צר (טלפון): אפשר לבחור בין "כל הכיתה" (קטן) ל"מוגדל" (קריא, נגלל הצידה). מסך רחב: תמיד כל הכיתה
  const box = $("smap"), need = Math.round(R.w * .8), narrow = !!box && box.clientWidth > 0 && box.clientWidth < need, big = narrow && zoom === "big";
  $("szoom").hidden = !narrow;
  for (const b of document.querySelectorAll("#szoom button")) b.setAttribute("aria-pressed", b.dataset.z === (big ? "big" : "fit"));
  $("szhint").hidden = !big;
  fl.style.minWidth = big ? need + "px" : "0";
  fl.style.maxWidth = Math.round(R.w * 1.1) + "px";
  svg.appendChild(el("rect", {x: R.x0, y: R.y0, width: R.w, height: R.h, class: "s-floor"}));
  svg.appendChild(el("path", {d: "M" + R.x1 + " " + R.door.t + "V" + R.y0 + "H" + R.x0 + "V" + R.y1 + "H" + R.x1 + "V" + (R.door.t + R.door.r), class: "s-wall"}));
  for (const l of R.lockers) { svg.appendChild(el("rect", {x: l.x, y: l.y, width: l.w, height: l.h, rx: 3, class: "s-locker"})); svg.appendChild(el("line", {x1: l.x + l.w - 9, y1: l.y + 11, x2: l.x + l.w - 9, y2: l.y + 22, class: "s-handle"})); }
  svg.appendChild(el("text", {x: (R.x0 + R.x1) / 2, y: R.y1 - 50, "text-anchor": "middle", class: "s-label"}, "לוקרים"));
  for (const w of R.wins) { svg.appendChild(el("rect", {x: R.x0 - 8, y: w.y, width: 16, height: w.h, class: "s-win"})); svg.appendChild(el("line", {x1: R.x0, y1: w.y, x2: R.x0, y2: w.y + w.h, class: "s-winl"})); }
  const wy = (R.y0 + R.y1) / 2 + 10;
  svg.appendChild(el("text", {x: R.x0 + 34, y: wy, "text-anchor": "middle", class: "s-wlabel", transform: "rotate(-90 " + (R.x0 + 34) + " " + wy + ")"}, "חלונות"));
  const B = R.board;
  svg.appendChild(el("rect", {x: B.x - 5, y: B.y, width: B.w + 10, height: B.h + 5, rx: 4, class: "s-wood"}));
  svg.appendChild(el("rect", {x: B.x, y: B.y + 5, width: B.w, height: B.h - 5, rx: 2, class: "s-board"}));
  svg.appendChild(el("text", {x: B.x + B.w / 2, y: B.y + B.h / 2 + 4, "text-anchor": "middle", "dominant-baseline": "central", class: "s-btext"}, "הלוח"));
  const D = R.door;
  svg.appendChild(el("path", {d: "M" + R.x1 + " " + (D.t + D.r) + "A" + D.r + " " + D.r + " 0 0 1 " + (R.x1 - D.r) + " " + D.t, class: "s-swing"}));
  svg.appendChild(el("line", {x1: R.x1, y1: D.t, x2: R.x1 - D.r, y2: D.t, class: "s-leaf"}));
  svg.appendChild(el("text", {x: R.x1 - 34, y: D.t + 30, "text-anchor": "middle", class: "s-dlabel"}, "דלת"));
  svg.appendChild(el("text", {x: R.x1 - 34, y: D.t + 49, "text-anchor": "middle", class: "s-dlabel"}, "הכניסה"));
  for (const l of g.labels) svg.appendChild(el("text", {x: l.x, y: l.y, "text-anchor": "middle", class: "s-label"}, l.text));
  for (const c of g.chairs) svg.appendChild(el("rect", {x: c.x, y: c.y, width: c.w, height: c.h, rx: 6, class: "s-chair"}));
  for (const d of g.desks) {
    svg.appendChild(el("rect", {x: d.x, y: d.y, width: d.w, height: d.h, rx: 8, class: "s-desk"}));
    svg.appendChild(d.split === "v" ? el("line", {x1: d.x + 100, y1: d.y + 6, x2: d.x + 100, y2: d.y + d.h - 6, class: "s-split"}) : el("line", {x1: d.x + 6, y1: d.y + 60, x2: d.x + d.w - 6, y2: d.y + 60, class: "s-split"}));
  }
  g.seats.forEach((s, i) => {
    const name = C.seats[i], on = sel && sel.t === "seat" && sel.i === i;
    const grp = el("g", {class: "s-seat" + (on ? " sel" : ""), tabindex: 0, role: "button", "aria-pressed": on, "aria-label": (name || "מקום פנוי") + (on ? " (נבחר)" : "")});
    grp.appendChild(el("rect", {x: s.x + 3, y: s.y + 3, width: 94, height: 54, rx: 6}));
    if (name) {
      const f = fit(dm.get(name) || name), lh = f.size * 1.12, y0 = s.y + 30 - (f.lines.length - 1) * lh / 2;
      f.lines.forEach((ln, j) => grp.appendChild(el("text", {x: s.x + 50, y: y0 + j * lh, "text-anchor": "middle", "dominant-baseline": "central", "font-size": f.size}, ln)));
    } else grp.appendChild(el("text", {x: s.x + 50, y: s.y + 30, "text-anchor": "middle", "dominant-baseline": "central", "font-size": 14, class: "s-empty"}, "פנוי"));
    grp.addEventListener("click", () => clickSeat(i));
    grp.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickSeat(i); } });
    svg.appendChild(grp);
  });
  renderPool(); renderCount(); renderSel();
}
// פס קבוע בתחתית בזמן שמשהו נבחר: מה נבחר, מה עושים עכשיו, הוצאה מהמקום וביטול. בטלפון המפה והרשימה רחוקות זו מזו.
function renderSel() {
  const b = $("ssel"); if (!b) return;
  b.hidden = !sel; if (!sel) return;
  const name = sel.t === "pool" ? sel.name : C.seats[sel.i];
  const what = sel.t === "pool" ? "לוחצים על מקום במפה כדי להושיב" : name ? "לוחצים על מקום אחר כדי להעביר או להחליף" : unseated().length ? "לוחצים על תלמיד מהממתינים כדי להושיב כאן" : "לוחצים על תלמיד במפה כדי להעביר אותו לכאן";
  b.innerHTML = '<i class="fa-solid fa-hand-pointer"></i><div><b>' + esc(name || "מקום פנוי") + "</b><span>" + what + "</span></div>" +
    (sel.t === "seat" && name ? '<button type="button" id="sselout">הוצאה</button>' : "") + '<button type="button" id="sselx" aria-label="ביטול הבחירה"><i class="fa-solid fa-xmark"></i></button>';
  const o = $("sselout"); if (o) o.onclick = () => { C.seats[sel.i] = null; sel = null; changed(); renderPlan(); };
  $("sselx").onclick = () => { sel = null; renderPlan(); };
}
function renderPool() {
  const p = $("spool"); if (!p) return;
  p.textContent = "";
  const u = unseated();
  if (!u.length) { const s = document.createElement("span"); s.className = "hint"; s.textContent = C.students.length ? "כל התלמידים משובצים." : "עדיין אין תלמידים ברשימה."; p.appendChild(s); }
  u.forEach((n, idx) => {
    const on = sel && sel.t === "pool" && sel.idx === idx, b = document.createElement("button");
    b.type = "button"; b.setAttribute("aria-pressed", on); b.textContent = n; b.onclick = () => clickPool(n, idx);
    p.appendChild(b);
  });
}
function renderCount() {
  const cap = capacity(), n = C.students.length, c = $("scap");
  if (c) { c.textContent = cap / 2 + " שולחנות · " + cap + " מקומות · " + n + " תלמידים" + (n > cap ? " · חסרים " + (n - cap) + " מקומות" : ""); c.classList.toggle("bad", n > cap); }
  const k = $("scount"); if (k) k.textContent = n + " תלמידים ברשימה";
}
function clickSeat(i) {
  if (!sel) sel = {t: "seat", i};
  else if (sel.t === "seat") { if (sel.i !== i) { const a = C.seats[sel.i]; C.seats[sel.i] = C.seats[i]; C.seats[i] = a; changed(); } sel = null; }
  else { C.seats[i] = sel.name; sel = null; changed(); }
  renderPlan();
}
function clickPool(name, idx) {
  if (sel && sel.t === "seat" && !C.seats[sel.i]) { C.seats[sel.i] = name; sel = null; changed(); }
  else if (sel && sel.t === "pool" && sel.idx === idx) sel = null;
  else sel = {t: "pool", name, idx};
  renderPlan();
}

// ---- צורת הכיתה ----
function stepper(label, min, max, get, set) {
  const w = document.createElement("div"), l = document.createElement("span"), c = document.createElement("div");
  l.className = "lbl"; l.textContent = label; c.className = "ctl";
  const mk = (txt, aria, d) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.setAttribute("aria-label", label + ": " + aria); b.onclick = () => go(d); return b; };
  const o = document.createElement("output"); o.textContent = get();
  const go = d => { const v = Math.min(max, Math.max(min, get() + d)); if (v !== get()) { set(v); o.textContent = v; shapeChanged(); } };
  c.append(mk("+", "יותר", 1), o, mk("−", "פחות", -1)); w.append(l, c);
  return w;
}
function renderShape() {
  const L = C.layout, box = $("sopts"), pc = $("spercol"); if (!box) return;
  for (const b of document.querySelectorAll("#stype button")) b.setAttribute("aria-pressed", b.dataset.type === L.type);
  box.textContent = ""; pc.textContent = "";
  if (L.type === "cols") {
    box.append(stepper("מספר טורים", 1, 8, () => L.cols, v => { L.cols = v; while (L.perCol.length < v) L.perCol.push(L.rows); renderShape(); }),
      stepper("שולחנות בכל טור", 1, 10, () => L.rows, v => { L.rows = v; L.perCol = L.perCol.map(() => v); renderShape(); }));
    if (L.cols > 1) for (let c = 0; c < L.cols; c++) pc.appendChild(stepper("טור " + (c + 1), 1, 10, () => L.perCol[c], v => { L.perCol[c] = v; }));
  } else if (L.type === "groups") {
    box.append(stepper("מספר קבוצות", 1, 12, () => L.groups, v => { L.groups = v; }),
      stepper("שולחנות בקבוצה", 1, 4, () => L.perGroup, v => { L.perGroup = v; }),
      stepper("קבוצות בשורה", 1, 5, () => L.perRow, v => { L.perRow = v; }));
  } else {
    box.append(stepper("שולחנות בכל צד", 1, 8, () => L.uSide, v => { L.uSide = v; }),
      stepper("שולחנות מאחור", 1, 8, () => L.uBack, v => { L.uBack = v; }));
  }
  pc.hidden = !pc.children.length;
}
function shapeChanged() { sel = null; reflow(); changed(); renderPlan(); }

// ---- רשימת הכיתות ----
function pickerHtml() {
  const l = saved(), opts = [];
  if (!l.some(x => x.id === C.id)) opts.push([C.id, C.example ? EX_NAME : (C.className || "כיתה חדשה") + " (לא נשמרה עדיין)"]);
  for (const x of l) opts.push([x.id, x.className || "כיתה ללא שם"]);
  opts.push(["__new", "＋ כיתה חדשה"]);
  return opts.map(o => '<option value="' + esc(o[0]) + '"' + (o[0] === C.id ? " selected" : "") + ">" + esc(o[1]) + "</option>").join("");
}
function renderPicker() { const p = $("spick"); if (p) p.innerHTML = pickerHtml(); const d = $("sdel"); if (d) d.hidden = !saved().some(x => x.id === C.id); }

// ---- דף להדפסה ----
function loadImg(src) { return new Promise(r => { const i = new Image(); i.onload = () => r(i); i.onerror = () => r(null); i.src = src; }); }
function rr(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
async function buildSheet() {
  try { await Promise.all([document.fonts.load("600 40px Rubik", "אב"), document.fonts.load("700 40px Rubik", "אב")]); } catch (e) {}
  normalizeSeats();
  const g = geometry(C.layout), R = room(g), dm = displayMap(), M = 80;
  const dims = land => { const W = land ? 2480 : 1754, H = land ? 1754 : 2480, f = land ? 1 : .74, head = Math.round(320 * f), top = head + 110; return {W, H, land, f, head, top, k: Math.min((W - 2 * M) / R.w, (H - top - M - 40) / R.h, 3.2)}; };
  const a = dims(true), b = dims(false), P = b.k > a.k * 1.08 ? b : a, {W, H, k, f, head, top} = P;
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  x.fillStyle = "#fffdf7"; x.fillRect(0, 0, W, H); x.direction = "rtl"; x.textBaseline = "middle";
  // פס הכותרת: כחול בית החינוך, פס זהב ודגלונים
  x.fillStyle = "#1d3a6b"; x.fillRect(0, 0, W, head);
  x.fillStyle = "#f2b33d"; x.fillRect(0, head, W, 16 * f);
  const flags = ["#f2b33d", "#cf4b3a", "#2c8a7e", "#2f6fd1"], fw = 62 * f, n = Math.ceil(W / fw);
  for (let i = 0; i < n; i++) { x.fillStyle = flags[i % 4]; x.beginPath(); x.moveTo(i * fw + 4, head + 16 * f); x.lineTo(i * fw + fw - 4, head + 16 * f); x.lineTo(i * fw + fw / 2, head + 16 * f + 50 * f); x.closePath(); x.fill(); }
  let tx = W - M;
  const li = await loadImg("logo.png");
  if (li) { const bs = 236 * f, bx = W - M - bs, by = (head - bs) / 2; x.fillStyle = "#fff"; rr(x, bx, by, bs, bs, 34 * f); x.fill();
    const s = Math.min((bs - 30 * f) / li.width, (bs - 30 * f) / li.height); x.drawImage(li, bx + (bs - li.width * s) / 2, by + (bs - li.height * s) / 2, li.width * s, li.height * s); tx = bx - 44 * f; }
  x.textAlign = "right";
  x.fillStyle = "#f2b33d"; x.font = "600 " + 48 * f + "px " + FAM; x.fillText("בית חינוך ע״ש א.ד. גורדון", tx, head * .27);
  x.fillStyle = "#fff"; x.font = "700 " + 120 * f + "px " + FAM; x.fillText("סידור הישיבה שלנו", tx, head * .63);
  x.textAlign = "left";
  const cls = C.example ? "" : C.className.trim();
  if (cls) { x.font = "700 " + 92 * f + "px " + FAM; const pw = x.measureText(cls).width + 110 * f, ph = 150 * f, py = head * .14;
    x.fillStyle = "#f2b33d"; rr(x, M, py, pw, ph, ph / 2); x.fill(); x.fillStyle = "#141a26"; x.textAlign = "center"; x.fillText(cls, M + pw / 2, py + ph / 2 + 4 * f); x.textAlign = "left"; }
  if (C.teacher.trim()) { x.fillStyle = "#fff"; x.font = "500 " + 44 * f + "px " + FAM; x.fillText("מחנך/ת: " + C.teacher.trim(), M, cls ? head * .8 : head * .5); }
  // החדר
  const ox = (W - R.w * k) / 2 - R.x0 * k, oy = top + Math.max(0, (H - top - M - 40 - R.h * k) / 2) - R.y0 * k, X = v => ox + v * k, Y = v => oy + v * k;
  x.fillStyle = "#fbf6e9"; x.fillRect(X(R.x0), Y(R.y0), R.w * k, R.h * k);
  x.strokeStyle = "#3d4a5c"; x.lineWidth = 11 * k; x.lineCap = "square"; x.lineJoin = "miter";
  x.beginPath(); x.moveTo(X(R.x1), Y(R.door.t)); x.lineTo(X(R.x1), Y(R.y0)); x.lineTo(X(R.x0), Y(R.y0)); x.lineTo(X(R.x0), Y(R.y1)); x.lineTo(X(R.x1), Y(R.y1)); x.lineTo(X(R.x1), Y(R.door.t + R.door.r)); x.stroke();
  for (const l of R.lockers) { x.fillStyle = "#cfd9e6"; x.strokeStyle = "#3d4a5c"; x.lineWidth = 1.6 * k; rr(x, X(l.x), Y(l.y), l.w * k, l.h * k, 3 * k); x.fill(); x.stroke(); x.lineWidth = 2.6 * k; x.lineCap = "round"; x.beginPath(); x.moveTo(X(l.x + l.w - 9), Y(l.y + 11)); x.lineTo(X(l.x + l.w - 9), Y(l.y + 22)); x.stroke(); }
  x.fillStyle = "#566072"; x.textAlign = "center"; x.font = "600 " + 19 * k + "px " + FAM; x.fillText("לוקרים", X((R.x0 + R.x1) / 2), Y(R.y1 - 55));
  for (const w of R.wins) { x.fillStyle = "#a9d3ee"; x.strokeStyle = "#3d4a5c"; x.lineWidth = 1.6 * k; x.lineCap = "butt"; x.fillRect(X(R.x0 - 9), Y(w.y), 18 * k, w.h * k); x.strokeRect(X(R.x0 - 9), Y(w.y), 18 * k, w.h * k); x.beginPath(); x.moveTo(X(R.x0), Y(w.y)); x.lineTo(X(R.x0), Y(w.y + w.h)); x.stroke(); }
  x.save(); x.translate(X(R.x0 + 36), Y((R.y0 + R.y1) / 2 + 10)); x.rotate(-Math.PI / 2); x.textAlign = "center"; x.fillStyle = "#2f6890"; x.font = "600 " + 22 * k + "px " + FAM; x.fillText("חלונות", 0, 0); x.restore();
  const B = R.board;
  x.fillStyle = "#a0622d"; rr(x, X(B.x - 6), Y(B.y), (B.w + 12) * k, (B.h + 6) * k, 4 * k); x.fill();
  x.fillStyle = "#1d3a6b"; rr(x, X(B.x), Y(B.y + 5), B.w * k, (B.h - 5) * k, 2 * k); x.fill();
  x.fillStyle = "#eef3fb"; x.textAlign = "center"; x.font = "600 " + 26 * k + "px " + FAM; x.fillText("ה ל ו ח", X(B.x + B.w / 2), Y(B.y + B.h / 2 + 4));
  const D = R.door;
  x.strokeStyle = "#8c96a3"; x.lineWidth = 1.6 * k; x.lineCap = "butt"; x.setLineDash([6 * k, 6 * k]); x.beginPath(); x.arc(X(R.x1), Y(D.t), D.r * k, Math.PI / 2, Math.PI); x.stroke(); x.setLineDash([]);
  x.strokeStyle = "#a0622d"; x.lineWidth = 8 * k; x.lineCap = "round"; x.beginPath(); x.moveTo(X(R.x1), Y(D.t)); x.lineTo(X(R.x1 - D.r), Y(D.t)); x.stroke();
  x.fillStyle = "#2a3142"; x.textAlign = "center"; x.font = "600 " + 17 * k + "px " + FAM; x.fillText("דלת", X(R.x1 - 34), Y(D.t + 25)); x.fillText("הכניסה", X(R.x1 - 34), Y(D.t + 45));
  // השולחנות
  x.fillStyle = "#566072"; x.font = "600 " + 18 * k + "px " + FAM; for (const l of g.labels) x.fillText(l.text, X(l.x), Y(l.y - 6));
  x.fillStyle = "#8fa9c9"; for (const ch of g.chairs) { rr(x, X(ch.x), Y(ch.y), ch.w * k, ch.h * k, 6 * k); x.fill(); }
  for (const d of g.desks) {
    x.fillStyle = "rgba(60,45,20,.16)"; rr(x, X(d.x + 3), Y(d.y + 4), d.w * k, d.h * k, 9 * k); x.fill();
    x.fillStyle = "#f6e2b6"; x.strokeStyle = "#a67c3d"; x.lineWidth = 2.2 * k; rr(x, X(d.x), Y(d.y), d.w * k, d.h * k, 9 * k); x.fill(); x.stroke();
    x.lineWidth = k; x.lineCap = "butt"; x.setLineDash([5 * k, 5 * k]); x.beginPath();
    if (d.split === "v") { x.moveTo(X(d.x + 100), Y(d.y + 7)); x.lineTo(X(d.x + 100), Y(d.y + d.h - 7)); } else { x.moveTo(X(d.x + 7), Y(d.y + 60)); x.lineTo(X(d.x + d.w - 7), Y(d.y + 60)); }
    x.stroke(); x.setLineDash([]);
  }
  x.fillStyle = "#141a26";
  g.seats.forEach((s, i) => { const nm = C.seats[i]; if (!nm) return; const fi = fit(dm.get(nm) || nm), lh = fi.size * 1.12, y0 = s.y + 31 - (fi.lines.length - 1) * lh / 2;
    x.font = "600 " + (fi.size * k) + "px " + FAM; fi.lines.forEach((ln, j) => x.fillText(ln, X(s.x + 50), Y(y0 + j * lh))); });
  x.fillStyle = "#566072"; x.font = "500 30px " + FAM; x.textAlign = "center"; x.fillText("עודכן בתאריך " + new Date().toLocaleDateString("he-IL"), W / 2, H - 48);
  return {canvas: c, land: P.land};
}
async function download() {
  const st = $("spdfst"); st.textContent = "מכין את הדף…";
  try {
    const {canvas, land} = await buildSheet(), blob = await jpegPdf(canvas, land);
    preview = canvas.toDataURL("image/jpeg", .8);
    const pv = $("sprev"); if (pv) { pv.hidden = false; $("sprevimg").src = preview; }
    const name = "סידור ישיבה" + (C.className && !C.example ? " - " + C.className.replace(/[\\/:*?"<>|]/g, " ") : "") + ".pdf";
    const file = new File([blob], name, {type: "application/pdf"}), size = "דף A4 " + (land ? "לרוחב" : "לאורך");
    // בטלפון: "שיתוף" פותח את תפריט המערכת (שמירה בקבצים, הדפסה, וואטסאפ). צריך לחיצה נפרדת - הדפדפן לא מאפשר לשתף אחרי המתנה
    if (matchMedia("(pointer:coarse)").matches && navigator.canShare && navigator.canShare({files: [file]})) {
      st.innerHTML = '<button type="button" class="btn gold" id="sshare"><i class="fa-solid fa-share-from-square"></i> שמירה, הדפסה או שליחה של הקובץ</button>';
      $("sshare").onclick = () => navigator.share({files: [file], title: name}).catch(() => {});
      return;
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 60000);
    st.textContent = "הקובץ ירד. לפתוח אותו ולהדפיס (" + size + ").";
  } catch (e) { st.textContent = "לא הצלחנו ליצור את הקובץ. אפשר לשמור את התמונה שלמטה ולהדפיס אותה."; }
}

// ---- התלמידים ----
const readNames = () => $("snames").value.split("\n").map(s => s.replace(/\s+/g, " ").trim()).filter(Boolean);
function setNames(list, keepSeats) {
  C.students = list; $("snames").value = list.join("\n");
  if (!keepSeats) fillSeats(list);
  sel = null; renderPlan();
}
function mapNames(fn) { const m = new Map(), list = C.students.map(n => { const v = fn(n); m.set(n, v); return v; }); C.seats = C.seats.map(n => n == null ? null : m.get(n)); setNames(list, true); changed(); }

const card = (n, title, body, open) => open == null
  ? '<section class="card scard"><h3><span class="num">' + n + "</span>" + title + "</h3>" + body + "</section>"
  : '<details class="card scard"' + (open ? " open" : "") + '><summary><h3><span class="num">' + n + "</span>" + title + '</h3><i class="fa-solid fa-chevron-down"></i></summary>' + body + "</details>";
const opt = (v, t, cur) => '<option value="' + v + '"' + (v === cur ? " selected" : "") + ">" + t + "</option>";

export default {
  parent: "tools", tab: "tools", live: true, wide: true,
  title: () => "סידור ישיבה",
  html() {
    startSeating();
    if (S.seating == null) return loading;
    if (!C) init();
    // כיתה שמורה עם תלמידים: צורת הכיתה והרשימה מקופלות, המפה במרכז
    const setup = C.example || !C.students.length;
    return '<p class="lead">מפת הכיתה שלך: מכניסים את רשימת התלמידים, בוחרים איך השולחנות מסודרים, ומזיזים בלחיצה. הכיתות נשמרות אצלך בלבד.</p>' +
      (S.seatErr ? '<div class="err" role="alert">לא הצלחנו לטעון את הכיתות השמורות. לבדוק את האינטרנט ולפתוח שוב.</div>' : "") +
      '<div class="demo" id="sex"' + (C.example ? "" : " hidden") + '>אלה שמות לדוגמה. מעלים רשימה או מקלידים שמות, והם יוחלפו בתלמידים שלך.</div>' +
      card(1, "הכיתה",
        '<div class="srow">' + field("הכיתות שלי", '<select id="spick">' + pickerHtml() + "</select>") +
        '<button type="button" class="btn danger small" id="sdel"' + (saved().some(x => x.id === C.id) ? "" : " hidden") + '><i class="fa-solid fa-trash-can"></i> מחיקה</button></div>' +
        '<div class="two">' + field("שם הכיתה", '<input id="scls" maxlength="40" placeholder="למשל: ד׳ מירי" value="' + esc(C.className) + '">') +
        field("מחנך/ת", '<input id="steach" maxlength="60" value="' + esc(C.teacher) + '">') + "</div>" +
        '<p id="sstate" class="hint' + (status.err ? " bad" : "") + '" aria-live="polite">' + esc(status.t) + "</p>") +
      card(2, "איך הכיתה מסודרת?",
        '<div class="seg" id="stype" role="group" aria-label="צורת הסידור">' + TYPES.map(t => '<button type="button" data-type="' + t[0] + '" aria-pressed="' + (C.layout.type === t[0]) + '">' + t[1] + "</button>").join("") + "</div>" +
        '<div class="stp" id="sopts"></div><div class="stp" id="spercol"></div>' +
        '<p class="hint">בכל שולחן יושבים שני תלמידים.</p><p class="scap" id="scap" aria-live="polite"></p>', setup) +
      card(3, "התלמידים",
        '<div class="srow"><button type="button" class="btn ghost small" id="sfilebtn"><i class="fa-solid fa-file-arrow-up"></i> העלאת רשימה (Word / PDF / Excel)</button>' +
        '<input id="sfile" type="file" accept=".docx,.pdf,.xlsx,.csv,.txt" hidden></div><p id="sfilest" class="hint" aria-live="polite"></p>' +
        field("שם אחד בכל שורה. אפשר לתקן, להוסיף ולמחוק כאן.", '<textarea id="snames" rows="8" spellcheck="false">' + esc(C.students.join("\n")) + "</textarea>") +
        '<div class="srow"><b class="scount" id="scount"></b><button type="button" class="link" id="sfix">האותיות יצאו הפוכות? תיקון</button><button type="button" class="link" id="ssort">מיון לפי א״ב</button></div>' +
        '<div class="two">' + field("איך השמות כתובים ברשימה", '<select id="sorder">' + opt("lf", "שם משפחה ואז שם פרטי", C.nameOrder) + opt("fl", "שם פרטי ואז שם משפחה", C.nameOrder) + "</select>") +
        field("איך השם מופיע על השולחן", '<select id="smode">' + opt("short", "שם פרטי + אות מהמשפחה", C.nameMode) + opt("first", "שם פרטי בלבד", C.nameMode) + opt("full", "שם מלא", C.nameMode) + "</select>") + "</div>", setup) +
      card(4, "מפת הכיתה",
        '<p class="hint">לוחצים על תלמיד ואז על מקום אחר כדי להעביר או להחליף. הדלת בקיר הימני, החלונות משמאל והלוקרים מאחור.</p>' +
        '<div class="seg szoom" id="szoom" role="group" aria-label="גודל המפה" hidden><button type="button" data-z="big">מוגדל</button><button type="button" data-z="fit">כל הכיתה</button></div>' +
        '<p class="hint" id="szhint" hidden><i class="fa-solid fa-arrows-left-right"></i>גוללים הצידה כדי לראות את כל הכיתה.</p>' +
        '<div class="smap" id="smap"><div class="sfloor" id="sfloor"><svg id="splan" role="group" aria-label="מפת הכיתה"></svg></div></div>' +
        '<div class="spool"><span class="lbl">ממתינים לשיבוץ</span><div id="spool"></div></div>' +
        '<div class="srow sacts">' + '<button type="button" class="btn ghost small" id="sord"><i class="fa-solid fa-arrow-down-1-9"></i> שיבוץ לפי הסדר</button>' +
        '<button type="button" class="btn ghost small" id="srand"><i class="fa-solid fa-shuffle"></i> שיבוץ אקראי</button>' +
        '<button type="button" class="btn ghost small" id="sclear"><i class="fa-solid fa-eraser"></i> ריקון המקומות</button></div>' +
        '<button type="button" class="btn" id="spdf"><i class="fa-solid fa-print"></i> הורדת דף להדפסה (PDF)</button><p id="spdfst" class="hint" aria-live="polite"></p>' +
        '<div class="sprev" id="sprev"' + (preview ? "" : " hidden") + '><p class="hint">כך ייראה הדף. אם ההורדה לא נפתחה, לחיצה ארוכה על התמונה שומרת אותה להדפסה.</p><img id="sprevimg" alt="תצוגת הדף להדפסה" src="' + esc(preview) + '"></div>') +
      '<div class="ssel" id="ssel" role="status" hidden></div>';
  },
  bind() {
    if (!$("splan")) return;
    renderShape(); renderPlan();
    for (const b of document.querySelectorAll("#szoom button")) b.onclick = () => { zoom = b.dataset.z; ls("adgSeatZoom", zoom); renderPlan(); };
    // סיבוב הטלפון / שינוי גודל חלון: הרוחב הזמין משתנה
    window.onresize = () => { clearTimeout(rt); rt = setTimeout(() => { if ($("splan")) renderPlan(); }, 200); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => renderPlan());
    $("spick").onchange = e => {
      flush();
      if (e.target.value === "__new") { C = blank(); C.teacher = myFull(); C.className = saved().length ? "" : myHome(); touched = true; }
      else { const d = saved().find(x => x.id === e.target.value); if (d) load(d); }
      setStatus(""); ui.render();
      if (e.target.value === "__new") $("scls").focus();
    };
    $("sdel").onclick = () => {
      if (!confirm("למחוק את הכיתה \"" + (C.className || "ללא שם") + "\"? אי אפשר לבטל.")) return;
      clearTimeout(saveT); saveT = 0;
      const id = C.id;
      delSeating(id).catch(() => alert("המחיקה נכשלה. לבדוק את האינטרנט ולנסות שוב."));
      const rest = saved().filter(x => x.id !== id);
      if (rest.length) load(rest[0]); else { C = blank(); C.teacher = myFull(); C.className = myHome(); }
      touched = true; setStatus("הכיתה נמחקה."); ui.render();
    };
    $("scls").oninput = e => { C.className = e.target.value; changed(); renderPicker(); };
    $("steach").oninput = e => { C.teacher = e.target.value; changed(); };
    for (const b of document.querySelectorAll("#stype button")) b.onclick = () => { C.layout.type = b.dataset.type; renderShape(); shapeChanged(); };
    let nt;
    $("snames").oninput = () => {
      clearTimeout(nt);
      nt = setTimeout(() => {
        C.students = readNames(); unExample();
        normalizeSeats(); for (const n of unseated()) { const i = C.seats.indexOf(null); if (i < 0) break; C.seats[i] = n; }   // שמות חדשים יושבים במקומות הפנויים הראשונים
        sel = null; changed(); renderPlan(); renderPicker();
      }, 350);
    };
    $("sfilebtn").onclick = () => $("sfile").click();
    $("sfile").onchange = async e => {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      const st = $("sfilest"); st.className = "hint"; st.textContent = "קורא את " + f.name + "…";
      try {
        const names = await readNamesFile(f);
        if (!names.length) { st.textContent = /\.pdf$/i.test(f.name) ? "לא נמצא טקסט בקובץ. ייתכן שזה PDF סרוק (תמונה). אפשר להקליד או להדביק את השמות בתיבה." : "לא זוהו שמות בקובץ. אפשר להקליד או להדביק אותם בתיבה."; return; }
        unExample(); setNames(names); changed(); renderPicker();
        st.className = "hint good"; st.textContent = "זוהו " + names.length + " שמות מתוך " + f.name + ". כדאי לעבור על הרשימה ולתקן אם צריך.";
      } catch (err) { st.textContent = err && /[א-ת]/.test(err.message || "") ? err.message : "לא הצלחנו לקרוא את הקובץ. אפשר לשמור אותו מחדש, או להדביק את השמות בתיבה."; }
    };
    $("sfix").onclick = () => mapNames(n => n.split(" ").map(w => [...w].reverse().join("")).join(" "));
    $("ssort").onclick = () => { setNames(C.students.slice().sort((a, b) => a.localeCompare(b, "he")), true); changed(); };
    $("sorder").onchange = e => { C.nameOrder = e.target.value; changed(); renderPlan(); };
    $("smode").onchange = e => { C.nameMode = e.target.value; changed(); renderPlan(); };
    $("sord").onclick = () => { fillSeats(C.students); sel = null; changed(); renderPlan(); };
    $("srand").onclick = () => { const a = C.students.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } fillSeats(a); sel = null; changed(); renderPlan(); };
    $("sclear").onclick = () => { if (!C.seats.some(Boolean) || confirm("לרוקן את כל המקומות? התלמידים יחזרו לרשימת הממתינים.")) { C.seats = C.seats.map(() => null); sel = null; changed(); renderPlan(); } };
    $("spdf").onclick = download;
  },
  // עדכון ברקע (הכיתות נטענו / נשמרו ממכשיר אחר): לא מציירים מחדש את מה שהמשתמש עובד עליו
  update(el) {
    if (!$("splan")) { ui.render(); return; }
    if (!touched && C.example && saved().length) { load(saved()[0]); ui.render(); return; }
    renderPicker();
  }
};
