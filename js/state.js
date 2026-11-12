// המצב המשותף של האפליקציה. null = עוד לא נטען.
import {ls} from "./util.js";
export const S = {
  ready: false,          // כבר ידוע אם יש משתמש מחובר
  user: null,            // {uid, name, role, house}
  T: ls("adgTT"),        // מערכת השעות: {g, days, teachers, full, homes}
  staff: null,           // [{id: uid, name, groups: [], off?}]
  groupsDoc: null,       // meta/groups
  duties: null, events: null,
  board: null,           // הודעות לוח, ממוזגות מכל הערוצים שלי
  chats: null,           // השיחות הפרטיות שלי
  chatWith: null, chatMsgs: null,   // השיחה הפתוחה
  err: ""
};
const subs = new Set();
export const onChange = f => subs.add(f);
export const changed = () => subs.forEach(f => f());
