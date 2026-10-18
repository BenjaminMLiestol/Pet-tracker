import { dateToDay, foodSupply, planFoodReminders, todayIso } from "../food";

const at = (iso: string) => Date.parse(iso);
// Tuesday 20 Oct 2026, 08:00 in Oslo.
const NOW = at("2026-10-20T06:00:00Z");
const TZ = "Europe/Oslo";
const bag = { bagGrams: 12000, dailyGrams: 300, startedOn: "2026-10-10" };

describe("dateToDay / todayIso", () => {
	it("turns a plain date into a calendar day number and back", () => {
		expect(dateToDay("1970-01-02")).toBe(1);
		expect(dateToDay("2026-10-20")! - dateToDay("2026-10-10")!).toBe(10);
		expect(dateToDay("nope")).toBeNull();
	});

	it("reads today in the dog's timezone", () => {
		expect(todayIso(at("2026-10-14T23:30:00Z"), "Europe/Oslo")).toBe("2026-10-15");
		expect(todayIso(at("2026-10-14T23:30:00Z"), "America/New_York")).toBe("2026-10-14");
	});
});

describe("foodSupply", () => {
	it("works out what is left and when it runs out", () => {
		const s = foodSupply(bag, NOW, TZ)!;
		// 10 days at 300 g from a 12 kg bag: 9 kg left, 30 days in total, 20 days to go.
		expect(s.remainingGrams).toBe(9000);
		expect(s.runsOutDay - dateToDay("2026-10-10")!).toBe(40);
		expect(s.daysLeft).toBe(30);
		expect(s.status).toBe("ok");
	});

	it("is low within a week and out at zero", () => {
		const nearEnd = foodSupply({ ...bag, startedOn: "2026-09-16" }, NOW, TZ)!; // 34 days in, 6 left
		expect(nearEnd.daysLeft).toBe(6);
		expect(nearEnd.status).toBe("low");

		const empty = foodSupply({ ...bag, startedOn: "2026-09-01" }, NOW, TZ)!; // past 40 days
		expect(empty.remainingGrams).toBe(0);
		expect(empty.daysLeft).toBe(0);
		expect(empty.status).toBe("out");
	});

	it("treats a bag opened today as full, and one opened tomorrow as not started", () => {
		expect(foodSupply({ ...bag, startedOn: "2026-10-20" }, NOW, TZ)!.remainingGrams).toBe(12000);
		expect(foodSupply({ ...bag, startedOn: "2026-10-21" }, NOW, TZ)!.remainingGrams).toBe(12000);
	});

	it("rounds the last partial portion away", () => {
		// 1000 g at 300 g a day: three full days.
		const s = foodSupply({ bagGrams: 1000, dailyGrams: 300, startedOn: "2026-10-20" }, NOW, TZ)!;
		expect(s.daysLeft).toBe(3);
	});

	it("is null until the bag is fully set up", () => {
		expect(foodSupply(null, NOW, TZ)).toBeNull();
		expect(foodSupply({ bagGrams: 1000 }, NOW, TZ)).toBeNull();
		expect(foodSupply({ ...bag, dailyGrams: 0 }, NOW, TZ)).toBeNull();
		expect(foodSupply({ ...bag, startedOn: "garbage" }, NOW, TZ)).toBeNull();
	});
});

describe("planFoodReminders", () => {
	const day = (r: { at: Date }) => `${r.at.getMonth() + 1}/${r.at.getDate()} ${r.at.getHours()}h`;

	it("reminds a week before it runs out and on the day, at 09:00", () => {
		const r = planFoodReminders(bag, new Date(NOW), TZ);
		// Runs out 19 Nov (10 Oct + 40 days).
		expect(r.map((x) => `${x.when}:${day(x)}`)).toEqual(["soon:11/12 9h", "today:11/19 9h"]);
	});

	it("only keeps the reminders still ahead", () => {
		const closeToEnd = planFoodReminders({ ...bag, startedOn: "2026-09-16" }, new Date(NOW), TZ); // 6 days left
		expect(closeToEnd.map((x) => `${x.when}:${day(x)}`)).toEqual(["today:10/26 9h"]);
		expect(planFoodReminders({ ...bag, startedOn: "2026-09-01" }, new Date(NOW), TZ)).toEqual([]);
	});

	it("gives nothing without a bag", () => {
		expect(planFoodReminders(null, new Date(NOW), TZ)).toEqual([]);
	});

	it("moves with a new bag", () => {
		const fresh = planFoodReminders({ ...bag, startedOn: "2026-10-20" }, new Date(NOW), TZ);
		expect(fresh.map((x) => `${x.when}:${day(x)}`)).toEqual(["soon:11/22 9h", "today:11/29 9h"]);
	});
});
