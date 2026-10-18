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
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiDelete, apiFetch } from "../api/client";
import { useAuth } from "./AuthContext";
import { usePet } from "./PetContext";
import { dayToDate, doseKey, normalizeTimes, type Dose, type Medicine } from "../utils/medicine";
import { calendarDay } from "../utils/dates";

// Medicines on a schedule and the doses given, for the active dog. Everything is shared by the dog's
// owners: a dose ticked off by anyone counts for everyone, so the lists are re-read when the app
// comes forward.

export type MedicineInput = {
	name: string;
	dose: string;
	times: string[];
	intervalDays: number;
	// "YYYY-MM-DD" or null for no end.
	endsOn: string | null;
};

type MedicineValue = {
	medicines: Medicine[];
	doses: Dose[];
	loading: boolean;
	refresh: () => Promise<void>;
	addMedicine: (input: MedicineInput) => Promise<boolean>;
	updateMedicine: (id: number, input: MedicineInput) => Promise<boolean>;
	removeMedicine: (id: number) => Promise<boolean>;
	// Tick a dose off (or take the tick back). Resolve true when the server has it.
	setGiven: (medicineId: number, date: string, slot: string, given: boolean) => Promise<boolean>;
};

const MedicineContext = createContext<MedicineValue | undefined>(undefined);

type ApiMedicine = {
	id: number;
	name: string;
	dose: string | null;
	times: string[];
	interval_days: number;
	starts_on: string;
	ends_on: string | null;
};
type ApiDose = { id: number; medicine_id: number; for: string; slot: string; user_id: number };

const mapMedicine = (m: ApiMedicine): Medicine => ({
	id: m.id,
	name: m.name,
	dose: m.dose,
	times: m.times,
	intervalDays: m.interval_days,
	startsOn: m.starts_on,
	endsOn: m.ends_on,
});
const mapDose = (d: ApiDose): Dose => ({ id: d.id, medicineId: d.medicine_id, for: d.for, slot: d.slot, userId: d.user_id });

// Under the per-user prefix, so signing out wipes it with the rest of the cache.
const cacheKey = (petId: number) => `pet-tracker/medicine-cache/v1/${petId}`;

// How far back doses are read: enough to show yesterday's and to let a forgotten tick be fixed.
const DOSE_DAYS_BACK = 8;

