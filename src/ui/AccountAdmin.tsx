// אזור הניהול: חשבון המשפחה (Google) + ניהול חשבונות למנהל האפליקציה.
import { useEffect, useState } from 'react';
import {
  addMember,
  cloudSignOut,
  listMembers,
  loadConfig,
  localBackup,
  refreshAccount,
  removeMember,
  resetCloudClient,
  saveConfig,
  initCloud,
  selectFamily,
  syncNow,
  useCloud,
  type Member
} from '@/state/cloud';
import { useGame } from '@/state/store';
import { GoogleButton } from './Account';
import { SectionTitle } from './components';
import { clsx } from './format';

function Card({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={clsx('card p-4', className)}>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

const STATUS: Record<string, string> = {
  off: '⚪ לא מוגדר',
  loading: '🔄 טוען...',
  'signed-out': '🟡 לא מחוברים',
  'no-access': '⏳ ממתינים לאישור המנהל',
  'pick-family': '👪 בחירת משפחה',
  link: '🔗 ממתין לחיבור המכשיר',
  syncing: '🔄 מסנכרן...',
  ok: '🟢 מסונכרן',
  error: '🔴 שגיאה'
};

/** פרטי התשתית – רק למנהל המשחק, לא להורים ולא לשחקנים */
function TechInfo() {
  const cfg = loadConfig();
  const isAdmin = useCloud((s) => s.isAdmin);
  const [appId, setAppId] = useState(cfg?.appId ?? '');
  if (!cfg || !isAdmin) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer font-semibold">🛠️ מידע טכני (Base44)</summary>
      <div className="mt-2 space-y-2 text-slate-700">
        <div>
          החשבונות והנתונים נשמרים ב-Base44. מזהה האפליקציה:{' '}
          <span className="num font-mono text-xs" dir="ltr">
            {cfg.appId}
          </span>
        </div>
        <a className="btn-soft text-xs inline-block" href={`https://app.base44.com/apps/${cfg.appId}/editor/workspace/overview`} target="_blank" rel="noreferrer">
          לוח הבקרה של Base44 ↗
        </a>
        <div className="flex gap-2 items-center">
          <input className="input text-xs flex-1" dir="ltr" value={appId} onChange={(e) => setAppId(e.target.value.trim())} aria-label="App ID" />
          <button
            className="btn-ghost text-xs"
            disabled={!appId || appId === cfg.appId}
            onClick={() => {
              saveConfig({ appId, appUrl: cfg.appUrl });
              resetCloudClient();
              initCloud();
            }}
          >
            החלפה
          </button>
        </div>
      </div>
    </details>
  );
}

function FamilyMembers({ familyId, isOwner }: { familyId: string; isOwner: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string>();
  const load = () => listMembers(familyId).then(setMembers);
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId]);
  return (
    <div className="mt-3">
      <div className="font-semibold text-sm mb-1">👥 חשבונות Google שנכנסים למשפחה</div>
      <div className="space-y-1">
        {members.map((m) => (
          <div key={m.email} className="flex items-center gap-2 text-sm rounded-lg bg-slate-50 px-2 py-1.5">
            <span className="flex-1 truncate" dir="ltr">
              {m.email}
            </span>
            <span className="chip text-xs">{m.role === 'owner' ? 'בעלים' : 'שותף'}</span>
            {isOwner && m.role === 'member' && (
              <button className="text-down text-xs" onClick={async () => (setMsg(await removeMember(familyId, m.email)), load())}>
                הסרה
              </button>
            )}
          </div>
        ))}
      </div>
      {isOwner && (
        <div className="flex gap-2 mt-2">
          <input className="input text-sm flex-1" dir="ltr" type="email" placeholder="parent2@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="btn-soft text-sm"
            disabled={!email.includes('@')}
            onClick={async () => {
              const e = await addMember(familyId, email);
              setMsg(e);
              if (!e) setEmail('');
              load();
            }}
          >
            ➕ הוספה
          </button>
        </div>
      )}
      {isOwner && <div className="text-xs text-slate-500 mt-1">למשל בן/בת הזוג – כך גם הם ייכנסו עם Google שלהם לאותה משפחה.</div>}
      {msg && <div className="text-xs text-down mt-1">{msg}</div>}
    </div>
  );
}

