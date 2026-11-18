// מערכת השינויים היומית: תמונה אחת לכל יום (צילום או קובץ), שההנהלה/צוות הניהול מעלים.
// נשמרת ב-daily/<תאריך> כ-JPEG מוקטן (אין Cloud Storage בתוכנית החינם; מסמך עד 1MB).
// הצפייה: הגדלה בכפתורים או בצביטה, גלילה בתוך התמונה. ההעלאה: בחירת תמונה, הערה, ולמי לשלוח התראה.
import {S} from "../state.js";
import {$, esc, today, parse, hhmm, DAYN} from "../util.js";
import {canPublish, watchDaily, saveDaily, delDaily, people} from "../data.js";
import {loading, empty, field, avatar, ui, tryDo} from "../ui.js";

const MAX_CHARS = 900000;          // גבול בטוח מתחת ל-1MB של מסמך
let zoom = 1, up = null;           // up = טיוטת העלאה: {data, w, h, note, mode: all|some|none, picked: Set, q}

const dateTitle = d => { const x = parse(d); return (d === today() ? "היום · " : "") + "יום " + DAYN[x.getDay()] + " " + x.getDate() + "." + (x.getMonth() + 1); };

// מקטין ודוחס עד שהתמונה נכנסת למסמך אחד. מחזיר {data, w, h}.
async function compress(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    for (let maxW = 2000; maxW >= 900; maxW -= 250) {
      const k = Math.min(1, maxW / Math.max(img.width, img.height)), w = Math.round(img.width * k), h = Math.round(img.height * k);
      const c = document.createElement("canvas"); c.width = w; c.height = h;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, w, h); g.drawImage(img, 0, 0, w, h);
      for (const q of [0.85, 0.75, 0.65, 0.55]) { const data = c.toDataURL("image/jpeg", q); if (data.length < MAX_CHARS) return {data, w, h}; }
    }
    throw new Error("big");
  } finally { URL.revokeObjectURL(url); }
}

// הכרטיס במסך הבית (ליום שנבחר ברצועת השבוע)
export function dailyCard(date) {
  watchDaily(date);
  const d = S.daily[date];
  if (d === undefined || (!d && !canPublish())) return "";
  if (!d) return '<a class="item" href="#/daily/' + date + '"><div class="ico slate"><i class="fa-solid fa-image"></i></div><div><b>מערכת השינויים</b><span>עוד לא הועלתה ליום הזה · להעלאה</span></div><i class="fa-solid fa-chevron-left go"></i></a>';
  const mine = (d.to || []).includes(S.user.uid);
  return '<a class="daily-card' + (mine ? " mine" : "") + '" href="#/daily/' + date + '"><img src="' + esc(d.data) + '" alt="מערכת השינויים"><div><b>מערכת השינויים' + (date === today() ? " להיום" : "") + "</b>" +
    (mine ? '<span class="minetag"><i class="fa-solid fa-circle-exclamation"></i> יש שינוי במערכת שלך</span>' : "") +
    "<span>" + (d.note ? esc(d.note) + " · " : "") + "עודכן ב-" + hhmm(d.at) + '</span><span class="open">לפתיחה בגדול <i class="fa-solid fa-chevron-left"></i></span></div></a>';
}

function viewer(d) {
  return '<div class="dzoom" role="group" aria-label="הגדלה"><button type="button" class="btn ghost small" data-z="-1" aria-label="הקטנה"><i class="fa-solid fa-magnifying-glass-minus"></i></button>' +
    '<button type="button" class="btn ghost small" data-z="0">' + Math.round(zoom * 100) + '%</button><button type="button" class="btn ghost small" data-z="1" aria-label="הגדלה"><i class="fa-solid fa-magnifying-glass-plus"></i></button></div>' +
    '<div class="dimg" id="dimg"><img src="' + esc(d.data) + '" alt="מערכת השינויים" style="width:' + (zoom * 100) + '%"></div>' +
    '<p class="hint center">' + (d.note ? esc(d.note) + " · " : "") + "הועלתה ע״י " + esc(d.byName || "") + " ב-" + hhmm(d.at) + "</p>";
}

function picker() {
  const s = (up.q || "").trim(), list = people().filter(p => !p.off && p.uid !== S.user.uid && (!s || p.full.includes(s) || p.name.includes(s)));
  return '<input class="search" id="dq" type="search" placeholder="חיפוש לפי שם" value="' + esc(up.q || "") + '" autocomplete="off">' +
    '<p class="hint">נבחרו ' + up.picked.size + "</p>" +
    '<div class="list dpick">' + list.map(p => '<label class="item check"><input type="checkbox" data-p="' + esc(p.uid) + '"' + (up.picked.has(p.uid) ? " checked" : "") + ">" + avatar(p) + "<div><b>" + esc(p.full) + "</b></div></label>").join("") + "</div>";
}

