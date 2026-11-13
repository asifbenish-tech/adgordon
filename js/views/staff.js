// ניהול צוות וקבוצות (הנהלה בלבד). זה "אובייקט אנשי הצוות" של בית החינוך: staff/<uid> ב-Firestore.
// מי נכנס לאפליקציה נקבע ברשימת הת"ז של לוח המערכות; כאן מגדירים שם מלא, קבוצות, כינויים וחסימה.
import {S} from "../state.js";
import {$, esc, uidOf, rid} from "../util.js";
import {isAdmin, groups, people, saveStaff, saveGroups, suggestGroups, dutyUnmatched, setAlias, saveAuth, removePerson} from "../data.js";
import {DEMO} from "../config.js";
import {idHash, idToken, api} from "../auth.js";
import {empty, loading, field, tags, avatar, chips, ui, tryDo} from "../ui.js";

let q = "", flt = "", open = "", mode = "list";
const ROLES = [["teacher", "צוות הוראה"], ["classes", "צוות (לא הוראה)"], ["coordinator", "ריכוז בית"], ["admin", "הנהלה - ניהול מלא"]];
const roleSel = cur => '<select name="role">' + ROLES.map(r => '<option value="' + r[0] + '"' + (r[0] === (cur || "teacher") ? " selected" : "") + ">" + r[1] + "</option>").join("") + "</select>";
// ספרת הביקורת של תעודת זהות ישראלית - תופס טעויות הקלדה
const validId = raw => { const id = String(raw).replace(/\D/g, ""); if (id.length < 5 || id.length > 9) return false; return [...id.padStart(9, "0")].reduce((sum, ch, i) => { const n = +ch * (i % 2 + 1); return sum + (n > 9 ? n - 9 : n); }, 0) % 10 === 0; };
// פרטי הכניסה מנוהלים כאן רק אחרי שהרשימה הישנה יובאה (אחרת הוספה של אדם אחד הייתה נועלת את כל השאר בחוץ)
const authOn = () => !!S.auth && Object.keys(S.auth).length > 0;
function loginHtml(p) {
  if (!authOn()) return "";
  const a = S.auth[p.uid] || {}, n = (a.h || []).length, okMail = !!a.email;
  return "<h4>כניסה לאפליקציה</h4>" + '<p class="state' + (n && okMail ? "" : " bad") + '">' + (n && okMail ? "יכול/ה להיכנס" : !n ? "לא יכול/ה להיכנס: לא הוגדרה תעודת זהות" : "לא יכול/ה להיכנס: חסר מייל לקבלת קוד") + (n > 1 ? " · " + n + " תעודות" : "") + "</p>" +
    field(n ? "החלפת תעודת הזהות (להשאיר ריק כדי לא לשנות)" : "תעודת זהות", '<input name="tz" inputmode="numeric" maxlength="9" autocomplete="off">') +
    field("מייל לקבלת קוד הכניסה", '<input name="email" type="email" dir="ltr" maxlength="80" value="' + esc(a.email || "") + '">') +
    (p.uid === S.user.uid ? "" : field("תפקיד", roleSel(a.role || p.role)));
}

const shown = () => { const s = q.trim(); return people().filter(p => (!flt || p.groups.includes(flt)) && (!s || p.full.includes(s) || p.name.includes(s) || p.aliases.some(a => a.includes(s)))); };

