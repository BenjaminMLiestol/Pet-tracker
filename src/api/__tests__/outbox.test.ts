import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "../client";
import {
	OUTBOX_KEY,
	bodyFor,
	flushOutbox,
	isOfflineError,
	isPendingId,
	loadOutbox,
	newClientId,
	newTempId,
	saveOutbox,
	type OutboxItem,
} from "../outbox";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

const item = (over: Partial<OutboxItem> = {}): OutboxItem => ({
	id: newClientId(),
	tempId: newTempId(),
	kind: "feeding",
	petId: 1,
	at: Date.parse("2026-10-20T10:00:00Z"),
	...over,
});

beforeEach(() => AsyncStorage.clear());

describe("ids", () => {
	it("makes unique client ids and negative temp ids", () => {
		const ids = new Set(Array.from({ length: 200 }, () => newClientId()));
		expect(ids.size).toBe(200);
		const temps = Array.from({ length: 200 }, () => newTempId());
		expect(new Set(temps).size).toBe(200);
		expect(temps.every(isPendingId)).toBe(true);
		expect(isPendingId(5)).toBe(false);
	});
});

describe("bodyFor", () => {
	it("builds each kind's request with the client_id", () => {
		const feeding = item({ id: "c1" });
		expect(bodyFor(feeding)).toEqual({
			pet_id: 1,
			feed_check: true,
			fed_at: "2026-10-20T10:00:00.000Z",
			client_id: "c1",
		});
		expect(bodyFor(item({ kind: "walk", id: "c2" }))).toMatchObject({ walk_check: true, walked_at: "2026-10-20T10:00:00.000Z" });
		expect(bodyFor(item({ kind: "bath", id: "c3" }))).toMatchObject({ bathed_at: "2026-10-20T10:00:00.000Z" });
		expect(bodyFor(item({ kind: "weight", id: "c4", value: 24.8 }))).toMatchObject({ value: 24.8, weighed_at: "2026-10-20T10:00:00.000Z" });
	});
});

describe("isOfflineError", () => {
	it("is true for no answer, false for an answer", () => {
		expect(isOfflineError(new ApiError("x", "network"))).toBe(true);
		expect(isOfflineError(new ApiError("x", "timeout"))).toBe(true);
		expect(isOfflineError(new ApiError("x", "http", 500))).toBe(false);
		expect(isOfflineError(new Error("x"))).toBe(false);
	});
});

describe("storage", () => {
	it("round-trips the queue and removes the key when empty", async () => {
		const items = [item(), item({ kind: "weight", value: 20 })];
		await saveOutbox(items);
		expect(await loadOutbox()).toEqual(items);

		await saveOutbox([]);
		expect(await AsyncStorage.getItem(OUTBOX_KEY)).toBeNull();
		expect(await loadOutbox()).toEqual([]);
	});

	it("ignores a damaged queue", async () => {
		await AsyncStorage.setItem(OUTBOX_KEY, "{nope");
		expect(await loadOutbox()).toEqual([]);
		await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify([{ junk: true }, null]));
		expect(await loadOutbox()).toEqual([]);
	});
});

describe("flushOutbox", () => {
	it("sends in order and empties the queue", async () => {
		const a = item();
		const b = item({ kind: "walk" });
		const send = jest.fn(async (i: OutboxItem) => ({ id: i.id }));

		const res = await flushOutbox([a, b], send);

		expect(send.mock.calls.map((c) => c[0].id)).toEqual([a.id, b.id]);
		expect(res.sent.map((s) => s.item.id)).toEqual([a.id, b.id]);
		expect(res.remaining).toEqual([]);
		expect(res.dropped).toEqual([]);
	});

	it("stops at the first offline error and keeps that item and the rest, in order", async () => {
		const [a, b, c] = [item(), item(), item()];
		const send = jest
			.fn()
			.mockResolvedValueOnce({})
			.mockRejectedValueOnce(new ApiError("down", "network"));

		const res = await flushOutbox([a, b, c], send);

		expect(res.sent.map((s) => s.item.id)).toEqual([a.id]);
		expect(res.remaining.map((i) => i.id)).toEqual([b.id, c.id]);
		expect(send).toHaveBeenCalledTimes(2);
	});

	it("keeps items when the server has a problem (5xx)", async () => {
		const a = item();
		const res = await flushOutbox([a], async () => {
			throw new ApiError("boom", "http", 503);
		});
		expect(res.remaining).toEqual([a]);
		expect(res.dropped).toEqual([]);
	});

	it("drops an item the server refuses so it cannot block the others", async () => {
		const [bad, good] = [item(), item()];
		const send = jest
			.fn()
			.mockRejectedValueOnce(new ApiError("invalid", "http", 422))
			.mockResolvedValueOnce({});

		const res = await flushOutbox([bad, good], send);

		expect(res.dropped.map((i) => i.id)).toEqual([bad.id]);
		expect(res.sent.map((s) => s.item.id)).toEqual([good.id]);
		expect(res.remaining).toEqual([]);
	});

	it("keeps the queue when the login has ended", async () => {
		const [a, b] = [item(), item()];
		const res = await flushOutbox([a, b], async () => {
			throw new Error("Unauthorized");
		});
		expect(res.remaining.map((i) => i.id)).toEqual([a.id, b.id]);
	});
});
