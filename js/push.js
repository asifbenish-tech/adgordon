// התראות דחיפה (FCM). המכשיר נרשם ב-push/<uid> עם האסימון שלו ועם השמירות של המשתמש;
// שרת הכניסה (tick ב-server/Code.gs) שולח התראה כ-10 דקות לפני כל שמירה. ההצגה עצמה ב-sw.js.
import {SDK, PUSH_KEY, DEMO} from "./config.js";
import {S} from "./state.js";
import {put} from "./store.js";
import {myDuty} from "./data.js";
import {firebaseApp, idToken, api} from "./auth.js";

// "unsupported" | "off" (עוד לא הוגדר בשרת) | "default" | "granted" | "denied"
export const pushState = () => !("Notification" in window && "serviceWorker" in navigator && "PushManager" in window) ? "unsupported" : !PUSH_KEY || DEMO ? "off" : Notification.permission;
export const isIos = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

let last = "";
// רושם/מרענן את המכשיר. נקרא בכל פתיחה (אם כבר אושר) ואחרי כל שינוי בשמירות שלי.
export async function syncPush() {
  if (pushState() !== "granted" || !S.user || !S.duty || !S.staff) return false;
  const duty = myDuty().map(x => ({day: x.day, from: x.from, to: x.to, place: x.places.join(" + ")})), sig = JSON.stringify(duty);
  if (sig === last) return true;
  const M = await import(SDK + "firebase-messaging.js"), reg = await navigator.serviceWorker.ready;
  const token = await M.getToken(M.getMessaging(firebaseApp()), {vapidKey: PUSH_KEY, serviceWorkerRegistration: reg});
  if (!token) return false;
  await put("push", S.user.uid, {tokens: {[token]: Date.now()}, duty, at: Date.now()}, true);
  last = sig; return true;
}
export async function enablePush() {
  const perm = await Notification.requestPermission();
  if (perm === "granted") { last = ""; await syncPush(); }
  return perm;
}
export const testPush = async () => api({a: "pushtest", t: await idToken()});

// הכרטיס שמוצג במסך השמירות ובפרופיל
export function pushCard() {
  const st = pushState();
  if (st === "off") return "";
  if (st === "unsupported") return isIos() ? '<div class="card note"><b><i class="fa-solid fa-bell"></i> התראות באייפון</b><p>כדי לקבל התראה לפני שמירה, מוסיפים את האפליקציה למסך הבית (כפתור השיתוף ← "הוסף למסך הבית") ופותחים אותה משם.</p></div>' : "";
  if (st === "granted") return '<div class="card note ok2"><b><i class="fa-solid fa-bell"></i> התראות פעילות במכשיר הזה</b><p>תגיע התראה כ-10 דקות לפני כל שמירה.</p><button type="button" class="btn ghost small" id="ptest">שליחת התראת בדיקה</button></div>';
  if (st === "denied") return '<div class="card note"><b><i class="fa-solid fa-bell-slash"></i> ההתראות חסומות במכשיר הזה</b><p>כדי להפעיל: בהגדרות הטלפון, תחת ההתראות של האפליקציה, לאפשר התראות.</p></div>';
  return '<div class="card note"><b><i class="fa-solid fa-bell"></i> התראה לפני שמירה</b><p>האפליקציה יכולה להתריע בטלפון כ-10 דקות לפני כל שמירה.</p><button type="button" class="btn" id="pon">הפעלת התראות</button></div>';
}
export function bindPush(render) {
  const on = document.getElementById("pon"), ts = document.getElementById("ptest");
  if (on) on.onclick = async () => { on.disabled = true; try { await enablePush(); } catch (e) { alert("לא הצלחנו להפעיל התראות במכשיר הזה. לנסות שוב מאוחר יותר."); } render(); };
  if (ts) ts.onclick = async () => { ts.disabled = true; let r; try { r = await testPush(); } catch (e) { r = {ok: false, error: "אין חיבור לשרת."}; } alert(r.ok ? "נשלחה. ההתראה אמורה להופיע בתוך כמה שניות." : r.error); ts.disabled = false; };
}