function listHtml() {
  const list = shown(), all = people().length;
  if (!list.length) return empty("לא נמצאו אנשי צוות");
  const count = '<p class="hint">' + list.length + " מתוך " + all + " אנשי צוות</p>";
  if (mode === "table") return count + '<div class="tablewrap"><table class="grid"><thead><tr><th>שם</th>' + groups().map(g => "<th>" + esc(g.label) + "</th>").join("") + "</tr></thead><tbody>" +
    list.map(p => '<tr data-uid="' + esc(p.uid) + '"' + (p.off ? ' class="off"' : "") + "><th>" + esc(p.full) + "</th>" + groups().map(g =>
      '<td><input type="checkbox" data-grp="' + esc(g.id) + '" aria-label="' + esc(p.full + " - " + g.label) + '"' + (p.groups.includes(g.id) ? " checked" : "") + "></td>").join("") + "</tr>").join("") + "</tbody></table></div>";
  return count + list.map(p =>
    '<details class="person' + (p.off ? " off" : "") + '" data-uid="' + esc(p.uid) + '"' + (open === p.uid ? " open" : "") + "><summary>" + avatar(p) + "<div><b>" + esc(p.full) +
    '</b><div class="tags">' + (p.off ? '<span class="tag red">חסום/ה</span>' : "") + (tags(p.groups) || (p.off ? "" : '<span class="none">בלי שיוך</span>')) + "</div>" + (p.phone ? '<span class="none" dir="ltr">' + esc(p.phone) + "</span>" : "") + '</div><i class="fa-solid fa-chevron-down chev"></i></summary>' +
    '<div class="pbody"><div class="aud">' + groups().map(g => '<label class="pill"><input type="checkbox" data-grp="' + esc(g.id) + '"' + (p.groups.includes(g.id) ? " checked" : "") + "><span>" + esc(g.label) + "</span></label>").join("") + "</div>" +
    '<form class="pform">' + field("שם מלא", '<input name="full" maxlength="50" value="' + esc(p.full) + '">') +
    field("טלפון נייד", '<input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="20" value="' + esc(p.phone) + '">') +
    field("כינויים באפליקציות אחרות (מופרדים בפסיק)", '<input name="aliases" maxlength="200" value="' + esc(p.aliases.join(", ")) + '" placeholder="למשל: ' + esc(p.name) + ' ק">') +
    loginHtml(p) + '<button class="btn ghost small">שמירת הפרטים</button></form>' +
    (p.uid === S.user.uid ? "" : '<label class="check"><input type="checkbox" data-off' + (p.off ? " checked" : "") + '> חסימת כניסה לאפליקציה</label><button type="button" class="btn danger small" data-rm>הסרה מהצוות</button>') +
    '<p class="hint">השם בלוח המערכות (המזהה): ' + esc(p.name) + "</p></div></details>").join("");
}

