// נתוני הדוגמה של מצב ההדגמה. נשמרים רק ב-localStorage של המכשיר.
import {S} from "./state.js";
import {iso, uidOf, heSort} from "./util.js";

export function seed() {
  const me = S.user, names = S.T ? Object.keys(S.T.teachers).sort(heSort).filter(n => n !== me.name) : [];
  const o = i => names[i] || "מורה " + (i + 1), u = i => uidOf(o(i));
  const dd = n => { const d = new Date(); d.setDate(d.getDate() + n); if (d.getDay() === 6) d.setDate(d.getDate() + 1); return iso(d); };
  const H = 36e5, now = Date.now();
  const msg = (mid, title, body, by, at, to) => ({id: mid, mid, title, body, by: uidOf(by), byName: by, at, to});
  const m1 = msg("m1", "אסיפת צוות ביום ראשון", "מתכנסים בחדר המורים בשעה 14:00.\nנא להגיע בזמן.", o(0), now - H, ["all"]);
  const m2 = msg("m2", "ישיבת מחנכים", "הודעה לדוגמה שנשלחה רק לקבוצת המחנכים.", o(1), now - 20 * H, ["home"]);
  const m3 = msg("m3", "טיול בית א", "הודעה לדוגמה שנשלחה רק לצוות בית א.", o(2), now - 50 * H, ["hA"]);
  const cid = [me.uid, u(0)].sort().join("__");
  const db = {
    staff: [{id: me.uid, name: me.name, groups: me.role === "admin" ? ["mgmt", "hA", "home"] : ["hA", "home"]},
      {id: u(0), name: o(0), groups: ["mgmt"]}, {id: u(1), name: o(1), groups: ["hA", "home"]},
      {id: u(2), name: o(2), groups: ["hA"]}, {id: u(3), name: o(3), groups: ["hB", "home"]}, {id: u(4), name: o(4), groups: ["hC"]}],
    meta: [],
    staffAuth: [{id: me.uid, name: me.name, h: ["demo"], email: "me@example.com", role: me.role}, {id: u(0), name: o(0), h: ["demo"], email: "", role: "teacher"}],
    events: [
      {id: "e1", date: dd(2), time: "16:00", title: "אסיפת הורים", place: "בכיתות", note: ""},
      {id: "e2", date: dd(9), time: "", title: "יום טיול שכבתי", place: "", note: "שכבת ו"},
      {id: "e3", date: dd(34), time: "18:00", title: "טקס חנוכה", place: "אולם", note: ""}],
    "channels/all/msgs": [m1], "channels/mgmt/msgs": [msg("m4", "תקציב טיולים", "הודעה לדוגמה בתיבת צוות הניהול. רק חברי הקבוצה רואים אותה.", o(0), now - 5 * H, ["mgmt"])], "channels/home/msgs": [m2], "channels/hA/msgs": [m3],
    chats: [{id: cid, members: [me.uid, u(0)].sort(), names: {[me.uid]: me.name, [u(0)]: o(0)}, last: {text: "תודה, נדבר מחר", at: now - 2 * H, by: u(0)}}]
  };
  // השינויים במערכת להיום: השיעור הראשון שלי מוחלף, ובשעה הפנויה הראשונה אני ממלא/ת מקום
  const day = new Date().getDay(), mine = ((S.T && S.T.teachers[me.name]) || []).filter(e => e[1] === day).sort((a, b) => a[2] - b[2]);
  if (mine.length) {
    const first = mine[0], hs = new Set(mine.map(e => e[2])), free = [...Array(8)].map((_, i) => i + 1).find(h => h > first[2] && !hs.has(h)) || 8;
    const rows = [
      {h: first[2], cls: "ז1", items: [{tn: me.name, u: me.uid, subj: first[3], why: "event", ev: "טיול שכבתי", sub: {name: o(1), u: u(1)}}]},
      {h: free, cls: "ח2", items: [{tn: o(2), u: u(2), subj: "מתמטיקה", why: "absent", ev: "", sub: {name: me.name, u: me.uid}}]},
      {h: 6, cls: "ט3", items: [{tn: o(3), u: u(3), subj: "אנגלית", why: "absent", ev: "", sub: null}]},
      {h: 7, cls: "ו2", items: [], cancel: "שחרור מוקדם", teachers: [{tn: o(4), u: u(4)}]}].sort((a, b) => a.h - b.h);
    db.changes = [{id: dd(0), date: dd(0), at: now - H, value: JSON.stringify({date: dd(0), rows, note: "יום טיול לשכבת ז",
      absent: [{tn: o(2), u: u(2), hours: null}, {tn: o(3), u: u(3), hours: [6]}],
      mine: {[me.uid]: [{h: first[2], cls: "ז1", k: "out", who: o(1), subj: first[3]}, {h: free, cls: "ח2", k: "in", who: o(2), subj: "מתמטיקה"}]}})},
      {id: dd(1), date: dd(1), at: now - 3 * H, value: JSON.stringify({date: dd(1), rows: [
        {h: 2, cls: "ה1", items: [{tn: o(3), u: u(3), subj: "מדעים", why: "absent", ev: "", sub: {name: o(4), u: u(4)}}]},
        {h: 2, cls: "ו3", items: [{tn: o(2), u: u(2), subj: "עברית", why: "event", ev: "השתלמות", sub: null}], note: "הכיתה בספרייה"}],
        absent: [{tn: o(3), u: u(3), hours: [1, 2]}], mine: {}})}];
  }
  // תמונה לדוגמה של מערכת השינויים (טבלה מצוירת), כמו זו שנשלחת מניהול גורדון
  const cells = [...Array(8)].map((_, r) => [...Array(10)].map((_, c) => '<rect x="' + (c * 80) + '" y="' + (40 + r * 34) + '" width="80" height="34" fill="' + ((r * 3 + c) % 7 === 0 ? "#fff3c4" : (r + c) % 9 === 0 ? "#fde2e2" : "#fff") + '" stroke="#ccd"/>').join("")).join("");
  db.daily = [{id: dd(0), data: "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="320"><rect width="800" height="40" fill="#7a1f1f"/><text x="400" y="26" fill="#fff" font-size="18" text-anchor="middle" font-family="sans-serif">מערכת שינויים</text>' + cells + "</svg>"),
    w: 800, h: 320, note: "", by: "school-gordon", byName: "ניהול גורדון", at: now - H, to: []}];
  db["chats/" + cid + "/msgs"] = [
    {id: "c1", by: me.uid, text: "היי, אפשר להחליף איתך שמירה ביום שלישי?", at: now - 3 * H},
    {id: "c2", by: u(0), text: "כן, אין בעיה.", at: now - 2.5 * H},
    {id: "c3", by: u(0), text: "תודה, נדבר מחר", at: now - 2 * H}];
  return db;
}
