// סידור ישיבה: החדר שמסביב לשולחנות. לוח, דלת, לוקרים וחלונות צמודים לקיר (קיר + מיקום לאורכו),
// ורהיטים (שולחן מורה, ארון, כיור...) עומדים בכל מקום בחדר. הכול נשמר ב-room של הכיתה:
//   {space: {t, b, l, r}, items: [{id, type, wall?, at?, len?, fx?, fy?, rot?, name?}]}
//   wall = t/b/l/r (קדמי/אחורי/שמאל/ימין במפה), at = מרכז הפריט לאורך הקיר (0..1), len = אורך יחסי לקיר
//   fx/fy = מרכז הרהיט כחלק מרוחב/גובה החדר; space = עוד מקום פנוי בכל צד (ביחידות של 60)
// הציור הוא "סצנה": רשימת צורות אחת שמצוירת גם במסך (SVG) וגם בדף ההדפסה (canvas), כך שהדף זהה למסך.

export const WALLED = {board: "לוח", door: "דלת", lockers: "לוקרים", windows: "חלונות"};
// סוג: [שם, רוחב, גובה, צבע, שטוח (מצויר מתחת לשולחנות)]
export const FREE = {
  tdesk: ["שולחן מורה", 170, 70, "wood"], cabinet: ["ארון", 140, 50, "wood"], shelf: ["מדף ספרים", 160, 40, "wood"],
  sink: ["כיור", 70, 60, "blue"], computer: ["מחשב", 80, 60, "gray"], ac: ["מזגן", 110, 30, "blue"],
  corner: ["פינת קריאה", 180, 140, "green", true], rug: ["שטיח", 200, 140, "green", true],
  pillar: ["עמוד", 50, 50, "gray"], trash: ["פח", 45, 45, "gray"], other: ["אחר", 120, 60, "gray"]
};
export const ADD = ["tdesk", "cabinet", "shelf", "sink", "computer", "ac", "corner", "rug", "pillar", "trash", "other", "board", "door", "lockers", "windows"];
export const LONG = ["board", "lockers", "windows"];   // אפשר לקצר ולהאריך
export const SIDES = [["t", "מקדימה"], ["b", "מאחור"], ["r", "מימין"], ["l", "משמאל"]];
const DOOR = 85, U = 60;
const NEW = {board: {wall: "t", at: .5, len: .4}, door: {wall: "b", at: .1}, lockers: {wall: "b", at: .5, len: .6}, windows: {wall: "l", at: .5, len: .6}};

export const label = it => it.type === "other" ? (it.name || "אחר") : WALLED[it.type] || FREE[it.type][0];
export const defRoom = () => ({space: {t: 0, b: 0, l: 0, r: 0}, items: [
  {id: "board", type: "board", wall: "t", at: .5, len: .5}, {id: "door", type: "door", wall: "r", at: .12},
  {id: "lockers", type: "lockers", wall: "b", at: .5, len: .86}, {id: "windows", type: "windows", wall: "l", at: .5, len: .86}]});
// כיתה שנשמרה לפני שהיה אפשר לערוך את החדר, או נתונים פגומים: חדר ברירת המחדל
export function fixRoom(r) {
  if (!r || !Array.isArray(r.items)) return defRoom();
  return {space: Object.assign({t: 0, b: 0, l: 0, r: 0}, r.space), items: r.items.filter(it => it && (WALLED[it.type] || FREE[it.type]))};
}
export function newItem(type, id) {
  return FREE[type] ? {id, type, fx: .5, fy: .5} : Object.assign({id, type}, NEW[type]);
}

