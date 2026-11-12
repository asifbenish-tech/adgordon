// בדיקה מקומית של server/Code.gs בלי Google: מריץ את הקוד מול חיקויים של שירותי
// Apps Script ובודק את כל מסלול הכניסה, כולל חתימת האסימון.
// הרצה: node server/test_server.js
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), crypto = require("crypto"), assert = require("assert");

const OWNER_H = "a".repeat(64), OTHER_H = "b".repeat(64), REMOVED_H = "c".repeat(64), LIVE_H = "d".repeat(64);
const ACCESS = {[OWNER_H]: {n: "אסיף", r: "admin", p: 1}, [OTHER_H]: {n: "אנה", r: "teacher"}, [REMOVED_H]: {n: "ארז", r: "teacher"}};
const LIVE = {ok: true, users: {[LIVE_H]: {n: "לייה", r: "coordinator", h: "A"}}, removed: {[REMOVED_H]: "ארז"}};
const {privateKey, publicKey} = crypto.generateKeyPairSync("rsa", {modulusLength: 2048});
const SA = {project_id: "gordon-staff", client_email: "firebase-adminsdk@gordon-staff.iam.gserviceaccount.com",
  private_key: privateKey.export({type: "pkcs8", format: "pem"})};

function makeEnv() {
  const props = {SA_KEY: JSON.stringify(SA)}, cache = {}, mails = [], sheets = {};
  const fsdb = {}, pushes = [], triggers = [], tokens = {}, valid = {};
  // אסימון זיהוי מדומה: מחזיר JWT ש-lookup מכיר. forge = אותו גוף, אבל Google לא מכירה אותו
  const mint = (uid, claims) => { const t = "h." + Buffer.from(JSON.stringify(Object.assign({user_id: uid}, claims))).toString("base64url") + ".s" + Object.keys(valid).length; valid[t] = uid; return t; };   // Firestore מדומה: {"col/id": fields}; התראות שנשלחו; אסימוני משתמשים
  let now = Date.parse("2026-10-25T08:00:00Z");
  const toBytes = b => Array.from(b, x => (x > 127 ? x - 256 : x));   // כמו Java: בתים עם סימן
  const sheet = name => ({
    rows: sheets[name],
    appendRow(r) { this.rows.push(r); },
    setFrozenRows() {},
    getLastRow() { return this.rows.length; },
    getRange(r, c) { const rows = this.rows; return {setValues(v) { v.forEach((row, i) => { rows[r - 1 + i] = rows[r - 1 + i] || []; row.forEach((x, j) => { rows[r - 1 + i][c - 1 + j] = x; }); }); }}; },
    getDataRange() { const rows = this.rows; return {getValues: () => rows.map(x => x.slice())}; },
    setName(n) { sheets[n] = this.rows; return sheet(n); },
  });
  const env = {
    Date: class extends Date { constructor(...a) { a.length ? super(...a) : super(now); } static now() { return now; } },
    Logger: {log() {}},
    PropertiesService: {getScriptProperties: () => ({getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; }})},
    CacheService: {getScriptCache: () => ({
      get: k => (cache[k] && cache[k].exp > now ? cache[k].v : null),
      put: (k, v, ttl) => { cache[k] = {v: String(v), exp: now + ttl * 1000}; },
      remove: k => { delete cache[k]; },
    })},
    LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock() {}})},
    MailApp: {sendEmail(a, b, c) { mails.push(typeof a === "object" ? a : {to: a, subject: b, body: c}); }},
    Session: {getEffectiveUser: () => ({getEmail: () => "adgordon248@gmail.com"})},
    SpreadsheetApp: {
      create() { sheets.Sheet1 = []; return {getSheets: () => [sheet("Sheet1")], insertSheet: n => { sheets[n] = []; return sheet(n); }, getId: () => "SHEET", getUrl: () => "https://sheet"}; },
      openById: () => ({getSheetByName: n => sheet(n), getUrl: () => "https://sheet"}),
    },
    UrlFetchApp: {fetchAll(reqs) { return reqs.map(q => this.fetch(q.url, q)); }, fetch(url, opt) {
      const res = (code, o) => ({getResponseCode: () => code, getContentText: () => JSON.stringify(o)});
      if (url.includes("access_map.json")) return res(200, ACCESS);
      if (url.includes("script.google.com")) return res(200, LIVE);
      if (url.includes("signInWithCustomToken")) {
        const tok = JSON.parse(opt.payload).token, [h, b, s] = tok.split(".");
        const ok = crypto.verify("RSA-SHA256", Buffer.from(h + "." + b), publicKey, Buffer.from(s, "base64url"));
        return ok ? res(200, {idToken: "x"}) : res(400, {error: {message: "INVALID_CUSTOM_TOKEN"}});
      }
      if (url.includes("accounts:delete")) return res(200, {});
      // כמו Firebase האמיתי: lookup מחזיר רק את המזהה; השם והתפקיד נמצאים בגוף האסימון עצמו
      if (url.includes("accounts:lookup")) { const uid = valid[JSON.parse(opt.payload).idToken]; return uid ? res(200, {users: [{localId: uid}]}) : res(400, {error: {message: "INVALID_ID_TOKEN"}}); }
      if (url.includes("oauth2.googleapis.com/token")) {
        const [h, b, sg] = opt.payload.assertion.split(".");
        return crypto.verify("RSA-SHA256", Buffer.from(h + "." + b), publicKey, Buffer.from(sg, "base64url")) ? res(200, {access_token: "AT"}) : res(400, {error: "invalid_grant"});
      }
      if (url.includes("firestore.googleapis.com")) {
        assert.strictEqual(opt.headers.Authorization, "Bearer AT", "firestore calls carry the service account token");
        const [pth, qs] = url.split("/documents/")[1].split("?");
        if (opt.method === "patch") {
          const mask = [...new URLSearchParams(qs || "").getAll("updateMask.fieldPaths")], f = JSON.parse(opt.payload).fields;
          fsdb[pth] = mask.length ? Object.assign({}, fsdb[pth], Object.fromEntries(mask.filter(k => k in f).map(k => [k, f[k]]))) : f;
          return res(200, {});
        }
        const one = decodeURIComponent(pth);
        if (one.split("/").length === 2) return fsdb[one] ? res(200, {name: one, fields: fsdb[one]}) : res(404, {error: {status: "NOT_FOUND"}});
        return res(200, {documents: Object.keys(fsdb).filter(k => k.startsWith(pth + "/")).map(k => ({name: "projects/x/databases/(default)/documents/" + k, fields: fsdb[k]}))});
      }
      if (url.includes("fcm.googleapis.com")) { const m = JSON.parse(opt.payload).message; pushes.push(m); return m.token === "dead" ? res(404, {}) : res(200, {}); }
      throw new Error("unexpected fetch " + url);
    }},
    ScriptApp: {getProjectTriggers: () => triggers.map(f => ({getHandlerFunction: () => f})),
      newTrigger: f => ({timeBased: () => ({everyMinutes: n => ({create: () => { triggers.push(f); triggers.every5 = n === 5; }})})})},
    ContentService: {MimeType: {JSON: "json"}, createTextOutput: t => ({text: t, setMimeType() { return this; }})},
    Utilities: {
      Charset: {UTF_8: "utf8"},
      getUuid: () => crypto.randomUUID(),
      base64EncodeWebSafe: x => Buffer.from(typeof x === "string" ? Buffer.from(x, "utf8") : Uint8Array.from(x, v => v & 255)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_"),
      computeRsaSha256Signature: (s, pem) => toBytes(crypto.sign("RSA-SHA256", Buffer.from(s, "utf8"), pem)),
      computeHmacSha256Signature: (s, k) => toBytes(crypto.createHmac("sha256", k).update(s).digest()),
      newBlob: s => ({getBytes: () => toBytes(Buffer.from(s, "utf8")), getDataAsString: () => Buffer.from(Uint8Array.from(s, v => v & 255)).toString("utf8")}),
      base64DecodeWebSafe: x => toBytes(Buffer.from(x, "base64url")),
      formatDate: (d, tz, fmt) => {   // רק התבנית שהשרת משתמש בה: "u|HH|mm|yyyy-MM-dd"
        const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {timeZone: tz, weekday: "short", hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit", hourCycle: "h23"}).formatToParts(d).map(x => [x.type, x.value]));
        return [["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday) + 1, p.hour, p.minute, p.year + "-" + p.month + "-" + p.day].join("|");
      },
    },
  };
  vm.createContext(env);
  vm.runInContext(fs.readFileSync(path.join(__dirname, "Code.gs"), "utf8") + "\nOWNER_HASH = " + JSON.stringify(OWNER_H) + ";", env);
  const post = body => JSON.parse(env.doPost({postData: {contents: JSON.stringify(body)}}).text);
  return {env, post, mails, sheets, props, fsdb, pushes, triggers, tokens, mint, tick: ms => { now += ms; }, setNow: t => { now = Date.parse(t); }, clearCache: () => { for (const k in cache) delete cache[k]; }};
}

const T = makeEnv();
T.env.setup();
assert.strictEqual(T.mails.length, 1, "setup sends one report mail");
assert.match(T.mails[0].body, /Firebase: עובדת ✓/, "self test signs a valid token");
const names = T.sheets["מיילים"].slice(1).map(r => r[0]);
assert.deepStrictEqual(names.sort(), ["אנה", "אסיף", "לייה"].sort(), "names from access map + live users, removed excluded");
const ownerRow = () => T.sheets["מיילים"].find(r => r[0] === "אסיף");
assert.strictEqual(ownerRow()[1], "adgordon248@gmail.com", "owner gets the script account's email");
assert.match(T.mails[0].body, /קוד הכניסה של אסיף יישלח ל-adgordon248@gmail.com/);
ownerRow()[1] = "asif@example.com";
T.env.setup();
assert.strictEqual(T.sheets["מיילים"].length, 4, "second setup adds no duplicates");
assert.strictEqual(ownerRow()[1], "asif@example.com", "setup never overwrites an email that was filled in");

// אין מייל -> הודעה ברורה
let r = T.post({a: "code", h: OTHER_H});
assert.strictEqual(r.ok, false); assert.match(r.error, /לא רשום מייל/);
T.sheets["מיילים"].forEach(row => { if (row[0] === "אנה") row[1] = "anna@example.com"; if (row[0] === "לייה") row[1] = "leia@example.com"; });
assert.strictEqual(T.sheets["מיילים"].find(r => r[0] === "אנה").length, 3, "rows keep their 3 columns");

// לא ברשימה / הוסר בעמוד המשתמשים
assert.match(T.post({a: "code", h: "e".repeat(64)}).error, /לא מופיעה/);
assert.match(T.post({a: "code", h: REMOVED_H}).error, /לא מופיעה/);
assert.match(T.post({a: "code", h: "not-a-hash"}).error, /לא תקינה/);

// קוד נשלח, מייל ממוסך
T.mails.length = 0;
r = T.post({a: "code", h: OTHER_H});
assert.deepStrictEqual(r, {ok: true, to: "a•••@example.com", name: "אנה"});
const code = T.mails[0].subject.match(/\d{6}/)[0];
assert.strictEqual(T.mails[0].to, "anna@example.com");
assert.ok(!JSON.stringify(T.env.CacheService.getScriptCache().get("c_" + OTHER_H)).includes(code), "code stored only as digest");

// קוד שגוי מוריד ניסיון; קוד נכון מחזיר אסימון תקין
const wrong = code === "000000" ? "111111" : "000000";
assert.match(T.post({a: "verify", h: OTHER_H, c: wrong}).error, /נשארו 4/);
assert.match(T.post({a: "verify", h: OTHER_H, c: "12a"}).error, /6 ספרות/);
r = T.post({a: "verify", h: OTHER_H, c: code});
assert.strictEqual(r.ok, true);
const [h64, b64, s64] = r.token.split(".");
assert.ok(crypto.verify("RSA-SHA256", Buffer.from(h64 + "." + b64), publicKey, Buffer.from(s64, "base64url")), "signature verifies");
const claims = JSON.parse(Buffer.from(b64, "base64url").toString("utf8"));
assert.strictEqual(claims.uid, "t_" + Buffer.from("אנה", "utf8").toString("hex"));
assert.deepStrictEqual(claims.claims, {n: "אנה", r: "teacher"});
assert.strictEqual(claims.aud, "https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit");
assert.strictEqual(claims.exp - claims.iat, 3600);
assert.match(T.post({a: "verify", h: OTHER_H, c: code}).error, /פג/, "code is single use");

// משתמש שנוסף בעמוד המשתמשים: התפקיד והבית מגיעים לאסימון
T.mails.length = 0;
T.post({a: "code", h: LIVE_H});
r = T.post({a: "verify", h: LIVE_H, c: T.mails[0].subject.match(/\d{6}/)[0]});
assert.deepStrictEqual(JSON.parse(Buffer.from(r.token.split(".")[1], "base64url")).claims, {n: "לייה", r: "coordinator", h: "A"});

// 5 טעויות מבטלות את הקוד
T.tick(11 * 60000);
T.post({a: "code", h: OTHER_H});
for (let i = 0; i < 4; i++) T.post({a: "verify", h: OTHER_H, c: "999999"});
r = T.post({a: "verify", h: OTHER_H, c: "999999"});
assert.strictEqual(r.expired, true); assert.match(r.error, /יותר מדי/);

// תוקף של 10 דקות
T.mails.length = 0;
T.post({a: "code", h: OTHER_H});
const late = T.mails[0].subject.match(/\d{6}/)[0];
T.tick(10 * 60000 + 1000);
assert.match(T.post({a: "verify", h: OTHER_H, c: late}).error, /פג/);

// עד 3 קודים לאדם ב-10 דקות
const U = makeEnv();
U.env.setup();
U.sheets["מיילים"].forEach(row => { row[1] = "x@example.com"; });
for (let i = 0; i < 3; i++) assert.strictEqual(U.post({a: "code", h: OTHER_H}).ok, true);
assert.match(U.post({a: "code", h: OTHER_H}).error, /נשלחו כבר 3/);
U.tick(10 * 60000 + 1000);
assert.strictEqual(U.post({a: "code", h: OTHER_H}).ok, true, "allowed again after 10 minutes");

// מפתח שירות של פרויקט אחר נדחה בבירור
U.props.SA_KEY = JSON.stringify(Object.assign({}, SA, {project_id: "school-gordon"}));
U.tick(10 * 60000 + 1000);
U.post({a: "code", h: OTHER_H});
const c2 = U.mails[U.mails.length - 1].subject.match(/\d{6}/)[0];
assert.match(U.post({a: "verify", h: OTHER_H, c: c2}).error, /שייך לפרויקט school-gordon/);

// מפתח מודבק בקוד (בלי מאפיין) עובד כמו מאפיין
const V = makeEnv();
delete V.props.SA_KEY;
vm.runInContext("SA_KEY_INLINE = " + JSON.stringify(SA) + ";", V.env);
V.env.setup();
assert.match(V.mails[0].body, /Firebase: עובדת ✓/, "inline key works");

// ---- מאגר הצוות ב-Firestore ----
const W = makeEnv();
W.env.setup();
assert.match(W.mails[0].body, /מאגר הצוות: עובדת ✓ \(המאגר ריק/, "setup reports the empty staff database");
assert.match(W.mails[0].body, /התראות על שמירות.*פעילות ✓/);
assert.deepStrictEqual([...W.triggers], ["tick"]); assert.ok(W.triggers.every5);
W.env.setup(); assert.strictEqual(W.triggers.length, 1, "setup never creates a second trigger");
W.sheets["מיילים"].forEach(row => { if (row[0] === "אנה") row[1] = "anna@example.com"; });
const S1 = v => ({stringValue: v}), uid = n => "t_" + Buffer.from(n, "utf8").toString("hex");

// ייבוא: רק הנהלה, עם אסימון תקף
const adminTok = W.mint(uid("אסיף"), {n: "אסיף", r: "admin"}), teachTok = W.mint(uid("אנה"), {n: "אנה", r: "teacher"});
const forged = "h." + Buffer.from(JSON.stringify({user_id: uid("אסיף"), n: "אסיף", r: "admin"})).toString("base64url") + ".forged";
const swapped = adminTok.split(".")[0] + "." + teachTok.split(".")[1] + "." + adminTok.split(".")[2];
assert.match(W.post({a: "import", t: teachTok}).error, /הנהלה בלבד/);
assert.match(W.post({a: "import", t: "bogus"}).error, /הנהלה בלבד/);
assert.match(W.post({a: "import", t: forged}).error, /הנהלה בלבד/, "a token Google does not know is refused, whatever it claims");
assert.match(W.post({a: "import", t: swapped}).error, /הנהלה בלבד/);
assert.match(W.post({a: "import"}).error, /הנהלה בלבד/);
assert.strictEqual(Object.keys(W.fsdb).length, 0, "nothing written by refused imports");
assert.deepStrictEqual(W.post({a: "import", t: adminTok}), {ok: true, added: 3, total: 3});
const anna = W.fsdb["staffAuth/" + uid("אנה")];
assert.deepStrictEqual(anna.h.arrayValue.values, [S1(OTHER_H)]); assert.deepStrictEqual(anna.email, S1("anna@example.com")); assert.deepStrictEqual(anna.role, S1("teacher"));
assert.deepStrictEqual(W.fsdb["staffAuth/" + uid("לייה")].house, S1("A"));
assert.deepStrictEqual(W.fsdb["staff/" + uid("אסיף")], {name: S1("אסיף"), role: S1("admin")});
assert.ok(!("staffAuth/" + uid("ארז") in W.fsdb), "people removed on the board are not imported");
// ייבוא שני לא דורס מה שנערך בינתיים
W.fsdb["staffAuth/" + uid("אנה")].email = S1("new@example.com");
W.fsdb["staff/" + uid("אנה")].groups = {arrayValue: {values: [S1("hA")]}};
assert.strictEqual(W.post({a: "import", t: adminTok}).added, 0);
assert.deepStrictEqual(W.fsdb["staffAuth/" + uid("אנה")].email, S1("new@example.com"));
assert.ok(W.fsdb["staff/" + uid("אנה")].groups, "groups survive");

// מעכשיו הכניסה לפי המאגר: מייל מהמאגר, תפקיד מהמאגר, ומי שנמחק ממנו לא נכנס - גם אם הוא ברשימה הישנה
W.mails.length = 0;
r = W.post({a: "code", h: OTHER_H});
assert.strictEqual(r.ok, true); assert.strictEqual(W.mails[0].to, "new@example.com", "email comes from the staff database, not the sheet");
W.fsdb["staffAuth/" + uid("אנה")].role = S1("admin");
W.clearCache();
W.post({a: "code", h: OTHER_H});
r = W.post({a: "verify", h: OTHER_H, c: W.mails[W.mails.length - 1].subject.match(/\d{6}/)[0]});
assert.deepStrictEqual(JSON.parse(Buffer.from(r.token.split(".")[1], "base64url")).claims, {n: "אנה", r: "admin"}, "role comes from the staff database");
delete W.fsdb["staffAuth/" + uid("אנה")];
W.clearCache();
assert.match(W.post({a: "code", h: OTHER_H}).error, /לא מופיעה/, "deleted from the database = no entry, although still on the old list");
// איש צוות חדש שנוסף רק במאגר (לא קיים בלוח המערכות), עם שתי תעודות
const NEW1 = "1".repeat(64), NEW2 = "2".repeat(64);
W.fsdb["staffAuth/" + uid("רותי")] = {name: S1("רותי"), email: S1("ruti@example.com"), role: S1("teacher"), h: {arrayValue: {values: [S1(NEW1), S1(NEW2)]}}};
W.clearCache();
assert.strictEqual(W.post({a: "code", h: NEW2}).name, "רותי");
W.fsdb["staffAuth/" + uid("רותי")].email = S1("");
W.clearCache();
assert.match(W.post({a: "code", h: NEW1}).error, /לא רשום מייל/);

// ---- התראות על שמירה ----
W.fsdb["push/" + uid("רותי")] = {tokens: {mapValue: {fields: {tokA: {integerValue: "1"}, dead: {integerValue: "1"}}}},
  duty: {arrayValue: {values: [{mapValue: {fields: {day: {integerValue: "4"}, from: S1("09:40"), to: S1("10:00"), place: S1("חצר מתקנים")}}},
    {mapValue: {fields: {day: {integerValue: "0"}, from: S1("11:30"), to: S1("11:50"), place: S1("מגרש")}}}]}}};
const at = t => { W.setNow(t); W.clearCache(); W.pushes.length = 0; return W.env.tick(); };
assert.strictEqual(at("2026-11-12T09:20:00+02:00"), 0, "thursday 09:20 - 20 minutes before: too early");
assert.strictEqual(at("2026-11-12T09:30:00+02:00"), 1, "thursday 09:30 - 10 minutes before: sent (the dead token fails)");
assert.strictEqual(W.pushes.length, 2);
assert.deepStrictEqual(W.pushes[0].data, {title: "שמירה בעוד 10 דקות", body: "חצר מתקנים · 09:40–10:00", url: "#/duty"});
W.setNow("2026-11-12T09:33:00+02:00"); W.pushes.length = 0;
assert.strictEqual(W.env.tick(), 0, "the next run does not send the same duty twice"); assert.strictEqual(W.pushes.length, 0);
assert.strictEqual(at("2026-11-12T09:38:00+02:00"), 0, "2 minutes before: too late");
assert.strictEqual(at("2026-11-13T09:30:00+02:00"), 0, "friday: this duty is on thursday");
assert.strictEqual(at("2026-11-15T11:21:00+02:00"), 1, "sunday duty, 9 minutes before");
assert.strictEqual(at("2026-11-14T11:21:00+02:00"), 0, "saturday: nothing");
// התראת בדיקה
const rutiTok = W.mint(uid("רותי"), {n: "רותי", r: "teacher"});
W.pushes.length = 0;
assert.deepStrictEqual(W.post({a: "pushtest", t: rutiTok}), {ok: true, sent: 1});
assert.match(W.post({a: "pushtest", t: teachTok}).error, /לא נשלחה/, "no devices registered");
assert.match(W.post({a: "pushtest", t: "nope"}).error, /להיכנס מחדש/);

// ---- "הגעת לשמירה?" והתראה לאחראי הביטחון ----
const L = v => ({arrayValue: {values: v.map(S1)}}), tk = (...t) => ({mapValue: {fields: Object.fromEntries(t.map(x => [x, {integerValue: "1"}]))}});
W.fsdb["push/" + uid("רותי")].name = S1("רותי כהן");
W.fsdb["push/" + uid("חסן")] = {tokens: tk("tokHasan"), duty: {arrayValue: {values: []}}};
W.fsdb["push/" + uid("אסיף")] = {tokens: tk("tokAsif"), duty: {arrayValue: {values: []}}};
W.fsdb["staff/" + uid("חסן")] = {name: S1("חסן"), groups: L(["sec"])};
W.fsdb["staff/" + uid("רותי")] = {name: S1("רותי"), full: S1("רותי כהן"), groups: L(["hA"])};
const tos = () => W.pushes.map(m => m.token + ": " + m.data.title);
assert.strictEqual(at("2026-11-12T09:42:00+02:00"), 1, "2 minutes into the duty, not checked in: asked 'did you arrive?'");
assert.deepStrictEqual(tos().filter(x => !x.startsWith("dead")), ["tokA: הגעת לשמירה?"]);
assert.strictEqual(at("2026-11-12T09:47:00+02:00"), 1, "7 minutes in, still no check-in: the security officer is alerted");
assert.deepStrictEqual(tos(), ["tokHasan: לא אושרה הגעה לשמירה"]);
assert.strictEqual(W.pushes[0].data.body, "רותי כהן · חצר מתקנים · 09:40–10:00");
W.setNow("2026-11-12T09:49:00+02:00"); W.pushes.length = 0; assert.strictEqual(W.env.tick(), 0, "alerted once only");
assert.strictEqual(at("2026-11-12T09:52:00+02:00"), 0, "after the window nothing more is sent");
W.fsdb["checkins/2026-11-12_" + uid("רותי") + "_09:40"] = {uid: S1(uid("רותי"))};
assert.strictEqual(at("2026-11-12T09:42:00+02:00"), 0, "checked in: no question");
assert.strictEqual(at("2026-11-12T09:47:00+02:00"), 0, "checked in: no alert to security");
assert.strictEqual(W.pushes.length, 0);

// ---- התראה על הודעה חדשה ----
W.fsdb["staff/" + uid("אסיף")].groups = L(["mgmt", "hA"]);
W.fsdb["push/" + uid("אנה")] = {tokens: tk("tokAnna")};
W.fsdb["staff/" + uid("אנה")].groups = L(["hB"]);
const note = b => { W.clearCache(); W.pushes.length = 0; const r = W.post(Object.assign({a: "notify"}, b)); return [r, W.pushes.map(m => m.token).sort().join(",")]; };
let [nr, nt] = note({t: rutiTok, kind: "board", to: ["all"], title: "אסיפה", text: "מחר ב-14:00"});
assert.strictEqual(nr.ok, true); assert.strictEqual(nt, "tokAnna,tokAsif,tokHasan", "everyone but the sender");
assert.deepStrictEqual(W.pushes[0].data, {title: "הודעה חדשה: אסיפה", body: "רותי כהן · מחר ב-14:00", url: "#/msg"});
[nr, nt] = note({t: rutiTok, kind: "board", to: ["hA"], title: "x", text: "y"}); assert.strictEqual(nt, "tokAsif", "only members of the group");
[nr, nt] = note({t: rutiTok, kind: "board", to: ["mgmt"], title: "x", text: "y"}); assert.strictEqual(nt, "", "the general board cannot reach the management box");
[nr, nt] = note({t: rutiTok, kind: "mgmt", title: "x", text: "y"}); assert.match(nr.error, /צוות הניהול/); assert.strictEqual(nt, "");
[nr, nt] = note({t: adminTok, kind: "mgmt", title: "תקציב", text: "y"}); assert.strictEqual(nt, "", "only other mgmt members (none registered)");
[nr, nt] = note({t: rutiTok, kind: "chat", to: uid("אנה"), text: "היי"}); assert.strictEqual(nt, "tokAnna");
assert.deepStrictEqual(W.pushes[0].data, {title: "רותי כהן", body: "היי", url: "#/chat/" + uid("רותי")});
W.fsdb["staff/" + uid("אנה")].off = {booleanValue: true};
[nr, nt] = note({t: rutiTok, kind: "chat", to: uid("אנה"), text: "היי"}); assert.strictEqual(nt, "", "blocked people get nothing");
[nr, nt] = note({t: forged, kind: "board", to: ["all"], title: "x", text: "y"}); assert.match(nr.error, /להיכנס מחדש/); assert.strictEqual(nt, "");
W.clearCache(); for (let i = 0; i < 60; i++) W.post({a: "notify", t: rutiTok, kind: "chat", to: uid("חסן"), text: "x"});
assert.match(W.post({a: "notify", t: rutiTok, kind: "chat", to: uid("חסן"), text: "x"}).error, /יותר מדי/, "rate limit per sender");

console.log("server/Code.gs: all checks passed");
