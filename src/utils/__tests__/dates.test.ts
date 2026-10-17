import { calendarDay, daysBetween, formatDay, formatWhen, isSameDay } from "../dates";

// 23:30 UTC on 1 March is already 2 March in Oslo (UTC+1) but still 1 March in New York.
const lateMarchFirstUtc = Date.parse("2026-03-01T23:30:00Z");

describe("calendar days in a timezone", () => {
	it("puts the same instant on different days in different timezones", () => {
		expect(calendarDay(lateMarchFirstUtc, "Europe/Oslo")).toBe(
			calendarDay(lateMarchFirstUtc, "America/New_York") + 1,
		);
	});

	it("isSameDay uses the given timezone's midnight", () => {
		const before = Date.parse("2026-03-01T22:30:00Z"); // 23:30 in Oslo, 1 March
		const after = Date.parse("2026-03-01T23:30:00Z"); // 00:30 in Oslo, 2 March
		expect(isSameDay(before, after, "Europe/Oslo")).toBe(false);
		expect(isSameDay(before, after, "America/New_York")).toBe(true);
	});

	it("counts whole calendar days, ignoring time of day", () => {
		const evening = Date.parse("2026-06-10T21:00:00Z");
		const nextMorning = Date.parse("2026-06-11T06:00:00Z");
		expect(daysBetween(evening, nextMorning, "UTC")).toBe(1);
		expect(daysBetween(nextMorning, evening, "UTC")).toBe(-1);
		expect(daysBetween(evening, evening, "UTC")).toBe(0);
	});

	it("handles daylight saving changes without drifting a day", () => {
		const before = Date.parse("2026-03-28T12:00:00Z"); // before the Oslo switch on 29 March
		const after = Date.parse("2026-03-30T12:00:00Z");
		expect(daysBetween(before, after, "Europe/Oslo")).toBe(2);
	});

	it("falls back to the device timezone for an unknown name", () => {
		expect(() => calendarDay(Date.now(), "Not/AZone")).not.toThrow();
	});
});

describe("formatWhen", () => {
	const labels = { today: "Today", yesterday: "Yesterday" };
	const now = Date.parse("2026-10-17T20:00:00Z"); // 22:00 on the 17th in Oslo
	beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(now));
	afterEach(() => jest.restoreAllMocks());

	it("says today, yesterday or the date, with the clock in the pet's timezone", () => {
		expect(formatWhen(Date.parse("2026-10-17T19:23:00Z"), "Europe/Oslo", "en-GB", labels)).toBe(
			"Today 21:23",
		);
		expect(formatWhen(Date.parse("2026-10-16T18:10:00Z"), "Europe/Oslo", "en-GB", labels)).toBe(
			"Yesterday 20:10",
		);
		expect(formatWhen(Date.parse("2026-10-12T16:30:00Z"), "Europe/Oslo", "en-GB", labels)).toBe(
			"12 Oct 18:30",
		);
	});

	it("uses the pet's day boundary, not UTC's", () => {
		// 23:30 UTC on the 16th is already 01:30 on the 17th in Oslo.
		expect(formatWhen(Date.parse("2026-10-16T23:30:00Z"), "Europe/Oslo", "en-GB", labels)).toBe(
			"Today 01:30",
		);
	});

	it("treats a future timestamp as today and survives an unknown timezone", () => {
		expect(formatWhen(now + 3_600_000, "UTC", "en-GB", labels)).toMatch(/^Today /);
		expect(() => formatWhen(now, "Not/AZone", "en-GB", labels)).not.toThrow();
	});
});

describe("formatDay", () => {
	const labels = { today: "Today", yesterday: "Yesterday" };
	const now = Date.parse("2026-10-17T20:00:00Z");
	beforeEach(() => jest.spyOn(Date, "now").mockReturnValue(now));
	afterEach(() => jest.restoreAllMocks());

	it("names today and yesterday, otherwise the date (with the year only when it differs)", () => {
		expect(formatDay(Date.parse("2026-10-17T05:00:00Z"), "Europe/Oslo", "en-GB", labels)).toBe("Today");
		expect(formatDay(Date.parse("2026-10-16T12:00:00Z"), "Europe/Oslo", "en-GB", labels)).toBe("Yesterday");
		expect(formatDay(Date.parse("2026-03-02T12:00:00Z"), "Europe/Oslo", "en-GB", labels)).toBe("2 Mar");
		expect(formatDay(Date.parse("2025-03-02T12:00:00Z"), "Europe/Oslo", "en-GB", labels)).toBe("2 Mar 2025");
	});
});

