// שיחות: "לוח בית חינוך" (כל הצוות), קבוצות קבועות (בתים, מחנכים, צוות ניהול, שכבות), קבוצות שכל אחד פותח, ושיחות פרטיות.
// כמו בוואטסאפ: רשימה אחת עם חיפוש וסינון (הכול / קבוצות / אישיות), קבוצה חדשה עם בחירת אנשי קשר, ופרטי קבוצה.
import {S} from "../state.js";
import {$, esc, ls, ago, hhmm, dayLabel} from "../util.js";
import {groups, people, person, unreadChats, chatUnread, otherOf, cidOf, openChat, openConv, sendChat, sendGroup, markChatSeen, isGroup, chatById, ALL_CHAT,
  newGroup, isGroupAdmin, updateGroup, leaveGroup, myFull} from "../data.js";
import {loading, empty, field, tags, avatar, chips, ui, tryDo} from "../ui.js";

let q = "", flt = "", cq = "", cflt = "";   // q/flt = אנשי הצוות; cq/cflt = רשימת השיחות
const ICONS = {school: "fa-school", lock: "fa-lock", layer: "fa-layer-group", group: "fa-user-group"};
export const gIcon = c => '<span class="gav' + (c.id === ALL_CHAT ? " all" : "") + '"><i class="fa-solid ' + (ICONS[c.icon] || "fa-users") + '"></i></span>';
const convName = c => isGroup(c) ? c.name || "קבוצה" : person(otherOf(c)).full;
const convHref = c => isGroup(c) ? "#/group/" + encodeURIComponent(c.id) : "#/chat/" + encodeURIComponent(otherOf(c));
const lastLine = c => { const l = c.last || {}; if (!l.text) return isGroup(c) ? (c.members || []).length + " משתתפים" : ""; return (l.by === S.user.uid ? "את/ה: " : isGroup(c) ? (l.byName || person(l.by).full.split(" ")[0]) + ": " : "") + l.text; };

function convRow(c) {
  const o = isGroup(c) ? null : person(otherOf(c)), l = c.last || {};
  return '<a class="item chatrow' + (chatUnread(c) ? " new" : "") + (c.id === ALL_CHAT ? " pinned" : "") + '" href="' + convHref(c) + '">' + (o ? avatar(o) : gIcon(c)) +
    "<div><b>" + esc(convName(c)) + (c.sys && c.id !== ALL_CHAT ? ' <span class="sysg">קבוצה קבועה</span>' : "") + "</b><span>" + esc(lastLine(c)) + "</span></div>" +
    "<small>" + (l.at ? esc(ago(l.at)) : "") + "</small></a>";
}
function convList() {
  const s = cq.trim(), all = (S.chats || []).filter(c => (c.members || []).includes(S.user.uid));
  let list = all.filter(c => !cflt || (cflt === "g" ? isGroup(c) : !isGroup(c)));
  if (s) list = list.filter(c => convName(c).includes(s) || String((c.last || {}).text || "").includes(s) || (!isGroup(c) && person(otherOf(c)).name.includes(s)));
  const board = list.find(c => c.id === ALL_CHAT), rest = list.filter(c => c.id !== ALL_CHAT);
  // מי שעוד אין לי איתו שיחה: מופיע בחיפוש כאיש קשר
  const ppl = s && cflt !== "g" ? people().filter(p => p.uid !== S.user.uid && !p.off && (p.full.includes(s) || p.name.includes(s)) && !all.some(c => !isGroup(c) && otherOf(c) === p.uid)).slice(0, 8) : [];
  if (!board && !rest.length && !ppl.length) return empty(s ? "לא נמצא" : cflt === "g" ? "אין קבוצות עדיין" : "אין שיחות עדיין", s ? "אפשר לנסות מילה אחרת." : "אפשר לפתוח שיחה עם איש צוות או קבוצה חדשה.", "fa-comments");
  return '<div class="list">' + (board ? convRow(board) : "") + rest.map(convRow).join("") + "</div>" +
    (ppl.length ? '<h3 class="month">אנשי צוות</h3><div class="list">' + ppl.map(p => '<a class="item" href="#/chat/' + encodeURIComponent(p.uid) + '">' + avatar(p) + "<div><b>" + esc(p.full) + "</b><span>שיחה חדשה</span></div></a>").join("") + "</div>" : "");
}
export const msg = {
  title: () => "שיחות",
  html() {
    if (S.chats == null) return loading;
    const seg = (id, label) => '<button type="button" data-cf="' + id + '" aria-pressed="' + (cflt === id) + '">' + label + "</button>";
    return '<div class="cvtop"><a class="btn" href="#/newgroup"><i class="fa-solid fa-users"></i> קבוצה חדשה</a><a class="btn ghost" href="#/new"><i class="fa-solid fa-pen-to-square"></i> שיחה אישית</a></div>' +
      '<input class="search" id="cq" type="search" placeholder="חיפוש שיחה, קבוצה או איש צוות" value="' + esc(cq) + '" autocomplete="off">' +
      '<div class="seg" role="group" aria-label="סינון">' + seg("", "הכול") + seg("g", "קבוצות") + seg("p", "אישיות") + "</div>" +
      '<div id="cvl">' + convList() + "</div>";
  },
  bind(el) {
    $("cq") && ($("cq").oninput = e => { cq = e.target.value; $("cvl").innerHTML = convList(); });
    for (const b of el.querySelectorAll("[data-cf]")) b.onclick = () => { cflt = b.dataset.cf; ui.render(); };
  },
  update() { const l = $("cvl"); if (l) l.innerHTML = convList(); }
};

