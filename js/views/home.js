// מסך הבית - "היום שלי": רצועת השבוע, ומתחתיה כל היום בציר אחד לפי שעון:
// השיעורים (מערכת השעות + לוח הצלצולים), השמירה (עם "הגעתי"), ואירועי בית החינוך (מלוח האירועים).
// מבנה "נקי ומוכר": שורות מקובצות, טקסט גדול, פעולה אחת בולטת.
import {S} from "../state.js";
import {BELLS} from "../config.js";
import {$, esc, iso, today, parse, DAYN} from "../util.js";
import {isAdmin, myFull, myDuty, dutyNow, checkIn, checkedIn, allDays, unreadChats, unreadBoard, unreadMgmt} from "../data.js";
import {loading, empty, secHead, ui, tryDo} from "../ui.js";
import {slots} from "./tt.js";

const SIDES = {"יסודי": "#2c8a7e", "חטיבה": "#2f6fd1", 'תל"ן': "#c98a12", "מגמות": "#cf4b3a", "סדירות": "#6c5fbf"};
const ICON = {vac: "fa-umbrella-beach", trip: "fa-person-hiking", event: "fa-star"};
let sel = null;   // התאריך שנבחר ברצועת השבוע (YYYY-MM-DD)

const hm = () => { const d = new Date(); return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0"); };
const t = s => String(s || "").replace(/^0/, "");
// ימי השבוע הנוכחי, ראשון עד שישי. בשבת - השבוע הבא.
function week() {
  const d = new Date(); d.setDate(d.getDate() - d.getDay() + (d.getDay() === 6 ? 7 : 0));
  return [...Array(6)].map((_, i) => { const x = new Date(d); x.setDate(d.getDate() + i); return x; });
}

// כל הפריטים עם שעה ביום שנבחר: שיעורים, שעות פנויות ביניהם, שמירות. ממוינים לפי שעה.
function timeline(date) {
  const day = parse(date).getDay(), out = [];
  for (const s of S.T ? slots(S.user.name, day) : []) {
    const b = BELLS[s.h] || ["", ""];
    out.push(s.ev.length
      ? {from: b[0], to: b[1], kind: "lesson", title: s.ev.map(e => e[3]).join(" · "), sub: "שעה " + s.h, side: s.ev[0][0]}
      : {from: b[0], to: b[1], kind: "free", title: "שעה פנויה", sub: "שעה " + s.h});
  }
  for (const x of myDuty().filter(x => x.day === day)) out.push({from: x.from, to: x.to, kind: "duty", title: "שמירה · " + x.places.join(" + "), sub: "עד " + t(x.to), slot: x});
  return out.sort((a, b) => (a.from || "99").localeCompare(b.from || "99"));
}

function rowHtml(x, isToday) {
  const now = hm(), cls = [x.kind === "duty" ? "du" : x.kind === "free" ? "free" : ""];
  const nowItem = isToday && x.from && x.from <= now && now < x.to;
  if (isToday && x.to && x.to <= now && x.kind !== "duty") cls.push("past");
  if (nowItem && x.kind !== "duty") cls.push("now");
  let extra = "";
  if (x.kind === "duty" && isToday) {
    const n = dutyNow(), mine = n && n.slot.from === x.from, done = checkedIn(S.user.uid, x.from);
    if (done) extra = '<span class="done"><i class="fa-solid fa-circle-check"></i> אישרת הגעה</span>';
    else if (mine) extra = '<button type="button" class="btn gold" id="arrive">הגעתי לשמירה</button>';
  }
  return '<li class="' + cls.join(" ") + '"><time>' + esc(t(x.from)) + "</time><div><b>" + esc(x.title) + (nowItem && x.kind !== "duty" ? '<span class="nowtag">עכשיו</span>' : "") + "</b>" +
    "<span>" + esc(x.sub) + (x.side ? ' <span class="tag" style="--t:' + (SIDES[x.side] || "#5b6880") + '">' + esc(x.side === "סדירות" ? "פגישה" : x.side) + "</span>" : "") + "</span>" + extra + "</div></li>";
}

function allDayHtml(d) {
  if (!d || !d.acts.length) return "";
  const vac = d.acts.some(a => a.k === "vac");
  return '<div class="allday' + (vac ? " vac" : "") + '"><h4>' + (d.date === today() ? "היום בבית החינוך" : "באותו יום בבית החינוך") + "</h4><ul>" +
    d.acts.map(a => '<li><i class="fa-solid ' + (ICON[a.k] || "fa-star") + '"></i><span>' + esc(a.t) + "</span></li>").join("") + "</ul>" +
    (d.tests.length ? '<a href="#/cal">' + d.tests.length + " הערכות בכיתות ←</a>" : "") + "</div>";
}

export default {
  title: () => "היום של " + myFull().split(" ")[0],
  html() {
    const days = week();
    if (!sel || !days.some(d => iso(d) === sel)) sel = days.find(d => iso(d) === today()) ? today() : iso(days[0]);
    const cal = S.sheet && S.events ? allDays() : null, byDate = d => cal && cal.find(x => x.date === iso(d)), myDays = new Set(myDuty().map(x => x.day));
    let h = '<div class="wkwrap"><div class="wk" role="group" aria-label="בחירת יום">' + days.map(d => {
      const k = iso(d), c = byDate(d), cls = [k === today() ? "today" : "", c && c.acts.some(a => a.k === "vac") ? "is-vac" : c && c.acts.length ? "has-ev" : myDays.has(d.getDay()) ? "has-du" : ""].filter(Boolean).join(" ");
      return '<button type="button" data-day="' + k + '" aria-pressed="' + (k === sel) + '"' + (cls ? ' class="' + cls + '"' : "") + ">" + "אבגדהוש"[d.getDay()] + "׳<b>" + d.getDate() + "</b><i></i></button>";
    }).join("") + "</div></div>";
    // הודעות חדשות: פס אחד, לא מסך
    const un = unreadBoard() + unreadChats() + unreadMgmt(), last = S.board && S.board[0];
    if (un) h += '<a class="alert" href="#/msg"><i class="fa-solid fa-envelope"></i><span><b>' + (un === 1 ? "הודעה חדשה" : un + " הודעות חדשות") + "</b>" + (last ? " · " + esc(last.title) : "") + '</span><i class="fa-solid fa-chevron-left go"></i></a>';
    const isToday = sel === today(), d = parse(sel), c = cal && cal.find(x => x.date === sel);
    h += allDayHtml(c);
    h += secHead(isToday ? "היום שלי" : "יום " + DAYN[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1), "#/tt", "המערכת השבועית");
    if (!S.T || !S.duty || !S.staff) h += loading;
    else {
      const items = timeline(sel);
      h += items.length ? '<ul class="tl">' + items.map(x => rowHtml(x, isToday)).join("") + "</ul>"
        : empty(c && c.acts.some(a => a.k === "vac") ? "יום חופש" : "אין לך שיעורים או שמירות ביום הזה", "מה שקורה בבית החינוך מופיע למעלה.");
    }
    // בימים הקרובים: אחרי השבוע המוצג
    const after = cal ? cal.filter(x => x.date > iso(days[5]) && x.acts.length).slice(0, 3) : [];
    if (after.length) h += secHead("בהמשך", "#/cal", "ללוח המלא") + '<div class="list">' + after.map(x => {
      const dt = parse(x.date), a = x.acts[0];
      return '<a class="item" href="#/cal"><div class="ico ' + (a.k === "vac" ? "green" : a.k === "trip" ? "teal" : "blue") + '"><i class="fa-solid ' + (ICON[a.k] || "fa-star") + '"></i></div><div><b>' + esc(a.t) +
        "</b><span>יום " + DAYN[dt.getDay()] + " " + dt.getDate() + "." + (dt.getMonth() + 1) + (x.acts.length > 1 ? " · ועוד " + (x.acts.length - 1) : "") + '</span></div><i class="fa-solid fa-chevron-left go"></i></a>';
    }).join("") + "</div>";
    h += secHead("קיצורי דרך") + '<div class="list">' +
      '<a class="item" href="#/duty"><div class="ico gold"><i class="fa-solid fa-shield-halved"></i></div><div><b>תורנות שמירה</b><span>השמירות שלי והלוח המלא</span></div><i class="fa-solid fa-chevron-left go"></i></a>' +
      '<a class="item" href="#/new"><div class="ico green"><i class="fa-solid fa-address-book"></i></div><div><b>אנשי הצוות</b><span>חיוג ושיחה פרטית</span></div><i class="fa-solid fa-chevron-left go"></i></a>' +
      (isAdmin() ? '<a class="item" href="#/staff"><div class="ico slate"><i class="fa-solid fa-users-gear"></i></div><div><b>ניהול צוות וקבוצות</b><span>שיוך, כניסה ותפקידים</span></div><i class="fa-solid fa-chevron-left go"></i></a>' : "") + "</div>";
    return h;
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-day]")) b.onclick = () => { sel = b.dataset.day; ui.render(); };
    const a = $("arrive"); if (a) a.onclick = async () => { const n = dutyNow(); if (!n) return; a.disabled = true; if (await tryDo(() => checkIn(n.slot), "האישור לא נשמר. לבדוק את האינטרנט ולנסות שוב.")) ui.render(); else a.disabled = false; };
  }
};
export const dateLine = () => { const d = new Date(); return "יום " + DAYN[d.getDay()] + ", " + d.toLocaleDateString("he-IL", {day: "numeric", month: "long"}); };
