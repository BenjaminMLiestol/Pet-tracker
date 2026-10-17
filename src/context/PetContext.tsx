import {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
	useState,
	useCallback,
	useEffect,
	useRef,
} from "react";
import { Alert } from "react-native";
import i18n from "../i18n";
import { describeError } from "../api/errors";
import { calendarDay, deviceTimeZone, isSameDay } from "../utils/dates";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiDelete, apiFetch } from "../api/client";
import { useAuth } from "./AuthContext";

// ===== Types expected by the rest of the app =====
export type FeedingRecord = { id: number; timestamp: number; fed: boolean };
export type BathRecord = { timestamp: number };
export type WalkRecord = { id: number; timestamp: number; walked: boolean };
export type WeightRecord = { timestamp: number; weightKg: number };

export type PetContextValue = {
	// All the dogs this person looks after, which one is active, and the loading state of that list.
	pets: Dog[];
	petsStatus: PetsStatus;
	selectPet: (id: number) => Promise<void>;
	// These throw an ApiError whose message is safe to show (for example a bad invitation code).
	createPet: (input: NewDog) => Promise<Dog>;
	joinWithCode: (code: string) => Promise<Dog>;
	leavePet: (id: number) => Promise<void>;
	// Re-reads the dog list (co-owners, shared settings). Called after sharing changes.
	reloadPets: () => Promise<void>;
	// The active dog's owners, by name.
	owners: DogOwner[];
	petId: number | null;
	// IANA timezone that defines where a day starts for this pet
	timezone: string;
	name: string;
	breed: string;
	feedings: FeedingRecord[];
	baths: BathRecord[];
	walks: WalkRecord[];
	weights: WeightRecord[];
	hasFedToday: boolean;
	hasWalkedToday: boolean;
	lastBathAt: Date | null;
	currentWeightKg: number | null;
	feedingsToday: number;
	walksToday: number;
	// Mutations resolve true when the save succeeded.
	// `at` backdates the entry (defaults to now). Edits move an existing entry in time.
	addFeeding: (at?: Date) => Promise<boolean>;
	updateFeeding: (id: number, at: Date) => Promise<boolean>;
	removeFeeding: (id: number) => Promise<boolean>;
	addWalk: (at?: Date) => Promise<boolean>;
	updateWalk: (id: number, at: Date) => Promise<boolean>;
	removeWalk: (id: number) => Promise<boolean>;
	setBathedToday: () => Promise<boolean>;
	// Days between baths (shared by everyone who owns the pet; default 30).
	bathIntervalDays: number;
	setBathInterval: (days: number) => Promise<boolean>;
	nextBathDueAt: Date | null;
	isBathDue: boolean;
	bathOverdueDays: number;
	setWeightToday: (weightKg: number) => Promise<boolean>;

	// True while a save request is in flight
	busy: boolean;

	// ⬇️ New for pull-to-refresh
	refresh: () => Promise<void>;
	refreshing: boolean;
	// Quietly pulls fresh data (no spinner); used when the app returns to the foreground.
	sync: () => Promise<void>;

	// Infinite scroll for the long logs (100 more entries per call)
	loadMore: (kind: PagedKind) => Promise<void>;
	hasMore: Record<PagedKind, boolean>;
	loadingMore: Record<PagedKind, boolean>;
};

export type PagedKind = "feedings" | "walks";

const PetContext = createContext<PetContextValue | undefined>(undefined);

export const DEFAULT_BATH_INTERVAL_DAYS = 30;

