// צוות גורדון - שרת הכניסה (Google Apps Script, רץ בחשבון adgordon248@gmail.com)
// כניסה לאזור האישי באפליקציה: ת"ז -> קוד חד-פעמי במייל -> אסימון כניסה של Firebase.
//
// מי רשאי להיכנס ובאיזה תפקיד: מאגר הצוות ב-Firestore (staffAuth/<uid>: גיבובי ת"ז, מייל, תפקיד),
// שמנוהל ממסך "ניהול צוות" באפליקציה. כל עוד המאגר ריק (לפני הייבוא הראשון) השרת עובד כמו קודם:
// הרשימה של לוח המערכות (access_map.json + users_admin) והמיילים מהגיליון "מיילים".
// בנוסף: tick() רץ כל 5 דקות ושולח התראת דחיפה כ-10 דקות לפני תורנות שמירה.
//
// פרטיות: תעודות זהות לא מגיעות לכאן. הדפדפן מגבב את הת"ז (PBKDF2, כמו בלוח)
// ושולח רק את הגיבוב. הקוד שנשלח במייל נשמר רק כגיבוב, ל-10 דקות.
// סודות (מאפייני סקריפט, לא בגיט): SA_KEY - מפתח חשבון השירות של Firebase,
// PEPPER - מלח לגיבוב הקודים, נוצר ב-setup.

var PROJECT_ID = "gordon-staff";
var API_KEY = "AIzaSyAXThb9nGkGSKH8ulaznf0ABgzJmlRxYEo";   // מזהה ציבורי (מופיע גם באפליקציה), לא סוד
var ACCESS_URL = "https://raw.githubusercontent.com/asifbenish-tech/gordon-timetable/master/access_map.json";
var USERS_API = "https://script.google.com/macros/s/AKfycbwJyZr8roh7yF0P32iXu2MgMoz95K62urGr_BAVOeAsWhMjqP-J3JQP87XKZanTpxNI/exec";
var APP_NAME = "צוות גורדון";
// אסיף - גיבוב בלבד (אותו גיבוב כמו OWNER_HASH ב-users_admin, ציבורי ממילא). ב-setup מקבל
// את המייל של החשבון שמריץ את הסקריפט, אם עוד אין לו מייל בגיליון - כדי שאפשר לבדוק מיד.
var OWNER_HASH = "41f9510f74c6f9b8cbce9d8e4e8935e07529928654e13e3261cd25397b4c2794";
var CODE_MIN = 10;     // תוקף קוד, בדקות
var MAX_TRIES = 5;     // ניסיונות לכל קוד
var MAX_SENDS = 3;     // קודים לאותו אדם ב-10 דקות
var MAX_HOUR = 40;     // קודים לכל בית הספר בשעה (מכסת המייל של חשבון Gmail: 100 ביום)
var AUD = "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit";
// מפתח השירות: במאפיין הסקריפט SA_KEY, או מודבק כאן בעותק שבחשבון בלבד. בגיט זה תמיד נשאר ריק.
var SA_KEY_INLINE = null;

// להרצה ידנית: בפעם הראשונה יוצר את הגיליון, ובכל פעם מוסיף לגיליון שמות חדשים
// ובודק שמפתח השירות עובד מול Firebase. התוצאה מגיעה במייל.
function setup() {
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty("PEPPER")) p.setProperty("PEPPER", Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty("SHEET_ID")) {
    var ss = SpreadsheetApp.create("צוות גורדון - מיילים לכניסה");
    var sh = ss.getSheets()[0].setName("מיילים");
    sh.appendRow(["שם", "מייל", "הערה"]);
    sh.setFrozenRows(1);
    ss.insertSheet("log").appendRow(["זמן", "פעולה", "שם", "פרטים"]);
    p.setProperty("SHEET_ID", ss.getId());
  }
  CacheService.getScriptCache().remove("access");
  var added = syncNames_(), mine = fillOwner_(), test = selfTest_(), fst = fsTest_(), trig = "פעילות ✓";
  try { ensureTrigger_(); } catch (err) { trig = "נכשלה - " + err.message; }
  var url = SpreadsheetApp.openById(p.getProperty("SHEET_ID")).getUrl();
  var missing = emails_().filter(function (x) { return !x.email; }).length;
  MailApp.sendEmail(owner_(), APP_NAME + " - שרת הכניסה",
    "גיליון המיילים: " + url + "\n" +
    (added ? "נוספו לגיליון " + added + " שמות חדשים.\n" : "") +
    (mine ? "קוד הכניסה של " + mine + " יישלח ל-" + owner_() + " (אפשר לשנות בגיליון).\n" : "") +
    (missing ? "חסר מייל ל-" + missing + " אנשי צוות - הם לא יוכלו להיכנס עד שימולא.\n" : "לכל אנשי הצוות יש מייל.\n") +
    "\nבדיקת החיבור ל-Firebase: " + test + "\nבדיקת הקריאה ממאגר הצוות: " + fst + "\nהתראות על שמירות (בדיקה כל 5 דקות): " + trig + "\n");
  Logger.log("sheet: " + url + " | added: " + added + " | missing emails: " + missing + " | firebase: " + test);
}

