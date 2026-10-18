import {
	GRACE_MINUTES,
	dayToDate,
	isDueOn,
	nextFreeTime,
	normalizeTimes,
	planMedicineReminders,
	slotInstant,
	slotsForDay,
	type Dose,
	type Medicine,
} from "../medicine";
import { dateToDay } from "../food";

const TZ = "Europe/Oslo";
const day = (iso: string) => dateToDay(iso)!;
// A moment on this phone's clock (no "Z"), like the slots.
const at = (iso: string) => new Date(iso);

const med = (over: Partial<Medicine> = {}): Medicine => ({
	id: 1,
	name: "Apoquel",
	dose: "1 tablet",
	times: ["08:00", "20:00"],
	intervalDays: 1,
	startsOn: "2026-10-10",
	endsOn: null,
	...over,
});

const dose = (over: Partial<Dose> = {}): Dose => ({ id: 1, medicineId: 1, for: "2026-10-20", slot: "08:00", userId: 1, ...over });

describe("days", () => {
	it("round-trips a calendar day", () => {
		expect(dayToDate(day("2026-10-20"))).toBe("2026-10-20");
		expect(dayToDate(day("2026-12-31") + 1)).toBe("2027-01-01");
	});
});

describe("isDueOn", () => {
	it("every day from the start, not before it", () => {
		expect(isDueOn(med(), day("2026-10-10"))).toBe(true);
		expect(isDueOn(med(), day("2026-12-24"))).toBe(true);
		expect(isDueOn(med(), day("2026-10-09"))).toBe(false);
	});

	it("every N days counts from the start day", () => {
		const m = med({ intervalDays: 3 });
		expect([10, 11, 12, 13, 14, 15, 16].map((d) => isDueOn(m, day(`2026-10-${d}`)))).toEqual([true, false, false, true, false, false, true]);
	});

	it("every 30 days crosses month ends", () => {
		const m = med({ intervalDays: 30 });
		expect(isDueOn(m, day("2026-11-09"))).toBe(true);
		expect(isDueOn(m, day("2026-11-08"))).toBe(false);
	});

	it("stops after the end day, including that day", () => {
		const m = med({ endsOn: "2026-10-14" });
		expect(isDueOn(m, day("2026-10-14"))).toBe(true);
		expect(isDueOn(m, day("2026-10-15"))).toBe(false);
	});

	it("runs forever without an end", () => {
		// Every 7 days from 2026-10-10: 2030-01-02 is 1180 days on, which is not a multiple of 7.
		expect(isDueOn(med({ intervalDays: 7 }), day("2030-01-02"))).toBe(false);
		expect(isDueOn(med({ intervalDays: 7 }), day("2030-01-05"))).toBe(true);
		expect(isDueOn(med({ intervalDays: 1 }), day("2040-06-01"))).toBe(true);
	});
});

describe("slotsForDay", () => {
	const d = day("2026-10-20");

	it("lists each slot of each due medicine, earliest first", () => {
		const slots = slotsForDay([med({ id: 2, name: "Zink", times: ["12:00"] }), med()], [], d, at("2026-10-20T06:00:00"));
		expect(slots.map((s) => `${s.slot} ${s.medicine.name}`)).toEqual(["08:00 Apoquel", "12:00 Zink", "20:00 Apoquel"]);
	});

	it("leaves out medicines that are not due that day", () => {
		expect(slotsForDay([med({ intervalDays: 2, startsOn: "2026-10-19" })], [], d, at("2026-10-20T06:00:00"))).toEqual([]);
	});

	it("is upcoming before the time, due until the grace period is over, then late", () => {
		const status = (iso: string) => slotsForDay([med({ times: ["08:00"] })], [], d, at(iso))[0].status;
		expect(status("2026-10-20T07:59:00")).toBe("upcoming");
		expect(status("2026-10-20T08:00:00")).toBe("due");
		expect(status("2026-10-20T08:29:00")).toBe("due");
		expect(status("2026-10-20T08:30:00")).toBe("late");
		expect(GRACE_MINUTES).toBe(30);
	});

	it("is given once ticked, whatever the time, and carries who gave it", () => {
		const slots = slotsForDay([med()], [dose({ userId: 7 })], d, at("2026-10-20T23:00:00"));
		expect(slots[0].status).toBe("given");
		expect(slots[0].dose?.userId).toBe(7);
		expect(slots[1].status).toBe("late");
	});

	it("does not mix up doses of another day, slot or medicine", () => {
		const doses = [dose({ for: "2026-10-19" }), dose({ slot: "20:00", medicineId: 2 })];
		expect(slotsForDay([med()], doses, d, at("2026-10-20T06:00:00")).every((s) => s.status === "upcoming")).toBe(true);
	});
});