export default {
  parent: "home", tab: "home",
  title: () => "ניהול צוות וקבוצות",
  html() {
    if (!isAdmin()) return empty("המסך הזה פתוח להנהלה בלבד");
    if (S.staff == null) return loading;
    const sug = suggestGroups(), ps = people(), un = S.duty ? dutyUnmatched() : [];
    const withCount = groups().map(g => ({id: g.id, label: g.label + " " + ps.filter(p => p.groups.includes(g.id)).length}));
    const imp = S.auth && !authOn() && !DEMO ? '<div class="card note warn"><b><i class="fa-solid fa-right-left"></i> להעביר את ניהול הכניסה לכאן</b><p>כרגע רשימת תעודות הזהות והמיילים מנוהלת בלוח המערכות ובגיליון. לחיצה אחת מעתיקה אותה לכאן, ומאותו רגע מוסיפים, מעדכנים ומסירים אנשי צוות רק מהמסך הזה. לוח המערכות עצמו לא משתנה.</p><button type="button" class="btn" id="imp">ייבוא רשימת הצוות</button></div>' : "";
    return imp + '<input class="search" id="sq" type="search" placeholder="חיפוש לפי שם" value="' + esc(q) + '" autocomplete="off">' + chips(withCount, flt, "data-g") +
      '<div class="seg" role="group" aria-label="תצוגה"><button type="button" data-mode="list" aria-pressed="' + (mode === "list") + '">כרטיסים</button><button type="button" data-mode="table" aria-pressed="' + (mode === "table") + '">טבלת קבוצות</button></div>' +
      (sug.length ? '<button type="button" class="btn ghost" id="sug"><i class="fa-solid fa-wand-magic-sparkles"></i> שיוך מחנכים ובתים לפי מערכת השעות (' + sug.length + ")</button>" : "") +
      '<div class="list" id="slist">' + listHtml() + "</div>" +
      (un.length ? '<h3 class="month">שמות מלוח השמירות שלא זוהו</h3><p class="hint">בוחרים למי השם שייך, והוא נשמר ככינוי אצל איש הצוות. מי שעוד לא ברשימה: קודם מוסיפים אותו למטה, ב"איש צוות שלא מופיע ברשימה".</p><div class="list">' + un.map(raw =>
        '<div class="item slim"><div><b>' + esc(raw) + '</b></div><select data-alias="' + esc(raw) + '" aria-label="שיוך של ' + esc(raw) + '"><option value="">לבחור איש צוות…</option>' + ps.map(p => '<option value="' + esc(p.uid) + '">' + esc(p.full) + "</option>").join("") + "</select></div>").join("") + "</div>" : "") +
      '<h3 class="month">קבוצות</h3><div class="list">' + groups().map(g => '<div class="item slim"><div><b>' + esc(g.label) + "</b><span>" + ps.filter(p => p.groups.includes(g.id)).length + ' אנשי צוות</span></div><button type="button" class="del" data-delg="' + esc(g.id) + '" aria-label="מחיקת הקבוצה"><i class="fa-solid fa-trash-can"></i></button></div>').join("") + "</div>" +
      '<details class="add"><summary><i class="fa-solid fa-plus"></i> קבוצה חדשה</summary><form id="gform">' + field("שם הקבוצה", '<input name="label" required maxlength="30" placeholder="למשל: צוות חטיבה, רכזי מקצוע">') + '<button class="btn">הוספה</button></form></details>' +
      '<details class="add"><summary><i class="fa-solid fa-user-plus"></i> איש צוות חדש</summary><form id="nform">' + field("שם קצר (מזהה)", '<input name="name" required maxlength="40" placeholder="למשל: רותי">') +
      '<p class="hint">זה השם שמזהה את האדם בכל האפליקציות. אם הוא מופיע בלוח המערכות - אותו שם בדיוק. אי אפשר לשנות אותו אחר כך.</p>' + field("שם מלא", '<input name="full" maxlength="50">') + field("טלפון נייד", '<input name="phone" type="tel" dir="ltr" inputmode="tel" maxlength="20">') +
      '<fieldset class="aud"><legend>שיוך (אפשר לסמן כמה)</legend>' + groups().map(g => '<label class="pill"><input type="checkbox" name="grp" value="' + esc(g.id) + '"><span>' + esc(g.label) + "</span></label>").join("") + "</fieldset>" +
      (authOn() ? field("תעודת זהות", '<input name="tz" inputmode="numeric" maxlength="9" autocomplete="off" required>') + field("מייל לקבלת קוד הכניסה", '<input name="email" type="email" dir="ltr" maxlength="80" required>') + field("תפקיד", roleSel("teacher"))
        : '<p class="hint">תעודת זהות ומייל אפשר יהיה להגדיר כאן אחרי ייבוא רשימת הצוות.</p>') + '<button class="btn">הוספה</button></form></details>' +
      '<p class="hint">תעודות הזהות לא נשמרות: המכשיר שלך הופך אותן לקוד חד־כיווני, ורק הוא נשמר. לכן אי אפשר להציג ת"ז קיימת, רק להחליף.</p>';
  },
  bind(el) {
    if (!isAdmin() || S.staff == null) return;
    $("sq").oninput = e => { q = e.target.value; $("slist").innerHTML = listHtml(); wire(); };
    for (const b of el.querySelectorAll("[data-g]")) b.onclick = () => { flt = b.dataset.g; ui.render(); };
    for (const b of el.querySelectorAll("[data-mode]")) b.onclick = () => { mode = b.dataset.mode; ui.render(); };
    const sug = $("sug"); if (sug) sug.onclick = async () => {
      const list = suggestGroups();
      if (!confirm("לשייך " + list.length + " מחנכים לקבוצת \"מחנכים\" ולבית של הכיתה שלהם?\nהפעולה רק מוסיפה שיוכים, ואפשר לשנות כל אחד אחר כך.")) return;
      if (await tryDo(() => Promise.all(list.map(x => saveStaff(x.p, {groups: x.groups}))))) ui.render();
    };
    for (const s of el.querySelectorAll("[data-alias]")) s.onchange = async () => { if (s.value && await tryDo(() => setAlias(s.dataset.alias, s.value))) ui.render(); };
    for (const b of el.querySelectorAll("[data-delg]")) b.onclick = async () => {
      const g = groups().find(x => x.id === b.dataset.delg);
      if (g && confirm("למחוק את הקבוצה \"" + g.label + "\"?\nהודעות שנשלחו אליה לא יוצגו יותר.") && await tryDo(() => saveGroups(groups().filter(x => x.id !== g.id)))) ui.render();
    };
    $("gform").onsubmit = async e => {
      e.preventDefault();
      const label = String(new FormData(e.target).get("label")).trim();
      if (groups().some(g => g.label === label)) { alert("כבר יש קבוצה בשם הזה."); return; }
      if (await tryDo(() => saveGroups([...groups(), {id: "g" + rid(), label}]))) ui.render();
    };
    $("nform").onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(e.target), v = k => String(fd.get(k) || "").trim(), name = v("name"), p = {uid: uidOf(name), name, role: ""};
      if (people().some(x => x.name === name)) { alert("השם הזה כבר ברשימה."); return; }
      if (authOn() && !validId(v("tz"))) { alert("מספר תעודת הזהות לא תקין. לבדוק את ההקלדה."); return; }
      const btn = e.target.querySelector(".btn"); btn.disabled = true;
      if (await tryDo(async () => {
        await saveStaff(p, Object.assign({groups: fd.getAll("grp").map(String), phone: v("phone"), off: false, removed: false}, v("full") ? {full: v("full")} : {}));
        if (authOn()) await saveAuth(p, {h: [await idHash(v("tz"))], email: v("email"), role: v("role")});
      })) { q = ""; flt = ""; mode = "list"; open = p.uid; ui.render(); } else btn.disabled = false;
    };
    const imp = $("imp"); if (imp) imp.onclick = async () => {
      imp.disabled = true; imp.textContent = "מייבא…";
      let r; try { r = await api({a: "import", t: await idToken()}); } catch (err) { r = {ok: false, error: "אין חיבור לשרת הכניסה."}; }
      alert(r.ok ? "יובאו " + r.added + " אנשי צוות. מעכשיו הכניסה מנוהלת מהמסך הזה." : r.error);
      ui.render();
    };
    wire();
  },
  // עדכון ברקע בזמן עבודה: מרעננים את הרשימה רק אם לא מקלידים בה כרגע
  update() { const l = $("slist"), a = document.activeElement; if (l && !(l.contains(a) && /^(text|search|email|select-one)$/.test(a.type)) && a !== $("sq")) { l.innerHTML = listHtml(); wire(); } }
};

