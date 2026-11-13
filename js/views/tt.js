// המערכת שלי - מתוך timetable.json של לוח המערכות (קריאה בלבד).
import {S} from "../state.js";
import {BOARD_URL} from "../config.js";
import {$, esc, fmtDate, heSort} from "../util.js";
import {isAdmin, fullName} from "../data.js";
import {empty, loading, ui} from "../ui.js";

const SIDES = {"יסודי": "#2f8f83", "חטיבה": "#1c3557", 'תל"ן': "#b9801f", "מגמות": "#a8432a", "סדירות": "#5f6f2e"};
let day = null, who = null;

export const todayIdx = () => new Date().getDay();   // 0 = ראשון, כמו ב-timetable.json
// השעות של היום, מהראשונה עד האחרונה; שעה בלי כלום באמצע = חלון פנוי.
export function slots(name, d) {
  const ev = ((S.T && S.T.teachers[name]) || []).filter(e => e[1] === d);
  if (!ev.length) return [];
  const hs = ev.map(e => e[2]), out = [];
  for (let h = Math.min(...hs); h <= Math.max(...hs); h++) out.push({h, ev: ev.filter(e => e[2] === h)});
  return out;
}
export const slotHtml = s => s.ev.length
  ? '<div class="slot"><div class="hour"><small>שעה</small><b>' + s.h + '</b></div><div class="what">' + s.ev.map(e =>
      "<div><b>" + esc(e[3]) + '</b> <span class="tag" style="--t:' + (SIDES[e[0]] || "#475569") + '">' + esc(e[0] === "סדירות" ? "פגישה" : e[0]) + "</span></div>").join("") + "</div></div>"
  : '<div class="slot free"><div class="hour"><small>שעה</small><b>' + s.h + '</b></div><div class="what"><b>פנוי</b></div></div>';

export default {
  parent: "me", tab: "",
  title: () => "המערכת שלי",
  html() {
    const T = S.T;
    if (!T) return loading;
    if (day == null) { const t = todayIdx(); day = t >= T.days.length ? 0 : t; }
    const me = who || S.user.name, list = slots(me, day);
    let h = "";
    if (isAdmin()) h += '<label class="field"><span>הצגת המערכת של</span><select id="ttwho"><option value="">המערכת שלי</option>' +
      Object.keys(T.teachers).sort(heSort).map(n => '<option value="' + esc(n) + '"' + (n === who ? " selected" : "") + ">" + esc(fullName(n)) + "</option>").join("") + "</select></label>";
    h += '<div class="seg days" role="group" aria-label="בחירת יום">' + T.days.map((d, i) =>
      '<button type="button" data-d="' + i + '" aria-pressed="' + (i === day) + '"' + (i === todayIdx() ? ' class="today"' : "") + ">" + esc(d) + "</button>").join("") + "</div>";
    h += list.length ? '<div class="list">' + list.map(slotHtml).join("") + "</div>"
      : empty(T.teachers[me] ? "אין שיעורים ביום " + esc(T.days[day]) : "לא נמצאה מערכת שעות על השם " + esc(me), T.teachers[me] ? "" : "מי שלא מלמד/ת לא מופיע/ה במערכת השעות.");
    return h + '<p class="hint">המערכת מעודכנת ל-' + esc(fmtDate(T.g)) + ' · <a href="' + BOARD_URL + '" target="_blank" rel="noopener">ללוח המערכות המלא</a></p>';
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-d]")) b.onclick = () => { day = +b.dataset.d; ui.render(); };
    const sel = $("ttwho"); if (sel) sel.onchange = () => { who = sel.value || null; ui.render(); };
  }
};
