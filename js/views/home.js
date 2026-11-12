// מסך הבית: מה חשוב לי היום.
import {S} from "../state.js";
import {PORTAL_URL} from "../config.js";
import {$, esc, DAYN} from "../util.js";
import {isAdmin, myFull, myGroups, nextDuty, calDays, unreadChats, unreadBoard, unreadMgmt} from "../data.js";
import {signOut} from "../auth.js";
import {loading, empty, secHead, tags, avatar} from "../ui.js";
import {slots, slotHtml, todayIdx} from "./tt.js";
import {boardItem} from "./msg.js";
import {dayCard} from "./cal.js";
import {nowCard, bindNow} from "./duty.js";
import {ui} from "../ui.js";
import {today} from "../util.js";

const ROLE = {admin: "הנהלה", coordinator: "ריכוז בית", teacher: "צוות הוראה"};
const tile = (href, icon, cls, big, label) => '<a class="tile ' + cls + '" href="' + href + '"><i class="fa-solid ' + icon + '"></i><b>' + big + "</b><span>" + label + "</span></a>";

export default {
  title: () => "שלום, " + myFull().split(" ")[0],
  html() {
    const u = S.user, d = todayIdx(), list = S.T ? slots(u.name, d) : [], busy = list.filter(s => s.ev.length).length;
    const nd = S.duty && S.staff ? nextDuty() : null, g = S.staff ? myGroups() : [], un = unreadBoard() + unreadChats() + unreadMgmt();
    const days = S.sheet && S.events ? calDays() : null, td = days && days.find(x => x.date === today()), soon = days ? days.filter(x => x.date > today()) : [];
    const wk = new Date(); wk.setDate(wk.getDate() + 7); const week = soon.filter(x => new Date(x.date) <= wk).length + (td ? 1 : 0);
    let h = "";
    // מה קורה היום בבית החינוך: חג, חופשה, אירוע, מבחנים - מלוח האירועים וההערכות
    if (td) h += '<div class="todaybox"><h3><i class="fa-solid fa-bullhorn"></i> היום בבית החינוך</h3>' + dayCard(td, {plain: true}) + "</div>";
    const nc = nowCard(); h += nc;
    if (nd && !nc) h += '<a class="item duty next" href="#/duty"><div class="ico"><i class="fa-solid fa-shield-halved"></i></div><div><small>' + (nd.when === "היום" ? "יש לך שמירה היום" : "השמירה הבאה שלך") + "</small><b>" +
      esc(nd.when) + " · " + esc(nd.slot.from.replace(/^0/, "")) + "–" + esc(nd.slot.to.replace(/^0/, "")) + "</b><span>" + esc(nd.slot.places.join(" + ")) + '</span></div><i class="fa-solid fa-chevron-left go"></i></a>';
    h += '<div class="tiles">' +
      tile("#/msg", "fa-comments", "t1", un || '<i class="fa-solid fa-check"></i>', un ? (un === 1 ? "הודעה חדשה" : "הודעות חדשות") : "אין הודעות חדשות") +
      tile("#/tt", "fa-table-cells", "t2", S.T ? busy : "…", d === 6 ? "שבת שלום" : busy === 1 ? "שיעור היום" : "שיעורים היום") +
      tile("#/cal", "fa-calendar-days", "t3", days ? week : "…", "ימי אירועים השבוע") + "</div>";
    h += secHead("היום במערכת", "#/tt", "למערכת המלאה");
    h += !S.T ? loading : d === 6 ? empty("שבת שלום") : !busy ? empty("אין לך שיעורים היום") : '<div class="list">' + list.map(slotHtml).join("") + "</div>";
    h += secHead("הודעות אחרונות", "#/msg", "לכל ההודעות");
    h += S.board == null ? loading : S.board.length ? S.board.slice(0, 2).map(m => boardItem(m, true)).join("") : empty("אין הודעות");
    h += secHead("בימים הקרובים", "#/cal", "ללוח המלא");
    h += !days ? loading : soon.length ? soon.slice(0, 4).map(x => dayCard(x, {plain: true})).join("") : empty(S.sheet.err ? "לא הצלחנו לקרוא את לוח האירועים" : "אין אירועים קרובים");
    h += secHead("עוד") + '<div class="list">' + (isAdmin() ? '<a class="item" href="#/staff"><div class="ico blue"><i class="fa-solid fa-users-gear"></i></div><div><b>ניהול צוות וקבוצות</b><span>מי שייך לאיזה בית, מחנכים, צוות ניהול</span></div><i class="fa-solid fa-chevron-left go"></i></a>' : "") +
      '<a class="item who" href="#/me">' + avatar(u) + "<div><b>" + esc(myFull()) + "</b><span>" + esc(ROLE[u.role] || "צוות בית החינוך") + " · המערכת שלי, שמירות ועדכון פרטים</span>" +
      (g.length ? '<div class="tags">' + tags(g) + "</div>" : "") + '</div><i class="fa-solid fa-chevron-left go"></i></a></div>';
    return h;
  },
  bind() { bindNow(() => ui.render()); }
};
export const dateLine = () => { const d = new Date(); return "יום " + DAYN[d.getDay()] + " · " + d.toLocaleDateString("he-IL", {day: "numeric", month: "long"}); };
