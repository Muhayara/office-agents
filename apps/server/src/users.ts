import crypto from 'node:crypto';
import type { OfficeDb } from './db';

/**
 * Akun pengunjung (login Google, F4). Peran: `guest` (bawaan) atau `employee` (dinaikkan CEO).
 * CEO tetap memakai token — akun Google tidak pernah mendapat hak CEO (§3.7).
 * Email hanya disimpan untuk CEO (menaikkan karyawan), tidak pernah dikirim ke pengguna lain.
 */
export type UserRole = 'guest' | 'employee';

export interface OfficeUser {
  id: string;
  provider: 'google';
  name: string;
  email: string;
  role: UserRole;
  blocked: boolean;
  createdAt: string;
  lastLoginAt: string;
}

interface UserRow {
  id: string;
  provider: string;
  name: string;
  email: string;
  role: string;
  blocked: number;
  created_at: string;
  last_login_at: string;
}

export const USER_ID_RE = /^u_[A-Za-z0-9_-]{16,40}$/;

function toUser(r: UserRow): OfficeUser {
  return {
    id: r.id,
    provider: 'google',
    name: r.name,
    email: r.email,
    role: r.role === 'employee' ? 'employee' : 'guest',
    blocked: r.blocked === 1,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  };
}

export class OfficeUsers {
  constructor(private readonly store: OfficeDb) {
    store.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        sub TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'guest',
        blocked INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL,
        UNIQUE (provider, sub)
      );
    `);
  }

  /** Buat atau perbarui akun Google (nama & email diperbarui setiap login; peran & blokir tetap). */
  upsertGoogle(identity: { sub: string; name: string; email: string }, now = new Date()): OfficeUser {
    const at = now.toISOString();
    const existing = this.store.db
      .prepare('SELECT * FROM users WHERE provider = ? AND sub = ?')
      .get('google', identity.sub) as UserRow | undefined;
    if (existing) {
      this.store.db
        .prepare('UPDATE users SET name = ?, email = ?, last_login_at = ? WHERE id = ?')
        .run(identity.name, identity.email, at, existing.id);
      return toUser({ ...existing, name: identity.name, email: identity.email, last_login_at: at });
    }
    const id = `u_${crypto.randomBytes(16).toString('base64url')}`;
    this.store.db
      .prepare('INSERT INTO users (id, provider, sub, name, email, role, blocked, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)')
      .run(id, 'google', identity.sub, identity.name, identity.email, 'guest', at, at);
    return { id, provider: 'google', name: identity.name, email: identity.email, role: 'guest', blocked: false, createdAt: at, lastLoginAt: at };
  }

  get(id: string): OfficeUser | null {
    if (!USER_ID_RE.test(id)) return null;
    const r = this.store.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return r ? toUser(r) : null;
  }

  list(limit = 200): OfficeUser[] {
    const rows = this.store.db
      .prepare('SELECT * FROM users ORDER BY last_login_at DESC LIMIT ?')
      .all(Math.min(Math.max(limit, 1), 1000)) as unknown as UserRow[];
    return rows.map(toUser);
  }

  update(id: string, patch: { role?: UserRole; blocked?: boolean }): OfficeUser | null {
    const u = this.get(id);
    if (!u) return null;
    const role = patch.role ?? u.role;
    const blocked = patch.blocked ?? u.blocked;
    this.store.db.prepare('UPDATE users SET role = ?, blocked = ? WHERE id = ?').run(role, blocked ? 1 : 0, id);
    return { ...u, role, blocked };
  }
}
