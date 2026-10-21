export type BirthdayReminder = {
	at: Date;
	// Whole years the dog turns; 0 when the stored year isn't usable (the day still counts).
	age: number;
};

/** "YYYY-MM-DD" -> its parts, or null when malformed. */
export function parseBirthday(value: string | null | undefined): { year: number; month: number; day: number } | null {
	const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
	return m ? { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) } : null;
}

/** A Date as "YYYY-MM-DD" on its local calendar day (not shifted to UTC). */
export function toDateString(d: Date): string {
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * The next birthday at `hour` (device time) that is still ahead, for this year or the next.
 * 29 February is celebrated on 28 February in years that have no leap day. A birthday that is
 * today is included while `hour` hasn't passed yet.
 */
export function planBirthdayReminders(now: Date, birthday: string | null | undefined, hour = 9): BirthdayReminder[] {
	const b = parseBirthday(birthday);
	if (!b) return [];
	const out: BirthdayReminder[] = [];
	for (const year of [now.getFullYear(), now.getFullYear() + 1]) {
		const day = b.month === 2 && b.day === 29 && new Date(year, 1, 29).getMonth() !== 1 ? 28 : b.day;
		const at = new Date(year, b.month - 1, day, hour, 0, 0, 0);
		if (at.getTime() > now.getTime()) out.push({ at, age: Math.max(0, year - b.year) });
	}
	return out;
}

/** True on the dog's birthday (device calendar day); 29 February counts on 28 February in non-leap years. */
export function isBirthdayToday(now: Date, birthday: string | null | undefined): boolean {
	const b = parseBirthday(birthday);
	if (!b) return false;
	const day = b.month === 2 && b.day === 29 && new Date(now.getFullYear(), 1, 29).getMonth() !== 1 ? 28 : b.day;
	return now.getMonth() === b.month - 1 && now.getDate() === day;
}
