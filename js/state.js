// המצב המשותף של האפליקציה. null = עוד לא נטען.
import {ls} from "./util.js";
export const S = {
  ready: false,          // כבר ידוע אם יש משתמש מחובר
  user: null,            // {uid, name, role, house}
  T: ls("adgTT"),        // מערכת השעות: {g, days, teachers, full, homes}
  staff: null,           // [{id: uid, name, groups: [], off?}]
  groupsDoc: null,       // meta/groups
  duty: null,            // לוח תורנות השמירה השבועי (data/duty.json)
  events: null,          // אירועים שההנהלה הוסיפה ידנית באפליקציה
  sheet: null,           // לוח האירועים וההערכות מהגיליון: {days: [{date, acts, note, tests}], classes, err?}
  auth: null,            // הנהלה בלבד: {uid: {h: [גיבובי ת"ז], email, role, house}} - פרטי הכניסה
  myAuth: null,          // פרטי הכניסה שלי (מייל) - כל אחד רואה רק את שלו
  portal: null, bank: null, portalErr: false,   // פורטל המידע ומאגר הפעילויות (נקראים מהפורטל)
  checkins: null,        // אישורי הגעה לשמירה: שלי, ואצל הנהלה/אחראי ביטחון - של כולם היום
  photos: null,          // {uid: "data:image/jpeg;base64,..."} - תמונות הפרופיל
  mgmt: null,            // הודעות צוות הניהול (תיבה נפרדת, רק לחברי הקבוצה)
  board: null,           // הודעות לוח, ממוזגות מכל הערוצים שלי
  chats: null,           // השיחות הפרטיות שלי
  chatWith: null, chatMsgs: null,   // השיחה הפתוחה
  err: ""
};
const subs = new Set();
export const onChange = f => subs.add(f);
export const changed = () => subs.forEach(f => f());
 