// גבולות החדר: השולחנות + שוליים (מקום ללוח, ללוקרים ולדלת) + המקום הנוסף שהמשתמש ביקש
export function room(g, sp) {
  sp = sp || {};
  let padL = 100 + (sp.l || 0) * U, padR = 100 + (sp.r || 0) * U; const padT = 125 + (sp.t || 0) * U, padB = 105 + (sp.b || 0) * U;
  let rw = g.w + padL + padR;
  if (rw < 660) { const e = (660 - rw) / 2; padL += e; padR += e; rw = 660; }
  return {x0: -padL, y0: -padT, x1: g.w + padR, y1: g.h + padB, w: rw, h: g.h + padT + padB};
}
// קיר: נקודת התחלה, כיוון לאורכו, כיוון פנימה לחדר, ואורך
function wallOf(R, w) {
  if (w === "t") return {p: [R.x0, R.y0], u: [1, 0], n: [0, 1], L: R.w};
  if (w === "b") return {p: [R.x0, R.y1], u: [1, 0], n: [0, -1], L: R.w};
  if (w === "l") return {p: [R.x0, R.y0], u: [0, 1], n: [1, 0], L: R.h};
  return {p: [R.x1, R.y0], u: [0, 1], n: [-1, 0], L: R.h};
}
const lenOf = (W, it) => it.type === "door" ? DOOR : Math.max(.1, Math.min(.95, it.len || .5)) * W.L;
function clampAt(W, it, at) { const m = (lenOf(W, it) / 2 + 14) / W.L; return m >= .5 ? .5 : Math.min(1 - m, Math.max(m, at)); }
function span(W, it) { const len = lenOf(W, it), c = clampAt(W, it, it.at == null ? .5 : it.at) * W.L; return [c - len / 2, c + len / 2]; }
const pt = (W, a, n) => [W.p[0] + W.u[0] * a + W.n[0] * n, W.p[1] + W.u[1] * a + W.n[1] * n];
function box(W, a, b, n1, n2) { const p = pt(W, a, n1), q = pt(W, b, n2); return {x: Math.min(p[0], q[0]), y: Math.min(p[1], q[1]), w: Math.abs(q[0] - p[0]), h: Math.abs(q[1] - p[1])}; }
const rotFor = w => w === "l" ? -90 : w === "r" ? 90 : 0;
const R2 = (b, c, rx) => Object.assign({t: "rect", c}, b, rx ? {rx} : {});
const T = (p, s, c, sz, rot) => ({t: "text", x: p[0], y: p[1], s, c, sz, rot: rot || 0});
export const dims = it => { const f = FREE[it.type]; return it.rot ? [f[2], f[1]] : [f[1], f[2]]; };
export const center = (R, it) => [R.x0 + (it.fx == null ? .5 : it.fx) * R.w, R.y0 + (it.fy == null ? .5 : it.fy) * R.h];

// הזזה לנקודה במפה: רהיט - לשם (בתוך החדר); פריט קיר - לקיר הקרוב ביותר
export function moveItem(R, it, x, y) {
  if (FREE[it.type]) {
    const [w, h] = dims(it), cl = (v, lo, hi) => lo >= hi ? .5 : Math.min(hi, Math.max(lo, v));
    it.fx = cl((x - R.x0) / R.w, (w / 2 + 8) / R.w, 1 - (w / 2 + 8) / R.w);
    it.fy = cl((y - R.y0) / R.h, (h / 2 + 8) / R.h, 1 - (h / 2 + 8) / R.h);
    return;
  }
  const d = {t: y - R.y0, b: R.y1 - y, l: x - R.x0, r: R.x1 - x}, w = Object.keys(d).reduce((a, b) => d[a] <= d[b] ? a : b), W = wallOf(R, w);
  it.wall = w; it.at = clampAt(W, it, ((w === "t" || w === "b") ? x - R.x0 : y - R.y0) / W.L);
}

