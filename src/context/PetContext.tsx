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
	addFeeding: () => Promise<boolean>;
	removeFeeding: (id: number) => Promise<boolean>;
	addWalk: () => Promise<boolean>;
	removeWalk: (id: number) => Promise<boolean>;
	setBathedToday: () => Promise<boolean>;
	nextBathDueAt: Date | null;
	isBathDue: boolean;
	bathOverdueDays: number;
	setWeightToday: (weightKg: number) => Promise<boolean>;

	// True while a save request is in flight
	busy: boolean;

	// ⬇️ New for pull-to-refresh
	refresh: () => Promise<void>;
	refreshing: boolean;

	// Infinite scroll for the long logs (100 more entries per call)
	loadMore: (kind: PagedKind) => Promise<void>;
	hasMore: Record<PagedKind, boolean>;
	loadingMore: Record<PagedKind, boolean>;
};

export type PagedKind = "feedings" | "walks";

const PetContext = createContext<PetContextValue | undefined>(undefined);

// ===== Backend API shapes =====
type ApiPet = {
	id: number;
	name: string;
	age?: number | null;
	breed?: string | null;
	timezone?: string | null;
};
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
	const { token } = useAuth();

	// Active pet metadata
	const [pet, setPet] = useState<ApiPet | null>(null);

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

	// ---- Public: refresh for pull-to-refresh ----
	const refresh = useCallback(async () => {
		if (!pet?.id) return;
		setRefreshing(true);
		try {
			await fetchActivities(pet.id);
		} finally {
			setRefreshing(false);
		}
	}, [pet?.id, fetchActivities]);

	// ---- Bootstrap: load from cache immediately, then refresh from API ----
	useEffect(() => {
		if (!token) {
			setHasMore({ feedings: false, walks: false });
			setPet(null);
			setFeedings([]);
			setBaths([]);
			setWalks([]);
			setWeights([]);
			return;
		}

		let cancelled = false;

		(async () => {
			// 0) Try load cached bundle for stored active pet (instant UI)
			const storedId = await AsyncStorage.getItem(STORAGE_ACTIVE_PET_ID);
			const activeId = storedId ? Number(storedId) : undefined;
			if (activeId && Number.isFinite(activeId)) {
				const raw = await AsyncStorage.getItem(cacheKey(activeId));
				if (raw && !cancelled) {
					try {
						const cached = JSON.parse(raw) as CachedBundle;
						if (cached.pet) setPet(cached.pet);
						setFeedings(Array.isArray(cached.feedings) ? cached.feedings : []);
						setWalks(Array.isArray(cached.walks) ? cached.walks : []);
						setBaths(Array.isArray(cached.baths) ? cached.baths : []);
						setWeights(Array.isArray(cached.weights) ? cached.weights : []);
					} catch {
						// ignore malformed cache
					}
				}
			}

			// 1) Load pets from API
			let selected: ApiPet | undefined;
			try {
				const petsRes = await apiFetch<ApiPet[] | { data: ApiPet[] }>("/pets");
				const pets = unwrapList<ApiPet>(petsRes);
				if (pets.length === 0) {
					if (!cancelled) setPet(null);
					return;
				}
				const storedActiveId =
					storedId ?? (await AsyncStorage.getItem(STORAGE_ACTIVE_PET_ID));
				selected = pets.find((p) => String(p.id) === storedActiveId) ?? pets[0];
				if (!cancelled) {
					setPet(selected);
					await AsyncStorage.setItem(
						STORAGE_ACTIVE_PET_ID,
						String(selected.id),
					);
				}
			} catch {
				// If API for pets fails, keep showing whatever we had from cache.
				return;
			}

			if (!selected || cancelled) return;

			// 2) Load activities for active pet (prefer network; cache already shown)
			try {
				await fetchActivities(selected.id);
			} catch (e) {
				// Ignore; we already showed cache. Network can fail without breaking UI.
				console.warn("Failed to refresh pet data from API", e);
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [token, fetchActivities]);

	// ---- Mutations: API-first (keeps server as source of truth), cache persists via effect ----
	const addFeeding = useCallback(
		() =>
			runMutation(async () => {
				if (!pet) return;
				const nowIso = new Date().toISOString();
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
		() =>
			runMutation(async () => {
				if (!pet) return;
				const nowIso = new Date().toISOString();
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

		const monthMs = 1000 * 60 * 60 * 24 * 30;
		const nextBathDueAt = lastBathAt
			? new Date(lastBathAt.getTime() + monthMs)
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
			removeFeeding,
			addWalk,
			removeWalk,
			setBathedToday,
			nextBathDueAt,
			isBathDue,
			bathOverdueDays,
			setWeightToday,
			busy,

			// pull-to-refresh
			refresh,
			refreshing,

			// infinite scroll
			loadMore,
			hasMore,
			loadingMore,
		};
	}, [
		pet,
		baths,
		feedings,
		walks,
		weights,
		addFeeding,
		removeFeeding,
		addWalk,
		removeWalk,
		setBathedToday,
		setWeightToday,
		busy,
		refresh,
		refreshing,
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
