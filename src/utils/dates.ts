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

function zoneOrDevice(timeZone: string): string | undefined {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return timeZone;
	} catch {
		return undefined; // unknown name: fall back to the device's own
	}
}

/**
 * "Today 21:23", "Yesterday 20:10", or "15 Oct 18:30": when something happened, as people
 * say it. Day and clock are both read in the pet's timezone so they always agree.
 */
export function formatWhen(
	ts: number,
	timeZone: string,
	locale: string,
	labels: { today: string; yesterday: string },
): string {
	const zone = zoneOrDevice(timeZone);
	const time = new Intl.DateTimeFormat(locale, {
		hour: "2-digit",
		minute: "2-digit",
		timeZone: zone,
	}).format(ts);
	const days = daysBetween(ts, Date.now(), timeZone);
	if (days <= 0) return `${labels.today} ${time}`;
	if (days === 1) return `${labels.yesterday} ${time}`;
	const date = new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		timeZone: zone,
	}).format(ts);
	return `${date} ${time}`;
}

/** Like formatWhen without the clock: "Today", "Yesterday" or "15 Oct" (year added when older). */
export function formatDay(
	ts: number,
	timeZone: string,
	locale: string,
	labels: { today: string; yesterday: string },
): string {
	const zone = zoneOrDevice(timeZone);
	const days = daysBetween(ts, Date.now(), timeZone);
	if (days <= 0) return labels.today;
	if (days === 1) return labels.yesterday;
	const sameYear =
		new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: zone }).format(ts) ===
		new Intl.DateTimeFormat("en-US", { year: "numeric", timeZone: zone }).format(Date.now());
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		...(sameYear ? {} : { year: "numeric" }),
		timeZone: zone,
	}).format(ts);
}

