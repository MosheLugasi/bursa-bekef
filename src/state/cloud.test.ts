import { describe, expect, it } from 'vitest';
import { deviceDataAction, localDocs, mergeRemote, rowsFromRecords, type RemoteRow } from './cloud';
import type { GameState, Profile } from './types';

const prof = (id: string, updatedAt: string, name = id) => ({ id, name, updatedAt }) as unknown as Profile;
const state = (): GameState => ({
  profiles: { a: prof('a', '2026-01-02T00:00:00Z', 'local-a'), b: prof('b', '2026-01-05T00:00:00Z', 'local-b') },
  portfolios: {},
  settings: { familyName: 'x', defaultStartCash: 1, defaultCurrency: 'ILS', feeRate: 0, minFee: 0, updatedAt: '2026-01-01T00:00:00Z' },
  deleted: {}
});

describe('each Google account is separate on a shared device', () => {
  it('syncs when the device data already belongs to this family', () => {
    expect(deviceDataAction('fam-a', 'fam-a', true)).toBe('sync');
  });
  it('never offers to merge another account\'s players – loads only this account', () => {
    expect(deviceDataAction('fam-a', 'fam-b', true)).toBe('replace');
    expect(deviceDataAction('fam-a', 'fam-b', false)).toBe('replace');
  });
  it('asks only about players who played on the device without any account', () => {
    expect(deviceDataAction(null, 'fam-b', true)).toBe('ask');
    expect(deviceDataAction(null, 'fam-b', false)).toBe('replace');
  });
});

describe('cloud sync merge', () => {
  it('last writer wins per document', () => {
    const pushed: Record<string, string> = {};
    const rows: RemoteRow[] = [
      { id: 'profile:a', data: { ...prof('a', '2026-01-03T00:00:00Z', 'remote-a') }, deleted: false, updated_at: '2026-01-03T00:00:00Z' },
      { id: 'profile:b', data: { ...prof('b', '2026-01-04T00:00:00Z', 'remote-b') }, deleted: false, updated_at: '2026-01-04T00:00:00Z' },
      { id: 'profile:c', data: { ...prof('c', '2026-01-01T00:00:00Z', 'remote-c') }, deleted: false, updated_at: '2026-01-01T00:00:00Z' }
    ];
    const { next, changed } = mergeRemote(state(), rows, pushed);
    expect(changed).toBe(true);
    expect(next.profiles.a.name).toBe('remote-a'); // הענן חדש יותר
    expect(next.profiles.b.name).toBe('local-b'); // המכשיר חדש יותר – יידחף
    expect(next.profiles.c.name).toBe('remote-c'); // חדש מהענן
    expect(pushed['profile:a']).toBe('2026-01-03T00:00:00Z');
    expect(pushed['profile:b']).toBeUndefined();
  });

  it('applies remote deletions only over older local copies', () => {
    const rows: RemoteRow[] = [
      { id: 'profile:a', data: null, deleted: true, updated_at: '2026-01-10T00:00:00Z' },
      { id: 'profile:b', data: null, deleted: true, updated_at: '2026-01-04T00:00:00Z' }
    ];
    const { next } = mergeRemote(state(), rows, {});
    expect(next.profiles.a).toBeUndefined();
    expect(next.profiles.b).toBeDefined();
  });

  it('only pushes settings that were actually set up', () => {
    const s = state();
    expect(localDocs(s).map((d) => d.id)).toContain('settings');
    s.settings = { ...s.settings, updatedAt: '' };
    expect(localDocs(s).map((d) => d.id)).not.toContain('settings');
  });

  it('ignores records planted by someone outside the family', () => {
    const recs = [
      { id: 'r1', family_id: 'F', doc_id: 'profile:a', payload: { updatedAt: '2026-01-01T00:00:00Z' }, created_by: 'Mom@Gmail.com', client_updated_at: '2026-01-01T00:00:00Z' },
      { id: 'r2', family_id: 'F', doc_id: 'profile:evil', payload: { updatedAt: '2026-01-01T00:00:00Z' }, created_by: 'stranger@gmail.com' },
      { id: 'r3', family_id: 'OTHER', doc_id: 'profile:b', payload: {}, created_by: 'mom@gmail.com' },
      { id: 'r4', family_id: 'F', doc_id: 'portfolio:p', payload: null, deleted: true, created_by: 'dad@gmail.com', client_updated_at: '2026-01-02T00:00:00Z' }
    ];
    const rows = rowsFromRecords(recs, 'F', ['mom@gmail.com', 'dad@gmail.com']);
    expect(rows.map((r) => r.id)).toEqual(['profile:a', 'portfolio:p']);
    expect(rows[1]).toMatchObject({ deleted: true, data: null, updated_at: '2026-01-02T00:00:00Z' });
  });

  it('Base44 entities keep every table behind row-level security', () => {
    const files = import.meta.glob('/base44/**/*.jsonc', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const readFileSync = (f: string, _enc: string) => files['/' + f];
    const strip = (t: string) => JSON.parse(t.replace(/^\s*\/\/.*$/gm, ''));
    for (const name of ['Family', 'FamilyDoc', 'AccessRequest']) {
      const e = strip(readFileSync(`base44/entities/${name}.jsonc`, 'utf8'));
      expect(e.name).toBe(name);
      for (const op of ['read', 'create', 'update', 'delete']) expect(e.rls?.[op], `${name}.${op}`).toBeTruthy();
    }
    const fam = strip(readFileSync('base44/entities/Family.jsonc', 'utf8'));
    expect(JSON.stringify(fam.rls.create)).toContain('admin');
    expect(JSON.stringify(fam.properties.max_profiles.rls)).toContain('admin');
    const auth = strip(readFileSync('base44/auth/config.jsonc', 'utf8'));
    expect(auth.enableGoogleLogin).toBe(true);
  });
});
