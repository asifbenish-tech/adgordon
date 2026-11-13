// האזור האישי: נפתח בלחיצה על התמונה. המערכת שלי, השמירות, עדכון פרטים, ויציאה.
import {S} from "../state.js";
import {$, esc, DAYN} from "../util.js";
import {isAdmin, myFull, myGroups, nextDuty, roleOf} from "../data.js";
import {signOut} from "../auth.js";
import {tags, avatar} from "../ui.js";
import {slots, todayIdx} from "./tt.js";

const ROLE = {admin: "הנהלה", coordinator: "ריכוז בית", teacher: "צוות הוראה", classes: "צוות בית החינוך"};
const row = (href, icon, cls, title, sub) => '<a class="item" href="' + href + '"><div class="ico ' + cls + '"><i class="fa-solid ' + icon + '"></i></div><div><b>' + title + "</b><span>" + sub + '</span></div><i class="fa-solid fa-chevron-left go"></i></a>';

export default {
  parent: "home", tab: "",
  title: () => "האזור האישי",
  html() {
    const g = S.staff ? myGroups() : [], nd = S.duty && S.staff ? nextDuty() : null, n = S.T ? slots(S.user.name, todayIdx()).filter(s => s.ev.length).length : null;
    return '<div class="card prof"><a class="big" href="#/edit" aria-label="עדכון התמונה">' + avatar(S.user) + "</a><b>" + esc(myFull()) + "</b><span>" + esc(ROLE[roleOf()] || "צוות בית החינוך") + '</span><div class="tags">' + tags(g) + "</div></div>" +
      '<div class="list">' +
      row("#/tt", "fa-table-cells", "violet", "המערכת שלי", n == null ? "מערכת השעות האישית" : n ? (n === 1 ? "שיעור אחד היום" : n + " שיעורים היום") : "אין שיעורים היום") +
      row("#/duty", "fa-shield-halved", "", "תורנות שמירה", nd ? "הבאה: " + esc(nd.when) + " ב-" + esc(nd.slot.from.replace(/^0/, "")) + " · " + esc(nd.slot.places.join(" + ")) : "השמירות שלי והלוח המלא") +
      row("#/edit", "fa-user-pen", "blue", "עדכון פרטים", "תמונה, שם מלא, טלפון ומייל") +
      '</div><button type="button" class="btn ghost" id="out"><i class="fa-solid fa-right-from-bracket"></i> יציאה מהחשבון</button>';
  },
  bind() { $("out").onclick = signOut; }
};