// ---- הסצנה ----
function itemPrims(R, it) {
  if (FREE[it.type]) {
    const [w, h] = dims(it), [cx, cy] = center(R, it), f = FREE[it.type], name = label(it), x = cx - w / 2, y = cy - h / 2;
    const fits = (len, sz) => [...name].length * sz * .56 <= len;
    let sz = 17, rot = 0;
    while (sz > 10 && !fits(w - 10, sz)) sz--;
    if (!fits(w - 10, sz) && h > w) { rot = -90; sz = 17; while (sz > 10 && !fits(h - 10, sz)) sz--; }
    return {prims: [R2({x, y, w, h}, "s-it " + f[3], 8), T([cx, cy], name, "s-itext", sz, rot)], hit: {x: x - 5, y: y - 5, w: w + 10, h: h + 10}};
  }
  const W = wallOf(R, it.wall || "t"), [a, b] = span(W, it), mid = (a + b) / 2, rot = rotFor(it.wall), P = [];
  if (it.type === "board") {
    P.push(R2(box(W, a - 5, b + 5, 5, 54), "s-wood", 4), R2(box(W, a, b, 10, 49), "s-board", 2), T(pt(W, mid, 30), "הלוח", "s-btext", 24, rot));
    return {prims: P, hit: box(W, a - 8, b + 8, 0, 60)};
  }
  if (it.type === "door") {
    const h = pt(W, a, 0), p1 = pt(W, b, 0), leaf = pt(W, a, DOOR), sweep = W.u[0] * W.n[1] - W.u[1] * W.n[0] > 0 ? 1 : 0, c = pt(W, mid, 46);
    P.push({t: "path", d: "M" + p1[0] + " " + p1[1] + "A" + DOOR + " " + DOOR + " 0 0 " + sweep + " " + leaf[0] + " " + leaf[1], c: "s-swing"},
      {t: "line", x1: h[0], y1: h[1], x2: leaf[0], y2: leaf[1], c: "s-leaf"},
      T([c[0], c[1] - 9], "דלת", "s-dlabel", 16), T([c[0], c[1] + 10], "הכניסה", "s-dlabel", 16));
    return {prims: P, hit: box(W, a - 4, b + 4, -6, DOOR + 6)};
  }
  if (it.type === "lockers") {
    const m = Math.max(2, Math.round((b - a) / 48)), lw = (b - a) / m;
    for (let i = 0; i < m; i++) {
      const s = a + i * lw, h1 = pt(W, s + lw - 9, 17), h2 = pt(W, s + lw - 9, 28);
      P.push(R2(box(W, s, s + lw, 6, 39), "s-locker", 3), {t: "line", x1: h1[0], y1: h1[1], x2: h2[0], y2: h2[1], c: "s-handle"});
    }
    P.push(T(pt(W, mid, 56), "לוקרים", "s-label", 17, rot));
    return {prims: P, hit: box(W, a - 4, b + 4, 0, 68)};
  }
  // windows
  const m = Math.max(1, Math.round((b - a) / 200)), wl = ((b - a) - (m - 1) * 28) / m;
  for (let i = 0; i < m; i++) { const s = a + i * (wl + 28), p = pt(W, s, 0), q = pt(W, s + wl, 0); P.push(R2(box(W, s, s + wl, -8, 8), "s-win"), {t: "line", x1: p[0], y1: p[1], x2: q[0], y2: q[1], c: "s-winl"}); }
  P.push(T(pt(W, mid, 34), "חלונות", "s-wlabel", 19, rot));
  return {prims: P, hit: box(W, a - 4, b + 4, -12, 48)};
}
// שכבות לפי סדר הציור: under (רצפה, קירות, רהיטים שטוחים) -> [שולחנות] -> over (שאר הרהיטים ופריטי הקיר)
export function scene(R, items) {
  const floor = [R2({x: R.x0, y: R.y0, w: R.w, h: R.h}, "s-floor")];
  for (const w of ["t", "r", "b", "l"]) {   // הקירות, עם פתח בכל דלת
    const W = wallOf(R, w), gaps = items.filter(it => it.type === "door" && (it.wall || "t") === w).map(it => span(W, it)).sort((x, y) => x[0] - y[0]);
    let s = 0;
    const seg = (a, b) => { if (b - a > 1) { const p = pt(W, a, 0), q = pt(W, b, 0); floor.push({t: "line", x1: p[0], y1: p[1], x2: q[0], y2: q[1], c: "s-wall"}); } };
    for (const [a, b] of gaps) { seg(s, a); s = Math.max(s, b); }
    seg(s, W.L);
  }
  const under = [{prims: floor}], over = [], layer = it => Object.assign({id: it.id}, itemPrims(R, it));
  for (const it of items) if (FREE[it.type] && FREE[it.type][4]) under.push(layer(it));
  for (const it of items) if (FREE[it.type] && !FREE[it.type][4]) over.push(layer(it));
  for (const t of ["windows", "lockers", "board", "door"]) for (const it of items) if (it.type === t) over.push(layer(it));
  return {under, over};
}

