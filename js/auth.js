// כניסה: ת"ז -> גיבוב בטלפון -> קוד במייל -> אסימון Firebase. במצב הדגמה: כניסה בלחיצה.
import {AUTH_API, SDK, FIREBASE, DEMO, ID_SALT} from "./config.js";
import {S, changed} from "./state.js";
import {openStore} from "./store.js";
import {startData, loadTT} from "./data.js";
import {$, esc, ls, uidOf, nameOf, heSort} from "./util.js";

let A, auth, fbApp, step = {s: "id"};
// סמל בית החינוך (logo.png בשורש הריפו). אם הקובץ חסר - אייקון במקומו.
const LOGO = '<div class="biglogo"><img src="logo.png" alt="סמל בית חינוך א.ד. גורדון" onerror="this.parentNode.className=\'bigico\';this.outerHTML=\'<i class=&quot;fa-solid fa-user-lock&quot;></i>\'"></div>';

export async function initAuth() {
  loadTT();
  if (DEMO) { S.user = ls("adgDemoUser"); S.ready = true; if (S.user) await enter(); changed(); return; }
  const [F, Au] = await Promise.all([import(SDK + "firebase-app.js"), import(SDK + "firebase-auth.js")]);
  A = Au; fbApp = F.initializeApp(FIREBASE);
  auth = A.initializeAuth(fbApp, {persistence: [A.indexedDBLocalPersistence, A.browserLocalPersistence]});
  A.onAuthStateChanged(auth, async u => {
    S.user = u ? await profile(u) : null; S.ready = true;
    if (S.user) await enter();
    changed();
  });
}
async function enter() { try { await openStore(fbApp); startData(); } catch (e) { S.err = "לא הצלחנו להתחבר למאגר הנתונים."; } }

// השם נגזר מהמזהה, כך שהוא תמיד זמין; התפקיד מגיע מהאסימון שהשרת חתם.
async function profile(u) {
  let c = ls("adgMe") || {};
  try { c = (await u.getIdTokenResult()).claims; ls("adgMe", {r: c.r, h: c.h}); } catch (e) {}
  return {uid: u.uid, name: nameOf(u.uid), role: c.r || "", house: c.h || ""};
}

export function signOut() {
  if (!confirm("לצאת מהחשבון במכשיר הזה?")) return;
  ls("adgMe", null);
  if (DEMO) { ls("adgDemoUser", null); ls("adgDemoData", null); ls("adgSeen", null); ls("adgChatSeen", null); location.hash = ""; location.reload(); return; }
  A.signOut(auth).then(() => { location.hash = ""; location.reload(); });
}

export function loginHtml() {
  if (DEMO) return '<div class="card form">' + LOGO + '<h2>מצב הדגמה</h2>' +
    "<p>כך האפליקציה תיראה. הנתונים הם דוגמה ונשמרים רק במכשיר הזה. הכניסה האמיתית תהיה עם תעודת זהות וקוד שמגיע למייל.</p>" +
    '<button type="button" class="btn" data-demo="teacher">כניסה כאיש/אשת צוות</button><button type="button" class="btn ghost" data-demo="admin">כניסה כהנהלה</button></div>';
  const err = step.err ? '<div class="err" role="alert">' + esc(step.err) + "</div>" : step.note ? '<div class="ok" role="status">' + esc(step.note) + "</div>" : "";
  if (step.s === "id") return '<form class="card form" id="lform" novalidate>' +
    LOGO + "<h2>כניסה</h2>" +
    "<p>נכנסים פעם אחת בכל מכשיר. אחרי הכניסה האפליקציה זוכרת אותך.</p>" +
    '<label class="field code"><span>תעודת זהות</span><input id="lin" inputmode="numeric" autocomplete="off" maxlength="9" required value="' + esc(step.id || "") + '"></label>' +
    err + '<button class="btn"' + (step.busy ? " disabled" : "") + ">" + (step.busy ? "שולח…" : "שליחת קוד למייל") + "</button>" +
    '<p class="hint">תעודת הזהות לא יוצאת מהמכשיר: נשלח רק קוד חד־כיווני שמחושב ממנה.</p></form>';
  return '<form class="card form" id="lform" novalidate>' +
    '<div class="bigico"><i class="fa-solid fa-envelope-open-text"></i></div><h2>בדקו את המייל</h2>' +
    "<p>שלום " + esc(step.name) + ', שלחנו קוד בן 6 ספרות אל <bdi dir="ltr">' + esc(step.to) + "</bdi>. הקוד בתוקף ל-10 דקות.</p>" +
    '<label class="field code"><span>הקוד מהמייל</span><input id="lin" inputmode="numeric" autocomplete="one-time-code" maxlength="6" required></label>' +
    err + '<button class="btn"' + (step.busy ? " disabled" : "") + ">" + (step.busy ? "רגע…" : "כניסה") + "</button>" +
    '<div class="row"><button type="button" class="link" id="lre">שליחת קוד חדש</button><button type="button" class="link" id="lreset">תעודת זהות אחרת</button></div></form>';
}