function uploadHtml(date, has) {
  if (!up) return '<label class="btn filebtn"><i class="fa-solid fa-camera"></i> ' + (has ? "החלפת התמונה" : "העלאת מערכת השינויים") + '<input id="dfile" type="file" accept="image/*"></label>' +
    (has ? '<button type="button" class="btn danger small" id="ddel"><i class="fa-solid fa-trash-can"></i> מחיקת התמונה של היום הזה</button>' : "");
  return '<div class="card dform"><h3>' + (has ? "החלפת" : "העלאת") + " מערכת השינויים · " + esc(dateTitle(date)) + "</h3>" +
    '<img class="dprev" src="' + up.data + '" alt="">' +
    field("הערה (לא חובה)", '<input id="dnote" maxlength="80" placeholder="למשל: שינויים בשכבת ז" value="' + esc(up.note || "") + '">') +
    '<fieldset class="aud"><legend>התראה לטלפון</legend>' +
    [["all", "לכל הצוות"], ["some", "רק למי שיש לו שינוי"], ["none", "בלי התראה"]].map(o => '<label class="pill"><input type="radio" name="dmode" value="' + o[0] + '"' + (up.mode === o[0] ? " checked" : "") + "><span>" + o[1] + "</span></label>").join("") + "</fieldset>" +
    (up.mode === "some" ? '<div id="dpicker">' + picker() + "</div>" : "") +
    '<div class="two"><button type="button" class="btn" id="dsave">פרסום</button><button type="button" class="btn ghost" id="dcancel">ביטול</button></div></div>';
}

export default {
  parent: "home", tab: "home",
  title: () => "מערכת השינויים",
  html(arg) {
    const date = arg || today();
    watchDaily(date);
    const d = S.daily[date];
    let h = '<h3 class="month">' + esc(dateTitle(date)) + "</h3>";
    if (d === undefined) return h + loading;
    if (d && !up) h += viewer(d);
    else if (!d && !up) h += empty("עוד לא הועלתה מערכת שינויים ליום הזה", canPublish() ? "אפשר להעלות צילום או תמונה כאן למטה." : "כשההנהלה תעלה אותה, היא תופיע כאן ובמסך הבית.", "fa-image");
    if (canPublish()) h += uploadHtml(date, !!d);
    return h;
  },
  bind(el, arg) {
    const date = arg || today();
    for (const b of el.querySelectorAll("[data-z]")) b.onclick = () => { const z = +b.dataset.z; zoom = z ? Math.min(4, Math.max(1, zoom + z * 0.5)) : 1; ui.render(); };
    const f = $("dfile"); if (f) f.onchange = async () => {
      const file = f.files[0]; if (!file) return;
      if (!/^image\//.test(file.type)) { alert("צריך לבחור קובץ תמונה."); return; }
      try { up = Object.assign(await compress(file), {note: "", mode: "all", picked: new Set(), q: ""}); }
      catch (e) { alert("לא הצלחנו לעבד את התמונה. לנסות תמונה אחרת או צילום מסך."); return; }
      ui.render();
    };
    const dd = $("ddel"); if (dd) dd.onclick = async () => { if (confirm("למחוק את מערכת השינויים של היום הזה?") && await tryDo(() => delDaily(date))) ui.render(); };
    if (!up) return;
    const note = $("dnote"); note.oninput = () => { up.note = note.value; };
    for (const r of el.querySelectorAll("[name=dmode]")) r.onchange = () => { up.mode = r.value; ui.render(); };
    const wire = () => {
      for (const c of el.querySelectorAll("[data-p]")) c.onchange = () => { c.checked ? up.picked.add(c.dataset.p) : up.picked.delete(c.dataset.p); const n = el.querySelector("#dpicker .hint"); if (n) n.textContent = "נבחרו " + up.picked.size; };
      const q = $("dq"); if (q) q.oninput = () => { up.q = q.value; $("dpicker").innerHTML = picker(); const q2 = $("dq"); q2.focus(); q2.setSelectionRange(q2.value.length, q2.value.length); wire(); };
    };
    wire();
    $("dcancel").onclick = () => { up = null; ui.render(); };
    $("dsave").onclick = async () => {
      const to = up.mode === "all" ? ["all"] : up.mode === "some" ? [...up.picked] : [];
      if (up.mode === "some" && !to.length) { alert("צריך לבחור לפחות איש צוות אחד, או לבחור התראה אחרת."); return; }
      const b = $("dsave"); b.disabled = true; b.textContent = "מפרסם…";
      if (await tryDo(() => saveDaily(date, {data: up.data, w: up.w, h: up.h, note: (up.note || "").trim()}, to), "התמונה לא נשמרה. לבדוק את האינטרנט ולנסות שוב.")) { up = null; zoom = 1; ui.render(); }
      else { b.disabled = false; b.textContent = "פרסום"; }
    };
  }
};
