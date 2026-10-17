import { apiFetch } from './client';
import { setToken } from './tokenStorage';

// Logins last a week on the server. Opening the app swaps the current one for a fresh week,
// so anyone who uses the app stays signed in and a lost phone expires on its own.

// Coming back to the foreground refreshes at most this often; a cold start always does.
export const REFRESH_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

let inFlight: Promise<unknown> | null = null;
let lastRefreshAt = 0;

/**
 * Swaps in a fresh token. Resolves the signed-in user, or null when nothing was done (too
 * soon, offline, or the login has expired, in which case the 401 handler signs out).
 * One call at a time: the server keeps the old token for only a few minutes.
 */
export function refreshSession<U>(opts: { force?: boolean } = {}): Promise<U | null> {
	if (inFlight) return inFlight as Promise<U | null>;
	if (!opts.force && Date.now() - lastRefreshAt < REFRESH_MIN_INTERVAL_MS) {
		return Promise.resolve(null);
	}

	inFlight = (async () => {
		try {
			const res = await apiFetch<{ user: U; token: string }>('/auth/refresh', { method: 'POST' });
			await setToken(res.token);
			lastRefreshAt = Date.now();
			return res.user;
		} catch {
			return null;
		} finally {
			inFlight = null;
		}
	})();
	return inFlight as Promise<U | null>;
}

/** Forget the throttle (a new sign-in starts a fresh week anyway). */
export function resetSessionRefresh(): void {
	lastRefreshAt = Date.now();
}
