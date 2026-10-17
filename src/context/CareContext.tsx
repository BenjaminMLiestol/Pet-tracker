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
import i18n from "../i18n";
import { apiFetch } from "../api/client";
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
	removeRecord: (kind: CareKind, id: number) => Promise<void>;
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
	}, []);

	useEffect(() => {
		if (!token || petId == null) {
			setRecords(EMPTY);
			return;
		}
		load(petId).catch((e) => console.warn("Failed to load care records", e));
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
	const run = useCallback(async (fn: () => Promise<void>): Promise<boolean> => {
		if (inFlight.current) return false;
		inFlight.current = true;
		setBusy(true);
		try {
			await fn();
			return true;
		} catch (e) {
			if (!(e instanceof Error && e.message === "Unauthorized"))
				Alert.alert(i18n.t("error_title"), i18n.t("error_save_failed"));
			return false;
		} finally {
			inFlight.current = false;
			setBusy(false);
		}
	}, []);

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

	const removeRecord = useCallback(
		async (kind: CareKind, id: number) => {
			await run(async () => {
				await apiFetch(`${ENDPOINT[kind]}/${id}`, { method: "DELETE" });
				setRecords((prev) => ({
					...prev,
					[kind]: prev[kind].filter((r) => r.id !== id),
				}));
			});
		},
		[run],
	);

	const value = useMemo(
		() => ({ records, busy, refreshing, refresh, addRecord, removeRecord }),
		[records, busy, refreshing, refresh, addRecord, removeRecord],
	);

	return <CareContext.Provider value={value}>{children}</CareContext.Provider>;
}

export function useCare(): CareContextValue {
	const ctx = useContext(CareContext);
	if (!ctx) throw new Error("useCare must be used within a CareProvider");
	return ctx;
}