// ---- אנשי הצוות (לשונית "צוות"): חיפוש, סינון לפי קבוצה, ולכל אחד: הודעה באפליקציה, חיוג, וואטסאפ ----
// מספר ישראלי לוואטסאפ: 050-1234567 -> 972501234567
export const waNum = ph => { let d = String(ph || "").replace(/\D/g, ""); if (d.startsWith("00")) d = d.slice(2); if (d.startsWith("0")) d = "972" + d.slice(1); return d.length >= 11 ? d : ""; };
const pickList = () => {
  const s = q.trim(), list = people().filter(p => p.uid !== S.user.uid && !p.off && (!flt || p.groups.includes(flt)) && (!s || p.full.includes(s) || p.name.includes(s)));
  return list.length ? list.map(p => {
    const tel = String(p.phone || "").replace(/[^\d+]/g, ""), wa = waNum(p.phone);
    return '<div class="item person-row">' + avatar(p) + "<div><b>" + esc(p.full) + '</b><div class="tags">' + tags(p.groups) + "</div>" + (p.phone ? '<span dir="ltr" class="ph">' + esc(p.phone) + "</span>" : "") + "</div>" +
      '<div class="acts">' +
      '<a class="act chat" href="#/chat/' + encodeURIComponent(p.uid) + '" aria-label="הודעה באפליקציה אל ' + esc(p.full) + '"><i class="fa-solid fa-comment"></i></a>' +
      (tel ? '<a class="act tel" href="tel:' + esc(tel) + '" aria-label="חיוג אל ' + esc(p.full) + '"><i class="fa-solid fa-phone"></i></a>' : "") +
      (wa ? '<a class="act wa" href="https://wa.me/' + wa + '" target="_blank" rel="noopener" aria-label="וואטסאפ אל ' + esc(p.full) + '"><i class="fa-brands fa-whatsapp"></i></a>' : "") +
      "</div></div>";
  }).join("") : empty("לא נמצאו אנשי צוות", s ? "אפשר לנסות שם אחר." : "", "fa-user-group");
};
export const pick = {
  title: () => "אנשי הצוות",
  html: () => '<input class="search" id="pq" type="search" placeholder="חיפוש לפי שם" value="' + esc(q) + '" autocomplete="off">' + chips(groups(), flt, "data-g") +
    '<div class="list" id="plist">' + pickList() + "</div>" +
    '<p class="hint center"><i class="fa-solid fa-comment"></i> הודעה באפליקציה · <i class="fa-solid fa-phone"></i> חיוג · <i class="fa-brands fa-whatsapp"></i> וואטסאפ. הטלפון מופיע רק למי שמילא אותו.</p>',
  bind(el) {
    $("pq").oninput = e => { q = e.target.value; $("plist").innerHTML = pickList(); };
    for (const b of el.querySelectorAll("[data-g]")) b.onclick = () => { flt = b.dataset.g; ui.render(); };
  },
  update() { $("plist").innerHTML = pickList(); }
};

