import { buildSnapshot, parsePendingLogs, SNAPSHOT_DAYS } from "../widgetSnapshot";

const NOW = Date.parse("2026-10-20T10:00:00Z");
const DAY = 86400000;
const base = {
	petId: 1,
	name: "Toya",
	timezone: "Europe/Oslo",
	feedGoal: 1,
	walkGoal: 2,
	api: "https://x.test/api/v1",
	token: "tok",
	now: NOW,
};

describe("buildSnapshot", () => {
	it("keeps only the last few days, oldest first", () => {
		const s = buildSnapshot({
			...base,
			feedings: [NOW - 1000, NOW - (SNAPSHOT_DAYS + 1) * DAY, NOW - 2 * DAY],
			walks: [NOW - 500, NOW - 400],
		});
		expect(s.feedings).toEqual([NOW - 2 * DAY, NOW - 1000]);
		expect(s.walks).toEqual([NOW - 500, NOW - 400]);
	});

	it("carries the dog, goals, timezone, api and login", () => {
		const s = buildSnapshot({ ...base, feedings: [], walks: [] });
		expect(s).toMatchObject({
			petId: 1,
			name: "Toya",
			tz: "Europe/Oslo",
			feedGoal: 1,
			walkGoal: 2,
			api: "https://x.test/api/v1",
			token: "tok",
			updatedAt: NOW,
		});
	});

	it("drops timestamps far in the future (a wrong clock)", () => {
		const s = buildSnapshot({ ...base, feedings: [NOW + 10 * DAY, NOW], walks: [] });
		expect(s.feedings).toEqual([NOW]);
	});
});

describe("parsePendingLogs", () => {
	const good = { id: "a1", kind: "walk", petId: 3, at: NOW };

	it("reads a valid queue", () => {
		expect(parsePendingLogs(JSON.stringify([good, { ...good, id: "a2", kind: "feeding" }]))).toHaveLength(2);
	});

	it("is empty for nothing, junk or a non-list", () => {
		expect(parsePendingLogs(null)).toEqual([]);
		expect(parsePendingLogs("")).toEqual([]);
		expect(parsePendingLogs("{not json")).toEqual([]);
		expect(parsePendingLogs('{"a":1}')).toEqual([]);
	});

	it("skips malformed items and repeats", () => {
		const text = JSON.stringify([
			good,
			good, // the same id twice
			{ ...good, id: "b", kind: "bath" },
			{ ...good, id: "c", petId: "x" },
			{ ...good, id: "", },
			{ ...good, id: "d", at: "later" },
			null,
		]);
		expect(parsePendingLogs(text).map((l) => l.id)).toEqual(["a1"]);
	});
});
