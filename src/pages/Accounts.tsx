import { useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { refreshAccount, useCloud } from '@/state/cloud';
import { useSession } from '@/state/store';
import { GoogleButton } from '@/ui/Account';
import { SectionTitle } from '@/ui/components';
import { useAdminData } from '@/ui/admin/useAdminData';
import { PendingRow } from '@/ui/admin/PendingRow';
import { NewAccountForm } from '@/ui/admin/NewAccountForm';
import { FamilyCard } from '@/ui/admin/FamilyCard';
import { UsersList } from '@/ui/admin/UsersList';

const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="card p-4">
    <SectionTitle>{title}</SectionTitle>
    {children}
  </div>
);

export default function Accounts() {
  const cloud = useCloud();
  const profileId = useSession((s) => s.profileId);
  const nav = useNavigate();
  const { data, load } = useAdminData(cloud.isAdmin);
  const [q, setQ] = useState('');
  const users = useMemo(() => new Map((data?.users ?? []).map((u) => [u.email, u])), [data]);
  const done = (email?: string) => {
    load();
    if (email && email === cloud.email) refreshAccount();
  };
  const s = q.trim().toLowerCase();
  const families = (data?.families ?? []).filter((f) => !s || f.name.toLowerCase().includes(s) || f.family_members.some((m) => m.email.includes(s)));

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-2xl font-extrabold">🛡️ חשבונות ומשתמשים</h1>
      {!profileId && <button className="btn-soft" onClick={() => nav('/')}>→ למסך הראשי</button>}
    </div>
  );
  if (cloud.status === 'loading' || cloud.status === 'off' || cloud.status === 'signed-out' || !cloud.isAdmin)
    return (
      <div className="space-y-4 max-w-3xl mx-auto p-3">
        {header}
        <div className="card p-5 text-center space-y-3">
          {cloud.status === 'loading' ? <div>🔄 טוען...</div> : cloud.status === 'signed-out' ? <><div>כדי לנהל חשבונות צריך להתחבר עם חשבון המנהל.</div><GoogleButton /></> : <div>🔒 המסך הזה מיועד למנהל המשחק בלבד.</div>}
        </div>
      </div>
    );

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-3">
      {header}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="chip">🏠 <span className="num font-bold">{data?.families.length ?? '…'}</span> חשבונות</span>
        <span className="chip">👤 <span className="num font-bold">{data?.users.length ?? '…'}</span> משתמשים</span>
        <span className="chip">⏳ <span className="num font-bold">{data?.pending.length ?? '…'}</span> ממתינים</span>
        <span className="flex-1" />
        <button className="btn-ghost text-sm" onClick={load}>🔄 רענון</button>
      </div>
      {data?.error && <div className="text-xs text-down">{data.error}</div>}
      <Section title="⏳ ממתינים לאישור">
        {!data ? <div className="text-sm text-slate-500">טוען...</div> : data.pending.length ? (
          <div className="space-y-2">{data.pending.map((p) => <PendingRow key={p.email} p={p} families={data.families} onDone={done} />)}</div>
        ) : <div className="text-sm text-slate-500">✅ אין אף אחד שממתין. מי שייכנס עם Google ועוד לא שויך למשפחה – יופיע כאן.</div>}
      </Section>
      <Section title="✨ פתיחת חשבון משפחה חדש">
        <p className="text-xs text-slate-500 mb-2">מזינים את כתובת ה-Gmail של ההורה – ברגע שייכנס עם Google הוא יגיע ישר למשפחה שלו.</p>
        <NewAccountForm registered={new Set(users.keys())} onDone={done} />
      </Section>
      <Section title="🏠 חשבונות משפחה">
        <input className="input text-sm mb-3" placeholder="🔍 חיפוש לפי שם משפחה או מייל" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="space-y-2">
          {families.map((f) => <FamilyCard key={f.id} f={f} users={users} onChange={done} />)}
          {data && !families.length && <div className="text-sm text-slate-500">לא נמצאו חשבונות.</div>}
        </div>
      </Section>
      <Section title="👤 כל המשתמשים">
        <UsersList users={data?.users ?? []} families={data?.families ?? []} />
      </Section>
    </div>
  );
}