// How long the app may sit in the background before it asks for Face ID again. Short enough
// that a phone left unlocked on a table is covered, long enough that checking a message or
// answering a call doesn't mean authenticating twice.
export const LOCK_GRACE_MS = 30_000;

/** Whether coming back to the foreground should lock the app. */
export function shouldLock(opts: {
	enabled: boolean;
	// When the app left the foreground (ms since epoch), or null if it never did.
	backgroundedAt: number | null;
	now: number;
	graceMs?: number;
}): boolean {
	if (!opts.enabled) return false;
	if (opts.backgroundedAt === null) return false;
	return opts.now - opts.backgroundedAt >= (opts.graceMs ?? LOCK_GRACE_MS);
}
