// לשונית "כלים": אפליקציות נוספות שהצוות משתמש בהן. כל כלי = ריבוע אייקון גדול + שם + הסבר קצר, ונפתח בחלון חדש.
// ההנהלה מוסיפה, עורכת, מסדרת ומוחקת כלים כאן; הרשימה נשמרת ב-meta/tools.
import {S} from "../state.js";
import {$, esc, rid} from "../util.js";
import {isAdmin, tools, saveTools} from "../data.js";
import {empty, field, ui, tryDo} from "../ui.js";

const ICONS = ["fa-table-cells", "fa-school", "fa-book-open", "fa-utensils", "fa-chair", "fa-calendar-check", "fa-chalkboard-user", "fa-clipboard-list", "fa-children", "fa-graduation-cap", "fa-file-signature", "fa-laptop", "fa-music", "fa-futbol", "fa-heart-pulse", "fa-link"];
const COLORS = [["blue", "כחול"], ["teal", "טורקיז"], ["gold", "זהב"], ["green", "ירוק"], ["violet", "סגול"], ["rose", "אדום"], ["slate", "אפור"]];
let edit = false, editing = "";
const okUrl = u => /^https:\/\/[^\s]+\.[^\s]+$/.test(u);

function toolHtml(x, i, n) {
  const tile = '<div class="ico ' + esc(x.color || "blue") + '"><i class="fa-solid ' + esc(x.icon || "fa-link") + '"></i></div><div><b>' + esc(x.name) + "</b>" + (x.desc ? "<span>" + esc(x.desc) + "</span>" : "") + "</div>";
  if (!edit) return '<a class="item tool" href="' + esc(x.url) + '" target="_blank" rel="noopener">' + tile + '<i class="fa-solid fa-arrow-up-right-from-square go"></i></a>';
  return '<div class="item tool">' + tile + '<div class="tmove"><button type="button" class="del" data-up="' + i + '" aria-label="למעלה"' + (i ? "" : " disabled") + '><i class="fa-solid fa-arrow-up"></i></button>' +
    '<button type="button" class="del" data-down="' + i + '" aria-label="למטה"' + (i < n - 1 ? "" : " disabled") + '><i class="fa-solid fa-arrow-down"></i></button>' +
    '<button type="button" class="del" data-edit="' + esc(x.id) + '" aria-label="עריכה"><i class="fa-solid fa-pen"></i></button>' +
    '<button type="button" class="del" data-rm="' + esc(x.id) + '" aria-label="מחיקה"><i class="fa-solid fa-trash-can"></i></button></div></div>';
}

function formHtml(x) {
  x = x || {name: "", desc: "", url: "https://", icon: "fa-link", color: "blue"};
  return '<form class="pform" id="tform">' + field("שם האפליקציה", '<input name="name" required maxlength="40" value="' + esc(x.name) + '">') +
    field("הסבר קצר (לא חובה)", '<input name="desc" maxlength="80" value="' + esc(x.desc || "") + '">') +
    field("קישור", '<input name="url" type="url" dir="ltr" required maxlength="300" value="' + esc(x.url) + '">') +
    '<fieldset class="aud"><legend>אייקון</legend>' + ICONS.map(ic => '<label class="pill picon"><input type="radio" name="icon" value="' + ic + '"' + (ic === x.icon ? " checked" : "") + '><span><i class="fa-solid ' + ic + '"></i></span></label>').join("") + "</fieldset>" +
    '<fieldset class="aud"><legend>צבע</legend>' + COLORS.map(c => '<label class="pill"><input type="radio" name="color" value="' + c[0] + '"' + (c[0] === (x.color || "blue") ? " checked" : "") + "><span>" + c[1] + "</span></label>").join("") + "</fieldset>" +
    '<div class="two"><button class="btn">' + (editing ? "שמירה" : "הוספה") + '</button><button type="button" class="btn ghost" id="tcancel">ביטול</button></div></form>';
}

export default {
  title: () => "כלים",
  html() {
    if (S.staff == null) return '<div class="skel"><i></i><i></i><i></i></div>';
    const list = tools();
    let h = '<p class="lead">אפליקציות נוספות של בית החינוך. כל כלי נפתח בחלון חדש.</p>';
    h += list.length ? '<div class="list">' + list.map((x, i) => toolHtml(x, i, list.length)).join("") + "</div>" : empty("עדיין אין כלים", isAdmin() ? "אפשר להוסיף את הראשון כאן למטה." : "ההנהלה תוסיף כאן אפליקציות בהמשך.", "fa-grip");
    if (isAdmin()) {
      if (edit) h += editing ? '<div class="card">' + formHtml(list.find(x => x.id === editing)) + "</div>"
        : '<details class="add"><summary><i class="fa-solid fa-plus"></i> הוספת כלי</summary><div style="padding:0 1rem 1rem">' + formHtml() + "</div></details>";
      h += '<button type="button" class="btn ghost" id="tedit"><i class="fa-solid ' + (edit ? "fa-check" : "fa-pen") + '"></i> ' + (edit ? "סיום עריכה" : "עריכת הרשימה") + "</button>";
    }
    return h;
  },
  bind(el) {
    const te = $("tedit"); if (te) te.onclick = () => { edit = !edit; editing = ""; ui.render(); };
    const list = tools(), save = l => tryDo(() => saveTools(l)).then(ok => ok && ui.render());
    const move = (i, d) => { const l = list.slice(); [l[i], l[i + d]] = [l[i + d], l[i]]; save(l); };
    for (const b of el.querySelectorAll("[data-up]")) b.onclick = () => move(+b.dataset.up, -1);
    for (const b of el.querySelectorAll("[data-down]")) b.onclick = () => move(+b.dataset.down, 1);
    for (const b of el.querySelectorAll("[data-edit]")) b.onclick = () => { editing = b.dataset.edit; ui.render(); };
    for (const b of el.querySelectorAll("[data-rm]")) b.onclick = () => { const x = list.find(t => t.id === b.dataset.rm); if (x && confirm("להסיר את \"" + x.name + "\" מהרשימה?")) save(list.filter(t => t !== x)); };
    const c = $("tcancel"); if (c) c.onclick = () => { editing = ""; const d = el.querySelector("details.add"); if (d) d.open = false; ui.render(); };
    const f = $("tform"); if (f) f.onsubmit = e => {
      e.preventDefault();
      const fd = new FormData(f), v = k => String(fd.get(k) || "").trim(), x = {name: v("name"), desc: v("desc"), url: v("url"), icon: v("icon") || "fa-link", color: v("color") || "blue"};
      if (!okUrl(x.url)) { alert("הקישור צריך להתחיל ב-https://"); return; }
      const l = editing ? list.map(t => t.id === editing ? Object.assign({}, t, x) : t) : [...list, Object.assign({id: "t" + rid()}, x)];
      editing = ""; save(l);
    };
  }
};
