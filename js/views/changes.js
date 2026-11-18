// השינויים במערכת, ישר מאפליקציית ניהול גורדון (school-gordon). השרת מעתיק אותם ל-changes/<תאריך> כל 5 דקות.
// למעלה "השינויים שלי", מתחת כל השינויים בבית החינוך לפי שעה, ובסוף מי חסר היום.
import {S} from "../state.js";
import {esc, today, parse, hhmm, DAYN} from "../util.js";
import {watchChanges, myChanges, chgText, watchDaily} from "../data.js";
import {loading, empty, secHead} from "../ui.js";

const WHY = {absent: "חסר/ה", event: "מלווה אירוע", borrowed: "בשיעור אחר", vacant: "אין מורה"};
const dateTitle = d => { const x = parse(d); return (d === today() ? "היום · " : "") + "יום " + DAYN[x.getDay()] + " " + x.getDate() + "." + (x.getMonth() + 1); };
const count = c => (c.rows || []).length;

// הכרטיס במסך הבית: רק כשיש שינויים ליום שנבחר
export function changesCard(date) {
  const c = S.changes[date];
  if (!c || !count(c)) return "";
  const mine = myChanges(date);
  return '<a class="item chgcard' + (mine.length ? " mine" : "") + '" href="#/changes/' + date + '"><div class="ico ' + (mine.length ? "gold" : "blue") + '"><i class="fa-solid fa-shuffle"></i></div><div><b>שינויים במערכת' + (date === today() ? " היום" : "") + "</b>" +
    (mine.length ? '<span class="minetag"><i class="fa-solid fa-circle-exclamation"></i> ' + (mine.length === 1 ? "שינוי אחד שלך" : mine.length + " שינויים שלך") + "</span>" : "") +
    "<span>" + count(c) + " שינויים בבית החינוך" + (c.at ? " · עודכן ב-" + hhmm(c.at) : "") + '</span></div><i class="fa-solid fa-chevron-left go"></i></a>';
}

function itemHtml(it, me) {
  const who = it.t === "" && !it.tn ? "שעה בלי מורה" : it.tn || "";
  const why = it.why === "event" && it.ev ? "מלווה: " + it.ev : WHY[it.why] || "";
  const sub = it.sub ? '<span class="to"><i class="fa-solid fa-arrow-left"></i> ' + esc(it.sub.name) + "</span>" : '<span class="to none">אין מחליף</span>';
  const mine = it.u === me || (it.sub && it.sub.u === me);
  return '<div class="ci' + (mine ? " mine" : "") + '"><b>' + esc(who) + (it.subj ? " · " + esc(it.subj) : "") + "</b>" + (why ? '<span class="why">' + esc(why) + "</span>" : "") + sub + "</div>";
}

function rowHtml(r, me) {
  const parts = (r.items || []).map(it => itemHtml(it, me));
  for (const o of r.overrides || []) parts.push(itemHtml({tn: o.tn, u: o.u, subj: o.subj, why: "", sub: o.sub}, me) + (o.note ? '<p class="cnote">' + esc(o.note) + "</p>" : ""));
  if (r.cancel) parts.push('<div class="ci' + ((r.teachers || []).some(t => t.u === me) ? " mine" : "") + '"><b>' + esc((r.teachers || []).map(t => t.tn).filter(Boolean).join(", ") || "השיעור") + '</b><span class="to none">' + esc(r.cancel === "בוטל" ? "בוטל" : "בוטל · " + r.cancel) + "</span></div>");
  if (r.note) parts.push('<p class="cnote"><i class="fa-regular fa-note-sticky"></i> ' + esc(r.note) + "</p>");
  return '<li><div class="ch"><small>שעה</small><b>' + r.h + '</b></div><div class="cw"><span class="cls">' + esc(r.cls) + "</span>" + parts.join("") + "</div></li>";
}

export default {
  parent: "home", tab: "home",
  title: () => "השינויים במערכת",
  html(arg) {
    const date = arg || today(), me = S.user.uid;
    watchChanges(date); watchDaily(date);
    const c = S.changes[date];
    let h = '<h3 class="month">' + esc(dateTitle(date)) + "</h3>";
    if (c === undefined) return h + loading;
    if (!c || !count(c)) h += empty("אין שינויים במערכת ליום הזה", "שינויים שמוזנים בניהול גורדון מופיעים כאן תוך כמה דקות.", "fa-shuffle");
    else {
      if (c.note) h += '<p class="cnote daynote"><i class="fa-solid fa-circle-info"></i> ' + esc(c.note) + "</p>";
      const mine = myChanges(date);
      if (mine.length) h += secHead("השינויים שלי") + '<div class="list">' + mine.map(x =>
        '<div class="item"><div class="ico ' + (x.k === "in" ? "gold" : x.k === "cancel" ? "slate" : "blue") + '"><i class="fa-solid ' + (x.k === "in" ? "fa-person-chalkboard" : x.k === "cancel" ? "fa-ban" : "fa-shuffle") + '"></i></div><div><b>שעה ' + x.h + " · " + esc(x.cls) + "</b><span>" + esc(chgText(x)) + "</span></div></div>").join("") + "</div>";
      h += secHead("כל השינויים") + '<ul class="chg">' + c.rows.map(r => rowHtml(r, me)).join("") + "</ul>";
      const abs = (c.absent || []).filter(a => a.tn);
      if (abs.length) h += secHead("חסרים היום") + '<p class="absent">' + abs.map(a => esc(a.tn) + (a.hours && a.hours.length ? " (שעות " + a.hours.join(", ") + ")" : "")).join(" · ") + "</p>";
      if (c.at) h += '<p class="hint center">מתוך ניהול גורדון · עודכן ב-' + hhmm(c.at) + "</p>";
    }
    if (S.daily[date]) h += '<div class="list"><a class="item" href="#/daily/' + date + '"><div class="ico slate"><i class="fa-solid fa-image"></i></div><div><b>תמונת מערכת השינויים</b><span>כפי שההנהלה העלתה</span></div><i class="fa-solid fa-chevron-left go"></i></a></div>';
    return h;
  },
  bind() {}
};
