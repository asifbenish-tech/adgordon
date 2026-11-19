// לוח השינויים: השינויים במערכת, מתוך הנתונים שמערכת השעות (ניהול גורדון, school-gordon) שומרת.
// השרת מעתיק אותם ל-changes/<תאריך> (היום ועד שבועיים קדימה), והמסך מאזין להם חי - כל עדכון מופיע לבד.
// בראש: בחירת יום, הערת היום והנעדרים. אחר כך השינויים שלי, ואז כל השינויים לפי שעה. התמונה (אם נשלחה) = כפתור משני.
import {S} from "../state.js";
import {BELLS} from "../config.js";
import {esc, today, parse, iso, hhmm, DAYN} from "../util.js";
import {watchChanges, myChanges, chgText, watchDaily, canPublish} from "../data.js";
import {loading, empty, secHead, ui} from "../ui.js";

const WHY = {absent: "חסר/ה", event: "מלווה אירוע", borrowed: "בשיעור אחר", vacant: "אין מורה"};
const DAYS_AHEAD = 14;
let onlyMine = false;   // לא נשמר במכשיר: כל כניסה למסך מתחילה מכל השינויים בבית החינוך (נשאר רק במעבר בין ימים)
addEventListener("hashchange", () => { if (!location.hash.startsWith("#/changes")) onlyMine = false; });
const t0 = s => String(s || "").replace(/^0/, "");
const count = c => (c && c.rows || []).length;

// ימי הלימודים מהיום ועד שבועיים קדימה (בלי שבת)
export function chgDays() {
  const out = [], d = parse(today());
  for (let i = 0; i <= DAYS_AHEAD; i++) { const x = new Date(d); x.setDate(d.getDate() + i); if (x.getDay() !== 6) out.push(iso(x)); }
  return out;
}
const dayLabel = d => { const days = chgDays(); return d === days[0] && d === today() ? "היום" : d === days[1] && days[0] === today() ? "מחר" : "יום " + "אבגדהוש"[parse(d).getDay()] + "׳"; };
const dateTitle = d => { const x = parse(d); return (d === today() ? "היום · " : "") + "יום " + DAYN[x.getDay()] + " " + x.getDate() + "." + (x.getMonth() + 1); };

// האם השורה נוגעת לי (אני חסר/ה, אני מחליף/ה, או השיעור שלי בוטל)
const touchesMe = (r, me) => (r.items || []).some(it => it.u === me || (it.sub && it.sub.u === me)) ||
  (r.overrides || []).some(o => o.u === me || (o.sub && o.sub.u === me)) || (!!r.cancel && (r.teachers || []).some(x => x.u === me));

// הכרטיס במסך הבית: אחד, ללוח השינויים של היום שנבחר
export function changesCard(date) {
  watchChanges(date); watchDaily(date);
  const c = S.changes[date], img = S.daily[date], n = count(c), mine = myChanges(date);
  if (!n && !img) return "";
  const sub = n ? n + (n === 1 ? " שינוי" : " שינויים") + " בבית החינוך" + (c.at ? " · עודכן ב-" + hhmm(c.at) : "") : "יש תמונה של מערכת השינויים";
  return '<div class="list"><a class="item chgcard' + (mine.length ? " mine" : "") + '" href="#/changes/' + date + '"><div class="ico ' + (mine.length ? "gold" : "blue") + '"><i class="fa-solid fa-shuffle"></i></div><div><b>לוח שינויים' + (date === today() ? " להיום" : "") + "</b>" +
    (mine.length ? '<span class="minetag"><i class="fa-solid fa-circle-exclamation"></i> ' + (mine.length === 1 ? "יש לך שינוי" : "יש לך " + mine.length + " שינויים") + "</span>" : "") +
    "<span>" + esc(sub) + '</span></div><i class="fa-solid fa-chevron-left go"></i></a></div>';
}

function itemHtml(it, me) {
  const who = it.why === "vacant" || !it.tn ? "שעה בלי מורה" : it.tn;
  const why = it.why === "event" && it.ev ? "מלווה: " + it.ev : WHY[it.why] || "";
  const sub = it.sub && it.sub.name ? '<span class="to"><i class="fa-solid fa-arrow-left"></i> מחליף/ה: ' + esc(it.sub.name) + "</span>" : '<span class="to none"><i class="fa-solid fa-xmark"></i> אין מחליף</span>';
  const mine = it.u === me || (it.sub && it.sub.u === me);
  return '<div class="ci' + (mine ? " mine" : "") + '">' + (mine ? '<span class="me">שלי</span>' : "") + "<b>" + esc(who) + (it.subj ? " · " + esc(it.subj) : "") + "</b>" + (why ? '<span class="why">' + esc(why) + "</span>" : "") + sub + "</div>";
}

function classHtml(r, me) {
  const parts = (r.items || []).map(it => itemHtml(it, me));
  for (const o of r.overrides || []) parts.push(itemHtml({tn: o.tn, u: o.u, subj: o.subj, why: "", sub: o.sub}, me) + (o.note ? '<p class="cnote">' + esc(o.note) + "</p>" : ""));
  if (r.cancel) {
    const mine = (r.teachers || []).some(x => x.u === me);
    parts.push('<div class="ci' + (mine ? " mine" : "") + '">' + (mine ? '<span class="me">שלי</span>' : "") + "<b>" + esc((r.teachers || []).map(x => x.tn).filter(Boolean).join(", ") || "השיעור") +
      '</b><span class="to none"><i class="fa-solid fa-ban"></i> ' + esc(r.cancel === "בוטל" ? "בוטל" : "בוטל · " + r.cancel) + "</span></div>");
  }
  if (r.note) parts.push('<p class="cnote"><i class="fa-regular fa-note-sticky"></i> ' + esc(r.note) + "</p>");
  return '<div class="ccls"><span class="cls">' + esc(r.cls) + "</span>" + parts.join("") + "</div>";
}

