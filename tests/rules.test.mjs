// בדיקת firestore.rules מול האמולטור. הרצה: ראו CLAUDE.md ("בדיקות").
import {initializeTestEnvironment, assertSucceeds as ok, assertFails as no} from "@firebase/rules-unit-testing";
import {doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, orderBy, limit} from "firebase/firestore";
import {readFileSync} from "node:fs";

const env = await initializeTestEnvironment({projectId: "demo-gordon", firestore: {rules: readFileSync(process.env.RULES || "firestore.rules", "utf8"), host: "127.0.0.1", port: 8089}});
const db = (uid, r) => env.authenticatedContext(uid, {n: uid, r}).firestore();
const A = db("t_admin", "admin"), T1 = db("t_one", "teacher"), T2 = db("t_two", "teacher"), B = db("t_blocked", "teacher"), X = env.unauthenticatedContext().firestore();
let n = 0; const t = async (name, p) => { try { await p; n++; } catch (e) { console.error("FAILED: " + name + "\n  " + e.message.split("\n")[0]); process.exitCode = 1; } };
const recent = (d, ch) => getDocs(query(collection(d, "channels/" + ch + "/msgs"), orderBy("at", "desc"), limit(100)));
const m = by => ({mid: "m", title: "x", body: "y", by, at: 1, to: ["hA"]});

await env.withSecurityRulesDisabled(async c => {
  const d = c.firestore();
  await setDoc(doc(d, "staff/t_one"), {name: "t_one", groups: ["hA"]});
  await setDoc(doc(d, "staff/t_blocked"), {name: "t_blocked", groups: ["hA"], off: true});
  await setDoc(doc(d, "channels/hA/msgs/m1"), m("t_one"));
  await setDoc(doc(d, "duties/d1"), {date: "2026-12-01"});
});

