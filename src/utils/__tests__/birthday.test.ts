import { isBirthdayToday, parseBirthday, planBirthdayReminders, toDateString } from "../birthday";

describe("planBirthdayReminders", () => {
	it("returns nothing without a birthday", () => {
		expect(planBirthdayReminders(new Date(2026, 9, 21), null)).toEqual([]);
		expect(planBirthdayReminders(new Date(2026, 9, 21), "garbage")).toEqual([]);
	});

	it("plans this year's birthday while it is ahead, and next year's", () => {
		const r = planBirthdayReminders(new Date(2026, 9, 21), "2021-10-30");
		expect(r.map((x) => [x.at.getFullYear(), x.at.getMonth(), x.at.getDate(), x.age])).toEqual([
			[2026, 9, 30, 5],
			[2027, 9, 30, 6],
		]);
	});

	it("skips this year's birthday once it has passed", () => {
		const r = planBirthdayReminders(new Date(2026, 9, 21), "2021-03-02");
		expect(r.map((x) => [x.at.getFullYear(), x.age])).toEqual([[2027, 6]]);
	});

	it("includes today until the hour has passed", () => {
		expect(planBirthdayReminders(new Date(2026, 9, 21, 8, 0), "2021-10-21")).toHaveLength(2);
		expect(planBirthdayReminders(new Date(2026, 9, 21, 10, 0), "2021-10-21")).toHaveLength(1);
	});

	it("moves 29 February to the 28th in non-leap years", () => {
		const r = planBirthdayReminders(new Date(2026, 0, 1), "2020-02-29");
		expect(r.map((x) => [x.at.getFullYear(), x.at.getMonth(), x.at.getDate()])).toEqual([
			[2026, 1, 28],
			[2027, 1, 28],
		]);
	});
});

describe("birthday helpers", () => {
	it("parses and formats", () => {
		expect(parseBirthday("2021-10-30")).toEqual({ year: 2021, month: 10, day: 30 });
		expect(toDateString(new Date(2021, 9, 5))).toBe("2021-10-05");
	});
});

describe("isBirthdayToday", () => {
	it("matches month and day only", () => {
		expect(isBirthdayToday(new Date(2026, 9, 30), "2021-10-30")).toBe(true);
		expect(isBirthdayToday(new Date(2026, 9, 29), "2021-10-30")).toBe(false);
		expect(isBirthdayToday(new Date(2026, 9, 30), null)).toBe(false);
	});

	it("celebrates 29 February on the 28th in non-leap years", () => {
		expect(isBirthdayToday(new Date(2026, 1, 28), "2020-02-29")).toBe(true);
		expect(isBirthdayToday(new Date(2028, 1, 28), "2020-02-29")).toBe(false);
		expect(isBirthdayToday(new Date(2028, 1, 29), "2020-02-29")).toBe(true);
	});
});