// ---- ציור הסצנה ----
const NS = "http://www.w3.org/2000/svg";
export function svgEl(tag, attrs, text) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text != null) e.textContent = text; return e; }
function svgPrim(p) {
  if (p.t === "rect") return svgEl("rect", Object.assign({x: p.x, y: p.y, width: p.w, height: p.h, class: p.c}, p.rx ? {rx: p.rx} : {}));
  if (p.t === "line") return svgEl("line", {x1: p.x1, y1: p.y1, x2: p.x2, y2: p.y2, class: p.c});
  if (p.t === "path") return svgEl("path", {d: p.d, class: p.c});
  const a = {x: p.x, y: p.y, "text-anchor": "middle", "dominant-baseline": "central", "font-size": p.sz, class: p.c};
  if (p.rot) a.transform = "rotate(" + p.rot + " " + p.x + " " + p.y + ")";
  return svgEl("text", a, p.s);
}
// פריט עם id = קבוצה שאפשר לבחור ולגרור (במצב "עריכת החדר"), עם מלבן לחיצה שקוף מעליה
export function toSvg(parent, layers, on) {
  for (const L of layers) {
    const g = L.id ? svgEl("g", {class: "s-obj" + (L.id === on ? " on" : ""), "data-id": L.id}) : parent;
    for (const p of L.prims) g.appendChild(svgPrim(p));
    if (L.id) { g.appendChild(svgEl("rect", {x: L.hit.x, y: L.hit.y, width: L.hit.w, height: L.hit.h, rx: 8, class: "s-hit"})); parent.appendChild(g); }
  }
}
// הצבעים בדף ההדפסה (תמיד בהיר)
const PAL = {
  "s-floor": {f: "#fbf6e9"}, "s-wall": {s: "#3d4a5c", w: 11, cap: "square"}, "s-win": {f: "#a9d3ee", s: "#3d4a5c", w: 1.6}, "s-winl": {s: "#3d4a5c", w: 1},
  "s-wlabel": {f: "#2f6890", wt: 600}, "s-wood": {f: "#a0622d"}, "s-board": {f: "#1d3a6b"}, "s-btext": {f: "#eef3fb", wt: 600},
  "s-leaf": {s: "#a0622d", w: 8, cap: "round"}, "s-swing": {s: "#8c96a3", w: 1.6, dash: [6, 6]}, "s-dlabel": {f: "#2a3142", wt: 600}, "s-label": {f: "#566072", wt: 600},
  "s-chair": {f: "#8fa9c9"}, "s-locker": {f: "#cfd9e6", s: "#3d4a5c", w: 1.6}, "s-handle": {s: "#3d4a5c", w: 2.6, cap: "round"},
  "s-desk": {f: "#f6e2b6", s: "#a67c3d", w: 2.2, shadow: true}, "s-split": {s: "#a67c3d", w: 1, dash: [5, 5]},
  "s-it wood": {f: "#ead6b3", s: "#8a6a3b", w: 2}, "s-it blue": {f: "#d3e6f5", s: "#4a7aa3", w: 2}, "s-it gray": {f: "#e1e5ec", s: "#5b6880", w: 2},
  "s-it green": {f: "#dcefdc", s: "#4f8a55", w: 2, dash: [8, 6]}, "s-itext": {f: "#2a3142", wt: 600}
};
function rr(x, a, b, w, h, r) { r = Math.min(r, w / 2, h / 2); x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
export function toCanvas(x, layers, X, Y, k, fam) {
  for (const L of layers) for (const p of L.prims) {
    const st = PAL[p.c]; if (!st) continue;
    x.setLineDash(st.dash ? st.dash.map(v => v * k) : []); x.lineCap = st.cap || "butt"; x.lineWidth = (st.w || 1) * k;
    if (p.t === "rect") {
      if (st.shadow) { x.fillStyle = "rgba(60,45,20,.16)"; rr(x, X(p.x + 3), Y(p.y + 4), p.w * k, p.h * k, (p.rx || 0) * k); x.fill(); }
      rr(x, X(p.x), Y(p.y), p.w * k, p.h * k, (p.rx || 0) * k);
      if (st.f) { x.fillStyle = st.f; x.fill(); }
      if (st.s) { x.strokeStyle = st.s; x.stroke(); }
    } else if (p.t === "line") { x.strokeStyle = st.s; x.beginPath(); x.moveTo(X(p.x1), Y(p.y1)); x.lineTo(X(p.x2), Y(p.y2)); x.stroke(); }
    else if (p.t === "path") { x.save(); x.translate(X(0), Y(0)); x.scale(k, k); x.lineWidth = st.w || 1; x.setLineDash(st.dash || []); x.strokeStyle = st.s; x.stroke(new Path2D(p.d)); x.restore(); }
    else { x.save(); x.translate(X(p.x), Y(p.y)); if (p.rot) x.rotate(p.rot * Math.PI / 180); x.fillStyle = st.f; x.font = (st.wt || 600) + " " + p.sz * k + "px " + fam; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(p.s, 0, 0); x.restore(); }
  }
  x.setLineDash([]);
}
