// לוח אירועים והערכות. המקור: גיליון Google של בית החינוך (נקרא חי), ועוד אירועים שההנהלה מוסיפה כאן.
import {S} from "../state.js";
import {EVENTS_VIEW} from "../config.js";
import {$, esc, parse, today, DAYN, MONTHS} from "../util.js";
import {isAdmin, allDays} from "../data.js";
import {put, del} from "../store.js";
import {loading, empty, field, ui, tryDo} from "../ui.js";

let show = "all", month = "";   // month: "" = מהיום והלאה, או "2026-12" = חודש שלם (כולל ימים שעברו)
const ICON = {vac: "fa-umbrella-beach", trip: "fa-person-hiking", event: "fa-star", test: "fa-file-pen", quiz: "fa-pen", work: "fa-book"};
const LABEL = {test: "מבחן", quiz: "בוחן", work: "עבודה"};

const line = (a, plain) => '<li class="k-' + a.k + '"><i class="fa-solid ' + ICON[a.k] + '"></i><span>' + esc(a.t) + "</span>" +
  (a.id && isAdmin() && !plain ? '<button type="button" class="del" data-del="' + esc(a.id) + '" aria-label="מחיקה"><i class="fa-solid fa-trash-can"></i></button>' : "") + "</li>";
const testLine = t => '<li class="k-' + t.k + '"><i class="fa-solid ' + ICON[t.k] + '"></i><span><b>' + esc(t.cls) + "</b> " + esc(t.t) + "</span></li>";

// כרטיס של יום אחד. opt: {plain: בלי מחיקה, acts/tests: מה להציג}
export function dayCard(d, opt = {}) {
  const dt = parse(d.date), acts = opt.tests === "only" ? [] : d.acts, tests = opt.acts === "only" ? [] : d.tests;
  if (!acts.length && !tests.length && !(d.note && opt.tests !== "only")) return "";
  return '<div class="day' + (d.date === today() ? " today" : "") + (acts.some(a => a.k === "vac") ? " vac" : "") + '"><div class="date"><b>' + dt.getDate() + "</b><small>" + DAYN[dt.getDay()] + "</small></div><ul>" +
    acts.map(a => line(a, opt.plain)).join("") + (d.note && opt.tests !== "only" ? '<li class="note"><i class="fa-solid fa-circle-info"></i><span>' + esc(d.note) + "</span></li>" : "") + tests.map(testLine).join("") + "</ul></div>";
}

export default {
  title: () => "אירועים והערכות",
  html() {
    if (S.sheet == null || S.events == null) return loading;
    const all = allDays(), opt = show === "ev" ? {acts: "only"} : show === "as" ? {tests: "only"} : {};
    const months = [...new Set(all.map(d => d.date.slice(0, 7)))], name = k => MONTHS[+k.slice(5) - 1] + (k.slice(0, 4) !== today().slice(0, 4) ? " " + k.slice(0, 4) : "");
    if (month && !months.includes(month)) month = "";
    const days = month ? all.filter(d => d.date.startsWith(month)) : all.filter(d => d.date >= today());
    let h = '<div class="seg" role="group" aria-label="תצוגה"><button type="button" data-show="all" aria-pressed="' + (show === "all") + '">הכול</button><button type="button" data-show="ev" aria-pressed="' + (show === "ev") + '">אירועים</button><button type="button" data-show="as" aria-pressed="' + (show === "as") + '">הערכות</button></div>';
    h += '<div class="chips" id="mchips" role="group" aria-label="בחירת חודש">' + [["", "הקרוב"], ...months.map(k => [k, name(k)])].map(x => '<button type="button" data-month="' + x[0] + '" aria-pressed="' + (x[0] === month) + '">' + x[1] + "</button>").join("") + "</div>";
    if (S.sheet.err) h += '<div class="err" role="alert">לא הצלחנו לקרוא את לוח האירועים מהגיליון' + (S.sheet.days.length ? ". מוצג העותק האחרון שנשמר במכשיר." : ". לבדוק את האינטרנט ולפתוח שוב.") + "</div>";
    let m = "", body = "";
    for (const d of days) {
      const card = dayCard(d, opt); if (!card) continue;
      const dt = parse(d.date), k = MONTHS[dt.getMonth()] + " " + dt.getFullYear();
      if (k !== m) { body += '<h3 class="month">' + k + "</h3>"; m = k; }
      body += card;
    }
    h += body || empty(month ? "אין " + (show === "as" ? "הערכות" : "אירועים") + " בחודש הזה" : show === "as" ? "אין הערכות קרובות" : "אין אירועים קרובים");
    if (isAdmin()) h += '<details class="add"><summary><i class="fa-solid fa-plus"></i> הוספת אירוע מהאפליקציה</summary><form id="eform">' +
      field("שם האירוע", '<input name="title" required maxlength="80">') +
      '<div class="two">' + field("תאריך", '<input name="date" type="date" required min="' + today() + '">') + field("שעה (לא חובה)", '<input name="time" type="time">') + "</div>" +
      field("מקום (לא חובה)", '<input name="place" maxlength="60">') + field("הערה (לא חובה)", '<input name="note" maxlength="120">') +
      '<p class="hint">אירוע שנוסף כאן מופיע רק באפליקציה. את הלוח הקבוע עורכים בגיליון.</p><button class="btn">הוספה ללוח</button></form></details>';
    return h + '<p class="hint">הלוח נקרא מהגיליון "לוח אירועים והערכות" בכל פתיחה · <a href="' + EVENTS_VIEW + '" target="_blank" rel="noopener">לגיליון</a></p>';
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-show]")) b.onclick = () => { show = b.dataset.show; ui.render(); };
    for (const b of el.querySelectorAll("[data-month]")) b.onclick = () => { month = b.dataset.month; ui.render(); };
    const cur = el.querySelector('#mchips [aria-pressed="true"]'); if (cur) cur.scrollIntoView({block: "nearest", inline: "center"});   // החודש שנבחר נשאר גלוי בשורת החודשים
    for (const b of el.querySelectorAll("[data-del]")) b.onclick = () => confirm("למחוק את האירוע?") && tryDo(() => del("events", b.dataset.del));
    const f = $("eform"); if (f) f.onsubmit = async e => {
      e.preventDefault();
      const o = {}; for (const [k, v] of new FormData(f)) o[k] = String(v).trim();
      if (await tryDo(() => put("events", null, o))) ui.render();
    };
  }
};
