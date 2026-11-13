// פורטל המידע בתוך האפליקציה. המקור היחיד הוא פורטל "צוות גורדון" (הריפו gordon-staff), שממשיך לפעול כרגיל:
// האפליקציה קוראת את העמוד שלו ואת activities.json בכל פתיחה ומציגה אותם כאן, כך שעדכון בפורטל מופיע גם פה.
import {S, changed} from "../state.js";
import {PORTAL_URL} from "../config.js";
import {$, esc, ls, parse, today, MONTHS} from "../util.js";
import {loading, empty, ui} from "../ui.js";

// צבעי הקטגוריות של הפורטל, מתורגמים לפלטה של האפליקציה (כחול דיו, זית, לבנה, זהב, ים)
const NAVY = "#1c3557", OLIVE = "#5f6f2e", BRICK = "#a8432a", GOLD = "#b9801f", SEA = "#2f6f73";
const COLORS = {blue: NAVY, red: BRICK, emerald: OLIVE, purple: NAVY, indigo: NAVY, pink: BRICK, cyan: SEA, amber: GOLD, yellow: GOLD,
  teal: SEA, fuchsia: BRICK, slate: "#6b6557", sky: SEA, orange: GOLD, violet: NAVY, rose: BRICK};
let q = "", asked = false;
const abs = h => new URL(h, PORTAL_URL).href;
const txt = (el, sel) => { const x = el.querySelector(sel); return x ? x.textContent.replace(/\s+/g, " ").trim() : ""; };

// מפרק את עמוד הפורטל: כל <section> הוא קטגוריה, כל a.card הוא קישור
export function parsePortal(html) {
  const doc = new DOMParser().parseFromString(html, "text/html"), out = [];
  for (const sec of doc.querySelectorAll("main section[id]")) {
    const cards = [...sec.querySelectorAll("a.card")].map(a => {
      const href = a.getAttribute("href") || "", ic = a.querySelector(".ico i"), color = ([...a.classList].find(c => c.startsWith("c-")) || "c-sky").slice(2);
      return {href: href === "#activities" ? "#/bank" : href.startsWith("#") ? abs(href) : abs(href), ext: href !== "#activities", title: txt(a, "h3"), desc: txt(a, ".desc"), note: txt(a, ".note span"),
        meta: href === "#activities" ? "" : txt(a, ".meta span"), icon: ic ? ic.className : "fa-solid fa-link", color: COLORS[color] || COLORS.sky, k: a.dataset.k || "", urgent: a.classList.contains("urgent")};
    }).filter(c => c.title);
    if (cards.length) out.push({id: sec.id, title: txt(sec, ".sec-head h2"), cards});
  }
  return out;
}
export function loadPortal() {
  if (asked) return; asked = true;
  S.portal = ls("adgPortal"); S.bank = ls("adgBank");
  fetch(PORTAL_URL, {cache: "no-cache"}).then(r => { if (!r.ok) throw 0; return r.text(); }).then(t => { const p = parsePortal(t); if (!p.length) throw 0; S.portal = p; ls("adgPortal", p); changed(); })
    .catch(() => { S.portal = S.portal || []; S.portalErr = true; changed(); });
  fetch(PORTAL_URL + "activities.json", {cache: "no-cache"}).then(r => r.json()).then(j => { S.bank = (j.events || []).sort((a, b) => a.date.localeCompare(b.date)); ls("adgBank", S.bank); changed(); })
    .catch(() => { S.bank = S.bank || []; changed(); });
}

const cardHtml = c => '<a class="item pcard' + (c.urgent ? " urgent" : "") + '" style="--c:' + c.color + '" href="' + esc(c.href) + '"' + (c.ext ? ' target="_blank" rel="noopener"' : "") + '><div class="ico"><i class="' + esc(c.icon) + '"></i></div><div><b>' + esc(c.title) +
  "</b><span>" + esc(c.desc) + "</span>" + (c.note ? '<span class="pnote"><i class="fa-solid fa-circle-info"></i> ' + esc(c.note) + "</span>" : "") + (c.meta ? "<small>" + esc(c.meta) + "</small>" : "") + '</div><i class="fa-solid ' + (c.ext ? "fa-arrow-up-right-from-square" : "fa-chevron-left") + ' go"></i></a>';
