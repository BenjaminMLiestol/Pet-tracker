import { planCareReminders, type CareDue } from "../careReminders";

const at = (iso: string) => Date.parse(iso);
// Tuesday 20 Oct 2026, 08:00 in Oslo.
const NOW = new Date("2026-10-20T06:00:00Z");
const TZ = "Europe/Oslo";

const vaccine = (over: Partial<CareDue> = {}): CareDue => ({
	kind: "vaccination",
	label: "Rabies",
	date: at("2025-11-10T10:00:00Z"),
	nextDueAt: at("2026-11-10T10:00:00Z"),
	...over,
});

const plan = (items: CareDue[], extra = {}) => planCareReminders({ now: NOW, items, timeZone: TZ, ...extra });
const days = (rs: ReturnType<typeof plan>) => rs.map((r) => `${r.when}:${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}h`);

describe("planCareReminders", () => {
	it("reminds a week before and on the day, at 09:00", () => {
		expect(days(plan([vaccine()]))).toEqual(["soon:11/3 9h", "today:11/10 9h"]);
	});

	it("skips the week-before reminder when the due date is already inside the week", () => {
		const r = plan([vaccine({ nextDueAt: at("2026-10-24T10:00:00Z") })]);
		expect(days(r)).toEqual(["today:10/24 9h"]);
	});

	it("skips a reminder whose time has already passed today", () => {
		// Due today: 09:00 is still ahead of 08:00.
		expect(days(plan([vaccine({ nextDueAt: at("2026-10-20T10:00:00Z") })]))).toEqual(["today:10/20 9h"]);
		// Later the same day, after 09:00, nothing is left.
		const late = planCareReminders({
			now: new Date("2026-10-20T12:00:00Z"),
			items: [vaccine({ nextDueAt: at("2026-10-20T10:00:00Z") })],
			timeZone: TZ,
		});
		expect(late).toEqual([]);
	});

	it("gives nothing for overdue or undated entries", () => {
		expect(plan([vaccine({ nextDueAt: at("2026-09-01T10:00:00Z") }), vaccine({ nextDueAt: null })])).toEqual([]);
	});

	it("lets a renewed vaccine replace the older one's due date", () => {
		const old = vaccine({ date: at("2024-11-10T10:00:00Z"), nextDueAt: at("2026-10-27T10:00:00Z") });
		const renewed = vaccine({ date: at("2026-10-01T10:00:00Z"), nextDueAt: at("2027-10-01T10:00:00Z") });
		const r = plan([old, renewed]);
		expect(r.every((x) => x.at.getFullYear() === 2027)).toBe(true);
	});

	it("keeps different vaccines and different treatments apart", () => {
		const items: CareDue[] = [
			vaccine({ label: "Rabies", nextDueAt: at("2026-11-10T10:00:00Z") }),
			vaccine({ label: "Distemper", nextDueAt: at("2026-12-10T10:00:00Z") }),
			{ kind: "parasite", label: "Frontline", parasiteType: "flea", date: at("2026-10-01T10:00:00Z"), nextDueAt: at("2026-11-01T10:00:00Z") },
			{ kind: "parasite", label: "Drontal", parasiteType: "worm", date: at("2026-10-01T10:00:00Z"), nextDueAt: at("2026-11-15T10:00:00Z") },
		];
		expect(plan(items)).toHaveLength(8);
	});

	it("uses the dog's calendar day for the due date", () => {
		// 23:30 UTC on 9 Nov is already 10 Nov in Oslo.
		const r = plan([vaccine({ nextDueAt: at("2026-11-09T23:30:00Z") })]);
		expect(days(r)).toEqual(["soon:11/3 9h", "today:11/10 9h"]);
	});

	it("returns soonest first and caps the number", () => {
		const items = Array.from({ length: 30 }, (_, i) =>
			vaccine({ label: `V${i}`, nextDueAt: at("2026-11-10T10:00:00Z") + i * 86400000 }),
		);
		const r = plan(items, { max: 5 });
		expect(r).toHaveLength(5);
		expect(r.map((x) => x.at.getTime())).toEqual([...r.map((x) => x.at.getTime())].sort((a, b) => a - b));
	});

	it("takes a custom hour and lead time", () => {
		const r = plan([vaccine()], { hour: 18, leadDays: 14 });
		expect(days(r)).toEqual(["soon:10/27 18h", "today:11/10 18h"]);
	});
});