// לא מחובר / חסום
await t("unauth cannot read duties", no(getDocs(collection(X, "duties"))));
await t("blocked cannot read duties", no(getDocs(collection(B, "duties"))));
await t("blocked cannot read board", no(recent(B, "all")));
await t("blocked cannot post", no(setDoc(doc(B, "channels/all/msgs/b1"), m("t_blocked"))));
// צוות וקבוצות
await t("staff reads staff list", ok(getDocs(collection(T1, "staff"))));
await t("self-register without groups", ok(setDoc(doc(T2, "staff/t_two"), {name: "t_two", groups: []})));
await t("no self-register with groups", no(setDoc(doc(db("t_three", "teacher"), "staff/t_three"), {name: "t_three", groups: ["mgmt"]})));
await t("no registering someone else", no(setDoc(doc(T2, "staff/t_other"), {name: "t_other", groups: []})));
await t("cannot change own groups", no(updateDoc(doc(T2, "staff/t_two"), {groups: ["mgmt"]})));
await t("cannot unblock self", no(updateDoc(doc(B, "staff/t_blocked"), {off: false})));
await t("admin sets groups", ok(setDoc(doc(A, "staff/t_two"), {name: "t_two", groups: ["hB"]}, {merge: true})));
await t("admin edits group list", ok(setDoc(doc(A, "meta/groups"), {list: []})));
await t("teacher cannot edit group list", no(setDoc(doc(T1, "meta/groups"), {list: []})));
// פרטי כניסה והתראות
await t("admin writes login details", ok(setDoc(doc(A, "staffAuth/t_one"), {name: "t_one", h: ["x"], email: "a@b.c", role: "teacher"})));
await t("admin reads login details", ok(getDocs(collection(A, "staffAuth"))));
await t("teacher cannot read login details", no(getDocs(collection(T1, "staffAuth"))));
await t("teacher cannot write login details", no(setDoc(doc(T1, "staffAuth/t_one"), {h: ["mine"]})));
await t("own push registration", ok(setDoc(doc(T1, "push/t_one"), {tokens: {a: 1}, duty: []}, {merge: true})));
await t("cannot read others' push registration", no(getDoc(doc(T2, "push/t_one"))));
await t("cannot write others' push registration", no(setDoc(doc(T2, "push/t_one"), {tokens: {evil: 1}})));
await t("admin cannot read push tokens", no(getDoc(doc(A, "push/t_one"))));
// עדכון פרטים עצמי: שם מלא, טלפון, מייל - ושום דבר אחר
await t("own full name and phone", ok(setDoc(doc(T1, "staff/t_one"), {full: "אחד מלא", phone: "050-1234567"}, {merge: true})));
await t("cannot add self to a group via details", no(setDoc(doc(T1, "staff/t_one"), {phone: "1", groups: ["mgmt"]}, {merge: true})));
await t("cannot set own role via details", no(setDoc(doc(T1, "staff/t_one"), {phone: "1", role: "admin"}, {merge: true})));
await t("cannot unblock via details", no(setDoc(doc(B, "staff/t_blocked"), {off: false}, {merge: true})));
await t("cannot edit someone else's details", no(setDoc(doc(T2, "staff/t_one"), {phone: "666"}, {merge: true})));
await t("phone too long refused", no(setDoc(doc(T1, "staff/t_one"), {phone: "1".repeat(40)}, {merge: true})));
await t("reads own login record", ok(getDoc(doc(T1, "staffAuth/t_one"))));
await t("cannot read another's login record", no(getDoc(doc(T2, "staffAuth/t_one"))));
await t("updates own email", ok(setDoc(doc(T1, "staffAuth/t_one"), {email: "new@b.c"}, {merge: true})));
await t("cannot replace own id hash", no(setDoc(doc(T1, "staffAuth/t_one"), {h: ["other"]}, {merge: true})));
await t("cannot change own role in login record", no(setDoc(doc(T1, "staffAuth/t_one"), {email: "x@y.z", role: "admin"}, {merge: true})));
await t("cannot create own login record", no(setDoc(doc(T2, "staffAuth/t_two"), {email: "x@y.z"}, {merge: true})));
await t("cannot change another's email", no(setDoc(doc(T2, "staffAuth/t_one"), {email: "evil@x.y"}, {merge: true})));
// תפקיד מהמאגר גובר על האסימון, מיד
await t("teacher cannot make self admin", no(updateDoc(doc(T2, "staff/t_two"), {role: "admin"})));
await t("admin promotes a teacher", ok(setDoc(doc(A, "staff/t_two"), {role: "admin"}, {merge: true})));
await t("promoted teacher is admin at once", ok(setDoc(doc(T2, "meta/x"), {a: 1})));
await t("admin demotes", ok(setDoc(doc(A, "staff/t_two"), {role: "teacher"}, {merge: true})));
await t("demoted loses admin at once", no(setDoc(doc(T2, "meta/x"), {a: 2})));
await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "staff/t_admin"), {name: "t_admin", groups: [], role: "teacher"}));
await t("token says admin but database says teacher: not admin", no(setDoc(doc(A, "meta/x"), {a: 3})));
await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "staff/t_admin"), {name: "t_admin", groups: [], role: "admin"}));
await t("admin again", ok(setDoc(doc(A, "meta/x"), {a: 4})));
// אישור הגעה לשמירה
const ci = u => ({uid: u, name: "x", date: "2026-11-12", from: "09:40", to: "10:00", place: "חצר", at: 1});
await t("check in for own duty", ok(setDoc(doc(T1, "checkins/2026-11-12_t_one_09:40"), ci("t_one"))));
await t("cannot check in for someone else", no(setDoc(doc(T2, "checkins/2026-11-12_t_one_11:30"), Object.assign(ci("t_one"), {from: "11:30"}))));
await t("cannot check in under another's id", no(setDoc(doc(T2, "checkins/2026-11-12_t_one_09:40"), ci("t_two"))));
await t("check-in id must match its content", no(setDoc(doc(T2, "checkins/whatever"), ci("t_two"))));
await t("blocked cannot check in", no(setDoc(doc(B, "checkins/2026-11-12_t_blocked_09:40"), ci("t_blocked"))));
await t("check-in cannot be changed", no(updateDoc(doc(T1, "checkins/2026-11-12_t_one_09:40"), {at: 2})));
await t("check-in cannot be deleted", no(deleteDoc(doc(T1, "checkins/2026-11-12_t_one_09:40"))));
await t("reads own check-ins", ok(getDocs(query(collection(T1, "checkins"), where("uid", "==", "t_one")))));
await t("cannot read others' check-ins", no(getDocs(query(collection(T2, "checkins"), where("date", "==", "2026-11-12")))));
await t("admin reads today's check-ins", ok(getDocs(query(collection(A, "checkins"), where("date", "==", "2026-11-12")))));
await env.withSecurityRulesDisabled(c => setDoc(doc(c.firestore(), "staff/t_sec"), {name: "t_sec", groups: ["sec"]}));
await t("security officer reads today's check-ins", ok(getDocs(query(collection(db("t_sec", "teacher"), "checkins"), where("date", "==", "2026-11-12")))));
// תמונות פרופיל
const jpg = "data:image/jpeg;base64," + "A".repeat(2000);
await t("own photo", ok(setDoc(doc(T1, "photos/t_one"), {data: jpg, at: 1})));
await t("staff reads photos", ok(getDocs(collection(T2, "photos"))));
await t("cannot set someone else's photo", no(setDoc(doc(T2, "photos/t_one"), {data: jpg, at: 1})));
await t("photo must be a small jpeg", no(setDoc(doc(T2, "photos/t_two"), {data: "data:image/jpeg;base64," + "A".repeat(100000), at: 1})));
await t("photo cannot be html/svg", no(setDoc(doc(T2, "photos/t_two"), {data: "data:image/svg+xml;base64,AAAA", at: 1})));
await t("blocked cannot upload photo", no(setDoc(doc(B, "photos/t_blocked"), {data: jpg, at: 1})));
await t("cannot delete someone else's photo", no(deleteDoc(doc(T2, "photos/t_one"))));
await t("admin removes a photo", ok(deleteDoc(doc(A, "photos/t_one"))));
// שמירות / אירועים
await t("teacher reads duties", ok(getDocs(collection(T1, "duties"))));
await t("teacher cannot write duties", no(addDoc(collection(T1, "duties"), {date: "x"})));
await t("admin writes events", ok(addDoc(collection(A, "events"), {date: "x"})));
// לוח הודעות
await t("everyone reads 'all'", ok(recent(T2, "all")));
await t("member reads group channel", ok(recent(T1, "hA")));
await t("non-member cannot read group channel", no(recent(T2, "hA")));
await t("non-member cannot get one message", no(getDoc(doc(T2, "channels/hA/msgs/m1"))));
await t("admin reads every group channel", ok(recent(A, "hA")));
await t("own outbox readable", ok(recent(T1, "s_t_one")));
await t("other's outbox not readable", no(recent(T2, "s_t_one")));
await t("anyone can post to a group", ok(setDoc(doc(T2, "channels/hA/msgs/m2"), m("t_two"))));
await t("cannot post as someone else", no(setDoc(doc(T2, "channels/hA/msgs/m3"), m("t_one"))));
await t("cannot post into other's outbox", no(setDoc(doc(T2, "channels/s_t_one/msgs/m4"), m("t_two"))));
await t("post into own outbox", ok(setDoc(doc(T2, "channels/s_t_two/msgs/m2"), m("t_two"))));
await t("cannot delete other's message", no(deleteDoc(doc(T2, "channels/hA/msgs/m1"))));
await t("sender deletes own message (even outside the group)", ok(deleteDoc(doc(T2, "channels/hA/msgs/m2"))));
await t("admin deletes any message", ok(deleteDoc(doc(A, "channels/hA/msgs/m1"))));
// תיבת צוות הניהול: רק חברי הקבוצה, גם לא הנהלה שאינה חברה
await env.withSecurityRulesDisabled(async c => { await setDoc(doc(c.firestore(), "staff/t_one"), {name: "t_one", groups: ["hA", "mgmt"]}); await setDoc(doc(c.firestore(), "channels/mgmt/msgs/g1"), m("t_one")); });
await t("mgmt member reads the mgmt box", ok(recent(T1, "mgmt")));
await t("mgmt member posts to the mgmt box", ok(setDoc(doc(T1, "channels/mgmt/msgs/g2"), m("t_one"))));
await t("non-member cannot read the mgmt box", no(recent(T2, "mgmt")));
await t("non-member cannot post to the mgmt box", no(setDoc(doc(T2, "channels/mgmt/msgs/g3"), m("t_two"))));
await t("admin who is not in mgmt cannot read the mgmt box", no(recent(A, "mgmt")));
await t("admin who is not in mgmt cannot delete there", no(deleteDoc(doc(A, "channels/mgmt/msgs/g1"))));
await t("mgmt member deletes own mgmt message", ok(deleteDoc(doc(T1, "channels/mgmt/msgs/g2"))));
// שיחות פרטיות
const cid = "t_one__t_two", chat = {members: ["t_one", "t_two"], names: {}, last: {text: "hi", at: 1, by: "t_one"}};
await t("no msg before chat exists", no(addDoc(collection(T1, "chats/" + cid + "/msgs"), {by: "t_one", text: "hi", at: 1})));
await t("create chat", ok(setDoc(doc(T1, "chats/" + cid), chat, {merge: true})));
await t("wrong chat id refused", no(setDoc(doc(T1, "chats/zzz"), chat)));
await t("cannot create chat for two others", no(setDoc(doc(A, "chats/" + "t_x__t_y"), {members: ["t_x", "t_y"]})));
await t("member sends", ok(addDoc(collection(T1, "chats/" + cid + "/msgs"), {by: "t_one", text: "hi", at: 1})));
await t("other member updates last", ok(setDoc(doc(T2, "chats/" + cid), {...chat, last: {text: "yo", at: 2, by: "t_two"}}, {merge: true})));
await t("cannot change members", no(updateDoc(doc(T2, "chats/" + cid), {members: ["t_two", "t_admin"]})));
await t("member lists own chats", ok(getDocs(query(collection(T2, "chats"), where("members", "array-contains", "t_two")))));
await t("cannot list all chats", no(getDocs(collection(T2, "chats"))));
await t("member reads messages", ok(getDocs(query(collection(T2, "chats/" + cid + "/msgs"), orderBy("at", "desc"), limit(200)))));
await t("admin cannot read chat", no(getDoc(doc(A, "chats/" + cid))));
await t("admin cannot read chat messages", no(getDocs(collection(A, "chats/" + cid + "/msgs"))));
await t("outsider cannot send into chat", no(addDoc(collection(A, "chats/" + cid + "/msgs"), {by: "t_admin", text: "x", at: 3})));
await t("cannot send as the other member", no(addDoc(collection(T1, "chats/" + cid + "/msgs"), {by: "t_two", text: "x", at: 3})));
// סידור ישיבה: רק של עצמי, גם לא ההנהלה
const seat = {className: "ד׳ מירי", teacher: "מירי", students: ["כהן נועה", "לוי איתי"], layout: {type: "cols", cols: 4}, seats: ["כהן נועה", null, "לוי איתי"], nameMode: "short", nameOrder: "lf", updated: 1};
await t("save own seating", ok(setDoc(doc(T1, "seating/t_one/classes/c1"), seat)));
await t("update own seating", ok(setDoc(doc(T1, "seating/t_one/classes/c1"), {...seat, seats: [null, "כהן נועה"], updated: 2})));
await t("list own seating", ok(getDocs(collection(T1, "seating/t_one/classes"))));
await t("cannot read another's seating", no(getDocs(collection(T2, "seating/t_one/classes"))));
await t("admin cannot read seating", no(getDoc(doc(A, "seating/t_one/classes/c1"))));
await t("cannot write another's seating", no(setDoc(doc(T2, "seating/t_one/classes/c2"), seat)));
await t("cannot delete another's seating", no(deleteDoc(doc(A, "seating/t_one/classes/c1"))));
await t("save seating with room", ok(setDoc(doc(T1, "seating/t_one/classes/c4"), {...seat, room: {space: {t: 1, b: 0, l: 0, r: 0}, items: [{id: "board", type: "board", wall: "r", at: .5, len: .5}, {id: "i1", type: "tdesk", fx: .5, fy: .2}]}})));
await t("seating room with too many items refused", no(setDoc(doc(T1, "seating/t_one/classes/c5"), {...seat, room: {space: {}, items: Array(41).fill({type: "pillar"})}})));
await t("seating extra field refused", no(setDoc(doc(T1, "seating/t_one/classes/c3"), {...seat, evil: 1})));
await t("seating huge list refused", no(setDoc(doc(T1, "seating/t_one/classes/c3"), {...seat, students: Array(81).fill("x")})));
await t("blocked cannot save seating", no(setDoc(doc(B, "seating/t_blocked/classes/c1"), seat)));
await t("delete own seating", ok(deleteDoc(doc(T1, "seating/t_one/classes/c1"))));
// סידור חדר האוכל: רק המחנך עצמו
const din = {name: "ו׳2", students: [{id: "s_1", name: "נועה כהן"}], columns: [7, 8, 7], teams: [{id: "tm_1", name: "צוות אדום", color: "red"}], tables: {"1": {team: "tm_1", active: true}},
  roles: [{id: "cups", name: "סידור כוסות", icon: "cup", count: 1, fixed: null, tables: [1]}], opts: {mode: "team", stage: "במה"},
  today: {date: "2026-11-14", absent: [], plan: {date: "2026-11-14", kind: "team", roles: {cups: ["s_1"]}, teams: {tm_1: []}, unassigned: [], extras: {}}},
  hist: {"2026-11-14": {date: "2026-11-14", kind: "team", roles: {cups: ["s_1"]}, teams: {}, extras: {}}}, updated: 1};