function doGet() {
  return json_({ok: true, app: APP_NAME});
}

// האפליקציה שולחת POST עם גוף טקסט (JSON), כדי שהדפדפן לא יבקש אישור CORS מקדים.
function doPost(e) {
  var out;
  try {
    var r = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (r.a === "code") out = sendCode_(String(r.h || ""));
    else if (r.a === "verify") out = verify_(String(r.h || ""), String(r.c || ""));
    else if (r.a === "import") out = import_(String(r.t || ""));
    else if (r.a === "pushtest") out = pushTest_(String(r.t || ""));
    else out = {ok: false, error: "פעולה לא מוכרת."};
  } catch (err) { out = {ok: false, error: "שגיאה בשרת: " + err.message}; }
  return json_(out);
}

function sendCode_(h) {
  if (!/^[0-9a-f]{64}$/.test(h)) return {ok: false, error: "בקשה לא תקינה."};
  var u = access_()[h];
  if (!u) return {ok: false, error: "תעודת הזהות לא מופיעה ברשימת הצוות. אם זו טעות - לפנות לאסיף."};
  var to = mailFor_(u);
  if (!to) return {ok: false, error: "עדיין לא רשום מייל עבורך. לבקש מאסיף להוסיף אותו."};
  var c = CacheService.getScriptCache(), lock = LockService.getScriptLock(), code;
  if (!lock.tryLock(10000)) return {ok: false, error: "המערכת עמוסה. לנסות שוב בעוד רגע."};
  try {
    var sends = +(c.get("n_" + h) || 0), hk = "g_" + Math.floor(Date.now() / 3600000), all = +(c.get(hk) || 0);
    if (sends >= MAX_SENDS) return {ok: false, error: "נשלחו כבר " + MAX_SENDS + " קודים. אפשר לבקש שוב בעוד 10 דקות."};
    if (all >= MAX_HOUR) return {ok: false, error: "יש יותר מדי בקשות כניסה כרגע. לנסות שוב בעוד שעה."};
    code = newCode_();
    c.put("c_" + h, JSON.stringify({d: digest_(h + ":" + code), t: 0, exp: Date.now() + CODE_MIN * 60000}), CODE_MIN * 60);
    c.put("n_" + h, String(sends + 1), 600);
    c.put(hk, String(all + 1), 3600);
  } finally { lock.releaseLock(); }
  MailApp.sendEmail({
    to: to, name: APP_NAME, subject: "קוד כניסה: " + code,
    body: "שלום " + u.n + ",\nהקוד שלך לכניסה לאפליקציית " + APP_NAME + ": " + code +
      "\nהקוד בתוקף ל-" + CODE_MIN + " דקות.\nלא ביקשת להיכנס? אפשר להתעלם מהמייל.",
    htmlBody: '<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.6;color:#0f172a">' +
      "שלום " + esc_(u.n) + ",<br>הקוד שלך לכניסה לאפליקציית " + APP_NAME + ":" +
      '<div style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:14px 0;direction:ltr;text-align:right">' + code + "</div>" +
      "הקוד בתוקף ל-" + CODE_MIN + " דקות.<br>" +
      '<span style="color:#64748b">לא ביקשת להיכנס? אפשר להתעלם מהמייל.</span></div>'
  });
  log_("code", u.n, mask_(to));
  return {ok: true, to: mask_(to), name: u.n};
}

