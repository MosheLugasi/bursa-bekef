import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { hashPin, useGame, useSession } from '@/state/store';
import type { GameState, Profile } from '@/state/types';
import { useMarket } from '@/data/loader';
import { totalValue } from '@/engine/trading';
import { formatDateHe } from '@/engine/dates';
import { leagueName, leagueOf } from '@/game/challenges';
import { levelFor } from '@/game/xp';
import { canAddProfile } from '@/state/cloud';
import { AccountSection, AppAdminSection } from '@/ui/AccountAdmin';
import { useUI } from '@/state/ui';
import { AGE_LABEL, checkPin, NewPortfolioSheet, PinPad, ProfileForm } from '@/ui/forms';
import { Change, SectionTitle, Sheet } from '@/ui/components';
import { clsx, fmtMoney } from '@/ui/format';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  );
}

export default function Admin() {
  const g = useGame();
  const market = useMarket();
  const session = useSession();
  const nav = useNavigate();
  const [pinErr, setPinErr] = useState<string>();
  const [edit, setEdit] = useState<Profile | 'new' | null>(null);
  const [newPf, setNewPf] = useState<string | null>(null);
  const [ownerPick, setOwnerPick] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [newPin, setNewPin] = useState('');

  if (g.settings.adminPinHash && !session.adminUnlocked) {
    return (
      <div className="max-w-md mx-auto p-6 text-center">
        <div className="text-5xl">🔐</div>
        <div className="font-bold text-xl mt-2">אזור ניהול להורים</div>
        <PinPad
          title="🔐 קוד הורים"
          error={pinErr}
          onCancel={() => nav(-1)}
          onSubmit={(pin) => (checkPin(pin, g.settings.adminPinHash) ? session.setAdmin(true) : setPinErr('קוד שגוי'))}
        />
      </div>
    );
  }

  const profiles = Object.values(g.profiles).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const portfolios = Object.values(g.portfolios).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const m = market.manifest;

  const exportData = () => {
    const data: GameState & { exportedAt: string; app: string } = { app: 'bursa-bekef', exportedAt: new Date().toISOString(), profiles: g.profiles, portfolios: g.portfolios, settings: g.settings, deleted: g.deleted };
    const blob = new Blob([JSON.stringify(data, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bursa-bekef-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4 max-w-3xl mx-auto p-1">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">⚙️ ניהול</h1>
        {!session.profileId && (
          <button className="btn-soft" onClick={() => nav('/')}>
            → למסך השחקנים
          </button>
        )}
      </div>

      <Card title="👨‍👩‍👧‍👦 הגדרות משפחה">
        <div className="grid sm:grid-cols-2 gap-3">
          <label>
            <span className="text-sm font-semibold text-slate-600">שם המשפחה</span>
            <input className="input mt-1" value={g.settings.familyName} onChange={(e) => g.updateSettings({ familyName: e.target.value })} />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-600">סכום התחלתי ברירת מחדל</span>
            <input className="input mt-1 num" inputMode="numeric" value={g.settings.defaultStartCash} onChange={(e) => g.updateSettings({ defaultStartCash: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-600">עמלת מסחר (%)</span>
            <input className="input mt-1 num" inputMode="decimal" value={g.settings.feeRate * 100} onChange={(e) => g.updateSettings({ feeRate: (Number(e.target.value) || 0) / 100 })} />
          </label>
          <label>
            <span className="text-sm font-semibold text-slate-600">עמלה מינימלית (₪/$)</span>
            <input className="input mt-1 num" inputMode="decimal" value={g.settings.minFee} onChange={(e) => g.updateSettings({ minFee: Number(e.target.value) || 0 })} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-sm font-semibold text-slate-600">{g.settings.adminPinHash ? 'החלפת קוד הורים' : 'הגדרת קוד הורים (מומלץ!)'}</span>
            <div className="flex gap-2 mt-1">
              <input className="input num text-center tracking-[0.5em]" inputMode="numeric" maxLength={4} value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))} placeholder="••••" />
              <button
                className="btn-soft"
                disabled={newPin.length !== 4}
                onClick={() => {
                  g.updateSettings({ adminPinHash: hashPin(newPin) });
                  setNewPin('');
                }}
              >
                שמירה
              </button>
              {g.settings.adminPinHash && (
                <button className="btn-ghost" onClick={() => g.updateSettings({ adminPinHash: undefined })}>
                  הסרה
                </button>
              )}
            </div>
          </label>
        </div>
        <div className="text-xs text-slate-500 mt-2">שינוי עמלות חל על תיקים חדשים.</div>
      </Card>

      <Card title="🧑‍🤝‍🧑 שחקנים">
        <div className="divide-y divide-slate-100">
          {profiles.map((p) => (
            <div key={p.id} className="flex items-center gap-3 py-2">
              <span className="w-10 h-10 rounded-full grid place-items-center text-2xl border-2" style={{ borderColor: p.color }}>
                {p.avatar}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold">
                  {p.name} {p.pinHash && '🔒'} {p.unlockAll && '🔓'}
                </span>
                <span className="block text-xs text-slate-500">
                  {AGE_LABEL[p.ageGroup]} · רמה {levelFor(p.xp).level} · {p.xp} XP · {Object.keys(p.achievements).length} הישגים
                </span>
              </span>
              <button className="btn-ghost text-sm" onClick={() => setNewPf(p.id)}>
                ➕ תיק
              </button>
              <button className="btn-ghost text-sm" onClick={() => setEdit(p)}>
                ✏️
              </button>
              <button
                className="btn-ghost text-sm text-down"
                onClick={() => {
                  if (confirm(`למחוק את ${p.name} ואת כל התיקים שלו/ה? אי אפשר לבטל.`)) g.deleteProfile(p.id);
                }}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
        <button className="btn-primary mt-3" onClick={() => setEdit('new')}>
          ➕ שחקן חדש
        </button>
      </Card>

      <Card title="💼 כל התיקים">
        <div className="divide-y divide-slate-100">
          {portfolios.map((p) => {
            const v = totalValue(p, market);
            return (
              <div key={p.id} className={clsx('flex items-center gap-3 py-2', p.archived && 'opacity-50')}>
                <span className="text-2xl">{p.emoji}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-bold truncate">
                    {p.name} {p.archived && '(ארכיון)'}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {g.profiles[p.ownerId]?.avatar} {g.profiles[p.ownerId]?.name} · {leagueName(leagueOf(p))} · {formatDateHe(p.currentDate, { short: true })} · {fmtMoney(v, p.baseCurrency)}
                  </span>
                </span>
                <Change value={v / p.startCash - 1} />
                <button
                  className="btn-ghost text-sm"
                  onClick={() => {
                    const name = prompt('שם חדש לתיק:', p.name);
                    if (name) g.setPortfolio({ ...p, name });
                  }}
                >
                  ✏️
                </button>
                <button className="btn-ghost text-sm" onClick={() => g.setPortfolio({ ...p, archived: !p.archived })} title="ארכיון">
                  {p.archived ? '♻️' : '🗄️'}
                </button>
                <button className="btn-ghost text-sm text-down" onClick={() => confirm(`למחוק את "${p.name}"?`) && g.deletePortfolio(p.id)}>
                  🗑️
                </button>
              </div>
            );
          })}
          {!portfolios.length && <div className="text-slate-500 text-sm py-2">אין תיקים עדיין.</div>}
        </div>
        <button className="btn-primary mt-3" disabled={!profiles.length} onClick={() => setOwnerPick(true)}>
          ➕ תיק חדש לשחקן
        </button>
        <div className="text-xs text-slate-500 mt-2">💡 כל שחקן יכול לנהל כמה תיקים. אפשר למשל לתת לכל ילד תיק "שוק חי" ותיק "מכונת זמן", או לפתוח כמה תיקים תחת משתמש אחד.</div>
      </Card>

      <AccountSection />
      <AppAdminSection />

      <Card title="📡 נתוני השוק">
        <div className="text-sm space-y-1">
          <div>
            מעודכן עד: <strong>{formatDateHe(m.asOf, { weekday: true })}</strong>
          </div>
          <div>נוצר: {new Date(m.generatedAt).toLocaleString('he-IL')}</div>
          <div>
            מקור: {m.synthetic ? <strong className="text-amber-700">⚠️ נתוני פיתוח סינתטיים</strong> : 'Yahoo Finance + FRED (נתוני מסחר אמיתיים, עדכון יומי אוטומטי ב-GitHub Actions)'}
          </div>
          <div>נכסים: {m.instruments.length}</div>
          {m.failed && m.failed.length > 0 && <div className="text-amber-700">לא התקבלו נתונים עבור: {m.failed.join(', ')}</div>}
        </div>
      </Card>

      <Card title="💾 גיבוי ושחזור">
        <div className="flex gap-2 flex-wrap">
          <button className="btn-soft" onClick={exportData}>
            ⬇️ הורדת גיבוי
          </button>
          <button className="btn-soft" onClick={() => fileRef.current?.click()}>
            ⬆️ שחזור מגיבוי
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text()) as GameState;
                if (!data.profiles || !data.portfolios) throw new Error('bad file');
                if (confirm('לשחזר מהגיבוי? המצב הנוכחי במכשיר יוחלף.')) g.replaceAll(data);
              } catch {
                alert('הקובץ לא תקין');
              }
              e.target.value = '';
            }}
          />
        </div>
      </Card>

      <Card title="⚠️ אזור מסוכן">
        <button
          className="btn-sell"
          onClick={() => {
            if (confirm('למחוק את כל השחקנים והתיקים במכשיר הזה? מומלץ להוריד גיבוי קודם.') && confirm('בטוח? אי אפשר לבטל.')) {
              g.resetAll();
              session.logout();
              nav('/');
            }
          }}
        >
          🗑️ איפוס מלא של המשחק
        </button>
      </Card>

      <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? '➕ שחקן חדש' : '✏️ עריכת שחקן'}>
        {edit && (
          <ProfileForm
            initial={edit === 'new' ? undefined : edit}
            showUnlock
            onCancel={() => setEdit(null)}
            onSave={(d) => {
              if (edit === 'new') {
                const q = canAddProfile();
                if (!q.ok) {
                  useUI.getState().toast({ emoji: '✋', text: `בחשבון הזה אפשר עד ${q.max} שחקנים. בקשו מהמנהל להגדיל את המכסה.`, kind: 'bad' });
                  return;
                }
                const id = g.addProfile({ name: d.name, avatar: d.avatar, color: d.color, ageGroup: d.ageGroup, pin: d.pin.length === 4 ? d.pin : undefined });
                if (d.unlockAll) g.updateProfile(id, (p) => ({ ...p, unlockAll: true }));
              } else {
                g.updateProfile(edit.id, (p) => ({ ...p, name: d.name, avatar: d.avatar, color: d.color, ageGroup: d.ageGroup, unlockAll: d.unlockAll, pinHash: d.pin.length === 4 ? hashPin(d.pin) : p.pinHash }));
              }
              setEdit(null);
            }}
          />
        )}
        {edit && edit !== 'new' && edit.pinHash && (
          <button className="btn-ghost text-sm mt-2" onClick={() => { g.updateProfile(edit.id, (p) => ({ ...p, pinHash: undefined })); setEdit(null); }}>
            🔓 הסרת קוד PIN של השחקן
          </button>
        )}
      </Sheet>
      <Sheet open={ownerPick} onClose={() => setOwnerPick(false)} title="למי התיק?">
        <div className="grid grid-cols-2 gap-2">
          {profiles.map((p) => (
            <button
              key={p.id}
              className="card p-3 flex items-center gap-2 hover:shadow-md"
              onClick={() => {
                setOwnerPick(false);
                setNewPf(p.id);
              }}
            >
              <span className="text-2xl">{p.avatar}</span>
              {p.name}
            </button>
          ))}
        </div>
      </Sheet>
      {newPf && <NewPortfolioSheet ownerId={newPf} onClose={() => setNewPf(null)} stay />}
    </div>
  );
}
