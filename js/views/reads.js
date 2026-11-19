// מי קרא הודעה קופצת: מי אישר "קראתי" ומי עוד לא. פתוח לשולח, להנהלה ולצוות הניהול.
import {S} from "../state.js";
import {esc, hhmm, ago} from "../util.js";
import {canPublish, watchReads, audienceOf} from "../data.js";
import {loading, empty, avatar, ui} from "../ui.js";

let cur = "", reads = null, unsub = null;
const find = mid => [...(S.board || []), ...(S.mgmt || [])].find(m => (m.mid || m.id) === mid);

export default {
  parent: "home", tab: "home", live: true,
  title: () => "מי קרא",
  html(mid) {
    const m = find(mid);
    if (!m) return S.board == null ? loading : empty("ההודעה לא נמצאה", "", "fa-envelope");
    if (!(m.by === S.user.uid || canPublish())) return empty("המסך הזה פתוח לשולח ולצוות הניהול", "", "fa-lock");
    if (cur !== mid) { if (unsub) unsub(); cur = mid; reads = null; unsub = watchReads(mid, l => { reads = l || []; ui.render(); }); }
    if (reads == null) return loading;
    const by = new Map(reads.map(r => [r.id, r])), aud = audienceOf(m), read = aud.filter(p => by.has(p.uid)), not = aud.filter(p => !by.has(p.uid));
    const row = (p, r) => '<div class="item">' + avatar(p) + "<div><b>" + esc(p.full) + "</b><span>" + (r ? "קרא/ה ב-" + hhmm(r.at) : "עוד לא קרא/ה") + "</span></div></div>";
    return '<article class="msg"><b>' + esc(m.title) + "</b><p>" + esc(m.body) + "</p><small>" + esc(ago(m.at)) + "</small></article>" +
      '<div class="readbar"><span style="width:' + (aud.length ? Math.round(read.length / aud.length * 100) : 0) + '%"></span></div>' +
      '<p class="lead center"><b>' + read.length + "</b> מתוך " + aud.length + " קראו</p>" +
      (not.length ? '<h3 class="month">עוד לא קראו (' + not.length + ')</h3><div class="list">' + not.map(p => row(p)).join("") + "</div>" : "") +
      (read.length ? '<h3 class="month">קראו (' + read.length + ')</h3><div class="list">' + read.sort((a, b) => by.get(a.uid).at - by.get(b.uid).at).map(p => row(p, by.get(p.uid))).join("") + "</div>" : "") +
      '<p class="hint center">"עוד לא קרא/ה" כולל גם מי שעוד לא פתח את האפליקציה מאז ההודעה.</p>';
  },
  bind() {}
};
