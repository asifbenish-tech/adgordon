// חלקי תצוגה משותפים למסכים.
import {esc, hue} from "./util.js";
import {groupLabel} from "./data.js";
import {S} from "./state.js";
export const ui = {render: () => {}};   // app.js מציב כאן ציור מחדש מלא של המסך הנוכחי
// טעינה: שלד של שורות מהבהבות (לא המילה "טוען")
export const loading = '<div class="skel" role="status" aria-label="טוען"><i></i><i></i><i></i></div>';
// מצב ריק: אייקון בעיגול + כותרת + הסבר
export const empty = (b, t, icon) => '<div class="empty"><i class="fa-solid ' + (icon || "fa-mug-hot") + '"></i><b>' + b + "</b>" + (t ? "<span>" + t + "</span>" : "") + "</div>";
export const field = (label, input) => '<label class="field"><span>' + label + "</span>" + input + "</label>";
export const secHead = (title, href, more) => '<div class="sec"><h3>' + title + "</h3>" + (href ? '<a href="' + href + '">' + more + "</a>" : "") + "</div>";
export const tags = ids => ids.map(g => '<span class="tag g-' + esc(g) + '">' + esc(groupLabel(g)) + "</span>").join("");
// עיגול של איש צוות: התמונה שלו אם העלה, אחרת האות הראשונה על צבע קבוע. p = {uid, name}
const INKS = ["#1d3a6b", "#2c8a7e", "#6c5fbf", "#c2622a", "#4f8a35", "#2f6fd1", "#9a4a7a"];
export const avatar = p => { const ph = S.photos && p.uid && S.photos[p.uid]; return '<span class="av" style="--c:' + INKS[hue(p.name) % INKS.length] + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : esc(String(p.name || "?").charAt(0))) + "</span>"; };
// שורת סינון לפי קבוצה: "הכל" + כל הקבוצות
export const chips = (groups, cur, attr) => '<div class="chips" role="group" aria-label="סינון">' +
  [{id: "", label: "הכל"}, ...groups].map(g => '<button type="button" ' + attr + '="' + esc(g.id) + '" aria-pressed="' + (g.id === cur) + '">' + esc(g.label) + "</button>").join("") + "</div>";
export async function tryDo(fn, failMsg) { try { await fn(); return true; } catch (e) { alert(failMsg || "הפעולה נכשלה. לבדוק את האינטרנט ולנסות שוב."); return false; } }