function boardHtml(rows, me) {
  const byH = new Map();
  for (const r of rows) { if (!byH.has(r.h)) byH.set(r.h, []); byH.get(r.h).push(r); }
  return '<div class="chg">' + [...byH.entries()].sort((a, b) => a[0] - b[0]).map(([h, rs]) => {
    const b = BELLS[h];
    return '<section class="chour"><h4><span>שעה ' + h + "</span>" + (b ? "<small>" + esc(t0(b[0])) + "–" + esc(t0(b[1])) + "</small>" : "") + "</h4>" + rs.map(r => classHtml(r, me)).join("") + "</section>";
  }).join("") + "</div>";
}

export default {
  parent: "home", tab: "home",
  title: () => "לוח שינויים",
  html(arg) {
    const days = chgDays(), date = arg && /^\d{4}-\d{2}-\d{2}$/.test(arg) ? arg : days[0], me = S.user.uid, only = onlyMine;
    for (const d of days) watchChanges(d);
    watchDaily(date);
    watchChanges(date);   // גם יום שמחוץ לשבועיים (מקישור ישן או מהתראה)
    // בחירת יום
    let h = '<div class="cdays" role="group" aria-label="בחירת יום">' + (days.includes(date) ? days : [date, ...days]).map(d => {
      const c = S.changes[d], n = count(c), mine = n && myChanges(d).length, x = parse(d);
      return '<a href="#/changes/' + d + '" aria-current="' + (d === date ? "true" : "false") + '"' + (mine ? ' class="mine"' : "") + "><b>" + dayLabel(d) + "</b><small>" + x.getDate() + "." + (x.getMonth() + 1) + "</small>" +
        "<i>" + (c === undefined ? "" : n ? (mine ? "★ " : "") + n : "—") + "</i></a>";
    }).join("") + "</div>";
    h += '<h3 class="month">' + esc(dateTitle(date)) + "</h3>";
    const c = S.changes[date], img = S.daily[date];
    if (c === undefined) return h + loading;
    if (c && c.at) h += '<p class="hint">עודכן ב-' + hhmm(c.at) + (iso(new Date(c.at)) !== today() ? " (" + new Date(c.at).getDate() + "." + (new Date(c.at).getMonth() + 1) + ")" : "") + " · מתוך מערכת השעות</p>";
    if (!count(c)) {
      h += empty("אין שינויים במערכת ליום הזה", "שינויים שמוזנים במערכת השעות מופיעים כאן תוך כמה דקות.", "fa-shuffle");
    } else {
      if (c.note) h += '<p class="cnote daynote"><i class="fa-solid fa-circle-info"></i> ' + esc(c.note) + "</p>";
      const abs = (c.absent || []).filter(a => a.tn);
      if (abs.length) h += '<div class="cabsent"><b>נעדרים (' + abs.length + ")</b><ul>" + abs.map(a => "<li" + (a.u === me ? ' class="mine"' : "") + ">" + esc(a.tn) + (a.hours && a.hours.length ? " <small>שעות " + a.hours.join(", ") + "</small>" : "") + "</li>").join("") + "</ul></div>";
      const mine = myChanges(date);
      if (mine.length) h += secHead("השינויים שלי") + '<div class="list">' + mine.map(x =>
        '<div class="item"><div class="ico ' + (x.k === "in" ? "gold" : x.k === "cancel" ? "slate" : "blue") + '"><i class="fa-solid ' + (x.k === "in" ? "fa-person-chalkboard" : x.k === "cancel" ? "fa-ban" : "fa-shuffle") + '"></i></div><div><b>שעה ' + x.h + " · " + esc(x.cls) + "</b><span>" + esc(chgText(x)) + "</span></div></div>").join("") + "</div>";
      h += '<div class="cbar"><h3>כל השינויים</h3><label class="switch"><input type="checkbox" id="conly"' + (only ? " checked" : "") + "><span>רק השינויים שלי</span></label></div>";
      const rows = only ? c.rows.filter(r => touchesMe(r, me)) : c.rows;
      h += rows.length ? boardHtml(rows, me) : empty("אין לך שינויים ביום הזה", "אפשר לכבות את \"רק השינויים שלי\" כדי לראות את כל השינויים.", "fa-circle-check");
    }
    // תמונה = משני
    if (img) h += '<a class="btn ghost cimg" href="#/daily/' + date + '"><i class="fa-solid fa-image"></i> הצג כתמונה</a>';
    else if (canPublish()) h += '<a class="btn ghost cimg" href="#/daily/' + date + '"><i class="fa-solid fa-image"></i> העלאת תמונה של מערכת השינויים</a>';
    return h;
  },
  bind(el) {
    const o = el.querySelector("#conly"); if (o) o.onchange = () => { onlyMine = o.checked; ui.render(); };
    const cur = el.querySelector('.cdays [aria-current="true"]'); if (cur) cur.scrollIntoView({block: "nearest", inline: "center"});
  }
};
