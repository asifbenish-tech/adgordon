// הודעות: לוח הודעות לפי קהל יעד + שיחות פרטיות בין אנשי צוות.
import {S} from "../state.js";
import {$, esc, ls, ago, hhmm, dayLabel} from "../util.js";
import {isAdmin, groups, groupLabel, people, person, sendBoard, delBoard, unreadBoard, unreadChats, chatUnread, otherOf, cidOf, openChat, sendChat, markChatSeen, MGMT, isMgmt, unreadMgmt} from "../data.js";
import {loading, empty, field, tags, avatar, chips, ui, tryDo} from "../ui.js";

let tab = "board", q = "", flt = "";

export const boardItem = (m, plain) => '<article class="msg' + (m.at > (ls((m.to || []).includes(MGMT) ? "adgSeenM" : "adgSeen") || 0) && m.by !== S.user.uid ? " new" : "") + '"><div class="mh"><b>' + esc(m.title) + "</b>" +
  (!plain && (m.by === S.user.uid || isAdmin()) ? '<button type="button" class="del" data-del="' + esc(m.mid || m.id) + '" aria-label="מחיקה"><i class="fa-solid fa-trash-can"></i></button>' : "") + "</div>" +
  '<div class="tags">' + tags((m.to || ["all"]).filter(groupLabel)) + "</div><p>" + esc(m.body) + "</p><small>" + esc(m.byName || "") + " · " + esc(ago(m.at)) + "</small></article>";

// kind: "board" = לוח ההודעות הכללי (בוחרים קהל יעד); "mgmt" = תיבת צוות הניהול (רק חברי הקבוצה רואים וכותבים)
function boardHtml(kind) {
  const list = kind === "mgmt" ? S.mgmt : S.board;
  if (list == null) return loading;
  return (kind === "mgmt" ? '<p class="hint"><i class="fa-solid fa-lock"></i> התיבה הזו פתוחה רק לחברי צוות הניהול.</p>' : "") +
    '<details class="add"><summary><i class="fa-solid fa-pen"></i> ' + (kind === "mgmt" ? "הודעה חדשה לצוות הניהול" : "הודעה חדשה") + '</summary><form id="bform">' +
    (kind === "mgmt" ? '<input type="checkbox" name="to" value="' + MGMT + '" checked hidden>' : '<fieldset class="aud"><legend>מי יראה את ההודעה</legend><label class="pill"><input type="checkbox" name="to" value="all" checked><span>כל הצוות</span></label>' +
    groups().filter(g => g.id !== MGMT).map(g => '<label class="pill"><input type="checkbox" name="to" value="' + esc(g.id) + '"><span>' + esc(g.label) + "</span></label>").join("") + "</fieldset>") +
    field("כותרת", '<input name="title" required maxlength="80">') + field("תוכן ההודעה", '<textarea name="body" rows="4" required maxlength="2000"></textarea>') +
    '<button class="btn">שליחה</button></form></details>' +
    (list.length ? list.map(m => boardItem(m)).join("") : empty("אין הודעות", kind === "mgmt" ? "הודעות של צוות הניהול יופיעו כאן." : "הודעות לצוות יופיעו כאן."));
}

function chatsHtml() {
  if (S.chats == null) return loading;
  return '<a class="btn ghost" href="#/new"><i class="fa-solid fa-address-book"></i> אנשי הצוות: שיחה חדשה או חיוג</a>' +
    (S.chats.length ? '<div class="list">' + S.chats.map(c => { const o = person(otherOf(c)), l = c.last || {};
      return '<a class="item chatrow' + (chatUnread(c) ? " new" : "") + '" href="#/chat/' + encodeURIComponent(o.uid) + '">' + avatar(o) + "<div><b>" + esc(o.full) + "</b><span>" +
        (l.by === S.user.uid ? "את/ה: " : "") + esc(l.text || "") + "</span></div><small>" + (l.at ? esc(ago(l.at)) : "") + "</small></a>"; }).join("") + "</div>"
      : empty("אין שיחות עדיין", "אפשר לפתוח שיחה פרטית עם כל איש צוות."));
}