await t("save own dining", ok(setDoc(doc(T1, "dining/t_one/classes/d1"), din)));
await t("update own dining", ok(setDoc(doc(T1, "dining/t_one/classes/d1"), {...din, today: null, updated: 2})));
await t("list own dining", ok(getDocs(collection(T1, "dining/t_one/classes"))));
await t("cannot read another's dining", no(getDocs(collection(T2, "dining/t_one/classes"))));
await t("admin cannot read dining", no(getDoc(doc(A, "dining/t_one/classes/d1"))));
await t("cannot write another's dining", no(setDoc(doc(T2, "dining/t_one/classes/d2"), din)));
await t("dining extra field refused", no(setDoc(doc(T1, "dining/t_one/classes/d3"), {...din, evil: 1})));
await t("dining huge list refused", no(setDoc(doc(T1, "dining/t_one/classes/d3"), {...din, students: Array(81).fill({id: "x", name: "x"})})));
await t("blocked cannot save dining", no(setDoc(doc(B, "dining/t_blocked/classes/d1"), din)));
await t("delete own dining", ok(deleteDoc(doc(T1, "dining/t_one/classes/d1"))));

await env.cleanup();
console.log(process.exitCode ? "rules: FAILURES above" : "firestore.rules: all " + n + " checks passed");