function verify_(h, code) {
  if (!/^[0-9a-f]{64}$/.test(h)) return {ok: false, error: "בקשה לא תקינה."};
  if (!/^\d{6}$/.test(code)) return {ok: false, error: "הקוד הוא 6 ספרות."};
  var c = CacheService.getScriptCache(), lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return {ok: false, error: "המערכת עמוסה. לנסות שוב בעוד רגע."};
  try {
    var rec = JSON.parse(c.get("c_" + h) || "null");
    if (!rec || rec.exp < Date.now()) return {ok: false, expired: true, error: "תוקף הקוד פג. לבקש קוד חדש."};
    if (digest_(h + ":" + code) !== rec.d) {
      rec.t++;
      if (rec.t >= MAX_TRIES) { c.remove("c_" + h); return {ok: false, expired: true, error: "יותר מדי ניסיונות. לבקש קוד חדש."}; }
      c.put("c_" + h, JSON.stringify(rec), Math.max(1, Math.ceil((rec.exp - Date.now()) / 1000)));
      return {ok: false, error: "הקוד שגוי. נשארו " + (MAX_TRIES - rec.t) + " ניסיונות."};
    }
    c.remove("c_" + h);
  } finally { lock.releaseLock(); }
  var u = access_()[h];
  if (!u) return {ok: false, error: "תעודת הזהות לא מופיעה ברשימת הצוות."};
  var claims = {n: u.n, r: u.r};
  if (u.h) claims.h = u.h;
  log_("login", u.n, "");
  return {ok: true, token: customToken_(uidOf_(u.n), claims), name: u.n};
}

// מי נכנס: גיבוב ת"ז -> {n: שם, r: תפקיד, h: בית, e: מייל}. המקור: staffAuth ב-Firestore.
// מאגר ריק = עוד לא יובא: הרשימה של לוח המערכות (בלי e - המייל מהגיליון).
function access_() {
  var c = CacheService.getScriptCache(), hit = c.get("access");
  if (hit) return JSON.parse(hit);
  var m = {}, docs = fsList_("staffAuth");
  if (docs.length) docs.forEach(function (d) {
    (d.h || []).forEach(function (h) { var u = {n: d.name, r: d.role || "teacher", e: d.email || ""}; if (d.house) u.h = d.house; if (d.name) m[h] = u; });
  });
  else m = legacy_();
  c.put("access", JSON.stringify(m), 120);
  return m;
}
function mailFor_(u) { return u.e !== undefined ? (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(u.e) ? u.e : "") : emailOf_(u.n); }

// הרשימה של לוח המערכות, ממוזגת בדיוק כמו בלוח (mergeAccess ב-viewer). משמשת עד הייבוא, ובייבוא עצמו.
function legacy_() {
  var m = JSON.parse(UrlFetchApp.fetch(ACCESS_URL).getContentText());
  try {   // אם שרת המשתמשים לא עונה - הרשימה הבסיסית, כמו בלוח
    var live = JSON.parse(UrlFetchApp.fetch(USERS_API, {muteHttpExceptions: true}).getContentText());
    if (live && live.ok) {
      Object.keys(live.removed || {}).forEach(function (h) { delete m[h]; });
      Object.keys(live.users || {}).forEach(function (h) { m[h] = live.users[h]; });
    }
  } catch (err) {}
  return m;
}

// ייבוא חד-פעמי (כפתור במסך ניהול הצוות, הנהלה בלבד): מעתיק את רשימת לוח המערכות + המיילים מהגיליון
// אל staffAuth ו-staff. מי שכבר קיים במאגר לא נדרס. מרגע שיש במאגר אנשים - הוא המקור היחיד לכניסה.
function import_(idToken) {
  var who = whoIs_(idToken);
  if (!who || who.r !== "admin") return {ok: false, error: "הפעולה פתוחה להנהלה בלבד."};
  var m = legacy_(), by = {}, mail = {}, have = {}, added = 0;
  emails_().forEach(function (x) { mail[x.name] = x.email; });
  fsList_("staffAuth").forEach(function (d) { have[d.id] = 1; });
  Object.keys(m).forEach(function (h) {
    var u = m[h]; if (!u.n) return;
    var p = by[u.n] = by[u.n] || {name: u.n, h: [], role: u.r || "teacher", email: mail[u.n] || ""};
    p.h.push(h); if (u.h) p.house = u.h;
  });
  Object.keys(by).forEach(function (n) {
    var uid = uidOf_(n), p = by[n];
    if (have[uid]) return;
    fsPatch_("staffAuth/" + uid, p);
    fsPatch_("staff/" + uid, {name: n, role: p.role}, ["name", "role"]);
    added++;
  });
  CacheService.getScriptCache().remove("access");
  log_("import", who.n, added + " נוספו");
  return {ok: true, added: added, total: Object.keys(by).length};
}

