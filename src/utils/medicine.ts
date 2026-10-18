import { calendarDay } from "./dates";
import { dateToDay } from "./food";

// Medicines on a schedule: several times a day, repeated every N days, from a start day until an
// optional end day. Days are the dog's own calendar days (days since 1970-01-01), so owners in
// different timezones agree on what "today" is. A slot's clock time is read on the phone, the way
// the feeding and walk reminders are.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Minutes after a slot's time before the app nags about a dose that hasn't been ticked. */
export const GRACE_MINUTES = 30;

export type Medicine = {
	id: number;
	name: string;
	dose: string | null;
	// "HH:MM", sorted, 1 to 6.
	times: string[];
	// Given every this many days: 1 is every day.
	intervalDays: number;
	// "YYYY-MM-DD".
	startsOn: string;
	// "YYYY-MM-DD", or null to run until it is removed.
	endsOn: string | null;
};

export type Dose = {
	id: number;
	medicineId: number;
	// The due day it was given for, "YYYY-MM-DD".
	for: string;
	slot: string;
	userId: number;
};

/** "2026-10-20" for a calendar day number. */
export function dayToDate(day: number): string {
	return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Whether the medicine is to be given on that calendar day. */
export function isDueOn(m: Medicine, day: number): boolean {
	const start = dateToDay(m.startsOn);
	if (start === null || day < start) return false;
	if (m.endsOn !== null) {
		const end = dateToDay(m.endsOn);
		if (end !== null && day > end) return false;
	}
	return (day - start) % Math.max(1, m.intervalDays) === 0;
}

/** The moment of a slot on a calendar day, as a Date on this phone's clock. */
export function slotInstant(day: number, slot: string): Date {
	const [h, min] = slot.split(":").map(Number);
	const d = new Date(day * DAY_MS);
	return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h, min, 0, 0);
}

export const doseKey = (medicineId: number, date: string, slot: string) => `${medicineId}|${date}|${slot}`;

/** Which doses have been given, for quick lookup. */
export function givenIndex(doses: Dose[]): Map<string, Dose> {
	return new Map(doses.map((d) => [doseKey(d.medicineId, d.for, d.slot), d]));
}

export type SlotStatus =
	// Ticked off.
	| "given"
	// Its time has not come yet.
	| "upcoming"
	// Its time has come (within the grace period): give it now.
	| "due"
	// More than the grace period past its time and still not ticked.
	| "late";

export type DaySlot = {
	medicine: Medicine;
	date: string;
	slot: string;
	dose: Dose | null;
	status: SlotStatus;
};

/** Every dose due on a day, earliest first, with where it stands at `now`. */
export function slotsForDay(
	medicines: Medicine[],
	doses: Dose[],
	day: number,
	now: Date,
	graceMinutes = GRACE_MINUTES,
): DaySlot[] {
	const given = givenIndex(doses);
	const date = dayToDate(day);
	const out: DaySlot[] = [];
	for (const medicine of medicines) {
		if (!isDueOn(medicine, day)) continue;
		for (const slot of medicine.times) {
			const dose = given.get(doseKey(medicine.id, date, slot)) ?? null;
			const at = slotInstant(day, slot).getTime();
			const status: SlotStatus = dose
				? "given"
				: now.getTime() < at
					? "upcoming"
					: now.getTime() < at + graceMinutes * 60_000
						? "due"
						: "late";
			out.push({ medicine, date, slot, dose, status });
		}
	}
	return out.sort((a, b) => a.slot.localeCompare(b.slot) || a.medicine.name.localeCompare(b.medicine.name));
}

export type MedicineReminder = {
	at: Date;
	medicine: Medicine;
	slot: string;
	date: string;
};

type Plan = {
	now: Date;
	medicines: Medicine[];
	doses: Dose[];
	timeZone: string;
	daysAhead?: number;
	graceMinutes?: number;
	// iOS keeps at most 64 local notifications, and the other reminders use some of them.
	max?: number;
};

/**
 * A reminder for each dose due in the next days, `graceMinutes` after its time. Local notifications
 * can't check at fire time whether the dose was ticked, so the rule is applied when scheduling: a
 * dose that is already ticked gets none, and the schedule is rebuilt whenever a dose is ticked or
 * the app opens. Soonest first.
 */
export function planMedicineReminders({
	now,
	medicines,
	doses,
	timeZone,
	daysAhead = 7,
	graceMinutes = GRACE_MINUTES,
	max = 16,
}: Plan): MedicineReminder[] {
	const today = calendarDay(now.getTime(), timeZone);
	const given = givenIndex(doses);
	const out: MedicineReminder[] = [];
	for (let offset = 0; offset < daysAhead; offset += 1) {
		const day = today + offset;
		const date = dayToDate(day);
		for (const medicine of medicines) {
			if (!isDueOn(medicine, day)) continue;
			for (const slot of medicine.times) {
				if (given.has(doseKey(medicine.id, date, slot))) continue;
				const at = new Date(slotInstant(day, slot).getTime() + graceMinutes * 60_000);
				if (at.getTime() > now.getTime()) out.push({ at, medicine, slot, date });
			}
		}
	}
	return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, max);
}

/** A clean list of "HH:MM" times: valid ones only, no repeats, earliest first. */
export function normalizeTimes(times: string[]): string[] {
	return Array.from(new Set(times.filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t)))).sort();
}

/** A time to offer for a new slot: 12 hours after the latest one, or the next free hour after that. */
export function nextFreeTime(existing: string[], fallback = "08:00"): string {
	const sorted = normalizeTimes(existing);
	const last = sorted[sorted.length - 1] ?? fallback;
	const [h0, m] = last.split(":").map(Number);
	for (let k = 0; k < 24; k += 1) {
		const candidate = `${String((h0 + 12 + k) % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
		if (!existing.includes(candidate)) return candidate;
	}
	return fallback;
}
