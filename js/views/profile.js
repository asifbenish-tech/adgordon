// הפרופיל שלי: תמונה אישית עם מסך עריכה (הזזה, הגדלה, סיבוב, חיתוך לעיגול).
// אין Cloud Storage (תוכנית חינם), ולכן התמונה מוקטנת ל-192x192 ונשמרת כטקסט ב-Firestore: photos/<uid>.
import {S} from "../state.js";
import {$, esc} from "../util.js";
import {myFull, myGroups, person, savePhoto, delPhoto, saveMine} from "../data.js";
import {tags, avatar, field, ui, tryDo} from "../ui.js";
import {pushCard, bindPush} from "../push.js";

const OUT = 192, VIEW = 600;   // גודל התמונה הנשמרת; רזולוציית משטח העריכה
let ed = null;                 // {img, s, min, x, y, rot} בזמן עריכה

function fit() {   // התמונה תמיד מכסה את כל העיגול
  const r = ed.rot % 2, w = (r ? ed.img.height : ed.img.width) * ed.s, h = (r ? ed.img.width : ed.img.height) * ed.s;
  const mx = Math.max(0, (w - VIEW) / 2), my = Math.max(0, (h - VIEW) / 2);
  ed.x = Math.max(-mx, Math.min(mx, ed.x)); ed.y = Math.max(-my, Math.min(my, ed.y));
}
function paint(ctx, size) {
  const k = size / VIEW;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, size, size);
  ctx.save(); ctx.translate(size / 2 + ed.x * k, size / 2 + ed.y * k); ctx.rotate(ed.rot * Math.PI / 2); ctx.scale(ed.s * k, ed.s * k);
  ctx.drawImage(ed.img, -ed.img.width / 2, -ed.img.height / 2); ctx.restore();
}
const draw = () => { fit(); paint($("pcan").getContext("2d"), VIEW); };
function zoom(to) { ed.s = Math.max(ed.min, Math.min(ed.min * 4, to)); $("pzoom").value = ed.s / ed.min; draw(); }

