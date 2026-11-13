// סידור ישיבה: קריאת רשימת תלמידים מקובץ, ויצירת קובץ PDF להדפסה. בלי ספריות חיצוניות:
// Word ו-Excel הם קובצי zip עם XML, ונפתחים כאן (DecompressionStream של הדפדפן). PDF נקרא עם pdf.js מ-vendor/pdfjs,
// שנטען רק כשבוחרים קובץ PDF. קובץ ה-PDF להדפסה = תמונת JPEG אחת בדף A4, נכתב ידנית.

// ---- שמות מתוך טקסט/טבלה ----
const HEADER = /(^|\s)(שם|שמות|משפחה|פרטי|רשימת|רשימה|כיתה|כתה|תלמידים|תלמידות|מחנכת|מחנך|מורה|מס'?|מספר|טלפון|נייד|כתובת|תאריך|ת\.?ז\.?|שנת|שנה"?ל|תש[פצ]"?[א-ת]|בית|ספר|חינוך|עמוד|סה"כ|סהכ|הערות|דף|name|class|page|phone)(\s|$)/i;
export function cleanName(t) {
  t = String(t || "").replace(/[‎‏‪-‮⁦-⁩]/g, "").replace(/\S+@\S+/g, " ").replace(/\d+/g, " ")
    .replace(/[.,;:|()[\]{}*_/\\+=<>•·–—]+/g, " ").replace(/(^|\s)-+|-+(\s|$)/g, " ").replace(/\s+/g, " ").trim();
  if (t.length < 2 || !/[א-תA-Za-z]{2}/.test(t)) return null;
  if (t.split(" ").length > 4 || HEADER.test(t)) return null;
  return t;
}
export function linesToNames(lines) {
  const out = [];
  for (const ln of lines) {
    const parts = (ln.match(/[,;\t]/g) || []).length >= 3 ? ln.split(/[,;\t]/) : [ln];
    for (const p of parts) { const n = cleanName(p); if (n) out.push(n); }
  }
  return out;
}
// טבלה: אם יש שורת כותרת, לוקחים רק את עמודות השם (לא שם ההורה)
export function rowsToNames(rows) {
  let cols = null; const out = [];
  for (const row of rows) {
    const cells = row.map(c => String(c == null ? "" : c).trim());
    if (!cols) {
      const idx = []; cells.forEach((c, i) => { if (/שם|name/i.test(c) && !/הורה|הורים|אם|אב|אמא|אבא|parent/i.test(c) && c.length < 20) idx.push(i); });
      if (idx.length) { cols = idx; continue; }
    }
    const use = (cols ? cols.map(i => cells[i] || "") : cells).filter(c => /[א-תA-Za-z]{2}/.test(c) && !/\d{3}/.test(c) && !/@/.test(c));
    const n = cleanName(use.join(" "));
    if (n) out.push(n);
  }
  return out;
}

// ---- zip (docx/xlsx) ----
async function unzip(buf) {
  const u = new Uint8Array(buf), v = new DataView(buf), files = {};
  let e = -1;
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error("zip");
  let p = v.getUint32(e + 16, true);
  const n = v.getUint16(e + 10, true), dec = new TextDecoder();
  for (let k = 0; k < n && v.getUint32(p, true) === 0x02014b50; k++) {
    const method = v.getUint16(p + 10, true), size = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(u.subarray(p + 46, p + 46 + nl));
    files[name] = {method, size, off};
    p += 46 + nl + xl + cl;
  }
  return async name => {
    const f = files[name]; if (!f) return null;
    const start = f.off + 30 + v.getUint16(f.off + 26, true) + v.getUint16(f.off + 28, true), data = u.subarray(start, start + f.size);
    if (f.method === 0) return dec.decode(data);
    if (f.method !== 8 || typeof DecompressionStream === "undefined") throw new Error("zip");
    return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  };
}
const xml = t => new DOMParser().parseFromString(t, "application/xml");
const tags = (node, name) => [...node.getElementsByTagName(name)];
const textOf = node => tags(node, "w:t").map(t => t.textContent).join("");
const inTable = node => { for (let n = node.parentNode; n; n = n.parentNode) if (n.nodeName === "w:tbl") return true; return false; };

async function readDocx(buf) {
  const get = await unzip(buf), doc = xml(await get("word/document.xml") || ""), body = doc.getElementsByTagName("w:body")[0];
  if (!body) return [];
  let names = [];
  for (const t of tags(body, "w:tbl")) {
    if (inTable(t)) continue;   // טבלה בתוך טבלה: נקראת עם הטבלה החיצונית
    names = names.concat(rowsToNames(tags(t, "w:tr").map(tr => [...tr.children].filter(c => c.nodeName === "w:tc").map(textOf))));
  }
  const lines = [];
  for (const p of tags(body, "w:p")) {
    if (inTable(p)) continue;
    let line = "";
    for (const r of tags(p, "*")) { if (r.nodeName === "w:t") line += r.textContent; else if (r.nodeName === "w:br" || r.nodeName === "w:tab") line += r.nodeName === "w:br" ? "\n" : " "; }
    line.split("\n").forEach(l => lines.push(l));
  }
  return linesToNames(lines).concat(names);
}

async function readXlsx(buf) {
  const get = await unzip(buf);
  const shared = tags(xml(await get("xl/sharedStrings.xml") || "<x/>"), "si").map(si => tags(si, "t").map(t => t.textContent).join(""));
  // הגיליון הראשון לפי סדר החוברת
  let path = "xl/worksheets/sheet1.xml";
  try {
    const wb = xml(await get("xl/workbook.xml")), first = tags(wb, "sheet")[0], rid = first && (first.getAttribute("r:id") || first.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id"));
    const rel = tags(xml(await get("xl/_rels/workbook.xml.rels")), "Relationship").find(r => r.getAttribute("Id") === rid);
    if (rel) { const t = rel.getAttribute("Target"); path = t.startsWith("/") ? t.slice(1) : "xl/" + t; }
  } catch (e) {}
  const sheet = xml(await get(path) || "<x/>"), col = ref => { let n = 0; for (const ch of ref.replace(/\d+/g, "")) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  return rowsToNames(tags(sheet, "row").map(r => {
    const row = [];
    for (const c of tags(r, "c")) {
      const t = c.getAttribute("t"), vEl = c.getElementsByTagName("v")[0];
      const val = t === "s" ? shared[+(vEl && vEl.textContent)] : t === "inlineStr" ? tags(c, "t").map(x => x.textContent).join("") : vEl ? vEl.textContent : "";
      row[col(c.getAttribute("r") || "A")] = val == null ? "" : val;
    }
    return Array.from(row, x => x == null ? "" : x);
  }));
}

let pdfLib = null;
const loadPdf = () => pdfLib || (pdfLib = new Promise((res, rej) => {
  const s = document.createElement("script"); s.src = "vendor/pdfjs/pdf.min.js";
  s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor/pdfjs/pdf.worker.min.js"; res(window.pdfjsLib); };
  s.onerror = () => { pdfLib = null; rej(new Error("load")); };
  document.head.appendChild(s);
}));
async function readPdf(buf) {
  const lib = await loadPdf(), pdf = await lib.getDocument({data: buf}).promise, lines = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const tc = await (await pdf.getPage(p)).getTextContent(), rows = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const x = it.transform[4], y = it.transform[5];
      let r = rows.find(r => Math.abs(r.y - y) < 4); if (!r) { r = {y, items: []}; rows.push(r); }
      r.items.push({x, s: it.str.trim()});
    }
    rows.sort((a, b) => b.y - a.y).forEach(r => lines.push(r.items.sort((a, b) => b.x - a.x).map(i => i.s).join(" ")));
  }
  return linesToNames(lines);
}

// קובץ -> רשימת שמות. שגיאה עם הודעה בעברית = להציג כמו שהיא.
export async function readNamesFile(f) {
  const ext = (f.name.split(".").pop() || "").toLowerCase();
  if (ext === "doc") throw new Error("קובץ Word ישן (‎.doc) לא נתמך. שמרו אותו כ-‎.docx ונסו שוב.");
  if (ext === "xls") throw new Error("קובץ Excel ישן (‎.xls) לא נתמך. שמרו אותו כ-‎.xlsx ונסו שוב.");
  if (ext === "txt") return linesToNames((await f.text()).split(/\r?\n/));
  if (ext === "csv") return rowsToNames((await f.text()).split(/\r?\n/).map(l => l.split(",")));
  const buf = await f.arrayBuffer();
  if (ext === "docx") return readDocx(buf);
  if (ext === "xlsx") return readXlsx(buf);
  if (ext === "pdf") return readPdf(buf);
  throw new Error("סוג הקובץ לא נתמך. אפשר להעלות Word ‏(docx), ‏PDF, ‏Excel ‏(xlsx) או קובץ טקסט.");
}

// ---- PDF: דף A4 אחד עם תמונת JPEG ----
export async function jpegPdf(canvas, land) {
  const bin = atob(canvas.toDataURL("image/jpeg", .92).split(",")[1]), img = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) img[i] = bin.charCodeAt(i);
  const W = land ? 841.89 : 595.28, H = land ? 595.28 : 841.89, enc = new TextEncoder(), parts = [], offs = [];
  let len = 0;
  const add = x => { const b = typeof x === "string" ? enc.encode(x) : x; parts.push(b); len += b.length; };
  const obj = (n, body) => { offs[n] = len; add(n + " 0 obj\n" + body + "\nendobj\n"); };
  add("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
  obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
  obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + W + " " + H + "] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>");
  offs[4] = len;
  add("4 0 obj\n<< /Type /XObject /Subtype /Image /Width " + canvas.width + " /Height " + canvas.height + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + img.length + " >>\nstream\n");
  add(img); add("\nendstream\nendobj\n");
  const draw = "q " + W + " 0 0 " + H + " 0 0 cm /Im0 Do Q";
  obj(5, "<< /Length " + draw.length + " >>\nstream\n" + draw + "\nendstream");
  const x = len;
  add("xref\n0 6\n0000000000 65535 f \n" + [1, 2, 3, 4, 5].map(n => String(offs[n]).padStart(10, "0") + " 00000 n \n").join("") + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + x + "\n%%EOF\n");
  return new Blob(parts, {type: "application/pdf"});
}
