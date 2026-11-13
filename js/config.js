// הגדרות. שום דבר כאן אינו סוד (הריפו ציבורי).
// AUTH_API ריק = אין כניסה אמיתית; האפליקציה נפתחת רק במצב הדגמה.
export const AUTH_API = "https://script.google.com/macros/s/AKfycbybc8g3EQJ0Ki6YLg7WWwhsUGi_KlIEWcciPugCN0voO1S1INHxTZDHQ5oiPy64gLe0/exec";   // כתובת ה-Web App של server/Code.gs (מסתיימת ב-/exec)
export const SDK = "https://www.gstatic.com/firebasejs/12.19.0/";
export const FIREBASE = {
  apiKey: "AIzaSyAXThb9nGkGSKH8ulaznf0ABgzJmlRxYEo",
  authDomain: "gordon-staff.firebaseapp.com",
  projectId: "gordon-staff",
  storageBucket: "gordon-staff.firebasestorage.app",
  messagingSenderId: "120741333798",
  appId: "1:120741333798:web:301e18ca732bd6bca9cfe7"
};
export const TT_URL = "https://raw.githubusercontent.com/asifbenish-tech/gordon-timetable/master/timetable.json";
export const BOARD_URL = "https://asifbenish-tech.github.io/gordon-timetable/";
export const PORTAL_URL = "https://asifbenish-tech.github.io/gordon-staff/";
// לוח האירועים וההערכות: גיליון Google (שיתוף "כל מי שיש לו את הקישור"). נקרא חי, ישירות מהדפדפן.
export const EVENTS_SHEET = "1nSX51Fcz_fRJHfioBOMWF7WGZGgtXcsqoobJMXZlzmo";
export const EVENTS_URL = "https://docs.google.com/spreadsheets/d/" + EVENTS_SHEET + "/gviz/tq?tqx=out:json&headers=0";
export const EVENTS_VIEW = "https://docs.google.com/spreadsheets/d/" + EVENTS_SHEET + "/edit";
// התראות דחיפה: המפתח הציבורי (VAPID) מ-Firebase console -> Project settings -> Cloud Messaging -> Web Push certificates.
// ריק = אין התראות דחיפה (האפליקציה מציעה רק את יומן הטלפון).
export const PUSH_KEY = "BHr93LSQBTkb7Av1wAeSaFDkFjN0eYrNNQoGtkkh4tylPlXGRSjiP-sF_7bBmVwAhP7xl6PDxV56DPZkMdLX2Dw";
// לוח הצלצולים: שעה -> [התחלה, סוף]. משמש את "היום שלי" כדי להציג שיעורים לפי שעון.
// ההפסקות (9:40, 11:30, 12:35) תואמות את לוח השמירות. לאמת מול לוח הצלצולים הרשמי ולתקן כאן אם צריך.
export const BELLS = {1: ["08:10", "08:55"], 2: ["08:55", "09:40"], 3: ["10:00", "10:45"], 4: ["10:45", "11:30"], 5: ["11:50", "12:35"],
  6: ["12:55", "13:40"], 7: ["13:40", "14:25"], 8: ["14:25", "15:10"], 9: ["15:10", "15:55"]};
export const ID_SALT = "gordon-lohot-2026";   // אותו מלח כמו בלוח המערכות
// מצב הדגמה: בלי שרת ובלי Firebase, נתוני דוגמה שנשמרים רק במכשיר.
// פעיל כל עוד אין שרת כניסה, או עם ?demo=1 בכתובת.
export const DEMO = !AUTH_API || (() => { try { if (new URLSearchParams(location.search).has("demo")) sessionStorage.setItem("adgDemo", "1"); return sessionStorage.getItem("adgDemo") === "1"; } catch (e) { return false; } })();
// קבוצות ברירת המחדל. ההנהלה מוסיפה ומוחקת קבוצות במסך "ניהול צוות" (נשמר ב-meta/groups).
export const DEFAULT_GROUPS = [
  {id: "hA", label: "בית א"}, {id: "hB", label: "בית ב"}, {id: "hC", label: "בית ג"},
  {id: "home", label: "מחנכים"}, {id: "mgmt", label: "צוות ניהול"}, {id: "sec", label: "אחראי ביטחון"}
];
// קבוצות שהאפליקציה תלויה בהן: תמיד קיימות, גם אם רשימת הקבוצות נערכה לפני שנוספו.
// mgmt = תיבת הודעות נפרדת; sec = מקבלים התראה כשאיש צוות לא אישר הגעה לשמירה, ורואים מי אישר.
export const BUILTIN_GROUPS = ["mgmt", "sec"];