// ---- שיחה (פרטית או קבוצה): בועות, ובקבוצה גם שם הכותב ----
function bubbles(group) {
  if (S.chatMsgs == null) return loading;
  if (!S.chatMsgs.length) return empty("עוד אין הודעות בשיחה", group ? "ההודעות כאן נראות רק למשתתפי הקבוצה." : "ההודעות כאן נראות רק לשניכם.");
  let h = "", day = "", prev = "";
  for (const m of S.chatMsgs) {
    const d = dayLabel(m.at), mine = m.by === S.user.uid;
    if (d !== day) { h += '<div class="dayline"><span>' + esc(d) + "</span></div>"; day = d; prev = ""; }
    const who = group && !mine && m.by !== prev ? '<b class="who">' + esc(m.byName || person(m.by).full) + "</b>" : "";
    h += '<div class="bub' + (mine ? " me" : "") + '">' + who + "<p>" + esc(m.text) + "</p><small>" + hhmm(m.at) + "</small></div>";
    prev = m.by;
  }
  return h;
}
const toBottom = () => window.scrollTo(0, document.documentElement.scrollHeight);
const sendForm = '<form class="send" id="cform"><textarea id="ctext" rows="1" maxlength="2000" placeholder="הודעה" aria-label="הודעה"></textarea><button class="btn" aria-label="שליחה"><i class="fa-solid fa-paper-plane"></i></button></form>';
function bindSend(fn) {
  const f = $("cform"), t = $("ctext");
  const send = async () => {
    const text = t.value.trim(); if (!text) return;
    t.value = ""; t.style.height = "";
    if (!await tryDo(() => fn(text), "ההודעה לא נשלחה. לבדוק את האינטרנט ולנסות שוב.")) t.value = text;
  };
  f.onsubmit = e => { e.preventDefault(); send(); t.focus(); };
  t.oninput = () => { t.style.height = ""; t.style.height = Math.min(t.scrollHeight, 120) + "px"; };
  setTimeout(toBottom, 0);
}
function refresh(cid, group) { const b = $("bubs"); if (!b) return; const n = b.children.length; b.innerHTML = bubbles(group); markChatSeen(cid); if (b.children.length !== n) toBottom(); }

export const chat = {
  parent: "msg", tab: "msg", live: true,
  title: uid => person(uid).full,
  html: () => '<div class="bubs" id="bubs">' + bubbles(false) + "</div>" + sendForm,
  bind(el, uid) { openChat(uid); markChatSeen(cidOf(uid)); $("bubs").innerHTML = bubbles(false); bindSend(text => sendChat(uid, text)); },
  update(el, uid) { refresh(cidOf(uid), false); }
};

export const group = {
  parent: "msg", tab: "msg", live: true,
  title: gid => (chatById(gid) || {}).name || "קבוצה",
  html(gid) {
    const c = chatById(gid);
    if (!c) return S.chats == null ? loading : empty("הקבוצה לא נמצאה", "ייתכן שהוצאת ממנה, או שהיא עוד נטענת.", "fa-users");
    return '<a class="ghead" href="#/ginfo/' + encodeURIComponent(gid) + '">' + gIcon(c) + "<span><b>" + esc(c.name) + "</b><small>" + (c.members || []).length + ' משתתפים · פרטי הקבוצה</small></span><i class="fa-solid fa-chevron-left"></i></a>' +
      (gid === ALL_CHAT ? '<p class="hint"><i class="fa-solid fa-school"></i> לוח בית חינוך: כל הצוות רואה וכותב כאן.</p>' : "") +
      '<div class="bubs" id="bubs">' + bubbles(true) + "</div>" + sendForm;
  },
  bind(el, gid) { if (!chatById(gid)) return; openConv(gid); markChatSeen(gid); $("bubs").innerHTML = bubbles(true); bindSend(text => sendGroup(gid, text)); },
  update(el, gid) { if (!$("bubs")) { ui.render(); return; } refresh(gid, true); }
};

