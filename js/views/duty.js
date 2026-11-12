// שמירות. האוסף duties הוא נקודת החיבור למערכת שמירות ייעודית שתיבנה בנפרד.
import {S} from "../state.js";
import {$, esc, nice, today, heSort} from "../util.js";
import {isAdmin, fullName, upcoming, myDuties} from "../data.js";
import {put, del} from "../store.js";
import {loading, empty, field, ui, tryDo} from "../ui.js";

let all = false;
const item = x => '<div class="item duty' + (x.who === S.user.name ? " mine" : "") + '"><div class="ico"><i class="fa-solid fa-shield-halved"></i></div><div><b>' +
  esc(nice(x.date)) + " · " + esc(x.from) + "–" + esc(x.to) + "</b><span>" + esc(x.place) + (all || x.who !== S.user.name ? " · " + esc(fullName(x.who)) : "") +
  (x.note ? " · " + esc(x.note) : "") + "</span></div>" + (isAdmin() ? '<button type="button" class="del" data-del="' + esc(x.id) + '" aria-label="מחיקה"><i class="fa-solid fa-trash-can"></i></button>' : "") + "</div>";

export default {
  title: () => "שמירות",
  html() {
    if (S.duties == null) return loading;
    const mine = myDuties(), list = all ? upcoming("duties") : mine;
    let h = '<div class="seg" role="group" aria-label="תצוגה"><button type="button" data-all="0" aria-pressed="' + !all + '">השמירות שלי</button><button type="button" data-all="1" aria-pressed="' + all + '">כל השמירות</button></div>';
    h += list.length ? '<div class="list">' + list.map(item).join("") + "</div>" : empty(all ? "לא שובצו שמירות" : "אין לך שמירות קרובות");
    if (mine.length) h += '<button type="button" class="btn ghost" id="ics"><i class="fa-solid fa-calendar-plus"></i> הוספת השמירות שלי ליומן הטלפון</button>' +
      '<p class="hint">היומן של הטלפון יזכיר לך יום לפני ושעה לפני כל שמירה. אחרי שינוי בשיבוץ כדאי להוסיף שוב.</p>';
    if (isAdmin()) h += '<details class="add"><summary><i class="fa-solid fa-plus"></i> שיבוץ שמירה</summary><form id="dform">' +
      field("מי שומר/ת", '<input name="who" list="dnames" required autocomplete="off"><datalist id="dnames">' + Object.keys((S.T && S.T.teachers) || {}).sort(heSort).map(n => '<option value="' + esc(n) + '">' + esc(fullName(n)) + "</option>").join("") + "</datalist>") +
      field("תאריך", '<input name="date" type="date" required min="' + today() + '">') +
      '<div class="two">' + field("משעה", '<input name="from" type="time" required>') + field("עד שעה", '<input name="to" type="time" required>') + "</div>" +
      field("עמדה / מקום", '<input name="place" required maxlength="60">') + field("הערה (לא חובה)", '<input name="note" maxlength="120">') +
      '<p class="hint">השם צריך להיות כמו בלוח המערכות (שם פרטי), כדי שהשמירה תופיע אצל איש הצוות.</p><button class="btn">שיבוץ</button></form></details>';
    return h;
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-all]")) b.onclick = () => { all = b.dataset.all === "1"; ui.render(); };
    for (const b of el.querySelectorAll("[data-del]")) b.onclick = () => confirm("למחוק את השמירה?") && tryDo(() => del("duties", b.dataset.del));
    const ics = $("ics"); if (ics) ics.onclick = exportIcs;
    const f = $("dform"); if (f) f.onsubmit = async e => {
      e.preventDefault();
      const o = {}; for (const [k, v] of new FormData(f)) o[k] = String(v).trim();
      if (o.to <= o.from) { alert("שעת הסיום צריכה להיות אחרי שעת ההתחלה."); return; }
      if (await tryDo(() => put("duties", null, o))) ui.render();
    };
  }
};

// קובץ יומן (ics) עם השמירות שלי: תזכורת יום לפני ושעה לפני. עובד בלי שרת.
function exportIcs() {
  const z = s => s.replace(/[-:]/g, ""), q = s => String(s || "").replace(/[\;,]/g, "\\$&").replace(/\n/g, "\\n");
  const stamp = new Date().toISOString().replace(/[-:]|\.\d+/g, "");
  const L = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//adgordon//shmirot//HE", "CALSCALE:GREGORIAN"];
  for (const x of myDuties()) L.push("BEGIN:VEVENT", "UID:" + x.id + "@adgordon", "DTSTAMP:" + stamp,
    "DTSTART:" + z(x.date) + "T" + z(x.from) + "00", "DTEND:" + z(x.date) + "T" + z(x.to) + "00",
    "SUMMARY:" + q("שמירה: " + x.place), "LOCATION:" + q(x.place), "DESCRIPTION:" + q(x.note || "שמירה - בית חינוך גורדון"),
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + q("שמירה מחר: " + x.place), "TRIGGER:-P1D", "END:VALARM",
    "BEGIN:VALARM", "ACTION:DISPLAY", "DESCRIPTION:" + q("שמירה בעוד שעה: " + x.place), "TRIGGER:-PT1H", "END:VALARM", "END:VEVENT");
  L.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([L.join("\r\n")], {type: "text/calendar;charset=utf-8"}));
  a.download = "shmirot.ics"; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