export function AccountSection() {
  const cloud = useCloud();
  const nProfiles = useGame((s) => Object.keys(s.profiles).length);
  const configured = !!loadConfig();
  const backup = localBackup();
  return (
    <Card title="☁️ חשבון המשפחה (Google)">
      {!configured ? (
        <p className="text-sm text-slate-600">
          חשבונות הענן כבויים בגרסה הזו – המשחק נשמר רק במכשיר.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="text-sm">
            סטטוס: <strong>{STATUS[cloud.status]}</strong>
            {cloud.email && (
              <span className="text-slate-500">
                {' '}
                · <span dir="ltr">{cloud.email}</span>
              </span>
            )}
            {cloud.lastSync && <span className="text-slate-500"> · {new Date(cloud.lastSync).toLocaleTimeString('he-IL')}</span>}
            {cloud.error && <div className="text-down text-xs mt-1">{cloud.error}</div>}
          </div>
          {cloud.status === 'signed-out' && <GoogleButton />}
          {cloud.status === 'no-access' && (
            <div className="rounded-xl bg-amber-50 p-3 text-sm">
              {cloud.isAdmin ? 'אתם מנהלי המשחק – אשרו את עצמכם במסך ״חשבונות ומשתמשים״, ואז לחצו ״בדיקה שוב״.' : `החשבון עוד לא אושר על ידי המנהל. ${cloud.requested ? 'הבקשה נשלחה ✅' : ''}`}
              <div className="flex gap-2 mt-2">
                <button className="btn-soft text-sm" onClick={() => refreshAccount()}>
                  🔄 בדיקה שוב
                </button>
              </div>
            </div>
          )}
          {cloud.family && (
            <div className="rounded-xl bg-sky-50 p-3 text-sm">
              <div className="font-bold text-base">🏠 {cloud.family.name}</div>
              <div className="text-slate-600">
                שחקנים: <span className="num font-bold">{nProfiles}</span> מתוך <span className="num font-bold">{cloud.family.max_profiles}</span> · {cloud.family.role === 'owner' ? 'אתם הבעלים' : 'אתם שותפים'}
              </div>
              {cloud.families.length > 1 && (
                <select className="input text-sm mt-2" value={cloud.family.id} onChange={(e) => selectFamily(e.target.value)}>
                  {cloud.families.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
              <FamilyMembers familyId={cloud.family.id} isOwner={cloud.family.role === 'owner'} />
            </div>
          )}
          {cloud.status !== 'signed-out' && (
            <div className="flex gap-2">
              {cloud.family && (
                <button className="btn-soft text-sm" onClick={() => syncNow()}>
                  🔄 סנכרון עכשיו
                </button>
              )}
              <button className="btn-ghost text-sm" onClick={() => cloudSignOut()}>
                התנתקות
              </button>
            </div>
          )}
          {backup && (
            <div className="text-xs text-slate-500">
              💾 במכשיר שמור גיבוי של השחקנים שהיו בו לפני החיבור לחשבון ({new Date(backup.at).toLocaleString('he-IL')}, {Object.keys(backup.state.profiles).length} שחקנים).{' '}
              <button
                className="underline"
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(new Blob([JSON.stringify(backup.state, null, 1)], { type: 'application/json' }));
                  a.download = `bursa-bekef-local-backup-${backup.at.slice(0, 10)}.json`;
                  a.click();
                }}
              >
                הורדה כקובץ
              </button>
            </div>
          )}
        </div>
      )}
      <TechInfo />
    </Card>
  );
}

export function AppAdminSection() {
  const isAdmin = useCloud((s) => s.isAdmin);
  if (!isAdmin) return null;
  return (
    <Card title="🛡️ ניהול חשבונות (מנהל המשחק)" className="border-violet-200">
      <p className="text-sm text-slate-600 mb-3">אישור משתמשים חדשים, פתיחת חשבונות משפחה, ניהול חברים ומכסות – הכל במסך אחד.</p>
      <a href="#/accounts" className="btn-primary">
        🛡️ למסך חשבונות ומשתמשים
      </a>
    </Card>
  );
}