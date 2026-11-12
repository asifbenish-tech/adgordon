// לוח אירועים.
import {S} from "../state.js";
import {$, esc, parse, today, DAYN, MONTHS} from "../util.js";
import {isAdmin, upcoming} from "../data.js";
import {put, del} from "../store.js";
import {loading, empty, field, ui, tryDo} from "../ui.js";

export const evItem = (x, plain) => { const d = parse(x.date); return '<div class="item"><div class="date"><b>' + d.getDate() + "</b><small>" + MONTHS[d.getMonth()] + "</small></div><div><b>" + esc(x.title) +
  "</b><span>יום " + DAYN[d.getDay()] + (x.time ? " · " + esc(x.time) : "") + (x.place ? " · " + esc(x.place) : "") + (x.note ? " · " + esc(x.note) : "") + "</span></div>" +
  (isAdmin() && !plain ? '<button type="button" class="del" data-del="' + esc(x.id) + '" aria-label="מחיקה"><i class="fa-solid fa-trash-can"></i></button>' : "") + "</div>"; };

export default {
  title: () => "לוח אירועים",
  html() {
    if (S.events == null) return loading;
    const list = upcoming("events");
    let h = "", m = "";
    if (isAdmin()) h += '<details class="add"><summary><i class="fa-solid fa-plus"></i> אירוע חדש</summary><form id="eform">' +
      field("שם האירוע", '<input name="title" required maxlength="80">') +
      '<div class="two">' + field("תאריך", '<input name="date" type="date" required min="' + today() + '">') + field("שעה (לא חובה)", '<input name="time" type="time">') + "</div>" +
      field("מקום (לא חובה)", '<input name="place" maxlength="60">') + field("הערה (לא חובה)", '<input name="note" maxlength="120">') + '<button class="btn">הוספה ללוח</button></form></details>';
    if (!list.length) return h + empty("אין אירועים קרובים");
    for (const x of list) {
      const d = parse(x.date), k = MONTHS[d.getMonth()] + " " + d.getFullYear();
      if (k !== m) { h += (m ? "</div>" : "") + '<h3 class="month">' + k + '</h3><div class="list">'; m = k; }
      h += evItem(x);
    }
    return h + "</div>";
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-del]")) b.onclick = () => confirm("למחוק את האירוע?") && tryDo(() => del("events", b.dataset.del));
    const f = $("eform"); if (f) f.onsubmit = async e => {
      e.preventDefault();
      const o = {}; for (const [k, v] of new FormData(f)) o[k] = String(v).trim();
      if (await tryDo(() => put("events", null, o))) ui.render();
    };
  }
};