function listHtml() {
  const s = q.trim(), hit = c => !s || (c.title + " " + c.desc + " " + c.k).includes(s);
  const h = (S.portal || []).map(sec => { const cs = sec.cards.filter(hit); return cs.length ? '<h3 class="month">' + esc(sec.title) + '</h3><div class="list">' + cs.map(cardHtml).join("") + "</div>" : ""; }).join("");
  return h || empty(s ? "לא נמצא דבר עבור \"" + esc(s) + "\"" : "לא הצלחנו לטעון את פורטל המידע", s ? "" : '<a href="' + PORTAL_URL + '" target="_blank" rel="noopener">לפתיחת הפורטל בדפדפן</a>');
}

export const portal = {
  title: () => "פורטל המידע",
  html() {
    loadPortal();
    if (S.portal == null) return loading;
    return '<input class="search" id="pq2" type="search" placeholder="חיפוש מהיר (למשל: תורנויות, חדר אוכל)" value="' + esc(q) + '" autocomplete="off">' +
      (S.portalErr && S.portal.length ? '<div class="err" role="alert">אין חיבור לפורטל. מוצג העותק האחרון שנשמר במכשיר.</div>' : "") + '<div id="plist2">' + listHtml() + "</div>";
  },
  bind() { const i = $("pq2"); if (i) i.oninput = e => { q = e.target.value; $("plist2").innerHTML = listHtml(); }; },
  update() { const l = $("plist2"); if (l) l.innerHTML = listHtml(); }
};

// ---- מאגר הפעילויות: תיקייה לכל אירוע, ובתוכה הפעילויות והקבצים ----
const FILE = {pdf: "fa-file-pdf", word: "fa-file-word"};
function folder(e) {
  const d = parse(e.date);
  return '<a class="item" href="#/bank/' + encodeURIComponent(e.id) + '"><div class="ico rose"><i class="fa-solid ' + esc(e.icon || "fa-folder") + '"></i></div><div><b>' + esc(e.title) + "</b><span>" + d.getDate() + " ב" + MONTHS[d.getMonth()] + " " + d.getFullYear() +
    " · " + (e.activities.length ? (e.activities.length === 1 ? "פעילות אחת" : e.activities.length + " פעילויות") : "עדיין אין פעילויות") + '</span></div><i class="fa-solid fa-chevron-left go"></i></a>';
}
const activity = a => '<article class="msg"><b>' + esc(a.title) + "</b>" + (a.subtitle ? "<small>" + esc(a.subtitle) + (a.grades ? " · " + esc(a.grades) : "") + "</small>" : "") + (a.desc ? "<p>" + esc(a.desc) + "</p>" : "") +
  (a.parts && a.parts.length ? '<ul class="parts">' + a.parts.map(p => "<li><b>" + esc(p[0]) + "</b> " + esc(p[1]) + "</li>").join("") + "</ul>" : "") +
  '<div class="files">' + (a.files || []).map(f => '<a class="btn ghost small" href="' + esc(abs(f.href)) + '" target="_blank" rel="noopener"><i class="fa-solid ' + (FILE[f.type] || "fa-file") + '"></i> ' + esc(f.label) + "</a>").join("") + "</div></article>";

export const bank = {
  parent: "portal", tab: "portal",
  title: id => { const e = id && (S.bank || []).find(x => x.id === id); return e ? e.title : "מאגר הפעילויות"; },
  back: id => id ? "bank" : "portal",
  html(id) {
    loadPortal();
    if (S.bank == null) return loading;
    if (id) { const e = S.bank.find(x => x.id === id); if (!e) return empty("התיקייה לא נמצאה"); return (e.note ? '<p class="lead">' + esc(e.note) + "</p>" : "") + (e.activities.length ? e.activities.map(activity).join("") : empty("עדיין אין פעילויות בתיקייה הזו")); }
    if (!S.bank.length) return empty("לא הצלחנו לטעון את מאגר הפעילויות");
    const up = S.bank.filter(e => e.date >= today()), past = S.bank.filter(e => e.date < today()).reverse();
    return (up.length ? '<h3 class="month">האירועים הקרובים</h3><div class="list">' + up.map(folder).join("") + "</div>" : "") + (past.length ? '<h3 class="month">אירועים שעברו</h3><div class="list">' + past.map(folder).join("") + "</div>" : "");
  },
  bind() {}
};