// ===== Backend API shapes =====
type ApiPet = {
	id: number;
	name: string;
	age?: number | null;
	breed?: string | null;
	timezone?: string | null;
	bath_interval_days?: number | null;
	date_of_birth?: string | null;
	// Everyone who looks after the dog (names only; emails stay private).
	users?: DogOwner[];
};
export type DogOwner = { id: number; first_name: string; last_name: string };
export type Dog = ApiPet;
export type NewDog = {
	name: string;
	breed?: string;
	date_of_birth?: string;
	timezone?: string;
};
export type PetsStatus = "loading" | "ready" | "error";
type ApiFeeding = {
	id: number;
	feed_check: boolean;
	fed_at: string;
	pet_id: number;
	user_id: number;
};
type ApiWalk = {
	id: number;
	walk_check: boolean;
	walked_at: string;
	pet_id: number;
	user_id: number;
};
type ApiBath = {
	id: number;
	bathed_at: string;
	pet_id: number;
	user_id: number;
};
type ApiWeight = {
	id: number;
	value: number;
	weighed_at: string;
	pet_id: number;
	user_id: number;
};

// Accept either an array or { data: [...] }.
function unwrapList<T>(res: T[] | { data: T[] }): T[] {
	return Array.isArray(res) ? res : (res?.data ?? []);
}

// Laravel paginator: { data, current_page, last_page, ... }
type Paged<T> = T[] | { data: T[]; current_page?: number; last_page?: number };
type Page<T> = { rows: T[]; hasMore: boolean };

function unwrapPage<T>(res: Paged<T>): Page<T> {
	if (Array.isArray(res)) return { rows: res, hasMore: false };
	return {
		rows: res?.data ?? [],
		hasMore: (res?.current_page ?? 1) < (res?.last_page ?? 1),
	};
}

const PAGE_SIZE = 100; // feedings / walks / baths per request
const WEIGHT_PAGE_SIZE = 500; // the weight chart wants the full history

const mapFeeding = (f: ApiFeeding): FeedingRecord => ({
	id: f.id,
	timestamp: Date.parse(f.fed_at),
	fed: !!f.feed_check,
});
const mapWalk = (w: ApiWalk): WalkRecord => ({
	id: w.id,
	timestamp: Date.parse(w.walked_at),
	walked: !!w.walk_check,
});

// Append a loaded page, dropping rows we already have, newest first.
function mergeById<T extends { id: number; timestamp: number }>(
	prev: T[],
	incoming: T[],
): T[] {
	const seen = new Set(prev.map((r) => r.id));
	return [...prev, ...incoming.filter((r) => !seen.has(r.id))].sort(
		(a, b) => b.timestamp - a.timestamp,
	);
}

function getLatestTimestamp<T extends { timestamp: number }>(
	items: T[],
): number | null {
	if (items.length === 0) return null;
	let max = items[0].timestamp;
	for (let i = 1; i < items.length; i += 1)
		if (items[i].timestamp > max) max = items[i].timestamp;
	return max;
}

// ===== Local cache keys =====
const STORAGE_ACTIVE_PET_ID = "pet-tracker/active-pet-id";
const CACHE_PREFIX = "pet-tracker/cache/v2";
const cacheKey = (petId: number) => `${CACHE_PREFIX}/${petId}`;

type CachedBundle = {
	pet: ApiPet | null;
	feedings: FeedingRecord[];
	walks: WalkRecord[];
	baths: BathRecord[];
	weights: WeightRecord[];
};

