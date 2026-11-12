// שכבת הנתונים: Firestore, או המכשיר עצמו במצב הדגמה. אותו ממשק לשניהם.
//   watch(path, cb, opt) -> unsub      opt: {has: [field, value]} | {recent: n}
//   put(path, id|null, obj, merge)     del(path, id)
import {SDK, DEMO} from "./config.js";
import {ls, rid} from "./util.js";
import {seed} from "./demo.js";

let impl = null;
export const watch = (path, cb, opt) => impl.watch(path, cb, opt || {});
export const put = (path, id, obj, merge) => impl.put(path, id, obj, !!merge);
export const del = (path, id) => impl.del(path, id);

export async function openStore(fbApp) {
  if (impl) return;
  impl = DEMO ? demoStore() : await fireStore(fbApp);
}

async function fireStore(fbApp) {
  const Fs = await import(SDK + "firebase-firestore.js");
  let db;
  try { db = Fs.initializeFirestore(fbApp, {localCache: Fs.persistentLocalCache({tabManager: Fs.persistentMultipleTabManager()})}); }
  catch (e) { db = Fs.getFirestore(fbApp); }
  return {
    watch(path, cb, opt) {
      let q = Fs.collection(db, path);
      if (opt.has) q = Fs.query(q, Fs.where(opt.has[0], "array-contains", opt.has[1]));
      if (opt.recent) q = Fs.query(q, Fs.orderBy("at", "desc"), Fs.limit(opt.recent));
      return Fs.onSnapshot(q, snap => cb(snap.docs.map(d => Object.assign({id: d.id}, d.data()))), err => cb(null, err));
    },
    put: (path, id, obj, merge) => id ? Fs.setDoc(Fs.doc(db, path, id), obj, {merge}) : Fs.addDoc(Fs.collection(db, path), obj),
    del: (path, id) => Fs.deleteDoc(Fs.doc(db, path, id))
  };
}

function demoStore() {
  let db = ls("adgDemoData");
  if (!db) { db = seed(); ls("adgDemoData", db); }
  const ws = new Set();
  const view = w => {
    let list = (db[w.path] || []).slice();
    if (w.opt.has) list = list.filter(x => (x[w.opt.has[0]] || []).includes(w.opt.has[1]));
    if (w.opt.recent) list = list.sort((a, b) => b.at - a.at).slice(0, w.opt.recent);
    return list;
  };
  const emit = path => { ls("adgDemoData", db); for (const w of ws) if (w.path === path) w.cb(view(w)); };
  return {
    watch(path, cb, opt) { const w = {path, cb, opt}; ws.add(w); setTimeout(() => ws.has(w) && cb(view(w)), 0); return () => ws.delete(w); },
    async put(path, id, obj, merge) {
      const list = db[path] = db[path] || [], i = id ? list.findIndex(x => x.id === id) : -1;
      if (i >= 0) list[i] = Object.assign(merge ? list[i] : {id}, obj); else list.push(Object.assign({id: id || rid()}, obj));
      emit(path);
    },
    async del(path, id) { db[path] = (db[path] || []).filter(x => x.id !== id); emit(path); }
  };
}
