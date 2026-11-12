// ניהול צוות וקבוצות (הנהלה בלבד). מי נכנס לאפליקציה נקבע ברשימת הת"ז של לוח המערכות;
// כאן מגדירים לכל איש צוות לאילו קבוצות הוא שייך, ואפשר לחסום כניסה.
import {S} from "../state.js";
import {$, esc, uidOf, rid} from "../util.js";
import {isAdmin, groups, people, saveStaff, saveGroups, suggestGroups} from "../data.js";
import {empty, field, tags, avatar, chips, ui, tryDo} from "../ui.js";

let q = "", flt = "", open = "";

function listHtml() {
  const s = q.trim(), all = people(), list = all.filter(p => (!flt || p.groups.includes(flt)) && (!s || p.full.includes(s) || p.name.includes(s)));
  if (!list.length) return empty("לא נמצאו אנשי צוות");
  return '<p class="hint">' + list.length + " מתוך " + all.length + " אנשי צוות</p>" + list.map(p =>
    '<details class="person' + (p.off ? " off" : "") + '" data-uid="' + esc(p.uid) + '"' + (open === p.uid ? " open" : "") + "><summary>" + avatar(p.name) + "<div><b>" + esc(p.full) +
    '</b><div class="tags">' + (p.off ? '<span class="tag red">חסום/ה</span>' : "") + (tags(p.groups) || (p.off ? "" : '<span class="none">בלי קבוצות</span>')) + "</div></div></summary>" +
    '<div class="pbody"><div class="aud">' + groups().map(g => '<label class="pill"><input type="checkbox" data-grp="' + esc(g.id) + '"' + (p.groups.includes(g.id) ? " checked" : "") + "><span>" + esc(g.label) + "</span></label>").join("") + "</div>" +
    (p.uid === S.user.uid ? "" : '<label class="check"><input type="checkbox" data-off' + (p.off ? " checked" : "") + "> חסימת כניסה לאפליקציה</label>") +
    '<p class="hint">השם בלוח המערכות: ' + esc(p.name) + "</p></div></details>").join("");
}

export default {
  parent: "home", tab: "home",
  title: () => "ניהול צוות וקבוצות",
  html() {
    if (!isAdmin()) return empty("המסך הזה פתוח להנהלה בלבד");
    if (S.staff == null) return '<p class="lead">טוען…</p>';
    const sug = suggestGroups();
    return '<input class="search" id="sq" type="search" placeholder="חיפוש לפי שם" value="' + esc(q) + '" autocomplete="off">' + chips(groups(), flt, "data-g") +
      (sug.length ? '<button type="button" class="btn ghost" id="sug"><i class="fa-solid fa-wand-magic-sparkles"></i> שיוך מחנכים ובתים לפי מערכת השעות (' + sug.length + ")</button>" : "") +
      '<div class="list" id="slist">' + listHtml() + "</div>" +
      '<h3 class="month">קבוצות</h3><div class="list">' + groups().map(g => '<div class="item slim"><div><b>' + esc(g.label) + "</b><span>" + people().filter(p => p.groups.includes(g.id)).length + ' אנשי צוות</span></div><button type="button" class="del" data-delg="' + esc(g.id) + '" aria-label="מחיקת הקבוצה"><i class="fa-solid fa-trash-can"></i></button></div>').join("") + "</div>" +
      '<details class="add"><summary><i class="fa-solid fa-plus"></i> קבוצה חדשה</summary><form id="gform">' + field("שם הקבוצה", '<input name="label" required maxlength="30" placeholder="למשל: צוות חטיבה, רכזי מקצוע">') + '<button class="btn">הוספה</button></form></details>' +
      '<details class="add"><summary><i class="fa-solid fa-user-plus"></i> איש צוות שלא מופיע ברשימה</summary><form id="nform">' + field("השם, בדיוק כמו בלוח המערכות", '<input name="name" required maxlength="40">') +
      '<p class="hint">הכניסה עצמה נקבעת לפי תעודת הזהות בעמוד המשתמשים של לוח המערכות. כאן רק מוסיפים את האדם לרשימה כדי לשייך אותו לקבוצות.</p><button class="btn">הוספה</button></form></details>';
  },
  bind(el) {
    if (!isAdmin() || S.staff == null) return;
    $("sq").oninput = e => { q = e.target.value; $("slist").innerHTML = listHtml(); wire(); };
    for (const b of el.querySelectorAll("[data-g]")) b.onclick = () => { flt = b.dataset.g; ui.render(); };
    const sug = $("sug"); if (sug) sug.onclick = async () => {
      const list = suggestGroups();
      if (!confirm("לשייך " + list.length + " מחנכים לקבוצת \"מחנכים\" ולבית של הכיתה שלהם?\nהפעולה רק מוסיפה שיוכים, ואפשר לשנות כל אחד אחר כך.")) return;
      if (await tryDo(() => Promise.all(list.map(x => saveStaff(x.p, {groups: x.groups}))))) ui.render();
    };
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
      const name = String(new FormData(e.target).get("name")).trim();
      if (people().some(p => p.name === name)) { alert("השם הזה כבר ברשימה."); return; }
      if (await tryDo(() => saveStaff({uid: uidOf(name), name}, {groups: []}))) { q = ""; flt = ""; open = uidOf(name); ui.render(); }
    };
    wire();
  },
  update() { if ($("slist") && document.activeElement !== $("sq")) { $("slist").innerHTML = listHtml(); wire(); } }
};

function wire() {
  for (const d of document.querySelectorAll("#slist details.person")) {
    const p = people().find(x => x.uid === d.dataset.uid);
    d.ontoggle = () => { if (d.open) open = p.uid; else if (open === p.uid) open = ""; };
    for (const c of d.querySelectorAll("[data-grp]")) c.onchange = () =>
      tryDo(() => saveStaff(p, {groups: [...d.querySelectorAll("[data-grp]")].filter(x => x.checked).map(x => x.dataset.grp)}));
    const off = d.querySelector("[data-off]");
    if (off) off.onchange = () => { if (off.checked && !confirm("לחסום את הכניסה של " + p.full + "?\nהחסימה מיידית, גם במכשיר שכבר מחובר.")) { off.checked = false; return; } tryDo(() => saveStaff(p, {off: off.checked})); };
  }
}
