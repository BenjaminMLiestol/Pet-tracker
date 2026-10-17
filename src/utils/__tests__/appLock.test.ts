import { LOCK_GRACE_MS, shouldLock } from "../appLock";

const now = 1_000_000;

describe("shouldLock", () => {
	it("never locks when the lock is off", () => {
		expect(shouldLock({ enabled: false, backgroundedAt: now - 10 * LOCK_GRACE_MS, now })).toBe(false);
	});

	it("does not lock after a quick trip out of the app", () => {
		expect(shouldLock({ enabled: true, backgroundedAt: now - (LOCK_GRACE_MS - 1), now })).toBe(false);
	});

	it("locks once the grace period has passed", () => {
		expect(shouldLock({ enabled: true, backgroundedAt: now - LOCK_GRACE_MS, now })).toBe(true);
		expect(shouldLock({ enabled: true, backgroundedAt: now - 60 * 60 * 1000, now })).toBe(true);
	});

	it("does nothing if the app never left the foreground", () => {
		expect(shouldLock({ enabled: true, backgroundedAt: null, now })).toBe(false);
	});

	it("takes a custom grace period", () => {
		expect(shouldLock({ enabled: true, backgroundedAt: now - 5_000, now, graceMs: 5_000 })).toBe(true);
		expect(shouldLock({ enabled: true, backgroundedAt: now - 4_999, now, graceMs: 5_000 })).toBe(false);
	});
});
