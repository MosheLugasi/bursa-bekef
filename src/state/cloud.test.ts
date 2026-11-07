import { describe, expect, it } from 'vitest';
import { localDocs, mergeRemote, type RemoteRow } from './cloud';
import { cloudSql } from './cloudSql';
import type { GameState, Profile } from './types';

const prof = (id: string, updatedAt: string, name = id) => ({ id, name, updatedAt }) as unknown as Profile;
const state = (): GameState => ({
  profiles: { a: prof('a', '2026-01-02T00:00:00Z', 'local-a'), b: prof('b', '2026-01-05T00:00:00Z', 'local-b') },
  portfolios: {},
  settings: { familyName: 'x', defaultStartCash: 1, defaultCurrency: 'ILS', feeRate: 0, minFee: 0, updatedAt: '2026-01-01T00:00:00Z' },
  deleted: {}
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

  it('setup SQL seeds the admin and protects the tables', () => {
    const sql = cloudSql(' Admin@Gmail.com ');
    expect(sql).toContain("values ('admin@gmail.com')");
    for (const tbl of ['families', 'family_members', 'access_requests', 'family_docs', 'app_admins']) expect(sql).toContain(`alter table public.${tbl} enable row level security`);
    expect(sql).toContain('PROFILE_QUOTA');
    expect(cloudSql("x'; drop table y; --@a.com")).not.toContain("x';");
  });
});