function wire() {
  for (const d of document.querySelectorAll("#slist [data-uid]")) {
    const p = people().find(x => x.uid === d.dataset.uid);
    if (d.tagName === "DETAILS") d.ontoggle = () => { if (d.open) open = p.uid; else if (open === p.uid) open = ""; };
    for (const c of d.querySelectorAll("[data-grp]")) c.onchange = () =>
      tryDo(() => saveStaff(p, {groups: [...d.querySelectorAll("[data-grp]")].filter(x => x.checked).map(x => x.dataset.grp)}));
    const f = d.querySelector(".pform"); if (f) f.onsubmit = async e => {
      e.preventDefault();
      const fd = new FormData(f), full = String(fd.get("full")).trim(), aliases = String(fd.get("aliases")).split(",").map(x => x.trim()).filter(Boolean);
      const tz = String(fd.get("tz") || "").trim(), patch = {};
      if (tz && !validId(tz)) { alert("מספר תעודת הזהות לא תקין. לבדוק את ההקלדה."); return; }
      if (fd.has("email")) patch.email = String(fd.get("email")).trim();
      if (fd.has("role")) patch.role = String(fd.get("role"));
      document.activeElement.blur();
      if (await tryDo(async () => {
        await saveStaff(p, {full, aliases, phone: String(fd.get("phone") || "").trim()});
        if (fd.has("email")) { if (tz) patch.h = [await idHash(tz)]; await saveAuth(p, patch); }
      })) ui.render();
    };
    const rm = d.querySelector("[data-rm]");
    if (rm) rm.onclick = async () => { if (confirm("להסיר את " + p.full + " מהצוות?\nהכניסה שלו/ה תיחסם והפרטים יימחקו. הודעות שכתב/ה יישארו.") && await tryDo(() => removePerson(p))) { open = ""; ui.render(); } };
    const off = d.querySelector("[data-off]");
    if (off) off.onchange = () => { if (off.checked && !confirm("לחסום את הכניסה של " + p.full + "?\nהחסימה מיידית, גם במכשיר שכבר מחובר.")) { off.checked = false; return; } tryDo(() => saveStaff(p, {off: off.checked})); };
  }
}