export const msg = {
  title: () => "הודעות",
  html() {
    if (tab === "mgmt" && !isMgmt()) tab = "board";
    const n = x => x ? " <em>" + x + "</em>" : "", btn = (id, label, cnt) => '<button type="button" data-tab="' + id + '" aria-pressed="' + (tab === id) + '">' + label + n(tab === id && id !== "chats" ? 0 : cnt) + "</button>";
    return '<div class="seg" role="group" aria-label="תצוגה">' + btn("board", "לוח הודעות", unreadBoard()) + (isMgmt() ? btn("mgmt", "צוות ניהול", unreadMgmt()) : "") + btn("chats", "שיחות", unreadChats()) + "</div>" +
      (tab === "chats" ? chatsHtml() : boardHtml(tab));
  },
  bind(el) {
    for (const b of el.querySelectorAll("[data-tab]")) b.onclick = () => { tab = b.dataset.tab; ui.render(); };
    // נראו; הסימון "חדש" נשאר עד הציור הבא
    if (tab === "board" && S.board) setTimeout(() => ls("adgSeen", Date.now()), 0);
    if (tab === "mgmt" && S.mgmt) setTimeout(() => ls("adgSeenM", Date.now()), 0);
    for (const b of el.querySelectorAll("[data-del]")) b.onclick = () => { const m = [...(S.board || []), ...(S.mgmt || [])].find(x => (x.mid || x.id) === b.dataset.del); if (m && confirm("למחוק את ההודעה לכולם?")) tryDo(() => delBoard(m)); };
    const f = $("bform"); if (!f) return;
    const boxes = [...f.querySelectorAll("[name=to]")];
    for (const c of boxes) c.onchange = () => {   // "כל הצוות" וקבוצות לא הולכים יחד
      if (c.value === "all" && c.checked) boxes.forEach(x => { if (x !== c) x.checked = false; });
      else if (c.checked) boxes[0].checked = false;
    };
    f.onsubmit = async e => {
      e.preventDefault();
      const to = boxes.filter(c => c.checked).map(c => c.value);
      if (!to.length) { alert("צריך לבחור מי יראה את ההודעה."); return; }
      const d = new FormData(f), btn = f.querySelector(".btn"); btn.disabled = true;
      if (await tryDo(() => sendBoard(String(d.get("title")).trim(), String(d.get("body")).trim(), to))) ui.render(); else btn.disabled = false;
    };
  }
};

// ---- בחירת איש צוות לשיחה חדשה ----
const pickList = () => {
  const s = q.trim(), list = people().filter(p => p.uid !== S.user.uid && !p.off && (!flt || p.groups.includes(flt)) && (!s || p.full.includes(s) || p.name.includes(s)));
  return list.length ? list.map(p => '<a class="item" href="#/chat/' + encodeURIComponent(p.uid) + '">' + avatar(p) + "<div><b>" + esc(p.full) + '</b><div class="tags">' + tags(p.groups) + "</div></div>" + (p.phone ? '<span class="call" data-tel="' + esc(p.phone) + '" role="link" tabindex="0" aria-label="חיוג אל ' + esc(p.full) + '"><i class="fa-solid fa-phone"></i></span>' : "") + "</a>").join("") : empty("לא נמצאו אנשי צוות");
};
export const pick = {
  parent: "msg", tab: "msg",
  title: () => "אנשי הצוות",
  html: () => '<input class="search" id="pq" type="search" placeholder="חיפוש לפי שם" value="' + esc(q) + '" autocomplete="off">' + chips(groups(), flt, "data-g") + '<div class="list" id="plist">' + pickList() + "</div>",
  bind(el) {
    $("pq").oninput = e => { q = e.target.value; $("plist").innerHTML = pickList(); };
    $("plist").onclick = e => { const c = e.target.closest("[data-tel]"); if (c) { e.preventDefault(); location.href = "tel:" + c.dataset.tel.replace(/[^\d+]/g, ""); } };
    for (const b of el.querySelectorAll("[data-g]")) b.onclick = () => { flt = b.dataset.g; ui.render(); };
  },
  update() { $("plist").innerHTML = pickList(); }
};

// ---- שיחה פרטית ----
function bubbles() {
  if (S.chatMsgs == null) return loading;
  if (!S.chatMsgs.length) return empty("עוד אין הודעות בשיחה", "ההודעות כאן נראות רק לשניכם.");
  let h = "", day = "";
  for (const m of S.chatMsgs) {
    const d = dayLabel(m.at);
    if (d !== day) { h += '<div class="dayline"><span>' + esc(d) + "</span></div>"; day = d; }
    h += '<div class="bub' + (m.by === S.user.uid ? " me" : "") + '"><p>' + esc(m.text) + "</p><small>" + hhmm(m.at) + "</small></div>";
  }
  return h;
}
const toBottom = () => window.scrollTo(0, document.documentElement.scrollHeight);
export const chat = {
  parent: "msg", tab: "msg", live: true,
  title: uid => person(uid).full,
  html: () => '<div class="bubs" id="bubs">' + bubbles() + '</div><form class="send" id="cform"><textarea id="ctext" rows="1" maxlength="2000" placeholder="הודעה" aria-label="הודעה"></textarea><button class="btn" aria-label="שליחה"><i class="fa-solid fa-paper-plane"></i></button></form>',
  bind(el, uid) {
    openChat(uid); markChatSeen(cidOf(uid));
    $("bubs").innerHTML = bubbles();
    const f = $("cform"), t = $("ctext");
    const send = async () => {
      const text = t.value.trim(); if (!text) return;
      t.value = ""; t.style.height = "";
      if (!await tryDo(() => sendChat(uid, text), "ההודעה לא נשלחה. לבדוק את האינטרנט ולנסות שוב.")) t.value = text;
    };
    f.onsubmit = e => { e.preventDefault(); send(); t.focus(); };
    t.oninput = () => { t.style.height = ""; t.style.height = Math.min(t.scrollHeight, 120) + "px"; };
    setTimeout(toBottom, 0);
  },
  update(el, uid) {
    const b = $("bubs"), n = b.children.length;
    b.innerHTML = bubbles(); markChatSeen(cidOf(uid));
    if (b.children.length !== n) toBottom();
  }
};
