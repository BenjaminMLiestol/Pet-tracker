import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";
import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { useTranslation } from "react-i18next";
import { usePet } from "./PetContext";
import { useAuth } from "./AuthContext";

const STORAGE_KEY = "app/reminders-enabled";
const CHANNEL_ID = "reminders";

// Fixed schedule (local time).
const FEEDING_HOUR = 18;
const WALK_HOUR = 19;
const WEIGH_IN_DAY = 0; // Sunday
const WEIGH_IN_HOUR = 10;
const DAYS_AHEAD = 7;
const WEIGH_IN_WEEKS_AHEAD = 4;
const DAY_MS = 24 * 60 * 60 * 1000;

Notifications.setNotificationHandler({
	handleNotification: async () => ({
		shouldShowBanner: true,
		shouldShowList: true,
		shouldPlaySound: false,
		shouldSetBadge: false,
	}),
});

type RemindersValue = {
	enabled: boolean;
	setEnabled: (enabled: boolean) => Promise<boolean>;
};

const RemindersContext = createContext<RemindersValue | undefined>(undefined);

async function ensurePermission(): Promise<boolean> {
	if (Platform.OS === "android") {
		await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
			name: "Reminders",
			importance: Notifications.AndroidImportance.DEFAULT,
		});
	}
	const current = await Notifications.getPermissionsAsync();
	if (current.granted) return true;
	if (!current.canAskAgain) return false;
	return (await Notifications.requestPermissionsAsync()).granted;
}

function at(base: Date, dayOffset: number, hour: number): Date {
	return new Date(
		base.getFullYear(),
		base.getMonth(),
		base.getDate() + dayOffset,
		hour,
		0,
		0,
	);
}

export function RemindersProvider({ children }: { children: ReactNode }) {
	const { t, i18n } = useTranslation();
	const { token } = useAuth();
	const { name, hasFedToday, hasWalkedToday, weights } = usePet();
	const [enabled, setEnabledState] = useState(false);
	const [appActiveTick, setAppActiveTick] = useState(0);

	const lastWeightAt = weights.length
		? Math.max(...weights.map((w) => w.timestamp))
		: null;

	useEffect(() => {
		AsyncStorage.getItem(STORAGE_KEY)
			.then((v) => setEnabledState(v === "1"))
			.catch(() => {});
	}, []);

	// Rebuild the schedule when the day rolls over while the app was backgrounded.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (s) => {
			if (s === "active") setAppActiveTick((n) => n + 1);
		});
		return () => sub.remove();
	}, []);

	const setEnabled = useCallback(async (next: boolean) => {
		if (next && !(await ensurePermission())) return false;
		setEnabledState(next);
		await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0").catch(() => {});
		return true;
	}, []);

	// Reschedule everything whenever the inputs change. Reminders for activities
	// already done today are skipped, so they only fire when still needed.
	// biome-ignore lint/correctness/useExhaustiveDependencies: appActiveTick is a re-run trigger
	useEffect(() => {
		let cancelled = false;
		(async () => {
			await Notifications.cancelAllScheduledNotificationsAsync();
			if (!enabled || !token || !name || cancelled) return;
			if (!(await ensurePermission())) return;

			const now = new Date();
			const schedule = async (
				date: Date,
				title: string,
				body: string,
			): Promise<void> => {
				if (date.getTime() <= now.getTime()) return;
				await Notifications.scheduleNotificationAsync({
					content: { title, body },
					trigger: {
						type: Notifications.SchedulableTriggerInputTypes.DATE,
						date,
						channelId: CHANNEL_ID,
					},
				});
			};

			for (let d = 0; d < DAYS_AHEAD; d += 1) {
				if (!(d === 0 && hasFedToday))
					await schedule(
						at(now, d, FEEDING_HOUR),
						t("reminder_feeding_title"),
						t("reminder_feeding_body", { name }),
					);
				if (!(d === 0 && hasWalkedToday))
					await schedule(
						at(now, d, WALK_HOUR),
						t("reminder_walk_title"),
						t("reminder_walk_body", { name }),
					);
			}

			// Next Sundays, skipping any within 6 days of the last logged weight.
			const daysUntilSunday = (WEIGH_IN_DAY - now.getDay() + 7) % 7;
			for (let w = 0; w < WEIGH_IN_WEEKS_AHEAD; w += 1) {
				const date = at(now, daysUntilSunday + w * 7, WEIGH_IN_HOUR);
				if (lastWeightAt && date.getTime() - lastWeightAt < 6 * DAY_MS) continue;
				await schedule(
					date,
					t("reminder_weight_title"),
					t("reminder_weight_body", { name }),
				);
			}
		})().catch((e) => console.warn("Failed to schedule reminders", e));
		return () => {
			cancelled = true;
		};
	}, [
		enabled,
		token,
		name,
		hasFedToday,
		hasWalkedToday,
		lastWeightAt,
		i18n.language,
		t,
		appActiveTick,
	]);

	const value = useMemo(() => ({ enabled, setEnabled }), [enabled, setEnabled]);
	return (
		<RemindersContext.Provider value={value}>
			{children}
		</RemindersContext.Provider>
	);
}

export function useReminders(): RemindersValue {
	const ctx = useContext(RemindersContext);
	if (!ctx) throw new Error("useReminders must be used within RemindersProvider");
	return ctx;
}
