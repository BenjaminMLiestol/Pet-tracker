import { calendarDay } from "./dates";

export type DayCount = {
	// Calendar day (days since 1970-01-01) in the dog's timezone.
	day: number;
	count: number;
};

/**
 * How many entries fall on each of the last `days` calendar days, oldest first, the last
 * item being today. Days are the dog's own (so co-owners in other timezones agree).
 */
export function lastDaysCounts(
	timestamps: number[],
	now: number,
	timeZone: string,
	days = 7,
): DayCount[] {
	const today = calendarDay(now, timeZone);
	const counts = new Map<number, number>();
	for (const ts of timestamps) {
		const day = calendarDay(ts, timeZone);
		if (day <= today && day > today - days) counts.set(day, (counts.get(day) ?? 0) + 1);
	}
	return Array.from({ length: days }, (_, i) => {
		const day = today - (days - 1 - i);
		return { day, count: counts.get(day) ?? 0 };
	});
}

export function totalOf(counts: DayCount[]): number {
	return counts.reduce((sum, d) => sum + d.count, 0);
}

/** Average per day over the window, rounded to one decimal ("2.6"). */
export function averagePerDay(counts: DayCount[]): number {
	if (counts.length === 0) return 0;
	return Math.round((totalOf(counts) / counts.length) * 10) / 10;
}

/** First letter (or short name) of a calendar day's weekday, in the given locale. */
export function weekdayLabel(
	day: number,
	locale: string,
	width: "narrow" | "short" = "narrow",
): string {
	// `day` is already a calendar date, so read its weekday in UTC to avoid shifting it.
	return new Intl.DateTimeFormat(locale, { weekday: width, timeZone: "UTC" }).format(
		day * 24 * 60 * 60 * 1000,
	);
}
