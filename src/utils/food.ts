import { calendarDay } from "./dates";

// The current bag of food: how long it lasts, and when to remind about buying more.
// All days are the dog's own calendar days, so co-owners in other timezones agree.

const DAY_MS = 24 * 60 * 60 * 1000;

export type FoodBag = {
	bagGrams: number;
	dailyGrams: number;
	// The day the bag was opened, "YYYY-MM-DD".
	startedOn: string;
};

export type FoodSupply = {
	remainingGrams: number;
	// Whole days of food left, counting today (0 once it has run out).
	daysLeft: number;
	// The calendar day the bag is empty (the first day without a full portion).
	runsOutDay: number;
	// "ok", "low" within `lowDays`, or "out".
	status: "ok" | "low" | "out";
};

/** Days of food left that count as "running low". Also how early the reminder comes. */
export const LOW_FOOD_DAYS = 7;

/** A plain date "2026-10-20" as a calendar day number (days since 1970-01-01). */
export function dateToDay(value: string): number | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
	if (!m) return null;
	return Math.round(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS);
}

/** Today's date in the dog's timezone as "YYYY-MM-DD" (what a new bag starts on). */
export function todayIso(now: number, timeZone: string): string {
	const d = new Date(calendarDay(now, timeZone) * DAY_MS);
	return d.toISOString().slice(0, 10);
}

/** The estimate, or null when the bag isn't fully set up. */
export function foodSupply(
	bag: Partial<FoodBag> | null,
	now: number,
	timeZone: string,
	lowDays = LOW_FOOD_DAYS,
): FoodSupply | null {
	if (!bag?.bagGrams || !bag.dailyGrams || !bag.startedOn) return null;
	const start = dateToDay(bag.startedOn);
	if (start === null) return null;

	const today = calendarDay(now, timeZone);
	const elapsed = Math.max(0, today - start); // a bag opened "tomorrow" hasn't started yet
	const remainingGrams = Math.max(0, bag.bagGrams - bag.dailyGrams * elapsed);
	const runsOutDay = start + Math.floor(bag.bagGrams / bag.dailyGrams);
	const daysLeft = Math.max(0, runsOutDay - today);
	return {
		remainingGrams,
		daysLeft,
		runsOutDay,
		status: daysLeft === 0 ? "out" : daysLeft <= lowDays ? "low" : "ok",
	};
}

export type FoodReminder = { at: Date; when: "soon" | "today" };

function localAt(calDay: number, hour: number): Date {
	const d = new Date(calDay * DAY_MS);
	return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
}

/**
 * Reminders to buy more: `leadDays` before the bag runs out and on the day, at 09:00, each only
 * if still ahead. None when the bag isn't set up.
 */
export function planFoodReminders(
	bag: Partial<FoodBag> | null,
	now: Date,
	timeZone: string,
	{ hour = 9, leadDays = LOW_FOOD_DAYS }: { hour?: number; leadDays?: number } = {},
): FoodReminder[] {
	const supply = foodSupply(bag, now.getTime(), timeZone, leadDays);
	if (!supply) return [];
	return (
		[
			[supply.runsOutDay - leadDays, "soon"],
			[supply.runsOutDay, "today"],
		] as const
	)
		.map(([day, when]) => ({ at: localAt(day, hour), when }))
		.filter((r) => r.at.getTime() > now.getTime());
}
