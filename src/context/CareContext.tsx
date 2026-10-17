import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../i18n";
import { describeError } from "../api/errors";
import { apiDelete, apiFetch } from "../api/client";
import { useAuth } from "./AuthContext";
import { usePet } from "./PetContext";

export type CareKind = "vet" | "vaccination" | "parasite";
export type ParasiteType = "flea" | "tick" | "worm";

export type CareRecord = {
	id: number;
	kind: CareKind;
	// Vet: reason. Vaccination: vaccine name. Parasite: product (may be empty).
	name: string;
	parasiteType: ParasiteType | null;
	date: number;
	nextDueAt: number | null;
	notes: string | null;
};

export type CareInput = {
	name: string;
	parasiteType?: ParasiteType;
	date: Date;
	nextDueAt: Date | null;
	notes?: string;
};

type CareContextValue = {
	records: Record<CareKind, CareRecord[]>;
	busy: boolean;
	refreshing: boolean;
	refresh: () => Promise<void>;
	addRecord: (kind: CareKind, input: CareInput) => Promise<boolean>;
	updateRecord: (kind: CareKind, id: number, input: CareInput) => Promise<boolean>;
	// Resolves true when the delete went through (errors are reported by the caller).
	removeRecord: (kind: CareKind, id: number) => Promise<boolean>;
};

const CareContext = createContext<CareContextValue | undefined>(undefined);

// Expected backend resources (same conventions as /baths, /weights, ...):
//   /vet-visits            { id, pet_id, reason, visited_at, next_visit_at, notes }
//   /vaccinations          { id, pet_id, name, given_at, next_due_at, notes }
//   /parasite-treatments   { id, pet_id, type: flea|tick|worm, product, given_at, next_due_at, notes }
const ENDPOINT: Record<CareKind, string> = {
	vet: "/vet-visits",
	vaccination: "/vaccinations",
	parasite: "/parasite-treatments",
};

type ApiRow = Record<string, any>;

function unwrapList(res: ApiRow[] | { data: ApiRow[] }): ApiRow[] {
	return Array.isArray(res) ? res : (res?.data ?? []);
}

function parseDate(v: unknown): number | null {
	if (typeof v !== "string") return null;
	const ts = Date.parse(v);
	return Number.isFinite(ts) ? ts : null;
}

function fromApi(kind: CareKind, row: ApiRow): CareRecord {
	const common = { id: row.id as number, kind, notes: row.notes ?? null };
	switch (kind) {
		case "vet":
			return {
				...common,
				name: row.reason ?? "",
				parasiteType: null,
				date: parseDate(row.visited_at) ?? 0,
				nextDueAt: parseDate(row.next_visit_at),
			};
		case "vaccination":
			return {
				...common,
				name: row.name ?? "",
				parasiteType: null,
				date: parseDate(row.given_at) ?? 0,
				nextDueAt: parseDate(row.next_due_at),
			};
		case "parasite":
			return {
				...common,
				name: row.product ?? "",
				parasiteType: (row.type as ParasiteType) ?? null,
				date: parseDate(row.given_at) ?? 0,
				nextDueAt: parseDate(row.next_due_at),
			};
	}
}

function toApi(kind: CareKind, petId: number, input: CareInput): ApiRow {
	const date = input.date.toISOString();
	const next = input.nextDueAt ? input.nextDueAt.toISOString() : null;
	const notes = input.notes?.trim() || null;
	switch (kind) {
		case "vet":
			return {
				pet_id: petId,
				reason: input.name,
				visited_at: date,
				next_visit_at: next,
				notes,
			};
		case "vaccination":
			return {
				pet_id: petId,
				name: input.name,
				given_at: date,
				next_due_at: next,
				notes,
			};
		case "parasite":
			return {
				pet_id: petId,
				type: input.parasiteType,
				product: input.name || null,
				given_at: date,
				next_due_at: next,
				notes,
			};
	}
}

// Offline cache so the Care tab shows the last known records without a connection.
export const CARE_CACHE_PREFIX = "pet-tracker/care-cache/v1";
const careCacheKey = (petId: number) => `${CARE_CACHE_PREFIX}/${petId}`;

const EMPTY: Record<CareKind, CareRecord[]> = {
	vet: [],
	vaccination: [],
	parasite: [],
};

