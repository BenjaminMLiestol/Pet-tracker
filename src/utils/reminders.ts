export type TimeOfDay = { hour: number; minute: number };
export type PlannedReminder = { kind: "feeding" | "walk"; at: Date };

/** "07:30" -> { hour: 7, minute: 30 }. Anything malformed falls back to `fallback`. */
export function parseTime(value: string | null | undefined, fallback: TimeOfDay): TimeOfDay {
	const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value ?? "");
	return match ? { hour: Number(match[1]), minute: Number(match[2]) } : fallback;
}

/** { hour: 7, minute: 5 } -> "07:05" (what the server stores). */
export function formatTime({ hour, minute }: TimeOfDay): string {
	return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** A Date on today's calendar day at the given time, used for the time picker. */
export function timeToDate({ hour, minute }: TimeOfDay, base = new Date()): Date {
	return new Date(base.getFullYear(), base.getMonth(), base.getDate(), hour, minute, 0, 0);
}

type Plan = {
	now: Date;
	daysAhead: number;
	feeding: TimeOfDay;
	walk: TimeOfDay;
	fedToday: boolean;
	walkedToday: boolean;
};

/**
 * Which feeding/walk reminders to schedule. Local notifications can't decide at fire time, so
 * the rule is applied when scheduling (and again whenever data changes): a reminder only exists
 * for a day if its time is still ahead and, for today, nothing has been logged yet.
 */
export function planDailyReminders({
	now,
	daysAhead,
	feeding,
	walk,
	fedToday,
	walkedToday,
}: Plan): PlannedReminder[] {
	const at = (dayOffset: number, { hour, minute }: TimeOfDay) =>
		new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, minute, 0, 0);

	const planned: PlannedReminder[] = [];
	for (let day = 0; day < daysAhead; day += 1) {
		if (!(day === 0 && fedToday)) planned.push({ kind: "feeding", at: at(day, feeding) });
		if (!(day === 0 && walkedToday)) planned.push({ kind: "walk", at: at(day, walk) });
	}
	return planned
		.filter((r) => r.at.getTime() > now.getTime())
		.sort((a, b) => a.at.getTime() - b.at.getTime());
}