export function MedicineProvider({ children }: { children: ReactNode }) {
	const { token, user } = useAuth();
	const { petId, timezone } = usePet();
	const [medicines, setMedicines] = useState<Medicine[]>([]);
	const [doses, setDoses] = useState<Dose[]>([]);
	const [loading, setLoading] = useState(false);
	// The dog on screen: a late answer for another dog is dropped.
	const active = useRef<number | null>(null);
	// The dog the lists above belong to. It changes in the same update that clears them, so the
	// saved copy can never be written under another dog's key.
	const [owner, setOwner] = useState<number | null>(null);

	const load = useCallback(async (id: number) => {
		const since = dayToDate(calendarDay(Date.now(), "UTC") - DOSE_DAYS_BACK);
		const [m, d] = await Promise.all([
			apiFetch<ApiMedicine[]>(`/medicines?pet_id=${id}`),
			apiFetch<ApiDose[]>(`/medicine-doses?pet_id=${id}&since=${since}`),
		]);
		if (active.current !== id) return;
		const meds = m.map(mapMedicine);
		const ds = d.map(mapDose);
		setMedicines(meds);
		setDoses(ds);
		AsyncStorage.setItem(cacheKey(id), JSON.stringify({ medicines: meds, doses: ds })).catch(() => {});
	}, []);

	useEffect(() => {
		active.current = petId;
		setMedicines([]);
		setDoses([]);
		setOwner(petId);
		if (!token || petId == null) return;
		let cancelled = false;
		(async () => {
			// The saved copy first, so the list is there without a connection, then the server's.
			try {
				const raw = await AsyncStorage.getItem(cacheKey(petId));
				if (raw && !cancelled && active.current === petId) {
					const cached = JSON.parse(raw) as { medicines?: Medicine[]; doses?: Dose[] };
					setMedicines(Array.isArray(cached.medicines) ? cached.medicines : []);
					setDoses(Array.isArray(cached.doses) ? cached.doses : []);
				}
			} catch {
				// a damaged cache is ignored
			}
			setLoading(true);
			try {
				await load(petId);
			} catch (e) {
				console.warn("Failed to load medicines", e);
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [token, petId, load]);

	const refresh = useCallback(async () => {
		if (petId == null) return;
		try {
			await load(petId);
		} catch (e) {
			console.warn("Failed to refresh medicines", e);
		}
	}, [petId, load]);

	// Another owner may have given a dose: look again when the app comes forward.
	useEffect(() => {
		if (!token) return;
		const sub = AppState.addEventListener("change", (s) => {
			if (s === "active") refresh();
		});
		return () => sub.remove();
	}, [token, refresh]);

	const body = (input: MedicineInput) => ({
		name: input.name.trim(),
		dose: input.dose.trim() || null,
		times: normalizeTimes(input.times),
		interval_days: input.intervalDays,
		ends_on: input.endsOn,
	});

	const addMedicine = useCallback(
		async (input: MedicineInput) => {
			if (petId == null) return false;
			try {
				// It starts today: the dog's today, so a late evening in another timezone is right.
				const created = await apiFetch<ApiMedicine>("/medicines", {
					method: "POST",
					body: { pet_id: petId, ...body(input), starts_on: dayToDate(calendarDay(Date.now(), timezone)) },
				});
				if (active.current === petId) setMedicines((prev) => [...prev, mapMedicine(created)].sort((a, b) => a.name.localeCompare(b.name)));
				return true;
			} catch {
				return false;
			}
		},
		[petId, timezone],
	);

	const updateMedicine = useCallback(async (id: number, input: MedicineInput) => {
		try {
			const saved = await apiFetch<ApiMedicine>(`/medicines/${id}`, { method: "PATCH", body: body(input) });
			setMedicines((prev) => prev.map((m) => (m.id === id ? mapMedicine(saved) : m)).sort((a, b) => a.name.localeCompare(b.name)));
			return true;
		} catch {
			return false;
		}
	}, []);

	const removeMedicine = useCallback(async (id: number) => {
		try {
			await apiDelete(`/medicines/${id}`);
			setMedicines((prev) => prev.filter((m) => m.id !== id));
			return true;
		} catch {
			return false;
		}
	}, []);

	const setGiven = useCallback(
		async (medicineId: number, date: string, slot: string, given: boolean) => {
			const key = doseKey(medicineId, date, slot);
			const same = (d: Dose) => doseKey(d.medicineId, d.for, d.slot) === key;
			const previous = doses;

			if (given) {
				// Show it at once; the server's answer replaces the stand-in.
				const stand: Dose = { id: -Date.now(), medicineId, for: date, slot, userId: user?.id ?? 0 };
				setDoses((prev) => [...prev.filter((d) => !same(d)), stand]);
				try {
					const saved = await apiFetch<ApiDose>(`/medicines/${medicineId}/doses`, { method: "PUT", body: { for: date, slot } });
					setDoses((prev) => [...prev.filter((d) => !same(d)), mapDose(saved)]);
					return true;
				} catch {
					setDoses((prev) => (prev.some((d) => d.id === stand.id) ? previous : prev));
					return false;
				}
			}

			setDoses((prev) => prev.filter((d) => !same(d)));
			try {
				await apiDelete(`/medicines/${medicineId}/doses?for=${date}&slot=${encodeURIComponent(slot)}`);
				return true;
			} catch {
				setDoses(previous);
				return false;
			}
		},
		[doses, user?.id],
	);

	// Keep the saved copy in step with local changes between reads.
	useEffect(() => {
		if (owner == null || !token || (medicines.length === 0 && doses.length === 0)) return;
		AsyncStorage.setItem(cacheKey(owner), JSON.stringify({ medicines, doses })).catch(() => {});
	}, [medicines, doses, owner, token]);

	const value = useMemo(
		() => ({ medicines, doses, loading, refresh, addMedicine, updateMedicine, removeMedicine, setGiven }),
		[medicines, doses, loading, refresh, addMedicine, updateMedicine, removeMedicine, setGiven],
	);

	return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
}

export function useMedicines(): MedicineValue {
	const ctx = useContext(MedicineContext);
	if (!ctx) throw new Error("useMedicines must be used within a MedicineProvider");
	return ctx;
}
