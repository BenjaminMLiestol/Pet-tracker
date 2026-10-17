import { averagePerDay, lastDaysCounts, totalOf, weekdayLabel } from "../insights";

const at = (iso: string) => Date.parse(iso);
// Tuesday 20 Oct 2026, noon in Oslo.
const NOW = at("2026-10-20T10:00:00Z");

describe("lastDaysCounts", () => {
	it("returns seven days ending today, oldest first, with zeros for quiet days", () => {
		const counts = lastDaysCounts(
			[at("2026-10-20T06:00:00Z"), at("2026-10-20T09:00:00Z"), at("2026-10-18T09:00:00Z")],
			NOW,
			"Europe/Oslo",
		);
		expect(counts).toHaveLength(7);
		expect(counts.map((d) => d.count)).toEqual([0, 0, 0, 0, 1, 0, 2]);
		expect(counts[6].day - counts[0].day).toBe(6);
	});

	it("ignores entries older than the window and ones in the future", () => {
		const counts = lastDaysCounts(
			[at("2026-10-13T09:00:00Z"), at("2026-10-14T09:00:00Z"), at("2026-10-22T09:00:00Z")],
			NOW,
			"Europe/Oslo",
		);
		// 14 Oct is the oldest day in the window (20 Oct minus six days); 13 Oct and 22 Oct fall out.
		expect(totalOf(counts)).toBe(1);
		expect(counts[0].count).toBe(1);
	});

	it("puts late evening on the dog's day, not UTC's", () => {
		// 23:30 UTC on the 19th is 01:30 on the 20th in Oslo.
		const counts = lastDaysCounts([at("2026-10-19T23:30:00Z")], NOW, "Europe/Oslo");
		expect(counts[6].count).toBe(1);
		const newYork = lastDaysCounts([at("2026-10-19T23:30:00Z")], NOW, "America/New_York");
		expect(newYork[6].count).toBe(0);
		expect(newYork[5].count).toBe(1);
	});
});

describe("totals", () => {
	it("sums and averages with one decimal", () => {
		const counts = lastDaysCounts(
			[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map(() =>
				at("2026-10-20T08:00:00Z"),
			),
			NOW,
			"Europe/Oslo",
		);
		expect(totalOf(counts)).toBe(18);
		expect(averagePerDay(counts)).toBe(2.6);
	});

	it("is zero for no data", () => {
		expect(averagePerDay(lastDaysCounts([], NOW, "Europe/Oslo"))).toBe(0);
	});
});

describe("weekdayLabel", () => {
	it("names the weekday of a calendar day in the locale", () => {
		const day = Math.round(at("2026-10-20T00:00:00Z") / 86400000); // a Tuesday
		expect(weekdayLabel(day, "en-GB", "short")).toBe("Tue");
		expect(weekdayLabel(day, "nb-NO", "short").toLowerCase()).toContain("ti");
		expect(weekdayLabel(day, "en-GB")).toBe("T");
	});
});