// מי מחזיק באסימון הזה (ID token של Firebase): {uid, n, r}
function whoIs_(idToken) {
  if (!idToken) return null;
  var r = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY, {
    method: "post", contentType: "application/json", muteHttpExceptions: true, payload: JSON.stringify({idToken: idToken})});
  if (r.getResponseCode() !== 200) return null;
  var u = (JSON.parse(r.getContentText()).users || [])[0];
  if (!u) return null;
  var c = {}; try { c = JSON.parse(u.customAttributes || "{}"); } catch (err) {}
  return {uid: u.localId, n: c.n || "", r: c.r || ""};
}

// ---- Firestore ו-FCM דרך REST, עם אסימון של חשבון השירות ----
var FS = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID + "/databases/(default)/documents/";
function oauth_() {
  var c = CacheService.getScriptCache(), hit = c.get("oauth");
  if (hit) return hit;
  var sa = saKey_(), now = Math.floor(Date.now() / 1000);
  var input = b64_(JSON.stringify({alg: "RS256", typ: "JWT"})) + "." + b64_(JSON.stringify({iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging"}));
  var r = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", {method: "post", muteHttpExceptions: true,
    payload: {grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: input + "." + b64_(Utilities.computeRsaSha256Signature(input, sa.private_key))}});
  var j = JSON.parse(r.getContentText());
  if (!j.access_token) throw new Error("חשבון השירות לא קיבל גישה: " + (j.error_description || j.error || r.getResponseCode()));
  c.put("oauth", j.access_token, 3000);
  return j.access_token;
}
function fsDec_(v) {
  if ("stringValue" in v) return v.stringValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(fsDec_);
  if ("mapValue" in v) return fsObj_(v.mapValue.fields || {});
  return null;
}
function fsObj_(f) { var o = {}; Object.keys(f).forEach(function (k) { o[k] = fsDec_(f[k]); }); return o; }
function fsEnc_(x) {
  if (typeof x === "string") return {stringValue: x};
  if (typeof x === "boolean") return {booleanValue: x};
  if (typeof x === "number") return x % 1 === 0 ? {integerValue: String(x)} : {doubleValue: x};
  if (Array.isArray(x)) return {arrayValue: {values: x.map(fsEnc_)}};
  if (x && typeof x === "object") { var f = {}; Object.keys(x).forEach(function (k) { f[k] = fsEnc_(x[k]); }); return {mapValue: {fields: f}}; }
  return {nullValue: null};
}
function fsList_(col) {
  var out = [], page = "";
  do {
    var r = UrlFetchApp.fetch(FS + col + "?pageSize=300" + (page ? "&pageToken=" + encodeURIComponent(page) : ""), {headers: {Authorization: "Bearer " + oauth_()}, muteHttpExceptions: true});
    if (r.getResponseCode() !== 200) throw new Error("קריאה מ-Firestore נכשלה (" + col + "): " + r.getResponseCode());
    var j = JSON.parse(r.getContentText());
    (j.documents || []).forEach(function (d) { var o = fsObj_(d.fields || {}); o.id = d.name.split("/").pop(); out.push(o); });
    page = j.nextPageToken || "";
  } while (page);
  return out;
}
// כתיבת מסמך. mask = רשימת שדות לעדכן בלי לגעת באחרים (בלי mask - המסמך מוחלף).
function fsPatch_(path, obj, mask) {
  var q = (mask || []).map(function (k) { return "updateMask.fieldPaths=" + encodeURIComponent(k); }).join("&");
  var r = UrlFetchApp.fetch(FS + path + (q ? "?" + q : ""), {method: "patch", contentType: "application/json", muteHttpExceptions: true,
    headers: {Authorization: "Bearer " + oauth_()}, payload: JSON.stringify({fields: fsEnc_(obj).mapValue.fields})});
  if (r.getResponseCode() !== 200) throw new Error("כתיבה ל-Firestore נכשלה (" + path + "): " + r.getResponseCode());
}

// ---- התראות דחיפה על תורנות שמירה ----
// כל מכשיר שהפעיל התראות כותב ל-push/<uid>: {tokens: {<אסימון FCM>: זמן}, duty: [{day, from, to, place}]}.
// tick רץ כל 5 דקות (הטריגר נוצר ב-setup) ושולח התראה 5-12 דקות לפני תחילת שמירה. פעם אחת לכל שמירה.
var LEAD_MIN = 5, LEAD_MAX = 12;
function tick() {
  var p = Utilities.formatDate(new Date(), "Asia/Jerusalem", "u|HH|mm|yyyy-MM-dd").split("|");
  var day = Number(p[0]) % 7, mins = Number(p[1]) * 60 + Number(p[2]), sent = 0;   // u: שני=1 ... ראשון=7 -> ראשון=0
  if (day === 6 || mins < 6 * 60 + 30 || mins > 16 * 60) return 0;
  var c = CacheService.getScriptCache();
  fsList_("push").forEach(function (d) {
    (d.duty || []).forEach(function (s) {
      var t = String(s.from || "").split(":"), lead = Number(t[0]) * 60 + Number(t[1]) - mins;
      if (s.day !== day || !(lead >= LEAD_MIN && lead <= LEAD_MAX)) return;
      var key = "p_" + d.id + "_" + p[3] + "_" + s.from;
      if (c.get(key)) return;
      c.put(key, "1", 3600);
      Object.keys(d.tokens || {}).forEach(function (tok) {
        if (push_(tok, "שמירה בעוד " + lead + " דקות", s.place + " · " + s.from + "–" + s.to, "#/duty")) sent++;
      });
    });
  });
  return sent;
}
function push_(token, title, body, url) {
  var r = UrlFetchApp.fetch("https://fcm.googleapis.com/v1/projects/" + PROJECT_ID + "/messages:send", {method: "post", contentType: "application/json", muteHttpExceptions: true,
    headers: {Authorization: "Bearer " + oauth_()},
    payload: JSON.stringify({message: {token: token, data: {title: title, body: body, url: url || ""}, webpush: {headers: {Urgency: "high", TTL: "900"}}}})});
  return r.getResponseCode() === 200;
}
// "שליחת התראת בדיקה" מהאפליקציה: לכל המכשירים של מי שביקש
function pushTest_(idToken) {
  var who = whoIs_(idToken);
  if (!who) return {ok: false, error: "צריך להיכנס מחדש."};
  var d = fsList_("push").filter(function (x) { return x.id === who.uid; })[0], n = 0;
  Object.keys((d && d.tokens) || {}).forEach(function (tok) { if (push_(tok, "התראת בדיקה", "ההתראות של אפליקציית גורדון פועלות במכשיר הזה.", "#/duty")) n++; });
  return n ? {ok: true, sent: n} : {ok: false, error: "ההתראה לא נשלחה. לכבות ולהפעיל שוב את ההתראות במכשיר."};
}
function ensureTrigger_() {
  var has = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === "tick"; });
  if (!has) ScriptApp.newTrigger("tick").timeBased().everyMinutes(5).create();
}
function fsTest_() {
  try { var n = fsList_("staffAuth").length; return "עובדת ✓ (" + (n ? n + " אנשי צוות במאגר" : "המאגר ריק - הכניסה לפי רשימת לוח המערכות עד הייבוא") + ")"; }
  catch (err) { return "נכשלה - " + err.message; }
}

