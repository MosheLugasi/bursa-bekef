// רכיבי חשבון: כפתור Google, מסך התחברות, בחירת משפחה וחיבור נתוני המכשיר לחשבון.
import { useMemo, useState } from 'react';
import { useGame } from '@/state/store';
import { cloudConfigured, cloudSignOut, linkFamily, refreshAccount, requestAccess, selectFamily, signInWithGoogle, useCloud } from '@/state/cloud';
import { Sheet } from './components';

export function GoogleButton({ label = 'התחברות עם Google', className = '' }: { label?: string; className?: string }) {
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          const e = await signInWithGoogle();
          if (e) {
            setErr(e);
            setBusy(false);
          }
        }}
        className="w-full flex items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 font-bold text-slate-800 shadow-sm hover:border-brand-400 hover:shadow active:scale-[.98] transition disabled:opacity-60"
      >
        <svg width="22" height="22" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        {busy ? 'מעבירים ל-Google...' : label}
      </button>
      {err && (
        <div className="text-xs text-down mt-1" dir="ltr">
          {err}
        </div>
      )}
    </div>
  );
}

/** מסך פתיחה כשיש חשבונות ענן ועוד אין נתונים במכשיר */
export function SignInScreen({ onGuest }: { onGuest: () => void }) {
  const cloud = useCloud();
  const [msg, setMsg] = useState<string>();
  return (
    <div className="max-w-md mx-auto p-4 pt-10">
      <div className="text-center mb-6">
        <div className="text-7xl anim-bob">🐂</div>
        <h1 className="text-3xl font-extrabold mt-2 text-brand-700">בורסה בכיף</h1>
        <p className="text-slate-600 mt-1">משחק מסחר בבורסה לכל המשפחה – עם נתונים אמיתיים מישראל ומארה״ב</p>
      </div>
      <div className="card p-5 space-y-4">
        {cloud.status === 'loading' || cloud.status === 'syncing' ? (
          <div className="text-center py-6">
            <div className="text-4xl animate-bounce">☁️</div>
            <div className="font-bold mt-2">מתחברים לחשבון...</div>
          </div>
        ) : cloud.status === 'no-access' ? (
          <>
            <div className="text-center">
              <div className="text-5xl">⏳</div>
              <h2 className="text-xl font-bold mt-2">החשבון עוד לא אושר</h2>
              <p className="text-sm text-slate-600 mt-1">
                התחברתם בתור <strong dir="ltr">{cloud.email}</strong>. כדי להיכנס, מנהל המשחק צריך לאשר את החשבון.
              </p>
            </div>
            {cloud.isAdmin && (
              <a href="#/accounts" className="btn-primary w-full text-center block">
                🛡️ אתם מנהלי המשחק – לניהול חשבונות ומשתמשים
              </a>
            )}
            {cloud.isAdmin ? null : cloud.requested ? (
              <div className="rounded-xl bg-up-bg p-3 text-center font-semibold">✅ הבקשה נשלחה! ברגע שהמנהל יאשר – לחצו ״בדיקה שוב״.</div>
            ) : (
              <button className="btn-primary w-full" onClick={async () => setMsg(await requestAccess())}>
                🙋 שליחת בקשת גישה למנהל
              </button>
            )}
            <div className="flex gap-2">
              <button className="btn-soft flex-1" onClick={() => refreshAccount()}>
                🔄 בדיקה שוב
              </button>
              <button className="btn-ghost flex-1" onClick={() => cloudSignOut()}>
                החלפת חשבון
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold text-center">👋 ברוכים הבאים!</h2>
            <p className="text-sm text-slate-600 text-center">מתחברים עם חשבון Google של ההורים – וכל המשפחה משחקת מכל מכשיר, עם טבלת תחרות משותפת.</p>
            <GoogleButton />
            {cloud.status === 'error' && cloud.error && (
              <div className="text-xs text-down" dir="ltr">
                {cloud.error}
              </div>
            )}
          </>
        )}
        {msg && <div className="text-sm text-down">{msg}</div>}
        <div className="border-t border-slate-100 pt-3 text-center">
          <button className="btn-ghost text-sm" onClick={onGuest}>
            או: לשחק בלי חשבון (נשמר רק במכשיר הזה)
          </button>
        </div>
      </div>
    </div>
  );
}