export function CareProvider({ children }: { children: ReactNode }) {
	const { token } = useAuth();
	const { petId } = usePet();
	const [records, setRecords] = useState(EMPTY);
	const [refreshing, setRefreshing] = useState(false);
	const [busy, setBusy] = useState(false);
	const inFlight = useRef(false);

	const load = useCallback(async (id: number) => {
		const kinds = Object.keys(ENDPOINT) as CareKind[];
		const lists = await Promise.all(
			kinds.map((k) =>
				apiFetch<ApiRow[] | { data: ApiRow[] }>(`${ENDPOINT[k]}?pet_id=${id}`),
			),
		);
		const next = { ...EMPTY };
		kinds.forEach((k, i) => {
			next[k] = unwrapList(lists[i])
				.map((row) => fromApi(k, row))
				.sort((a, b) => b.date - a.date);
		});
		setRecords(next);
		AsyncStorage.setItem(careCacheKey(id), JSON.stringify(next)).catch(() => {});
	}, []);

	useEffect(() => {
		if (!token || petId == null) {
			setRecords(EMPTY);
			return;
		}
		let cancelled = false;
		(async () => {
			// Show the cached copy immediately, then refresh from the network.
			try {
				const raw = await AsyncStorage.getItem(careCacheKey(petId));
				if (raw && !cancelled) {
					const cached = JSON.parse(raw) as Partial<Record<CareKind, CareRecord[]>>;
					setRecords({
						vet: cached.vet ?? [],
						vaccination: cached.vaccination ?? [],
						parasite: cached.parasite ?? [],
					});
				}
			} catch {
				// ignore a malformed cache
			}
			try {
				await load(petId);
			} catch (e) {
				console.warn("Failed to load care records", e);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [token, petId, load]);

	const refresh = useCallback(async () => {
		if (petId == null) return;
		setRefreshing(true);
		try {
			await load(petId);
		} finally {
			setRefreshing(false);
		}
	}, [petId, load]);

	// Same guard as PetContext: block double taps, alert on failure.
	const run = useCallback(
		async (fn: () => Promise<void>, opts?: { silent?: boolean }): Promise<boolean> => {
		if (inFlight.current) return false;
		inFlight.current = true;
		setBusy(true);
		try {
			await fn();
			return true;
		} catch (e) {
			if (!(e instanceof Error && e.message === "Unauthorized") && !opts?.silent)
				Alert.alert(i18n.t("error_title"), describeError(e));
			return false;
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
		},
		[],
	);

	const addRecord = useCallback(
		(kind: CareKind, input: CareInput) =>
			run(async () => {
				if (petId == null) return;
				const created = await apiFetch<ApiRow>(ENDPOINT[kind], {
					method: "POST",
					body: toApi(kind, petId, input),
				});
				// Fall back to what we sent if the server returns no body.
				const row = created?.id
					? created
					: { ...toApi(kind, petId, input), id: -Date.now() };
				setRecords((prev) => ({
					...prev,
					[kind]: [fromApi(kind, row), ...prev[kind]].sort(
						(a, b) => b.date - a.date,
					),
				}));
			}),
		[petId, run],
	);

	const updateRecord = useCallback(
		(kind: CareKind, id: number, input: CareInput) =>
			run(async () => {
				if (petId == null) return;
				// pet_id stays as it is; only the editable fields are sent.
				const { pet_id: _pet, ...fields } = toApi(kind, petId, input);
				const saved = await apiFetch<ApiRow>(`${ENDPOINT[kind]}/${id}`, {
					method: "PATCH",
					body: fields,
				});
				const row = saved?.id ? saved : { ...fields, id };
				setRecords((prev) => ({
					...prev,
					[kind]: prev[kind]
						.map((r) => (r.id === id ? fromApi(kind, row) : r))
						.sort((a, b) => b.date - a.date),
				}));
			}),
		[petId, run],
	);

	const removeRecord = useCallback(
		(kind: CareKind, id: number) =>
			run(
				async () => {
					await apiDelete(`${ENDPOINT[kind]}/${id}`);
					setRecords((prev) => ({
						...prev,
						[kind]: prev[kind].filter((r) => r.id !== id),
					}));
				},
				{ silent: true },
			),
		[run],
	);

	// Keep the cache in step with local add/remove between refreshes.
	useEffect(() => {
		// Skip the untouched initial state so it can't overwrite the cache before it is read.
		if (petId == null || !token || records === EMPTY) return;
		AsyncStorage.setItem(careCacheKey(petId), JSON.stringify(records)).catch(
			() => {},
		);
	}, [records, petId, token]);

	const value = useMemo(
		() => ({ records, busy, refreshing, refresh, addRecord, updateRecord, removeRecord }),
		[records, busy, refreshing, refresh, addRecord, updateRecord, removeRecord],
	);

	return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare(): CareContextValue {
	const ctx = useContext(CareContext);
	if (!ctx) throw new Error("useCare must be used within a CareProvider");
	return ctx;
}
