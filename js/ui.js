// חלקי תצוגה משותפים למסכים.
import {esc, hue} from "./util.js";
import {groupLabel} from "./data.js";
import {S} from "./state.js";
export const ui = {render: () => {}};   // app.js מציב כאן ציור מחדש מלא של המסך הנוכחי
// מצב טעינה: שלד של שורות מהבהבות, במקום המילה "טוען"
export const loading = '<div class="skel" role="status" aria-label="טוען"><i></i><i></i><i></i></div>';
// שיבולת - המוטיב מסמל בית החינוך. מופיעה במצבים ריקים.
const WHEAT = '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M24 44V14"/><path d="M24 14c0-4 1.5-7 0-10-1.5 3 0 6 0 10z"/><path d="M24 20c-3-1-6-4-7-8 4 0 7 3 7 8zM24 20c3-1 6-4 7-8-4 0-7 3-7 8zM24 28c-3-1-6-4-7-8 4 0 7 3 7 8zM24 28c3-1 6-4 7-8-4 0-7 3-7 8zM24 36c-3-1-6-4-7-8 4 0 7 3 7 8zM24 36c3-1 6-4 7-8-4 0-7 3-7 8z"/></svg>';
export const empty = (b, t) => '<div class="empty">' + WHEAT + "<b>" + b + "</b>" + (t ? "<span>" + t + "</span>" : "") + "</div>";
export const field = (label, input) => '<label class="field"><span>' + label + "</span>" + input + "</label>";
export const secHead = (title, href, more) => '<div class="sec"><h3>' + title + "</h3>" + (href ? '<a href="' + href + '">' + more + "</a>" : "") + "</div>";
export const tags = ids => ids.map(g => '<span class="tag g-' + esc(g) + '">' + esc(groupLabel(g)) + "</span>").join("");
// עיגול של איש צוות: התמונה שלו אם העלה, אחרת האות הראשונה על צבע קבוע. p = {uid, name}
export const avatar = p => { const ph = S.photos && p.uid && S.photos[p.uid]; return '<span class="av" style="--c:' + INKS[hue(p.name) % INKS.length] + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : esc(String(p.name || "?").charAt(0))) + "</span>"; };
// צבעי הרקע לאות הראשונה: מתוך הפלטה של הסמל (כחול, זית, לבנה, ים, חום-זהב)
const INKS = ["#1c3557", "#5f6f2e", "#a8432a", "#2f6f73", "#8a5a14", "#4a4e7a"];
// שורת סינון לפי קבוצה: "הכל" + כל הקבוצות
export const chips = (groups, cur, attr) => '<div class="chips" role="group" aria-label="סינון">' +
  [{id: "", label: "הכל"}, ...groups].map(g => '<button type="button" ' + attr + '="' + esc(g.id) + '" aria-pressed="' + (g.id === cur) + '">' + esc(g.label) + "</button>").join("") + "</div>";
export async function tryDo(fn, failMsg) { try { await fn(); return true; } catch (e) { alert(failMsg || "הפעולה נכשלה. לבדוק את האינטרנט ולנסות שוב."); return false; } }
