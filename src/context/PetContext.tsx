import {
	createContext,
	useContext,
	useMemo,
	type ReactNode,
	useState,
	useCallback,
	useEffect,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiFetch } from "../api/client";
import { useAuth } from "./AuthContext";

// ===== Types expected by the rest of the app =====
export type FeedingRecord = { id: number; timestamp: number; fed: boolean };
export type BathRecord = { timestamp: number };
export type WalkRecord = { id: number; timestamp: number; walked: boolean };
export type WeightRecord = { timestamp: number; weightKg: number };

export type PetContextValue = {
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
	setFedToday: (fed: boolean) => Promise<void>;
	setBathedToday: () => Promise<void>;
	setWalkedToday: (walked: boolean) => Promise<void>;
	nextBathDueAt: Date | null;
	isBathDueToday: boolean;
	setWeightToday: (weightKg: number) => Promise<void>;

	// ⬇️ New for pull-to-refresh
	refresh: () => Promise<void>;
	refreshing: boolean;
};

const PetContext = createContext<PetContextValue | undefined>(undefined);

// ===== Backend API shapes =====
type ApiPet = {
	id: number;
	name: string;
	age?: number | null;
	breed?: string | null;
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

function isSameDay(a: Date, b: Date): boolean {
	return (
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate()
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
		const [feedingsRaw, walksRaw, bathsRaw, weightsRaw] = await Promise.all([
			apiFetch<ApiFeeding[] | { data: ApiFeeding[] }>(
				`/feedings?pet_id=${petId}`,
			),
			apiFetch<ApiWalk[] | { data: ApiWalk[] }>(`/walks?pet_id=${petId}`),
			apiFetch<ApiBath[] | { data: ApiBath[] }>(`/baths?pet_id=${petId}`),
			apiFetch<ApiWeight[] | { data: ApiWeight[] }>(`/weights?pet_id=${petId}`),
		]);

		setFeedings(
			unwrapList(feedingsRaw)
				.map((f) => ({
					id: f.id,
					timestamp: Date.parse(f.fed_at),
					fed: !!f.feed_check,
				}))
				.sort((a, b) => b.timestamp - a.timestamp),
		);

		setWalks(
			unwrapList(walksRaw)
				.map((w) => ({
					id: w.id,
					timestamp: Date.parse(w.walked_at),
					walked: !!w.walk_check,
				}))
				.sort((a, b) => b.timestamp - a.timestamp),
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
	const setFedToday = useCallback(
		async (fed: boolean) => {
			if (!pet) return;

			const nowIso = new Date().toISOString();
			const today = new Date();

			const todays = feedings
				.filter((f) => isSameDay(new Date(f.timestamp), today))
				.sort((a, b) => b.timestamp - a.timestamp);
			const latestToday = todays[0];

			if (fed) {
				if (latestToday) {
					await apiFetch(`/feedings/${latestToday.id}`, {
						method: "PATCH",
						body: { feed_check: true, fed_at: nowIso },
					});
					setFeedings((prev) =>
						prev.map((f) =>
							f.id === latestToday.id
								? { ...f, fed: true, timestamp: Date.parse(nowIso) }
								: f,
						),
					);
				} else {
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
				}
			} else {
				if (!latestToday) return;
				await apiFetch(`/feedings/${latestToday.id}`, { method: "DELETE" });
				setFeedings((prev) => prev.filter((f) => f.id !== latestToday.id));
			}
		},
		[pet, feedings],
	);

	const setBathedToday = useCallback(async () => {
		if (!pet) return;
		const nowIso = new Date().toISOString();
		await apiFetch("/baths", {
			method: "POST",
			body: { pet_id: pet.id, bathed_at: nowIso },
		});
		setBaths((prev) => [{ timestamp: Date.parse(nowIso) }, ...prev]);
	}, [pet]);

	const setWalkedToday = useCallback(
		async (walked: boolean) => {
			if (!pet) return;
			const nowIso = new Date().toISOString();
			const today = new Date();

			const todays = walks
				.filter((w) => isSameDay(new Date(w.timestamp), today))
				.sort((a, b) => b.timestamp - a.timestamp);
			const latestToday = todays[0];

			if (walked) {
				if (latestToday) {
					await apiFetch(`/walks/${latestToday.id}`, {
						method: "PATCH",
						body: { walk_check: true, walked_at: nowIso },
					});
					setWalks((prev) =>
						prev.map((w) =>
							w.id === latestToday.id
								? { ...w, walked: true, timestamp: Date.parse(nowIso) }
								: w,
						),
					);
				} else {
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
				}
			} else {
				if (!latestToday) return;
				await apiFetch(`/walks/${latestToday.id}`, { method: "DELETE" });
				setWalks((prev) => prev.filter((w) => w.id !== latestToday.id));
			}
		},
		[pet, walks],
	);

	const setWeightToday = useCallback(
		async (weightKg: number) => {
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
		},
		[pet],
	);

	// ---- Derived values ----
	const value = useMemo<PetContextValue>(() => {
		const today = new Date();

		const hasFedToday = feedings.some(
			(f) => f.fed && isSameDay(new Date(f.timestamp), today),
		);
		const hasWalkedToday = walks.some(
			(w) => w.walked && isSameDay(new Date(w.timestamp), today),
		);

		const lastBathTs = getLatestTimestamp(baths);
		const lastBathAt = lastBathTs ? new Date(lastBathTs) : null;

		const monthMs = 1000 * 60 * 60 * 24 * 30;
		const nextBathDueAt = lastBathAt
			? new Date(lastBathAt.getTime() + monthMs)
			: today;
		const isBathDueToday = nextBathDueAt
			? isSameDay(today, nextBathDueAt)
			: false;

		const latestWeightTs = getLatestTimestamp(weights);
		const currentWeightKg = latestWeightTs
			? (weights.find((w) => w.timestamp === latestWeightTs)?.weightKg ?? null)
			: null;

		return {
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
			setFedToday,
			setBathedToday,
			setWalkedToday,
			nextBathDueAt,
			isBathDueToday,
			setWeightToday,

			// pull-to-refresh
			refresh,
			refreshing,
		};
	}, [
		pet,
		baths,
		feedings,
		walks,
		weights,
		setFedToday,
		setBathedToday,
		setWalkedToday,
		setWeightToday,
		refresh,
		refreshing,
	]);

	return <PetContext.Provider value={value}>{children}</PetContext.Provider>;
}

export function usePet(): PetContextValue {
	const ctx = useContext(PetContext);
	if (!ctx) throw new Error("usePet must be used within a PetProvider");
	return ctx;
}
