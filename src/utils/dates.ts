// "Which day is it?" depends on where you are. The pet's home timezone decides it, so
// co-owners in different timezones agree on what counts as "today".

const DAY_MS = 24 * 60 * 60 * 1000;

export function deviceTimeZone(): string {
	return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

/** Calendar day (days since 1970-01-01) of an instant, as seen in `timeZone`. */
export function calendarDay(ms: number, timeZone: string): number {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-US", {
			timeZone,
			year: "numeric",
			month: "numeric",
			day: "numeric",
		}).formatToParts(ms);
	} catch {
		// Unknown timezone name: fall back to the device's own.
		parts = new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "numeric",
			day: "numeric",
		}).formatToParts(ms);
	}
	const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
	return Math.round(Date.UTC(get("year"), get("month") - 1, get("day")) / DAY_MS);
}

export function isSameDay(a: number, b: number, timeZone: string): boolean {
	return calendarDay(a, timeZone) === calendarDay(b, timeZone);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: number, to: number, timeZone: string): number {
	return calendarDay(to, timeZone) - calendarDay(from, timeZone);
}