function syncNames_() {
  var have = {}, m = access_(), names = [];
  emails_().forEach(function (x) { have[x.name] = 1; });
  Object.keys(m).forEach(function (h) { var n = m[h].n; if (n && !have[n]) { have[n] = 1; names.push(n); } });
  names.sort(function (a, b) { return a.localeCompare(b, "he"); });
  if (names.length) {
    var sh = sheet_("מיילים");
    sh.getRange(sh.getLastRow() + 1, 1, names.length, 3).setValues(names.map(function (n) { return [n, "", ""]; }));
  }
  return names.length;
}

function fillOwner_() {
  var o = access_()[OWNER_HASH];
  if (!o) return "";
  var sh = sheet_("מיילים"), v = sh.getDataRange().getValues();
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][0] || "").trim() !== o.n) continue;
    if (String(v[i][1] || "").trim()) return "";
    sh.getRange(i + 1, 2, 1, 1).setValues([[owner_()]]);
    return o.n;
  }
  return "";
}

function emails_() {
  var v = sheet_("מיילים").getDataRange().getValues(), out = [];
  for (var i = 1; i < v.length; i++) {
    var n = String(v[i][0] || "").trim(), e = String(v[i][1] || "").trim();
    if (n) out.push({name: n, email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e) ? e : ""});
  }
  return out;
}

