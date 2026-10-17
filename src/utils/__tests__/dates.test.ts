import { calendarDay, daysBetween, isSameDay } from "../dates";

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
