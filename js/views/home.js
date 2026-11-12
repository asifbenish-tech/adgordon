// מסך הבית: מה חשוב לי היום.
import {S} from "../state.js";
import {PORTAL_URL} from "../config.js";
import {$, esc, nice} from "../util.js";
import {isAdmin, fullName, myGroups, myDuties, upcoming, unreadChats} from "../data.js";
import {signOut} from "../auth.js";
import {loading, empty, secHead, tags, avatar} from "../ui.js";
import {slots, slotHtml, todayIdx} from "./tt.js";
import {boardItem} from "./msg.js";
import {evItem} from "./cal.js";

const ROLE = {admin: "הנהלה", coordinator: "ריכוז בית", teacher: "צוות הוראה"};

export default {
  title: () => "שלום, " + fullName(S.user.name).split(" ")[0],
  html() {
    const u = S.user, d = todayIdx(), list = S.T ? slots(u.name, d) : [], nd = S.duties ? myDuties()[0] : null, g = S.staff ? myGroups() : [], uc = unreadChats();
    let h = '<div class="card who">' + avatar(u.name) + "<div><b>" + esc(fullName(u.name)) + "</b><span>" + esc(ROLE[u.role] || "צוות בית החינוך") + "</span>" +
      (g.length ? '<div class="tags">' + tags(g) + "</div>" : "") + '</div><button type="button" class="link" id="out">יציאה</button></div>';
    if (nd) h += '<a class="item duty next" href="#/duty"><div class="ico"><i class="fa-solid fa-shield-halved"></i></div><div><small>השמירה הבאה שלך</small><b>' +
      esc(nice(nd.date)) + " · " + esc(nd.from) + "–" + esc(nd.to) + "</b><span>" + esc(nd.place) + "</span></div></a>";
    if (uc) h += '<a class="item" href="#/msg"><div class="ico blue"><i class="fa-solid fa-comment-dots"></i></div><div><b>' + (uc === 1 ? "שיחה אחת עם הודעה חדשה" : uc + " שיחות עם הודעות חדשות") + "</b><span>לשיחות הפרטיות</span></div></a>";
    h += secHead("היום במערכת", "#/tt", "למערכת המלאה");
    h += !S.T ? loading : d === 6 ? empty("שבת שלום") : !list.some(s => s.ev.length) ? empty("אין לך שיעורים היום") : '<div class="list">' + list.map(slotHtml).join("") + "</div>";
    h += secHead("הודעות אחרונות", "#/msg", "לכל ההודעות");
    h += S.board == null ? loading : S.board.length ? S.board.slice(0, 2).map(m => boardItem(m, true)).join("") : empty("אין הודעות");
    const ev = upcoming("events").slice(0, 3);
    h += secHead("האירועים הקרובים", "#/cal", "ללוח המלא");
    h += S.events == null ? loading : ev.length ? '<div class="list">' + ev.map(x => evItem(x, true)).join("") + "</div>" : empty("אין אירועים קרובים");
    h += '<div class="list links">' + (isAdmin() ? '<a class="item" href="#/staff"><div class="ico blue"><i class="fa-solid fa-users-gear"></i></div><div><b>ניהול צוות וקבוצות</b><span>מי שייך לאיזה בית, מחנכים, צוות ניהול</span></div></a>' : "") +
      '<a class="item" href="' + PORTAL_URL + '" target="_blank" rel="noopener"><div class="ico blue"><i class="fa-solid fa-book-open"></i></div><div><b>פורטל המידע לצוות</b><span>טפסים, דיווחים וקישורים</span></div></a></div>';
    return h;
  },
  bind() { $("out").onclick = signOut; }
};
