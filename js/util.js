export const $ = id => document.getElementById(id);
export const esc = t => String(t == null ? "" : t).replace(/[&<>"]/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"}[c]));
// localStorage בטוח: ls(k) קורא, ls(k, v) כותב, ls(k, null) מוחק
export const ls = (k, v) => { try { if (v === undefined) return JSON.parse(localStorage.getItem(k)); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } };
export const DAYN = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];
export const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];
export const p2 = n => String(n).padStart(2, "0");
export const iso = d => d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate());
export const parse = s => { const [y, m, d] = String(s).split("-").map(Number); return new Date(y, m - 1, d); };
export const today = () => iso(new Date());
export const hhmm = ms => { const d = new Date(ms); return p2(d.getHours()) + ":" + p2(d.getMinutes()); };
export function nice(s) {
  const d = parse(s), diff = Math.round((d - parse(today())) / 864e5), base = "יום " + DAYN[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1);
  return diff === 0 ? "היום" : diff === 1 ? "מחר, " + base : base;
}
export function ago(ms) {
  const m = Math.round((Date.now() - ms) / 6e4);
  if (m < 2) return "עכשיו"; if (m < 60) return "לפני " + m + " דקות";
  if (m < 120) return "לפני שעה"; if (m < 1440) return "לפני " + Math.round(m / 60) + " שעות";
  const d = new Date(ms); return d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear();
}
export function dayLabel(ms) {
  const d = new Date(ms), k = iso(d), y = new Date(); y.setDate(y.getDate() - 1);
  return k === today() ? "היום" : k === iso(y) ? "אתמול" : "יום " + DAYN[d.getDay()] + " " + d.getDate() + "." + (d.getMonth() + 1);
}
export function fmtDate(s) { const d = new Date(s); return isNaN(d) ? "" : d.getDate() + "." + (d.getMonth() + 1) + "." + d.getFullYear(); }
// מזהה משתמש = t_ + hex של השם בלוח המערכות (כמו בשרת הכניסה ובמסך אילוצי המורים)
export const uidOf = name => "t_" + [...new TextEncoder().encode(name)].map(b => b.toString(16).padStart(2, "0")).join("");
export const nameOf = uid => { try { return new TextDecoder().decode(new Uint8Array(uid.slice(2).match(/../g).map(h => parseInt(h, 16)))); } catch (e) { return ""; } };
export const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
export const heSort = (a, b) => a.localeCompare(b, "he");
// צבע קבוע לכל שם (לעיגול עם האות הראשונה)
export const hue = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.codePointAt(0)) % 360; return h; };
export const norm = s => String(s || "").replace(/[-־'׳"״.]/g, "").replace(/\s+/g, " ").trim();
