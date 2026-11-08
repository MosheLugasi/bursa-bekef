import { useState } from 'react';
import { adminCreateFamily, norm } from '@/state/cloud';
import { DEFAULT_MAX_PROFILES } from '@/state/cloud';
import { inviteAppUser } from '@/state/admin';

/** פתיחת חשבון משפחה חדש לכתובת Gmail (גם לפני שהאדם נכנס לאפליקציה) */
export function NewAccountForm({ registered, onDone }: { registered: Set<string>; onDone: (email: string) => void }) {
  const [name, setName] = useState('');
  const [owner, setOwner] = useState('');
  const [max, setMax] = useState(DEFAULT_MAX_PROFILES);
  const [invite, setInvite] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();
  const isNew = owner.includes('@') && !registered.has(norm(owner));
  const submit = async () => {
    setBusy(true);
    let e = await adminCreateFamily(name, owner, max);
    if (!e && invite && isNew) e = (await inviteAppUser(owner)) && 'החשבון נפתח, אבל שליחת ההזמנה נכשלה';
    setBusy(false);
    setMsg(e ?? '✅ החשבון נפתח! עכשיו אפשר להיכנס איתו עם Google.');
    if (!e || e.startsWith('החשבון נפתח')) {
      onDone(norm(owner));
      setName('');
      setOwner('');
    }
  };
  return (
    <div className="space-y-2">
      <div className="grid sm:grid-cols-2 gap-2">
        <input className="input text-sm" placeholder="שם המשפחה (למשל: משפחת כהן)" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="input text-sm" dir="ltr" type="email" placeholder="parent@gmail.com" value={owner} onChange={(e) => setOwner(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          מספר שחקנים מותר:
          <input className="input text-sm w-20 num" type="number" min={1} max={50} value={max} onChange={(e) => setMax(Math.max(1, Math.min(50, Number(e.target.value) || 1)))} />
        </label>
        {isNew && (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={invite} onChange={(e) => setInvite(e.target.checked)} />
            📧 לשלוח הזמנה במייל
          </label>
        )}
      </div>
      <button className="btn-primary text-sm" disabled={busy || !owner.includes('@')} onClick={submit}>
        {busy ? 'פותחים...' : '✨ פתיחת החשבון'}
      </button>
      {msg && <div className="text-xs">{msg}</div>}
    </div>
  );
}