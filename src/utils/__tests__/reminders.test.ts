import { formatTime, parseTime, planDailyReminders, timeToDate } from "../reminders";

const feeding = { hour: 18, minute: 0 };
const walk = { hour: 19, minute: 30 };
const base = { daysAhead: 7, feeding, walk, fedToday: false, walkedToday: false };
const at = (iso: string) => new Date(iso); // local time, no Z

describe("parseTime / formatTime", () => {
	it("round-trips HH:MM", () => {
		expect(parseTime("07:05", feeding)).toEqual({ hour: 7, minute: 5 });
		expect(formatTime({ hour: 7, minute: 5 })).toBe("07:05");
		expect(formatTime(parseTime("23:59", feeding))).toBe("23:59");
	});

	it("falls back for anything malformed", () => {
		for (const bad of ["", "7:30", "24:00", "12:60", "noon", "18:00:00", null, undefined]) {
			expect(parseTime(bad as string, walk)).toEqual(walk);
		}
	});

	it("builds a picker date on the given day", () => {
		const d = timeToDate({ hour: 6, minute: 45 }, at("2026-10-17T12:00:00"));
		expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([
			2026, 9, 17, 6, 45,
		]);
	});
});

describe("planDailyReminders", () => {
	it("schedules both reminders every day at the chosen times", () => {
		const plan = planDailyReminders({ ...base, now: at("2026-10-17T08:00:00") });
		expect(plan).toHaveLength(14);
		expect(plan[0]).toEqual({ kind: "feeding", at: at("2026-10-17T18:00:00") });
		expect(plan[1]).toEqual({ kind: "walk", at: at("2026-10-17T19:30:00") });
		expect(plan[plan.length - 1].at).toEqual(at("2026-10-23T19:30:00"));
	});

	it("honours custom times including minutes", () => {
		const plan = planDailyReminders({
			...base,
			now: at("2026-10-17T05:00:00"),
			feeding: { hour: 7, minute: 15 },
			walk: { hour: 21, minute: 5 },
		});
		expect(plan[0].at).toEqual(at("2026-10-17T07:15:00"));
		expect(plan[1].at).toEqual(at("2026-10-17T21:05:00"));
	});

	it("skips today's reminder once that activity is logged, but not tomorrow's", () => {
		const plan = planDailyReminders({
			...base,
			now: at("2026-10-17T08:00:00"),
			fedToday: true,
		});
		expect(plan.filter((r) => r.kind === "feeding")[0].at).toEqual(at("2026-10-18T18:00:00"));
		expect(plan.filter((r) => r.kind === "walk")[0].at).toEqual(at("2026-10-17T19:30:00"));
	});

	it("skips both when both are already done today", () => {
		const plan = planDailyReminders({
			...base,
			now: at("2026-10-17T08:00:00"),
			fedToday: true,
			walkedToday: true,
		});
		expect(plan[0].at).toEqual(at("2026-10-18T18:00:00"));
		expect(plan).toHaveLength(12);
	});

	it("drops a time that has already passed today", () => {
		const plan = planDailyReminders({ ...base, now: at("2026-10-17T18:30:00") });
		expect(plan[0]).toEqual({ kind: "walk", at: at("2026-10-17T19:30:00") });
		expect(plan.filter((r) => r.kind === "feeding")[0].at).toEqual(at("2026-10-18T18:00:00"));
	});

	it("never schedules in the past, even at the exact minute", () => {
		const plan = planDailyReminders({ ...base, now: at("2026-10-17T18:00:00") });
		expect(plan.every((r) => r.at.getTime() > at("2026-10-17T18:00:00").getTime())).toBe(true);
	});
});
