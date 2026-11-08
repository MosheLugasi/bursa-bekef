// כתובות באתר. המשחק יושב תמיד ב-<שורש>/app/, ולכן השורש מחושב מהכתובת הנוכחית –
// כך זה עובד גם ב-shori.co.il/ וגם ב-github.io/bursa-bekef/ (ובבדיקות, שבהן אין location).
const here = typeof location !== 'undefined' ? location.href : 'http://localhost/app/';

/** שורש האתר, למשל ‎/ או ‎/bursa-bekef/ */
export const SITE_ROOT = new URL('../', here).pathname;

/** האתר הקנוני (shori.co.il) */
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || 'https://shori.co.il/';

/** ב-Base44 אין דפי נחיתה (הדף הראשי הוא המשחק) – מפנים לאתר הקנוני */
const onBase44Host = typeof location !== 'undefined' && /(^|\.)base44\.(app|com)$/.test(location.hostname);

/** דף הנחיתה של שורי (‎?home=1 – כדי שלא יעביר אוטומטית חזרה למשחק) */
export const LANDING_URL = `${onBase44Host ? SITE_URL : SITE_ROOT}?home=1`;