describe("planMedicineReminders", () => {
	const plan = (over = {}) =>
		planMedicineReminders({ now: at("2026-10-20T06:00:00"), medicines: [med()], doses: [], timeZone: TZ, ...over });
	const when = (r: { at: Date }) => `${r.at.getMonth() + 1}/${r.at.getDate()} ${String(r.at.getHours()).padStart(2, "0")}:${String(r.at.getMinutes()).padStart(2, "0")}`;

	it("reminds 30 minutes after each slot", () => {
		const r = plan({ daysAhead: 1 });
		expect(r.map(when)).toEqual(["10/20 08:30", "10/20 20:30"]);
	});

	it("skips a dose that is already ticked, and times that have passed", () => {
		expect(plan({ daysAhead: 1, doses: [dose()] }).map(when)).toEqual(["10/20 20:30"]);
		expect(plan({ daysAhead: 1, now: at("2026-10-20T08:15:00") }).map(when)).toEqual(["10/20 08:30", "10/20 20:30"]);
		expect(plan({ daysAhead: 1, now: at("2026-10-20T08:31:00") }).map(when)).toEqual(["10/20 20:30"]);
	});

	it("follows the schedule: every N days, and nothing after the end", () => {
		const m = med({ intervalDays: 3, startsOn: "2026-10-20", times: ["09:00"], endsOn: "2026-10-26" });
		expect(planMedicineReminders({ now: at("2026-10-20T06:00:00"), medicines: [m], doses: [], timeZone: TZ, daysAhead: 14 }).map(when)).toEqual([
			"10/20 09:30",
			"10/23 09:30",
			"10/26 09:30",
		]);
	});

	it("only a dose on its own day is ticked: yesterday's tick does not cancel today's reminder", () => {
		expect(plan({ daysAhead: 1, doses: [dose({ for: "2026-10-19" })] })).toHaveLength(2);
	});

	it("looks a week ahead by default and caps how many it schedules, soonest first", () => {
		const r = plan();
		expect(r).toHaveLength(14);
		const many = plan({ medicines: Array.from({ length: 10 }, (_, i) => med({ id: i + 1, name: `M${i}` })), max: 16 });
		expect(many).toHaveLength(16);
		expect(many.map((x) => x.at.getTime())).toEqual([...many.map((x) => x.at.getTime())].sort((a, b) => a - b));
	});

	it("has nothing for no medicines", () => {
		expect(plan({ medicines: [] })).toEqual([]);
	});
});

describe("helpers", () => {
	it("reads a slot on the calendar day, on the phone's clock", () => {
		const s = slotInstant(day("2026-10-20"), "07:05");
		expect([s.getFullYear(), s.getMonth() + 1, s.getDate(), s.getHours(), s.getMinutes()]).toEqual([2026, 10, 20, 7, 5]);
	});

	it("cleans a list of times", () => {
		expect(normalizeTimes(["20:00", "08:00", "08:00", "25:00", "8:00", "nope"])).toEqual(["08:00", "20:00"]);
	});
});

describe("nextFreeTime", () => {
	it("offers twelve hours after the latest slot", () => {
		expect(nextFreeTime(["08:00"])).toBe("20:00");
		expect(nextFreeTime(["20:00"])).toBe("08:00");
		expect(nextFreeTime(["06:30", "14:30"])).toBe("02:30");
	});

	it("moves on to the next free hour when that one is taken, and always gives a free time", () => {
		expect(nextFreeTime(["08:00", "20:00"])).toBe("09:00");
		const all = Array.from({ length: 23 }, (_, h) => `${String(h).padStart(2, "0")}:00`);
		expect(all).not.toContain(nextFreeTime(all));
	});

	it("starts from the fallback when there are no slots", () => {
		expect(nextFreeTime([])).toBe("20:00");
	});
});
