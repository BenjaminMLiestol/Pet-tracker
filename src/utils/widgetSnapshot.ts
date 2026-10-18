// What the app shares with the home-screen widget (see targets/widget/Snapshot.swift, which
// reads the same JSON). Only the last few days of timestamps travel: enough for the widget to
// count "today" by itself after midnight, small enough to be cheap to write on every change.

export type WidgetSnapshot = {
	petId: number;
	name: string;
	tz: string;
	feedGoal: number;
	walkGoal: number;
	feedings: number[];
	walks: number[];
	api: string;
	token: string;
	updatedAt: number;
};

export type PendingWidgetLog = {
	id: string;
	kind: "feeding" | "walk";
	petId: number;
	at: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
export const SNAPSHOT_DAYS = 3;

export function buildSnapshot(input: {
	petId: number;
	name: string;
	timezone: string;
	feedGoal: number;
	walkGoal: number;
	feedings: number[];
	walks: number[];
	api: string;
	token: string;
	now: number;
}): WidgetSnapshot {
	const since = input.now - SNAPSHOT_DAYS * DAY_MS;
	const recent = (stamps: number[]) => stamps.filter((t) => t >= since && t <= input.now + DAY_MS).sort((a, b) => a - b);
	return {
		petId: input.petId,
		name: input.name,
		tz: input.timezone,
		feedGoal: input.feedGoal,
		walkGoal: input.walkGoal,
		feedings: recent(input.feedings),
		walks: recent(input.walks),
		api: input.api,
		token: input.token,
		updatedAt: input.now,
	};
}

/** The queue the widget writes when a log couldn't be sent. Anything malformed is skipped. */
export function parsePendingLogs(text: string | null | undefined): PendingWidgetLog[] {
	if (!text) return [];
	let raw: unknown;
	try {
		raw = JSON.parse(text);
	} catch {
		return [];
	}
	if (!Array.isArray(raw)) return [];
	const seen = new Set<string>();
	const out: PendingWidgetLog[] = [];
	for (const item of raw) {
		if (
			item &&
			typeof item.id === "string" &&
			item.id.length > 0 &&
			item.id.length <= 64 &&
			(item.kind === "feeding" || item.kind === "walk") &&
			Number.isInteger(item.petId) &&
			Number.isFinite(item.at) &&
			!seen.has(item.id)
		) {
			seen.add(item.id);
			out.push({ id: item.id, kind: item.kind, petId: item.petId, at: item.at });
		}
	}
	return out;
}
