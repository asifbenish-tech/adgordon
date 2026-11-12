// חלקי תצוגה משותפים למסכים.
import {esc, hue} from "./util.js";
import {groupLabel} from "./data.js";
import {S} from "./state.js";
export const ui = {render: () => {}};   // app.js מציב כאן ציור מחדש מלא של המסך הנוכחי
export const loading = '<p class="lead">טוען…</p>';
export const empty = (b, t) => '<div class="empty"><b>' + b + "</b>" + (t ? "<span>" + t + "</span>" : "") + "</div>";
export const field = (label, input) => '<label class="field"><span>' + label + "</span>" + input + "</label>";
export const secHead = (title, href, more) => '<div class="sec"><h3>' + title + "</h3>" + (href ? '<a href="' + href + '">' + more + "</a>" : "") + "</div>";
export const tags = ids => ids.map(g => '<span class="tag g-' + esc(g) + '">' + esc(groupLabel(g)) + "</span>").join("");
// עיגול של איש צוות: התמונה שלו אם העלה, אחרת האות הראשונה על צבע קבוע. p = {uid, name}
export const avatar = p => { const ph = S.photos && p.uid && S.photos[p.uid]; return '<span class="av" style="--h:' + hue(p.name) + '">' + (ph ? '<img src="' + esc(ph) + '" alt="">' : esc(String(p.name || "?").charAt(0))) + "</span>"; };
// שורת סינון לפי קבוצה: "הכל" + כל הקבוצות
export const chips = (groups, cur, attr) => '<div class="chips" role="group" aria-label="סינון">' +
  [{id: "", label: "הכל"}, ...groups].map(g => '<button type="button" ' + attr + '="' + esc(g.id) + '" aria-pressed="' + (g.id === cur) + '">' + esc(g.label) + "</button>").join("") + "</div>";
export async function tryDo(fn, failMsg) { try { await fn(); return true; } catch (e) { alert(failMsg || "הפעולה נכשלה. לבדוק את האינטרנט ולנסות שוב."); return false; } }