// ---- בחירת אנשי קשר (קבוצה חדשה / הוספה לקבוצה): חיפוש + סינון לפי קבוצה + "סימון כולם" ----
let pk = null;   // {sel: Set, q, g}
function pickerList(exclude) {
  const s = pk.q.trim(), list = people().filter(p => p.uid !== S.user.uid && !p.off && !exclude.includes(p.uid) && (!pk.g || p.groups.includes(pk.g)) && (!s || p.full.includes(s) || p.name.includes(s)));
  if (!list.length) return empty("לא נמצאו אנשי צוות", "", "fa-user-group");
  return '<button type="button" class="link selall" data-all>' + (list.every(p => pk.sel.has(p.uid)) ? "ביטול הסימון של כולם" : "סימון כל " + list.length + " המוצגים") + "</button>" +
    '<div class="list">' + list.map(p => '<label class="item check">' + '<input type="checkbox" data-u="' + esc(p.uid) + '"' + (pk.sel.has(p.uid) ? " checked" : "") + ">" + avatar(p) + "<div><b>" + esc(p.full) + '</b><div class="tags">' + tags(p.groups) + "</div></div></label>").join("") + "</div>";
}
const pickerHtml = exclude => '<input class="search" id="gq" type="search" placeholder="חיפוש איש צוות" value="' + esc(pk.q) + '" autocomplete="off">' + chips(groups(), pk.g, "data-pg") +
  '<p class="hint" id="gcount">נבחרו ' + pk.sel.size + '</p><div id="gpl">' + pickerList(exclude) + "</div>";
function bindPicker(el, exclude) {
  const wire = () => {
    for (const c of el.querySelectorAll("[data-u]")) c.onchange = () => { c.checked ? pk.sel.add(c.dataset.u) : pk.sel.delete(c.dataset.u); $("gcount").textContent = "נבחרו " + pk.sel.size; };
    const all = el.querySelector("[data-all]"); if (all) all.onclick = () => { const boxes = [...el.querySelectorAll("[data-u]")], on = !boxes.every(b => b.checked); boxes.forEach(b => { b.checked = on; on ? pk.sel.add(b.dataset.u) : pk.sel.delete(b.dataset.u); }); $("gcount").textContent = "נבחרו " + pk.sel.size; $("gpl").innerHTML = pickerList(exclude); wire(); };
  };
  $("gq").oninput = e => { pk.q = e.target.value; $("gpl").innerHTML = pickerList(exclude); wire(); };
  for (const b of el.querySelectorAll("[data-pg]")) b.onclick = () => { pk.g = b.dataset.pg; ui.render(); };
  wire();
}

export const newgroup = {
  parent: "msg", tab: "msg",
  title: () => "קבוצה חדשה",
  html() {
    if (!pk || pk.mode !== "new") pk = {mode: "new", sel: new Set(), q: "", g: "", name: ""};
    return '<form id="ngf">' + field("שם הקבוצה", '<input id="gname" required maxlength="60" placeholder="למשל: צוות טיול שנתי" value="' + esc(pk.name) + '">') +
      "<h3 class=\"month\">מי בקבוצה</h3>" + pickerHtml([]) + '<button class="btn sticky" id="gmake"><i class="fa-solid fa-users"></i> פתיחת הקבוצה</button></form>' +
      '<p class="hint center">את/ה תהיה מנהל/ת הקבוצה: אפשר להוסיף ולהוציא אנשים ולשנות את השם. כל משתתף יכול לצאת.</p>';
  },
  bind(el) {
    $("gname").oninput = e => { pk.name = e.target.value; };
    bindPicker(el, []);
    $("ngf").onsubmit = async e => {
      e.preventDefault();
      const name = pk.name.trim();
      if (!name) { alert("צריך לתת שם לקבוצה."); return; }
      if (!pk.sel.size) { alert("צריך לבחור לפחות איש צוות אחד."); return; }
      const b = $("gmake"); b.disabled = true; let gid = "";
      if (await tryDo(async () => { gid = await newGroup(name, [...pk.sel]); })) { pk = null; location.hash = "#/group/" + gid; } else b.disabled = false;
    };
  }
};

