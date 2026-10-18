import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError } from "./client";

// Entries logged without a connection wait here and are sent later. Each carries a random
// `id` that is also sent to the server as `client_id`, so an entry sent twice (a reply that
// never arrived) is saved once.

export type OutboxKind = "feeding" | "walk" | "bath" | "weight";

export type OutboxItem = {
	// Sent as client_id.
	id: string;
	// Stand-in id (negative) for the row shown while waiting.
	tempId: number;
	kind: OutboxKind;
	petId: number;
	// When it happened (ms since epoch).
	at: number;
	// Weight in kg, for kind "weight".
	value?: number;
};

// Under the per-user prefix so signing out wipes it with the rest of the cache.
export const OUTBOX_KEY = "pet-tracker/outbox/v1";

export const OUTBOX_PATH: Record<OutboxKind, string> = {
	feeding: "/feedings",
	walk: "/walks",
	bath: "/baths",
	weight: "/weights",
};

let counter = 0;
const rand = () => Math.random().toString(36).slice(2, 10);

/** Fresh id for an entry, unique enough that two phones never collide. */
export function newClientId(now = Date.now()): string {
	return `${now.toString(36)}-${rand()}${rand()}`;
}

/** A negative stand-in id, never equal to a server id and unique within this run. */
export function newTempId(now = Date.now()): number {
	counter += 1;
	return -(now * 1000 + (counter % 1000));
}

export const isPendingId = (id: number) => id < 0;

/** The request body for an item. */
export function bodyFor(item: OutboxItem): Record<string, unknown> {
	const when = new Date(item.at).toISOString();
	switch (item.kind) {
		case "feeding":
			return { pet_id: item.petId, feed_check: true, fed_at: when, client_id: item.id };
		case "walk":
			return { pet_id: item.petId, walk_check: true, walked_at: when, client_id: item.id };
		case "bath":
			return { pet_id: item.petId, bathed_at: when, client_id: item.id };
		case "weight":
			return { pet_id: item.petId, value: item.value, weighed_at: when, client_id: item.id };
	}
}

/** True when the request never got an answer (no signal, a timeout), so it can be tried again. */
export function isOfflineError(e: unknown): boolean {
	return e instanceof ApiError && (e.kind === "network" || e.kind === "timeout");
}

export async function loadOutbox(): Promise<OutboxItem[]> {
	try {
		const raw = await AsyncStorage.getItem(OUTBOX_KEY);
		const parsed = raw ? JSON.parse(raw) : [];
		return Array.isArray(parsed)
			? parsed.filter((i) => i && typeof i.id === "string" && typeof i.petId === "number")
			: [];
	} catch {
		return [];
	}
}

export async function saveOutbox(items: OutboxItem[]): Promise<void> {
	try {
		if (items.length === 0) await AsyncStorage.removeItem(OUTBOX_KEY);
		else await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
	} catch {
		// The queue still lives in memory for this session.
	}
}

export type FlushResult = {
	// Items the server accepted, with its reply.
	sent: { item: OutboxItem; response: unknown }[];
	// Items the server refused for good (invalid): sending them again can never work.
	dropped: OutboxItem[];
	// Items still waiting (no connection, or the server had a problem).
	remaining: OutboxItem[];
};

/**
 * Sends the queue oldest first, one at a time. Stops at the first sign the network or server
 * is unavailable (the rest stay queued, in order); an item the server rejects as invalid is
 * dropped so it can't block the ones behind it.
 */
export async function flushOutbox(
	items: OutboxItem[],
	send: (item: OutboxItem) => Promise<unknown>,
): Promise<FlushResult> {
	const result: FlushResult = { sent: [], dropped: [], remaining: [] };
	for (let i = 0; i < items.length; i += 1) {
		const item = items[i];
		try {
			result.sent.push({ item, response: await send(item) });
		} catch (e) {
			const refused = e instanceof ApiError && e.kind === "http" && (e.status ?? 0) >= 400 && (e.status ?? 0) < 500;
			if (refused) {
				result.dropped.push(item);
				continue;
			}
			// Offline, a 5xx, or the login ended: keep this one and everything after it.
			result.remaining.push(...items.slice(i));
			return result;
		}
	}
	return result;
}
