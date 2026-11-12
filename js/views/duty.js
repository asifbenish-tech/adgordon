// תורנות שמירה בהפסקות: לוח שבועי קבוע. המקור: הגיליון של רכז התורנויות, עותק ב-data/duty.json.
// השמות בגיליון חופשיים ("גלית ז", "אלי מור"); data.js מתאים אותם לאנשי הצוות.
import {S} from "../state.js";
import {$, esc, DAYN} from "../util.js";
import {isAdmin, dutySlots, myDuty, dutyUnmatched} from "../data.js";
import {loading, empty, ui} from "../ui.js";

let all = false, day = null;
const t = s => s.replace(/^0/, "");
const span = x => t(x.from) + "–" + t(x.to);

function mineHtml() {
  const mine = myDuty(), td = new Date().getDay();
  if (!mine.length) return empty("אין לך תורנות שמירה בלוח", "אם זו טעות, כדאי לבדוק איך השם שלך כתוב בלוח המלא.");
  return '<div class="list">' + mine.map(x => '<div class="item duty' + (x.day === td ? " mine" : "") + '"><div class="date"><small>יום</small><b>' + "אבגדהוש".charAt(x.day) + "׳</b></div><div><b>יום " + DAYN[x.day] + " · " + span(x) +
    "</b><span>" + esc(x.places.join(" + ")) + "</span></div>" + (x.day === td ? '<span class="tag g-all">היום</span>' : "") + "</div>").join("") + "</div>" +
    '<button type="button" class="btn ghost" id="ics"><i class="fa-solid fa-calendar-plus"></i> הוספה ליומן הטלפון, עם תזכורת</button>' +
    '<p class="hint">היומן יזכיר לך 10 דקות לפני כל שמירה, כל שבוע עד סוף השנה. אם הלוח משתנה, מוחקים מהיומן ומוסיפים שוב.</p>';
}

function boardHtml() {
  const days = S.duty.rows.length ? S.duty.rows[0].days.length : 6;
  if (day == null) day = Math.min(new Date().getDay(), days - 1);
  const slots = dutySlots().filter(x => x.day === day), breaks = [...new Set(S.duty.rows.map(r => r.from + "|" + r.to))];
  let h = '<div class="seg days" role="group" aria-label="בחירת יום">' + DAYN.slice(0, days).map((d, i) =>
    '<button type="button" data-d="' + i + '" aria-pressed="' + (i === day) + '"' + (i === new Date().getDay() ? ' class="today"' : "") + ">" + d + "</button>").join("") + "</div>";
  for (const b of breaks) {
    const [from, to] = b.split("|"), rows = S.duty.rows.filter(r => r.from === from && r.to === to && r.days[day] && r.days[day].length);
    if (!rows.length) continue;
    h += '<div class="card brk"><h3><i class="fa-regular fa-clock"></i> ' + t(from) + "–" + t(to) + "</h3>" + rows.map(r => '<div class="brow"><span>' + esc(r.place) + "</span><b>" +
      r.days[day].map(raw => { const s = slots.find(x => x.raw === raw && x.from === from), p = s && s.p;
        return '<span class="' + (p && p.uid === S.user.uid ? "me" : p ? "" : "unk") + '">' + esc(p ? p.full : raw) + "</span>"; }).join(" / ") + "</b></div>").join("") + "</div>";
  }
  return h;
}

export default {
  title: () => "תורנות שמירה",
  html() {
    if (S.duty == null || S.staff == null) return loading;
    const un = dutyUnmatched();
    return '<div class="seg" role="group" aria-label="תצוגה"><button type="button" data-all="0" aria-pressed="' + !all + '">השמירות שלי</button><button type="button" data-all="1" aria-pressed="' + all + '">הלוח המלא</button></div>' +
      (all ? boardHtml() : mineHtml()) +
      (isAdmin() && un.length ? '<a class="item" href="#/staff"><div class="ico"><i class="fa-solid fa-user-tag"></i></div><div><b>' + un.length + " שמות בלוח לא זוהו</b><span>" + esc(un.join(", ")) + " · לשיוך במסך ניהול הצוות</span></div></a>" : "") +
      '<p class="hint">' + esc(S.duty.title || "") + (S.duty.updated ? " · מעודכן ל-" + esc(S.duty.updated.split("-").reverse().join(".")) : "") + (S.duty.source ? ' · <a href="' + esc(S.duty.source) + '" target="_blank" rel="noopener">לגיליון המקורי</a>' : "") + "</p>";
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-all]")) b.onclick = () => { all = b.dataset.all === "1"; ui.render(); };
    for (const b of el.querySelectorAll("[data-d]")) b.onclick = () => { day = +b.dataset.d; ui.render(); };
    const ics = $("ics"); if (ics) ics.onclick = exportIcs;
  }
};

// קובץ יומן (ics): אירוע שבועי חוזר לכל שמירה, עם תזכורת 10 דקות לפני. עובד בלי שרת.
function exportIcs() {
  const z = s => s.replace(/[-:]/g, ""), q = s => String(s || "").replace(/[\;,]/g, "\\$&"), p2 = n => String(n).padStart(2, "0");
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, ""), until = z(S.duty.until || (new Date().getFullYear() + 1) + "-06-30") + "T235959";
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//adgordon//shmirot//HE", "CALSCALE:GREGORIAN"];
  for (const x of myDuty()) {
    const d = new Date(); d.setDate(d.getDate() + (x.day - d.getDay() + 7) % 7);
    const ymd = d.getFullYear() + p2(d.getMonth() + 1) + p2(d.getDate()), place = x.places.join(" + ");
    L.push("BEGIN:VEVENT", "UID:duty-" + x.day + "-" + z(x.from) + "@adgordon", "DTSTAMP:" + stamp, "DTSTART:" + ymd + "T" + z(x.from) + "00", "DTEND:" + ymd + "T" + z(x.to) + "00",
      "RRULE:FREQ=WEEKLY;UNTIL=" + until, "SUMMARY:" + q("שמירה: " + place), "LOCATION:" + q(place),
      "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + q("שמירה בעוד 10 דקות: " + place), "TRIGGER:-PT10M", "END:VALARM", "END:VEVENT");
  }
  L.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([L.join("\r\n")], {type: "text/calendar;charset=utf-8"}));
  a.download = "shmirot.ics"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