function load(file) {
  if (!file || !/^image\//.test(file.type)) { alert("צריך לבחור קובץ תמונה."); return; }
  const img = new Image(), url = URL.createObjectURL(file);
  img.onload = () => { const min = VIEW / Math.min(img.width, img.height); ed = {img, s: min, min, x: 0, y: 0, rot: 0}; ui.render(); };
  img.onerror = () => { URL.revokeObjectURL(url); alert("לא הצלחנו לפתוח את התמונה. לנסות תמונה אחרת."); };
  img.src = url;
}

export default {
  parent: "me", tab: "", live: true,
  title: () => ed ? "עריכת התמונה" : "עדכון פרטים",
  html() {
    if (ed) return '<div class="stage"><canvas id="pcan" width="' + VIEW + '" height="' + VIEW + '" aria-label="התמונה. גוררים כדי להזיז"></canvas><div class="ring"></div></div>' +
      '<p class="hint center">גוררים כדי להזיז. מה שבתוך העיגול הוא מה שיופיע.</p>' +
      '<label class="zoom"><i class="fa-solid fa-magnifying-glass-minus"></i><input id="pzoom" type="range" min="1" max="4" step="0.01" value="1" aria-label="הגדלה"><i class="fa-solid fa-magnifying-glass-plus"></i></label>' +
      '<div class="two"><button type="button" class="btn" id="psave">שמירה</button><button type="button" class="btn ghost" id="pcancel">ביטול</button></div>' +
      '<button type="button" class="btn ghost small" id="prot"><i class="fa-solid fa-rotate-right"></i> סיבוב התמונה</button>';
    const g = S.staff ? myGroups() : [], has = !!(S.photos && S.photos[S.user.uid]), me = person(S.user.uid), canMail = !!(S.myAuth && S.myAuth.id);
    return '<div class="card prof"><div class="big">' + avatar(S.user) + "</div><b>" + esc(myFull()) + '</b><div class="tags">' + tags(g) + "</div></div>" +
      '<label class="btn filebtn"><i class="fa-solid fa-camera"></i> ' + (has ? "החלפת התמונה" : "הוספת תמונה") + '<input id="pfile" type="file" accept="image/*"></label>' +
      (has ? '<button type="button" class="btn ghost" id="pdel"><i class="fa-solid fa-trash-can"></i> הסרת התמונה</button>' : "") +
      '<p class="hint center">התמונה תופיע ליד השם שלך בהודעות, בשיחות וברשימת הצוות. רואים אותה רק אנשי הצוות.</p>' +
      '<form class="card dform" id="dform"><h3>הפרטים שלי</h3>' + field("שם מלא", '<input name="full" required maxlength="50" value="' + esc(me.full) + '">') +
      field("טלפון נייד", '<input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="20" value="' + esc(me.phone || "") + '">') +
      (canMail ? field("מייל (אליו נשלח קוד הכניסה)", '<input name="email" type="email" dir="ltr" required maxlength="80" value="' + esc(S.myAuth.email || "") + '">') : "") +
      '<button class="btn">שמירת הפרטים</button><p class="hint">הטלפון מופיע בדף אנשי הצוות. שיוך לבית, מחנכים וצוות ניהול מעדכנת ההנהלה.</p></form>' + pushCard();
  },
  bind() {
    if (!ed) {
      $("pfile").onchange = e => load(e.target.files[0]);
      bindPush(() => ui.render());
      $("dform").onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(e.target), v = k => fd.has(k) ? String(fd.get(k)).trim() : undefined, btn = e.target.querySelector(".btn");
        if (fd.has("email") && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v("email"))) { alert("כתובת המייל לא תקינה."); return; }
        btn.disabled = true; document.activeElement.blur();
        if (await tryDo(() => saveMine(v("full"), v("phone") || "", v("email")), "הפרטים לא נשמרו. לבדוק את האינטרנט ולנסות שוב.")) { btn.textContent = "נשמר ✓"; setTimeout(() => ui.render(), 900); } else btn.disabled = false;
      };
      const d = $("pdel"); if (d) d.onclick = async () => { if (confirm("להסיר את התמונה?") && await tryDo(delPhoto)) ui.render(); };
      return;
    }
    const c = $("pcan"), pts = new Map(); let pinch = 0;
    const k = () => VIEW / c.getBoundingClientRect().width;
    c.onpointerdown = e => { c.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); pinch = 0; };
    c.onpointermove = e => {
      if (!pts.has(e.pointerId)) return;
      const [px, py] = pts.get(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { ed.x += (e.clientX - px) * k(); ed.y += (e.clientY - py) * k(); draw(); return; }
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);   // שתי אצבעות: הגדלה
      if (pinch) zoom(ed.s * d / pinch); pinch = d;
    };
    c.onpointerup = c.onpointercancel = e => { pts.delete(e.pointerId); pinch = 0; };
    c.onwheel = e => { e.preventDefault(); zoom(ed.s * (e.deltaY < 0 ? 1.08 : 0.93)); };
    $("pzoom").oninput = e => zoom(ed.min * +e.target.value);
    $("prot").onclick = () => { ed.rot = (ed.rot + 1) % 4; draw(); };
    $("pcancel").onclick = () => { ed = null; ui.render(); };
    $("psave").onclick = async () => {
      const o = document.createElement("canvas"); o.width = o.height = OUT; paint(o.getContext("2d"), OUT);
      const data = o.toDataURL("image/jpeg", 0.82), btn = $("psave"); btn.disabled = true;
      if (await tryDo(() => savePhoto(data), "התמונה לא נשמרה. לבדוק את האינטרנט ולנסות שוב.")) { ed = null; ui.render(); } else btn.disabled = false;
    };
    draw();
  },
  update() { const a = document.activeElement; if (!ed && !(a && /^(INPUT|TEXTAREA)$/.test(a.tagName) && a.type !== "file")) ui.render(); }   // עדכון נתונים ברקע לא מאפס עריכה באמצע
};
