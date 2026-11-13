// המעטפת: ניווט, סרגל עליון, לשוניות. כל מסך הוא מודול ב-js/views עם {title, html, bind, update?}.
import {S, onChange} from "./state.js";
import {DEMO} from "./config.js";
import {$, esc} from "./util.js";
import {ui, avatar} from "./ui.js";
import {initAuth, loginHtml, bindLogin} from "./auth.js";
import {unreadBoard, unreadChats, unreadMgmt} from "./data.js";
import {syncPush} from "./push.js";
import home, {dateLine} from "./views/home.js";
import tt from "./views/tt.js";
import duty from "./views/duty.js";
import cal from "./views/cal.js";
import {msg, chat, pick} from "./views/msg.js";
import staff from "./views/staff.js";
import profile from "./views/profile.js";
import menu from "./views/menu.js";
import {portal, bank} from "./views/portal.js";

const VIEWS = {home, msg, tt, duty, cal, chat, new: pick, staff, me: menu, edit: profile, portal, bank};
// המערכת והשמירות נמצאות באזור האישי (לחיצה על התמונה למעלה)
const TABS = [["home", "היום", "fa-sun"], ["msg", "הודעות", "fa-comments"], ["cal", "אירועים", "fa-calendar-days"], ["portal", "מידע", "fa-book-open"]];
let last = "";

export const route = () => { const [name, arg] = location.hash.replace(/^#\/?/, "").split("/"); return {name: VIEWS[name] ? name : "home", arg: arg ? decodeURIComponent(arg) : ""}; };
export const go = h => { if (location.hash === "#/" + h) render(true); else location.hash = "#/" + h; };

function render(force) {
  const el = $("view"), r = route(), v = VIEWS[r.name], key = r.name + "/" + r.arg;
  document.body.classList.toggle("in", !!S.user);
  if (!S.ready) { el.innerHTML = '<div class="skel" role="status" aria-label="טוען"><i></i><i></i><i></i></div>'; return; }
  if (!S.user) { document.body.classList.remove("hero"); $("sub").textContent = "אפליקציית הצוות"; $("title").textContent = "בית חינוך א.ד. גורדון"; $("back").hidden = true; el.innerHTML = loginHtml(); bindLogin(); if (last !== "login") enter(el); last = "login"; return; }
  const tab = v.tab != null ? v.tab : r.name;
  for (const a of $("tabs").children) a.setAttribute("aria-current", a.dataset.t === tab ? "page" : "false");
  badge();
  $("title").textContent = v.title(r.arg);
  document.body.classList.toggle("hero", r.name === "home");
  $("sub").textContent = r.name === "home" ? dateLine() : "בית חינוך א.ד. גורדון";
  $("me").innerHTML = avatar(S.user);
  $("back").hidden = !v.parent;
  // מי שמקליד עכשיו בטופס: לא לדרוס לו את המסך כשמגיע עדכון ברקע
  const typing = el.contains(document.activeElement) && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (!force && key === last && (typing || v.live)) { if (v.update) v.update(el, r.arg); return; }
  const top = el.scrollTop, same = key === last;
  last = key;
  el.innerHTML = (DEMO ? '<div class="demo"><b>מצב הדגמה.</b> נתוני דוגמה שנשמרים רק במכשיר הזה.</div>' : "") +
    (S.err ? '<div class="err" role="alert">' + esc(S.err) + "</div>" : "") + v.html(r.arg);
  v.bind(el, r.arg);
  if (!same) { window.scrollTo(0, 0); enter(el); } else el.scrollTop = top;
}

// כניסה מדורגת: רק כשעוברים מסך, לא בכל עדכון נתונים
function enter(el) { el.classList.remove("enter"); void el.offsetWidth; el.classList.add("enter"); clearTimeout(enter.t); enter.t = setTimeout(() => el.classList.remove("enter"), 700); }

// גודל טקסט: 100% / 112% / 125%, נשמר במכשיר. כל העיצוב ב-rem, כך שהכול גדל יחד.
const SIZES = [1, 1.12, 1.25];
function setFs(v) { document.documentElement.style.setProperty("--fs", v); $("aa").textContent = v > 1 ? "א" + "+".repeat(SIZES.indexOf(v)) : "א+"; $("aa").setAttribute("aria-label", "גודל טקסט: " + Math.round(v * 100) + "%"); }
setFs(SIZES.includes(+localStorage.getItem("adgFs")) ? +localStorage.getItem("adgFs") : 1);
$("aa").onclick = () => { const cur = +getComputedStyle(document.documentElement).getPropertyValue("--fs") || 1, v = SIZES[(SIZES.indexOf(cur) + 1) % SIZES.length]; try { localStorage.setItem("adgFs", v); } catch (e) {} setFs(v); };

function badge() {
  const em = document.querySelector('#tabs a[data-t="msg"] em'), n = unreadBoard() + unreadChats() + unreadMgmt();
  em.hidden = !n; em.textContent = n || "";
}

$("tabs").innerHTML = TABS.map(t => '<a href="#/' + t[0] + '" data-t="' + t[0] + '"><i class="fa-solid ' + t[2] + '"></i><span>' + t[1] + "</span><em hidden></em></a>").join("");
$("back").onclick = () => { const r = route(), v = VIEWS[r.name]; go((v.back && v.back(r.arg)) || v.parent || "home"); };
ui.render = () => render(true);
window.addEventListener("hashchange", () => render(true));
onChange(() => { render(false); syncPush().catch(() => {}); });
render(true);
initAuth();
setInterval(() => { if (S.user && !document.hidden) render(false); }, 60000);   // כרטיס "הגעתי לשמירה" מופיע ונעלם לפי השעה
if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("sw.js").catch(() => {});