// ---- פרטי קבוצה: משתתפים (עם חיפוש), ולמנהל/ת הקבוצה: שינוי שם, הוספה והוצאה. כל אחד יכול לצאת (חוץ מקבוצה קבועה). ----
let gq = "";
export const ginfo = {
  parent: "msg", tab: "msg",
  title: () => "פרטי הקבוצה",
  html(gid) {
    const c = chatById(gid);
    if (!c) return S.chats == null ? loading : empty("הקבוצה לא נמצאה", "", "fa-users");
    const adm = isGroupAdmin(c), adding = pk && pk.mode === "add" && pk.gid === gid;
    if (adding) return "<h3 class=\"month\">הוספה ל" + esc(c.name) + "</h3>" + pickerHtml(c.members) + '<div class="two"><button type="button" class="btn" id="addok">הוספה</button><button type="button" class="btn ghost" id="addno">ביטול</button></div>';
    const s = gq.trim(), mem = (c.members || []).map(person).filter(p => !s || p.full.includes(s) || p.name.includes(s)).sort((a, b) => a.full.localeCompare(b.full, "he"));
    return '<div class="ginfo">' + gIcon(c) + (adm ? '<form id="rnf" class="rn"><input id="rn" maxlength="60" value="' + esc(c.name) + '" aria-label="שם הקבוצה"><button class="btn small">שמירת השם</button></form>' : "<h2>" + esc(c.name) + "</h2>") +
      "<p>" + (c.members || []).length + " משתתפים" + (c.sys ? " · קבוצה קבועה, מתעדכנת לבד מניהול הצוות ומערכת השעות" : "") + "</p></div>" +
      (adm ? '<button type="button" class="btn ghost" id="gadd"><i class="fa-solid fa-user-plus"></i> הוספת משתתפים</button>' : "") +
      '<input class="search" id="gmq" type="search" placeholder="חיפוש משתתף" value="' + esc(gq) + '" autocomplete="off">' +
      '<div class="list" id="gml">' + mem.map(p => '<div class="item">' + avatar(p) + "<div><b>" + esc(p.full) + (p.uid === S.user.uid ? " (את/ה)" : "") + "</b>" + ((c.admins || []).includes(p.uid) ? "<span>מנהל/ת הקבוצה</span>" : "") + "</div>" +
        (p.uid !== S.user.uid ? '<a class="act chat" href="#/chat/' + encodeURIComponent(p.uid) + '" aria-label="שיחה אישית עם ' + esc(p.full) + '"><i class="fa-solid fa-comment"></i></a>' : "") +
        (adm && p.uid !== S.user.uid ? '<button type="button" class="act rm" data-rm="' + esc(p.uid) + '" aria-label="הוצאה מהקבוצה"><i class="fa-solid fa-user-minus"></i></button>' : "") + "</div>").join("") + "</div>" +
      (c.sys ? "" : '<button type="button" class="btn danger" id="gleave"><i class="fa-solid fa-right-from-bracket"></i> יציאה מהקבוצה</button>');
  },
  bind(el, gid) {
    const c = chatById(gid); if (!c) return;
    if (pk && pk.mode === "add" && pk.gid === gid) {
      bindPicker(el, c.members);
      $("addno").onclick = () => { pk = null; ui.render(); };
      $("addok").onclick = async () => { if (!pk.sel.size) { pk = null; ui.render(); return; } const members = [...new Set([...c.members, ...pk.sel])]; if (await tryDo(() => updateGroup(gid, {members}))) { pk = null; ui.render(); } };
      return;
    }
    const q2 = $("gmq"); if (q2) q2.oninput = e => { gq = e.target.value; ui.render(); const x = $("gmq"); x.focus(); x.setSelectionRange(x.value.length, x.value.length); };
    const rn = $("rnf"); if (rn) rn.onsubmit = async e => { e.preventDefault(); const name = $("rn").value.trim(); if (name && name !== c.name) await tryDo(() => updateGroup(gid, {name})); };
    const ad = $("gadd"); if (ad) ad.onclick = () => { pk = {mode: "add", gid, sel: new Set(), q: "", g: ""}; ui.render(); };
    for (const b of el.querySelectorAll("[data-rm]")) b.onclick = async () => { const p = person(b.dataset.rm); if (!confirm("להוציא את " + p.full + " מהקבוצה?")) return; await tryDo(() => updateGroup(gid, {members: c.members.filter(u => u !== p.uid), admins: (c.admins || []).filter(u => u !== p.uid)})); };
    const lv = $("gleave"); if (lv) lv.onclick = async () => { if (confirm("לצאת מהקבוצה \"" + c.name + "\"?") && await tryDo(() => leaveGroup(c))) location.hash = "#/msg"; };
  }
};