export function bindLogin() {
  if (DEMO) {
    for (const b of document.querySelectorAll("[data-demo]")) b.onclick = async () => {
      const names = S.T ? Object.keys(S.T.teachers).sort(heSort) : [], want = b.dataset.demo === "admin" ? "אסיף" : "גלית", name = names.includes(want) ? want : names[0] || "אנה";
      S.user = {uid: uidOf(name), name, role: b.dataset.demo, house: ""};
      ls("adgDemoUser", S.user); await enter(); changed();
    };
    return;
  }
  const f = $("lform"), inp = $("lin");
  f.onsubmit = e => { e.preventDefault(); step.s === "id" ? askCode(inp.value) : sendCode(inp.value); };
  if (step.s === "code") {
    inp.oninput = () => { inp.value = inp.value.replace(/\D/g, "").slice(0, 6); if (inp.value.length === 6) sendCode(inp.value); };
    $("lre").onclick = () => askCode(step.id);
    $("lreset").onclick = () => { step = {s: "id"}; changed(); };
  }
  if (!step.busy) inp.focus();
}

async function askCode(raw) {
  const id = String(raw || "").replace(/\D/g, "");
  if (id.length < 5) { step.err = "צריך להקליד את מספר תעודת הזהות המלא."; changed(); return; }
  step = Object.assign(step, {id, busy: true, err: ""}); changed();
  try {
    step.h = await idHash(id);
    const r = await api({a: "code", h: step.h}), again = step.s === "code";
    step = r.ok ? {s: "code", id, h: step.h, to: r.to, name: r.name, note: again ? "נשלח קוד חדש. הקוד הקודם כבר לא בתוקף." : ""} : {s: "id", id, err: r.error};
  } catch (e) { step = {s: step.s, id, h: step.h, to: step.to, name: step.name, err: "אין חיבור לשרת הכניסה. לבדוק את האינטרנט ולנסות שוב."}; }
  changed();
}

async function sendCode(code) {
  if (step.busy) return;
  if (!/^\d{6}$/.test(code)) { step.err = "הקוד הוא 6 ספרות."; changed(); return; }
  step.busy = true; step.err = ""; changed();
  try {
    const r = await api({a: "verify", h: step.h, c: code});
    if (r.ok) { await A.signInWithCustomToken(auth, r.token); step = {s: "id"}; return; }
    step.err = r.error;
    if (r.expired) step = {s: "id", id: step.id, err: r.error};
  } catch (e) { step.err = "הכניסה נכשלה. לבדוק את האינטרנט ולנסות שוב."; }
  step.busy = false; changed();
}

async function api(body) {
  const r = await fetch(AUTH_API, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify(body)});
  return r.json();
}

// אותו גיבוב כמו בכניסה ללוח המערכות (PBKDF2-SHA256, 100 אלף איטרציות)
async function idHash(raw) {
  const id = raw.replace(/\D/g, "").padStart(9, "0"), enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(id), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({name: "PBKDF2", hash: "SHA-256", salt: enc.encode(ID_SALT), iterations: 100000}, key, 256);
  return [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, "0")).join("");
}
