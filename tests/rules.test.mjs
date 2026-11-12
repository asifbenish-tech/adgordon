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

await env.cleanup();
console.log(process.exitCode ? "rules: FAILURES above" : "firestore.rules: all " + n + " checks passed");
