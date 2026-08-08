const SESSION_KEY = 'ping.session.v1';

export interface Session {
  myId: string;
  hasPw: boolean;
}

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (typeof parsed.myId !== 'string' || !parsed.myId) return null;
    return { myId: parsed.myId, hasPw: Boolean(parsed.hasPw) };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // localStorage unavailable (e.g. private mode) — session just won't persist.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // localStorage unavailable — nothing to clear.
  }
}