function emailOf_(name) {
  var hit = emails_().filter(function (x) { return x.name === name && x.email; })[0];
  return hit ? hit.email : "";
}

// אסימון כניסה של Firebase (custom token), חתום במפתח חשבון השירות.
function customToken_(uid, claims) {
  var sa = saKey_(), now = Math.floor(Date.now() / 1000);
  var body = {iss: sa.client_email, sub: sa.client_email, aud: AUD, iat: now, exp: now + 3600, uid: uid};
  if (claims) body.claims = claims;
  var input = b64_(JSON.stringify({alg: "RS256", typ: "JWT"})) + "." + b64_(JSON.stringify(body));
  return input + "." + b64_(Utilities.computeRsaSha256Signature(input, sa.private_key));
}

function saKey_() {
  var raw = PropertiesService.getScriptProperties().getProperty("SA_KEY") || (SA_KEY_INLINE && JSON.stringify(SA_KEY_INLINE)), sa;
  if (!raw) throw new Error("חסר מפתח השירות (SA_KEY) - ראו server/README.txt");
  try { sa = JSON.parse(raw); } catch (err) { throw new Error("SA_KEY אינו JSON תקין - להדביק את כל תוכן הקובץ שהורד"); }
  if (!sa.client_email || !sa.private_key) throw new Error("SA_KEY חסר client_email או private_key");
  if (sa.project_id !== PROJECT_ID) throw new Error("SA_KEY שייך לפרויקט " + sa.project_id + " ולא ל-" + PROJECT_ID);
  return sa;
}

// בודק את כל השרשרת: חתימת אסימון -> כניסה ב-Firebase -> מחיקת משתמש הבדיקה.
function selfTest_() {
  try {
    var r = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=" + API_KEY, {
      method: "post", contentType: "application/json", muteHttpExceptions: true,
      payload: JSON.stringify({token: customToken_("selftest"), returnSecureToken: true})});
    var j = JSON.parse(r.getContentText());
    if (r.getResponseCode() !== 200) return "נכשלה - " + ((j.error && j.error.message) || r.getResponseCode());
    UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:delete?key=" + API_KEY, {
      method: "post", contentType: "application/json", muteHttpExceptions: true, payload: JSON.stringify({idToken: j.idToken})});
    return "עובדת ✓";
  } catch (err) { return "נכשלה - " + err.message; }
}

// מזהה משתמש קבוע לפי השם בלוח: t_ + hex של השם (כמו המזהים במסך אילוצי המורים).
function uidOf_(name) {
  return "t_" + Utilities.newBlob(name).getBytes().map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
}

function newCode_() {
  var x = parseInt(Utilities.getUuid().replace(/-/g, "").slice(0, 12), 16);   // 48 ביט אקראיים
  return ("00000" + (x % 1000000)).slice(-6);
}

function digest_(s) {
  return Utilities.computeHmacSha256Signature(s, PropertiesService.getScriptProperties().getProperty("PEPPER"))
    .map(function (b) { return ("0" + (b & 255).toString(16)).slice(-2); }).join("");
}

function b64_(x) {
  return (typeof x === "string" ? Utilities.base64EncodeWebSafe(x, Utilities.Charset.UTF_8) : Utilities.base64EncodeWebSafe(x)).replace(/=+$/, "");
}

function mask_(e) { var i = e.indexOf("@"); return e.charAt(0) + "•••" + e.slice(i); }
function esc_(s) { return String(s).replace(/[&<>"]/g, function (c) { return {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]; }); }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function log_(a, n, d) { sheet_("log").appendRow([new Date().toISOString(), a, n, d]); }
function sheet_(name) { return SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty("SHEET_ID")).getSheetByName(name); }
function owner_() { return Session.getEffectiveUser().getEmail(); }
