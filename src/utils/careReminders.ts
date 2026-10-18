import { calendarDay } from "./dates";

export type CareKind = "vet" | "vaccination" | "parasite";

export type CareDue = {
	kind: CareKind;
	// Vaccination name, vet reason, or parasite type: what the entry is about.
	label: string;
	// A parasite's type ("flea" | "tick" | "worm"), which decides what a newer entry replaces.
	parasiteType?: string | null;
	// When it was given / happened, and when the next one is due (ms since epoch).
	date: number;
	nextDueAt: number | null;
};

export type CareReminder = {
	at: Date;
	kind: CareKind;
	label: string;
	parasiteType?: string | null;
	// A week ahead, or on the day itself.
	when: "soon" | "today";
};

type Plan = {
	now: Date;
	items: CareDue[];
	timeZone: string;
	// Hour of day (device time) the reminder fires. Mid-morning: early enough to book it.
	hour?: number;
	// How many days before the due date the first reminder is sent.
	leadDays?: number;
	// iOS keeps only 64 local notifications and the daily ones use some; stay well under.
	max?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

// A newer entry of the same thing replaces the older one's due date: once a vaccine is
// renewed, the old "next due" is no longer a reminder. Vet visits are one list; vaccines
// are told apart by name; treatments by type (flea, tick, worm).
function groupKey(i: CareDue): string {
	if (i.kind === "vaccination") return `vaccination:${i.label.trim().toLowerCase()}`;
	if (i.kind === "parasite") return `parasite:${i.parasiteType ?? ""}`;
	return "vet";
}

/** The calendar day (in the dog's timezone) as a local Date at `hour`. */
function localAt(calDay: number, hour: number): Date {
	const d = new Date(calDay * DAY_MS); // midnight UTC of that calendar day
	return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour, 0, 0, 0);
}

/**
 * Reminders for vaccinations, vet visits and flea/tick/worm treatments that have a next-due
 * date: one a week before and one on the day, each only if still ahead. Soonest first.
 */
export function planCareReminders({
	now,
	items,
	timeZone,
	hour = 9,
	leadDays = 7,
	max = 20,
}: Plan): CareReminder[] {
	const latest = new Map<string, CareDue>();
	for (const item of items) {
		const key = groupKey(item);
		const current = latest.get(key);
		if (!current || item.date > current.date) latest.set(key, item);
	}

	const out: CareReminder[] = [];
	for (const item of latest.values()) {
		if (item.nextDueAt === null) continue;
		const due = calendarDay(item.nextDueAt, timeZone);
		const days: [number, "soon" | "today"][] = [
			[due - leadDays, "soon"],
			[due, "today"],
		];
		for (const [day, when] of days) {
			const at = localAt(day, hour);
			if (at.getTime() > now.getTime()) out.push({ at, kind: item.kind, label: item.label, parasiteType: item.parasiteType, when });
		}
	}
	return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}
