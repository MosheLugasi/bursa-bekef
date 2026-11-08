import { ShoriMark } from '@/ui/Logo';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useGame, useSession } from '@/state/store';
import { levelFor } from '@/game/xp';
import { checkPin, PinPad, ProfileForm } from '@/ui/forms';
import { Sheet } from '@/ui/components';
import { playerLimitText, canAddProfile, cloudConfigured, useCloud } from '@/state/cloud';
import { useUI } from '@/state/ui';
import { AccountBar, SignInScreen } from '@/ui/Account';
import { LANDING_URL } from '@/ui/links';
import type { NewProfile } from '@/state/store';

/** הוספת שחקן – בכפוף למכסת השחקנים של חשבון הענן */
function addWithQuota(add: (p: NewProfile) => string, p: NewProfile): boolean {
  const q = canAddProfile();
  if (!q.ok) {
    useUI.getState().toast({ emoji: '✋', text: playerLimitText(q.max), kind: 'bad' });
    return false;
  }
  add(p);
  return true;
}

function Setup({ onStart, onDone }: { onStart: () => void; onDone: () => void }) {
  const setup = useGame((s) => s.setup);
  const addProfile = useGame((s) => s.addProfile);
  const profileMap = useGame((s) => s.profiles);
  const profiles = useMemo(() => Object.values(profileMap), [profileMap]);
  const [step, setStep] = useState(0);
  const cloudFamily = useCloud((c) => c.family);
  const [family, setFamily] = useState(cloudFamily?.name ?? '');
  const [pin, setPin] = useState('');
  return (
    <div className="max-w-lg mx-auto p-4 pt-10">
      <div className="text-center mb-6">
        <div className="flex justify-center anim-float"><ShoriMark size={88} className="drop-shadow-lg" /></div>
        <h1 className="text-3xl font-extrabold mt-2 text-ink">שורי</h1>
        <p className="text-slate-600 mt-1">משחק מסחר בבורסה לכל המשפחה – עם נתונים אמיתיים מישראל ומארה״ב</p>
      </div>
      {step === 0 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-xl font-bold">👋 ברוכים הבאים! בואו נכין את המשחק</h2>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">שם המשפחה / הקבוצה</span>
            <input className="input mt-1" value={family} onChange={(e) => setFamily(e.target.value)} placeholder="למשל: משפחת לוגסי" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-slate-600">קוד הורים לניהול (4 ספרות, מומלץ)</span>
            <input className="input mt-1 num text-center tracking-[0.5em]" inputMode="numeric" maxLength={4} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
            <span className="text-xs text-slate-500">הקוד שומר על אזור הניהול: הוספת שחקנים, תיקים, איפוס וגיבוי.</span>
          </label>
          <button
            className="btn-primary w-full"
            onClick={() => {
              setup(family.trim() || 'המשפחה שלנו', pin.length === 4 ? pin : undefined);
              onStart();
              setStep(1);
            }}
          >
            המשך ←
          </button>
        </div>
      )}
      {step === 1 && (
        <div className="card p-5 space-y-4">
          <h2 className="text-xl font-bold">🧑‍🤝‍🧑 מי משחק?</h2>
          {profiles.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {profiles.map((p) => (
                <span key={p.id} className="chip">
                  {p.avatar} {p.name}
                </span>
              ))}
            </div>
          )}
          <ProfileForm key={profiles.length} saveLabel="➕ הוספת שחקן" onSave={(d) => addWithQuota(addProfile, { name: d.name, avatar: d.avatar, color: d.color, ageGroup: d.ageGroup, pin: d.pin.length === 4 ? d.pin : undefined })} />
          {profiles.length > 0 && (
            <button className="btn-buy w-full text-lg" onClick={onDone}>
              סיימנו להוסיף – בואו נשחק! 🎉
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Welcome() {
  const profileMap = useGame((s) => s.profiles);
  const profiles = useMemo(() => Object.values(profileMap), [profileMap]);
  const settings = useGame((s) => s.settings);
  const portfolios = useGame((s) => s.portfolios);
  const addProfile = useGame((s) => s.addProfile);
  const login = useSession((s) => s.login);
  const nav = useNavigate();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pinErr, setPinErr] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [adminPin, setAdminPin] = useState(false);
  // wizard = באמצע הוספת שחקנים בהקמה (כדי שלא נקפוץ למסך הבחירה אחרי השחקן הראשון)
  const [wizard, setWizard] = useState(false);
  const cloudStatus = useCloud((c) => c.status);
  const cloudFamily = useCloud((c) => c.family);
  const isAdmin = useCloud((c) => c.isAdmin);
  const firstSyncDone = useCloud((c) => !!c.lastSync);
  const [guest, setGuest] = useState(() => localStorage.getItem('bursa-bekef-guest') === '1');

  const empty = !settings.familyName || profiles.length === 0;
  // יש חשבונות ענן ואין נתונים במכשיר: קודם מתחברים (או בוחרים לשחק בלי חשבון)
  const familyReady = !!cloudFamily && (cloudStatus === 'ok' || cloudStatus === 'error' || (cloudStatus === 'syncing' && firstSyncDone));
  if (empty && !wizard && cloudConfigured() && !guest && !familyReady)
    return (
      <SignInScreen
        onGuest={() => {
          localStorage.setItem('bursa-bekef-guest', '1');
          setGuest(true);
        }}
      />
    );
  if (wizard || empty) return <Setup onStart={() => setWizard(true)} onDone={() => setWizard(false)} />;

  const enter = (id: string) => {
    login(id);
    const has = Object.values(portfolios).some((p) => p.ownerId === id && !p.archived);
    nav(has ? '/home' : '/portfolio?new=1');
  };

  return (
    <div className="max-w-3xl mx-auto p-4 pt-10">
      <div className="text-center mb-8">
        <div className="flex justify-center anim-float"><ShoriMark size={72} className="drop-shadow-lg" /></div>
        <h1 className="text-3xl font-extrabold mt-1 text-ink">שורי</h1>
        <p className="text-slate-600">{settings.familyName}</p>
        <h2 className="text-2xl font-bold mt-6">מי משחק עכשיו?</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...profiles]
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
          .map((p) => {
            const l = levelFor(p.xp);
            return (
              <button
                key={p.id}
                onClick={() => (p.pinHash ? (setPinErr(undefined), setPinFor(p.id)) : enter(p.id))}
                className="card p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-0.5 transition"
              >
                <div className="w-20 h-20 rounded-full grid place-items-center text-5xl border-4" style={{ borderColor: p.color, background: p.color + '22' }}>
                  {p.avatar}
                </div>
                <div className="font-bold text-lg">{p.name}</div>
                <div className="text-xs text-slate-500">
                  {l.emoji} {l.title} · רמה {l.level}
                </div>
                {p.pinHash && <div className="text-xs">🔒</div>}
              </button>
            );
          })}
        <button onClick={() => (settings.adminPinHash ? setAdminPin(true) : setAdding(true))} className="rounded-2xl border-2 border-dashed border-slate-300 p-4 flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-white">
          <div className="text-5xl">➕</div>
          <div className="font-semibold">שחקן חדש</div>
        </button>
      </div>
      <div className="mt-6">
        <AccountBar />
      </div>
      <div className="text-center mt-4 flex flex-wrap justify-center gap-1">
        <Link to="/admin" className="btn-ghost">
          ⚙️ אזור ניהול (הורים)
        </Link>
        <a href={LANDING_URL} className="btn-ghost">
          🌐 אתר שורי
        </a>
        {isAdmin && (
          <Link to="/accounts" className="btn-ghost">
            🛡️ חשבונות ומשתמשים
          </Link>
        )}
      </div>
      {pinFor && (
        <PinPad
          title="🔒 הקלידו את הקוד שלכם"
          error={pinErr}
          onCancel={() => setPinFor(null)}
          onSubmit={(pin) => {
            const p = profiles.find((x) => x.id === pinFor);
            if (p && checkPin(pin, p.pinHash)) enter(p.id);
            else setPinErr('קוד שגוי, נסו שוב');
          }}
        />
      )}
      {adminPin && (
        <PinPad
          title="🔐 קוד הורים"
          error={pinErr}
          onCancel={() => setAdminPin(false)}
          onSubmit={(pin) => {
            if (checkPin(pin, settings.adminPinHash)) {
              setAdminPin(false);
              setPinErr(undefined);
              setAdding(true);
            } else setPinErr('קוד שגוי');
          }}
        />
      )}
      <Sheet open={adding} onClose={() => setAdding(false)} title="➕ שחקן חדש">
        <ProfileForm
          saveLabel="הוספה"
          onCancel={() => setAdding(false)}
          onSave={(d) => {
            if (addWithQuota(addProfile, { name: d.name, avatar: d.avatar, color: d.color, ageGroup: d.ageGroup, pin: d.pin.length === 4 ? d.pin : undefined })) setAdding(false);
          }}
        />
      </Sheet>
    </div>
  );
}