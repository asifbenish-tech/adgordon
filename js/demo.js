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
    duties: [
      {id: "d1", date: dd(1), from: "07:30", to: "08:00", place: "שער ראשי", who: me.name, note: ""},
      {id: "d2", date: dd(1), from: "13:15", to: "13:45", place: "רחבת ההסעות", who: o(0), note: ""},
      {id: "d3", date: dd(3), from: "10:00", to: "10:25", place: "חצר היסודי", who: o(1), note: ""},
      {id: "d4", date: dd(6), from: "13:15", to: "13:45", place: "רחבת ההסעות", who: me.name, note: ""}],
    events: [
      {id: "e1", date: dd(2), time: "16:00", title: "אסיפת הורים", place: "בכיתות", note: ""},
      {id: "e2", date: dd(9), time: "", title: "יום טיול שכבתי", place: "", note: "שכבת ו"},
      {id: "e3", date: dd(34), time: "18:00", title: "טקס חנוכה", place: "אולם", note: ""}],
    "channels/all/msgs": [m1], "channels/home/msgs": [m2], "channels/hA/msgs": [m3],
    chats: [{id: cid, members: [me.uid, u(0)].sort(), names: {[me.uid]: me.name, [u(0)]: o(0)}, last: {text: "תודה, נדבר מחר", at: now - 2 * H, by: u(0)}}]
  };
  db["chats/" + cid + "/msgs"] = [
    {id: "c1", by: me.uid, text: "היי, אפשר להחליף איתך שמירה ביום שלישי?", at: now - 3 * H},
    {id: "c2", by: u(0), text: "כן, אין בעיה.", at: now - 2.5 * H},
    {id: "c3", by: u(0), text: "תודה, נדבר מחר", at: now - 2 * H}];
  return db;
}
