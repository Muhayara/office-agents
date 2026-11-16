import React, { useCallback, useEffect, useState } from 'react';
import { type SessionInfo, type SessionRole, fetchSession, login, logout } from '../lib/session';

interface AuthGateProps {
  children: (session: { role: SessionRole; onLogout: () => void }) => React.ReactNode;
}

type GateState =
  | { kind: 'loading' }
  | { kind: 'offline' }
  | { kind: 'login'; info: SessionInfo }
  | { kind: 'ready'; role: SessionRole };

/**
 * Gerbang login CEO. Token hanya dikirim sekali ke POST /api/session;
 * setelah itu browser memakai cookie HttpOnly yang tidak bisa dibaca JavaScript.
 */
export function AuthGate({ children }: AuthGateProps) {
  const [state, setState] = useState<GateState>({ kind: 'loading' });
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const info = await fetchSession();
      setState(info.authenticated && info.role ? { kind: 'ready', role: info.role } : { kind: 'login', info });
    } catch {
      setState({ kind: 'offline' });
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleLogout = useCallback(() => {
    void logout().then(() => {
      setToken('');
      void refresh();
    });
  }, [refresh]);

  if (state.kind === 'ready') {
    return <>{children({ role: state.role, onLogout: handleLogout })}</>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await login(token.trim());
      if (result.ok) {
        setToken('');
        setState({ kind: 'ready', role: result.role });
      } else {
        setError(result.error);
      }
    } catch {
      setError('Server tidak merespons.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card" role="dialog" aria-labelledby="auth-title">
        <h1 id="auth-title" className="auth-title">
          Meja Dispatch Office Agents
        </h1>

        {state.kind === 'loading' && <p className="auth-muted">Memeriksa sesi...</p>}

        {state.kind === 'offline' && (
          <>
            <p className="auth-muted">
              Office Server belum aktif di port 7420. Jalankan <code>start.bat</code> atau{' '}
              <code>npm run dev:server</code>, lalu coba lagi.
            </p>
            <button type="button" className="auth-button" onClick={() => void refresh()}>
              Coba lagi
            </button>
          </>
        )}

        {state.kind === 'login' && (
          <form onSubmit={(e) => void onSubmit(e)}>
            <p className="auth-muted">
              {state.info.tokenSource === 'file' ? (
                <>
                  Masukkan token CEO. Isinya ada di file <code>data/.office-token</code> pada folder
                  proyek (dibuat otomatis saat server pertama kali jalan).
                </>
              ) : (
                <>
                  Masukkan token CEO (nilai <code>OFFICE_TOKEN</code> di file <code>.env</code>).
                </>
              )}
              {state.info.viewerEnabled && ' Token pengunjung hanya membuka mode lihat.'}
            </p>
            <label className="auth-label" htmlFor="office-token">
              Token
            </label>
            <input
              id="office-token"
              className="auth-input mono"
              type="password"
              autoComplete="current-password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoFocus
            />
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-button" disabled={submitting || !token.trim()}>
              {submitting ? 'Memeriksa...' : 'Masuk'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