export function PetProvider({ children }: { children: ReactNode }) {
	const { token, user } = useAuth();

	// Active pet metadata, and every dog this person looks after
	const [pet, setPet] = useState<ApiPet | null>(null);
	const [pets, setPets] = useState<ApiPet[]>([]);
	const [petsStatus, setPetsStatus] = useState<PetsStatus>("loading");
	// The dog whose data is on screen. Late responses for another dog are dropped.
	const activePetId = useRef<number | null>(null);

	// Activity state from backend (and cache)
	const [feedings, setFeedings] = useState<FeedingRecord[]>([]);
	const [baths, setBaths] = useState<BathRecord[]>([]);
	const [walks, setWalks] = useState<WalkRecord[]>([]);
	const [weights, setWeights] = useState<WeightRecord[]>([]);

	// Pull-to-refresh state
	const [refreshing, setRefreshing] = useState(false);

	// Infinite-scroll state: next page to request and whether more exist
	const nextPage = useRef<Record<PagedKind, number>>({ feedings: 2, walks: 2 });
	const loadingMoreRef = useRef<Record<PagedKind, boolean>>({
		feedings: false,
		walks: false,
	});
	const [hasMore, setHasMore] = useState<Record<PagedKind, boolean>>({
		feedings: false,
		walks: false,
	});
	const [loadingMore, setLoadingMore] = useState<Record<PagedKind, boolean>>({
		feedings: false,
		walks: false,
	});

	// Save-in-flight guard: blocks double taps and surfaces failures to the user
	const [busy, setBusy] = useState(false);
	const inFlight = useRef(false);
	// Resolves true when the save went through. `silent` skips the error alert so the
	// caller can report the outcome itself (deletes use a toast).
	const runMutation = useCallback(
		async (fn: () => Promise<void>, opts?: { silent?: boolean }): Promise<boolean> => {
		if (inFlight.current) return false;
		inFlight.current = true;
		setBusy(true);
		try {
			await fn();
			return true;
		} catch (e) {
			if (e instanceof Error && e.message === "Unauthorized") return false; // handled by logout
			if (!opts?.silent) Alert.alert(i18n.t("error_title"), describeError(e));
			return false;
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
		},
		[],
	);

	// ---- Persist state to cache whenever it changes ----
	useEffect(() => {
		if (!pet?.id) return;
		const payload: CachedBundle = { pet, feedings, walks, baths, weights };
		AsyncStorage.setItem(cacheKey(pet.id), JSON.stringify(payload)).catch(
			() => {},
		);
	}, [pet?.id, pet, feedings, walks, baths, weights]);

	// ---- Helper: fetch activities for a given pet id ----
	const fetchActivities = useCallback(async (petId: number) => {
		const list = (path: string, size: number, page = 1) =>
			`${path}?pet_id=${petId}&per_page=${size}&page=${page}`;
		const [feedingsRaw, walksRaw, bathsRaw, weightsRaw] = await Promise.all([
			apiFetch<Paged<ApiFeeding>>(list("/feedings", PAGE_SIZE)),
			apiFetch<Paged<ApiWalk>>(list("/walks", PAGE_SIZE)),
			apiFetch<Paged<ApiBath>>(list("/baths", PAGE_SIZE)),
			apiFetch<Paged<ApiWeight>>(list("/weights", WEIGHT_PAGE_SIZE)),
		]);

		// The user may have switched dogs while this was loading: drop the stale answer.
		if (activePetId.current !== petId) return;

		const feedingsPage = unwrapPage(feedingsRaw);
		const walksPage = unwrapPage(walksRaw);
		nextPage.current = { feedings: 2, walks: 2 };
		setHasMore({
			feedings: feedingsPage.hasMore,
			walks: walksPage.hasMore,
		});

		setFeedings(
			feedingsPage.rows.map(mapFeeding).sort((a, b) => b.timestamp - a.timestamp),
		);
		setWalks(
			walksPage.rows.map(mapWalk).sort((a, b) => b.timestamp - a.timestamp),
		);

		setBaths(
			unwrapList(bathsRaw)
				.map((b) => ({ timestamp: Date.parse(b.bathed_at) }))
				.sort((a, b) => b.timestamp - a.timestamp),
		);

		setWeights(
			unwrapList(weightsRaw)
				.map((w) => ({
					timestamp: Date.parse(w.weighed_at),
					weightKg: Number(w.value),
				}))
				.sort((a, b) => b.timestamp - a.timestamp),
		);
	}, []);

	// ---- Infinite scroll: fetch the next 100 feedings/walks ----
	const loadMore = useCallback(
		async (kind: PagedKind) => {
			if (!pet || !hasMore[kind] || loadingMoreRef.current[kind]) return;
			loadingMoreRef.current[kind] = true;
			setLoadingMore((prev) => ({ ...prev, [kind]: true }));
			const petId = pet.id;
			try {
				const page = nextPage.current[kind];
				const url = `/${kind}?pet_id=${petId}&per_page=${PAGE_SIZE}&page=${page}`;
				if (kind === "feedings") {
					const res = unwrapPage(await apiFetch<Paged<ApiFeeding>>(url));
					setFeedings((prev) => mergeById(prev, res.rows.map(mapFeeding)));
					setHasMore((prev) => ({ ...prev, feedings: res.hasMore }));
				} else {
					const res = unwrapPage(await apiFetch<Paged<ApiWalk>>(url));
					setWalks((prev) => mergeById(prev, res.rows.map(mapWalk)));
					setHasMore((prev) => ({ ...prev, walks: res.hasMore }));
				}
				nextPage.current[kind] = page + 1;
			} catch (e) {
				console.warn(`Failed to load more ${kind}`, e);
			} finally {
				loadingMoreRef.current[kind] = false;
				setLoadingMore((prev) => ({ ...prev, [kind]: false }));
			}
		},
		[pet, hasMore],
	);

	// ---- Showing a dog: reset, then cache, then network ----
	const clearActivities = useCallback(() => {
		setFeedings([]);
		setWalks([]);
		setBaths([]);
		setWeights([]);
		setHasMore({ feedings: false, walks: false });
	}, []);

	const loadCached = useCallback(async (id: number) => {
		try {
			const raw = await AsyncStorage.getItem(cacheKey(id));
			if (!raw || activePetId.current !== id) return;
			const cached = JSON.parse(raw) as CachedBundle;
			setFeedings(Array.isArray(cached.feedings) ? cached.feedings : []);
			setWalks(Array.isArray(cached.walks) ? cached.walks : []);
			setBaths(Array.isArray(cached.baths) ? cached.baths : []);
			setWeights(Array.isArray(cached.weights) ? cached.weights : []);
		} catch {
			// ignore a malformed cache
		}
	}, []);

	// Makes `selected` the active dog. The previous dog's lists are cleared in the same state
	// update as the pet change, so the cache effect can never save them under the new dog's key.
	const activate = useCallback(
		async (selected: ApiPet) => {
			activePetId.current = selected.id;
			setPet(selected);
			clearActivities();
			AsyncStorage.setItem(STORAGE_ACTIVE_PET_ID, String(selected.id)).catch(() => {});
			await loadCached(selected.id);
			try {
				await fetchActivities(selected.id);
			} catch (e) {
				// The cache may already be showing; a network failure must not break the screen.
				console.warn("Failed to refresh pet data from API", e);
			}
		},
		[clearActivities, loadCached, fetchActivities],
	);

	// Reads the dog list and keeps the active dog's details (owners, shared settings) fresh.
	// If the active dog is gone (we left it), falls back to the first remaining one.
	const loadPets = useCallback(async (): Promise<ApiPet[]> => {
		const list = unwrapList<ApiPet>(await apiFetch<ApiPet[] | { data: ApiPet[] }>("/pets"));
		setPets(list);
		setPetsStatus("ready");
		const current = list.find((p) => p.id === activePetId.current);
		if (current) {
			setPet((p) => (p && p.id === current.id ? { ...p, ...current } : p));
		} else if (list.length > 0) {
			await activate(list[0]);
		} else {
			activePetId.current = null;
			setPet(null);
			clearActivities();
		}
		return list;
	}, [activate, clearActivities]);

	// ---- Bootstrap: show the cached dog at once, then refresh from the API ----
	useEffect(() => {
		if (!token) {
			activePetId.current = null;
			setPets([]);
			setPetsStatus("loading");
			setPet(null);
			clearActivities();
			return;
		}

		let cancelled = false;

		(async () => {
			setPetsStatus("loading");
			const storedId = await AsyncStorage.getItem(STORAGE_ACTIVE_PET_ID);
			const cachedId = storedId ? Number(storedId) : NaN;

			// 0) The cached dog (instant, and works offline).
			let showingCached = false;
			if (Number.isFinite(cachedId)) {
				try {
					const raw = await AsyncStorage.getItem(cacheKey(cachedId));
					const cached = raw ? (JSON.parse(raw) as CachedBundle) : null;
					if (cached?.pet && !cancelled) {
						activePetId.current = cachedId;
						setPet(cached.pet);
						setPets([cached.pet]);
						await loadCached(cachedId);
						showingCached = true;
					}
				} catch {
					// ignore a malformed cache
				}
			}

			// 1) The real list of dogs.
			try {
				const list = unwrapList<ApiPet>(await apiFetch<ApiPet[] | { data: ApiPet[] }>("/pets"));
				if (cancelled) return;
				setPets(list);
				setPetsStatus("ready");
				if (list.length === 0) {
					activePetId.current = null;
					setPet(null);
					clearActivities();
					return;
				}
				const selected = list.find((p) => p.id === cachedId) ?? list[0];
				if (showingCached && selected.id === cachedId) {
					// Same dog as the cache: keep what's on screen, refresh details and data.
					setPet(selected);
					await fetchActivities(selected.id).catch((e) =>
						console.warn("Failed to refresh pet data from API", e),
					);
				} else {
					await activate(selected);
				}
			} catch (e) {
				if (cancelled) return;
				// Offline with a cached dog is fine; with nothing to show it is an error.
				setPetsStatus(showingCached ? "ready" : "error");
				console.warn("Failed to load dogs", e);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [token, fetchActivities, activate, loadCached, clearActivities]);

	// ---- Mutations: API-first (keeps server as source of truth), cache persists via effect ----
	const addFeeding = useCallback(
		(at?: Date) =>
			runMutation(async () => {
				if (!pet) return;
				const nowIso = (at ?? new Date()).toISOString();
				const created = await apiFetch<{
					id: number;
					fed_at: string;
					feed_check: boolean;
				}>("/feedings", {
					method: "POST",
					body: { pet_id: pet.id, feed_check: true, fed_at: nowIso },
				});
				setFeedings((prev) => [
					{
						id: created.id,
						fed: true,
						timestamp: Date.parse(created.fed_at ?? nowIso),
					},
					...prev,
				]);
			}),
		[pet, runMutation],
	);

	const updateFeeding = useCallback(
		(id: number, at: Date) =>
			runMutation(async () => {
				const saved = await apiFetch<ApiFeeding>(`/feedings/${id}`, {
					method: "PATCH",
					body: { fed_at: at.toISOString() },
				});
				setFeedings((prev) =>
					prev.map((f) => (f.id === id ? { ...f, timestamp: Date.parse(saved.fed_at) } : f)),
				);
			}),
		[runMutation],
	);

	const removeFeeding = useCallback(
		(id: number) =>
			runMutation(async () => {
				await apiDelete(`/feedings/${id}`);
				setFeedings((prev) => prev.filter((f) => f.id !== id));
			}, { silent: true }),
		[runMutation],
	);

	const setBathedToday = useCallback(
		() =>
			runMutation(async () => {
				if (!pet) return;
				const nowIso = new Date().toISOString();
				await apiFetch("/baths", {
					method: "POST",
					body: { pet_id: pet.id, bathed_at: nowIso },
				});
				setBaths((prev) => [{ timestamp: Date.parse(nowIso) }, ...prev]);
			}),
		[pet, runMutation],
	);

	const addWalk = useCallback(
		(at?: Date) =>
			runMutation(async () => {
				if (!pet) return;
				const nowIso = (at ?? new Date()).toISOString();
				const created = await apiFetch<{
					id: number;
					walked_at: string;
					walk_check: boolean;
				}>("/walks", {
					method: "POST",
					body: { pet_id: pet.id, walk_check: true, walked_at: nowIso },
				});
				setWalks((prev) => [
					{
						id: created.id,
						walked: true,
						timestamp: Date.parse(created.walked_at ?? nowIso),
					},
					...prev,
				]);
			}),
		[pet, runMutation],
	);

	const updateWalk = useCallback(
		(id: number, at: Date) =>
			runMutation(async () => {
				const saved = await apiFetch<ApiWalk>(`/walks/${id}`, {
					method: "PATCH",
					body: { walked_at: at.toISOString() },
				});
				setWalks((prev) =>
					prev.map((w) => (w.id === id ? { ...w, timestamp: Date.parse(saved.walked_at) } : w)),
				);
			}),
		[runMutation],
	);

	const removeWalk = useCallback(
		(id: number) =>
			runMutation(async () => {
				await apiDelete(`/walks/${id}`);
				setWalks((prev) => prev.filter((w) => w.id !== id));
			}, { silent: true }),
		[runMutation],
	);

	const setWeightToday = useCallback(
		(weightKg: number) =>
			runMutation(async () => {
				if (!pet || !Number.isFinite(weightKg) || weightKg <= 0) return;
				const nowIso = new Date().toISOString();
				await apiFetch("/weights", {
					method: "POST",
					body: { pet_id: pet.id, value: weightKg, weighed_at: nowIso },
				});
				setWeights((prev) => [
					{ timestamp: Date.parse(nowIso), weightKg },
					...prev,
				]);
			}),
		[pet, runMutation],
	);

	// Saves the shared bath interval. Optimistic: the schedule updates at once and rolls
	// back if the server refuses. Resolves true when saved.
	const setBathInterval = useCallback(
		async (days: number): Promise<boolean> => {
			if (!pet) return false;
			const previous = pet.bath_interval_days ?? DEFAULT_BATH_INTERVAL_DAYS;
			setPet((p) => (p ? { ...p, bath_interval_days: days } : p));
			try {
				const saved = await apiFetch<ApiPet>(`/pets/${pet.id}`, {
					method: "PATCH",
					body: { bath_interval_days: days },
				});
				setPet((p) => (p && p.id === saved.id ? { ...p, ...saved } : p));
				return true;
			} catch {
				setPet((p) => (p && p.id === pet.id ? { ...p, bath_interval_days: previous } : p));
				return false;
			}
		},
		[pet],
	);

	// ---- Refresh: this dog's data and the dog list (co-owners, shared settings) ----
	const refresh = useCallback(async () => {
		if (!pet?.id) return;
		setRefreshing(true);
		try {
			await Promise.all([fetchActivities(pet.id), loadPets().catch(() => [])]);
		} finally {
			setRefreshing(false);
		}
	}, [pet?.id, fetchActivities, loadPets]);

	// Same, without the pull-to-refresh spinner: used when the app returns to the foreground.
	const sync = useCallback(async () => {
		if (!pet?.id) return;
		try {
			await Promise.all([fetchActivities(pet.id), loadPets().catch(() => [])]);
		} catch (e) {
			console.warn("Failed to sync pet data", e);
		}
	}, [pet?.id, fetchActivities, loadPets]);

	// ---- Dogs: switch, create, join with a code, leave ----
	const selectPet = useCallback(
		async (id: number) => {
			if (id === activePetId.current) return;
			const next = pets.find((p) => p.id === id);
			if (next) await activate(next);
		},
		[pets, activate],
	);

	const createPet = useCallback(
		async (input: NewDog): Promise<Dog> => {
			const created = await apiFetch<ApiPet>("/pets", { method: "POST", body: input });
			setPets((prev) => [...prev.filter((p) => p.id !== created.id), created]);
			setPetsStatus("ready");
			await activate(created);
			return created;
		},
		[activate],
	);

	const joinWithCode = useCallback(
		async (code: string): Promise<Dog> => {
			const joined = await apiFetch<ApiPet>("/invitations/accept", {
				method: "POST",
				body: { code },
			});
			setPets((prev) => [...prev.filter((p) => p.id !== joined.id), joined]);
			setPetsStatus("ready");
			await activate(joined);
			return joined;
		},
		[activate],
	);

	// Stops looking after a dog (the server keeps at least one owner on every dog).
	const leavePet = useCallback(
		async (id: number) => {
			if (!user) return;
			await apiFetch(`/pets/${id}/users/${user.id}`, { method: "DELETE" });
			await loadPets();
		},
		[user, loadPets],
	);

	const reloadPets = useCallback(async () => {
		await loadPets();
	}, [loadPets]);

	// ---- Derived values ----
	const value = useMemo<PetContextValue>(() => {
		const today = new Date();
		const timezone = pet?.timezone || deviceTimeZone();

		const feedingsToday = feedings.filter(
			(f) => f.fed && isSameDay(f.timestamp, today.getTime(), timezone),
		).length;
		const walksToday = walks.filter(
			(w) => w.walked && isSameDay(w.timestamp, today.getTime(), timezone),
		).length;
		const hasFedToday = feedingsToday > 0;
		const hasWalkedToday = walksToday > 0;

		const lastBathTs = getLatestTimestamp(baths);
		const lastBathAt = lastBathTs ? new Date(lastBathTs) : null;

		const bathIntervalDays = pet?.bath_interval_days ?? DEFAULT_BATH_INTERVAL_DAYS;
		const nextBathDueAt = lastBathAt
			? new Date(lastBathAt.getTime() + bathIntervalDays * 24 * 60 * 60 * 1000)
			: today;
		// Due on the due date and every day after it until a bath is logged.
		const bathOverdueDays = Math.max(
			0,
			calendarDay(today.getTime(), timezone) -
				calendarDay(nextBathDueAt.getTime(), timezone),
		);
		const isBathDue =
			calendarDay(today.getTime(), timezone) >=
			calendarDay(nextBathDueAt.getTime(), timezone);

		const latestWeightTs = getLatestTimestamp(weights);
		const currentWeightKg = latestWeightTs
			? (weights.find((w) => w.timestamp === latestWeightTs)?.weightKg ?? null)
			: null;

		return {
			pets,
			petsStatus,
			selectPet,
			createPet,
			joinWithCode,
			leavePet,
			reloadPets,
			owners: pet?.users ?? [],
			petId: pet?.id ?? null,
			timezone,
			name: pet?.name ?? "",
			breed: pet?.breed ?? "",
			feedings,
			baths,
			walks,
			weights,
			hasFedToday,
			hasWalkedToday,
			lastBathAt,
			currentWeightKg,
			feedingsToday,
			walksToday,
			addFeeding,
			updateFeeding,
			removeFeeding,
			addWalk,
			updateWalk,
			removeWalk,
			setBathedToday,
			bathIntervalDays,
			setBathInterval,
			nextBathDueAt,
			isBathDue,
			bathOverdueDays,
			setWeightToday,
			busy,

			// pull-to-refresh
			refresh,
			refreshing,
			sync,

			// infinite scroll
			loadMore,
			hasMore,
			loadingMore,
		};
	}, [
		pet,
		pets,
		petsStatus,
		selectPet,
		createPet,
		joinWithCode,
		leavePet,
		reloadPets,
		baths,
		feedings,
		walks,
		weights,
		addFeeding,
		updateFeeding,
		removeFeeding,
		addWalk,
		updateWalk,
		removeWalk,
		setBathedToday,
		setBathInterval,
		setWeightToday,
		busy,
		refresh,
		refreshing,
		sync,
		loadMore,
		hasMore,
		loadingMore,
	]);

	return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet(): PetContextValue {
	const ctx = useContext(PetContext);
	if (!ctx) throw new Error("usePet must be used within a PetProvider");
	return ctx;
}