/** שורת מצב קטנה של החשבון (במסך בחירת השחקן) */
export function AccountBar() {
  const cloud = useCloud();
  if (!cloudConfigured() || cloud.status === 'off') return null;
  if (cloud.status === 'signed-out')
    return (
      <div className="card p-3 flex flex-wrap items-center gap-3 max-w-md mx-auto">
        <div className="text-sm flex-1 min-w-48">☁️ רוצים לשחק מכל מכשיר ולשמור בענן? התחברו עם Google.</div>
        <GoogleButton label="התחברות" className="w-full sm:w-auto" />
      </div>
    );
  const dot = { loading: '🔄', syncing: '🔄', ok: '🟢', error: '🔴', 'no-access': '⏳', 'pick-family': '👪', link: '🔗', off: '', 'signed-out': '' }[cloud.status];
  if (cloud.status === 'no-access')
    return (
      <div className="card p-3 max-w-md mx-auto text-sm text-center space-y-2">
        <div>
          ⏳ החשבון <span dir="ltr">{cloud.email}</span> עוד לא שייך למשפחה.
        </div>
        {cloud.isAdmin ? (
          <a href="#/accounts" className="btn-primary inline-block">
            🛡️ לניהול חשבונות
          </a>
        ) : cloud.requested ? (
          <div className="text-emerald-700 font-semibold">✅ בקשת הגישה נשלחה למנהל</div>
        ) : (
          <button className="btn-soft" onClick={() => requestAccess()}>
            🙋 בקשת גישה מהמנהל
          </button>
        )}
      </div>
    );
  return (
    <div className="text-center text-xs text-slate-500">
      ☁️ {cloud.family ? <strong>{cloud.family.name}</strong> : null} {cloud.email && <span dir="ltr">{cloud.email}</span>} {dot}
      {cloud.status === 'error' && cloud.error && <div className="text-down mt-1">{cloud.error}</div>}
    </div>
  );
}

/** חלונות שמופיעים מעל הכל: בחירת משפחה, וחיבור נתוני המכשיר לחשבון */
export function CloudGate() {
  const cloud = useCloud();
  const profileMap = useGame((s) => s.profiles);
  const profiles = useMemo(() => Object.values(profileMap), [profileMap]);
  const [busy, setBusy] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  if (cloud.status === 'pick-family')
    return (
      <Sheet open onClose={() => undefined} title="👪 לאיזו משפחה להיכנס?">
        <div className="space-y-2">
          {cloud.families.map((f) => (
            <button key={f.id} className="w-full card p-3 text-right hover:bg-brand-50 flex items-center gap-3" onClick={() => selectFamily(f.id)}>
              <span className="text-3xl">🏠</span>
              <span className="flex-1">
                <span className="font-bold block">{f.name}</span>
                <span className="text-xs text-slate-500">{f.role === 'owner' ? 'בעלים' : 'שותפים'} · עד {f.max_profiles} שחקנים</span>
              </span>
            </button>
          ))}
          <button className="btn-ghost w-full" onClick={() => cloudSignOut()}>
            התנתקות
          </button>
        </div>
      </Sheet>
    );

  if (cloud.status === 'link' && cloud.family)
    return (
      <Sheet open onClose={() => undefined} title="🔗 חיבור המכשיר לחשבון">
        <div className="space-y-3">
          <p className="text-sm">
            התחברתם לחשבון <strong>{cloud.family.name}</strong>. במכשיר הזה כבר יש {profiles.length} שחקנים ({profiles.map((p) => p.avatar + ' ' + p.name).join(', ')}). מה לעשות איתם?
          </p>
          <button
            disabled={busy}
            className="btn-primary w-full text-right"
            onClick={async () => {
              setBusy(true);
              await linkFamily('upload');
              setBusy(false);
            }}
          >
            ⬆️ להעלות אותם לחשבון
            <span className="block text-xs font-normal opacity-90">מומלץ אם אלה השחקנים של המשפחה שלכם – הם יישמרו בענן ויופיעו בכל מכשיר</span>
          </button>
          {!confirmReplace ? (
            <button className="btn-soft w-full text-right" onClick={() => setConfirmReplace(true)}>
              ⬇️ לא, רק להוריד את מה שיש בחשבון
              <span className="block text-xs font-normal">השחקנים שבמכשיר יוסרו ממנו (נשמר עותק גיבוי במכשיר)</span>
            </button>
          ) : (
            <div className="rounded-xl bg-amber-50 p-3 text-sm space-y-2">
              <div>בטוחים? השחקנים שבמכשיר לא יעלו לחשבון.</div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className="btn-sell flex-1"
                  onClick={async () => {
                    setBusy(true);
                    await linkFamily('replace');
                    setBusy(false);
                  }}
                >
                  כן, להוריד מהחשבון
                </button>
                <button className="btn-ghost" onClick={() => setConfirmReplace(false)}>
                  ביטול
                </button>
              </div>
            </div>
          )}
          <button className="btn-ghost w-full text-sm" onClick={() => cloudSignOut()}>
            להתנתק ולהמשיך בלי חשבון
          </button>
        </div>
      </Sheet>
    );
  return null;
}