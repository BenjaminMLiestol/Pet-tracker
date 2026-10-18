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
import { useCare } from "./CareContext";
import { planCareReminders, type CareDue } from "../utils/careReminders";
import { planFoodReminders } from "../utils/food";
import { useMedicines } from "./MedicineContext";
import { planMedicineReminders } from "../utils/medicine";
import { reminderTimes, useAuth } from "./AuthContext";
import { isPartial, isSameCalendarDay, parseTime, planDailyReminders } from "../utils/reminders";

// Rebuilds of the reminder schedule wait for each other (see the effect below).
let schedulingQueue: Promise<void> = Promise.resolve();

const STORAGE_KEY = "app/reminders-enabled";
const CHANNEL_ID = "reminders";

// Feeding and walk times are the user's own setting (Profile). The weigh-in is fixed.
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
	const { token, user } = useAuth();
	const {
		name,
		hasFedToday,
		hasWalkedToday,
		feedingsToday,
		walksToday,
		feedingsPerDay,
		walksPerDay,
		food,
		weights,
		sync,
		timezone,
	} = usePet();
	const { records: care } = useCare();
	const { medicines, doses } = useMedicines();
	const { feeding: feedingTime, walk: walkTime } = reminderTimes(user);
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

	// When the app returns to the foreground: pull fresh data first (a co-owner may have fed
	// the dog, which should cancel today's reminder), and rebuild the schedule in case the
	// day rolled over while the app was in the background.
	useEffect(() => {
		const sub = AppState.addEventListener("change", (s) => {
			if (s !== "active") return;
			setAppActiveTick((n) => n + 1);
			sync();
		});
		return () => sub.remove();
	}, [sync]);

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
		// One rebuild at a time. Several changes arrive in a burst (the dog, its goals, the care
		// records and the bag all load one after another), and rebuilds that overlap each add
		// their own copies of every reminder.
		const run = async () => {
			if (cancelled) return; // superseded while waiting its turn
			await Notifications.cancelAllScheduledNotificationsAsync();
			if (!enabled || !token || !name || cancelled) return;
			if (!(await ensurePermission())) return;

			const now = new Date();
			const schedule = async (
				date: Date,
				title: string,
				body: string,
			): Promise<void> => {
				// A newer rebuild has taken over: stop adding to a schedule it is about to clear.
				if (cancelled || date.getTime() <= now.getTime()) return;
				await Notifications.scheduleNotificationAsync({
					content: { title, body },
					trigger: {
						type: Notifications.SchedulableTriggerInputTypes.DATE,
						date,
						channelId: CHANNEL_ID,
					},
				});
			};

			// Reminders only exist for what still needs doing: today's is skipped once logged.
			const planned = planDailyReminders({
				now,
				daysAhead: DAYS_AHEAD,
				feeding: parseTime(feedingTime, { hour: 18, minute: 0 }),
				walk: parseTime(walkTime, { hour: 19, minute: 0 }),
				fedToday: hasFedToday,
				walkedToday: hasWalkedToday,
			});
			for (const reminder of planned) {
				const feeding = reminder.kind === "feeding";
				const count = feeding ? feedingsToday : walksToday;
				const goal = feeding ? feedingsPerDay : walksPerDay;
				// Only today's reminder can say how far along the day is; later ones are rebuilt
				// when the app opens.
				const partial = isSameCalendarDay(reminder.at, now) && isPartial(count, goal);
				await schedule(
					reminder.at,
					t(feeding ? "reminder_feeding_title" : "reminder_walk_title"),
					partial
						? t(feeding ? "reminder_feeding_progress" : "reminder_walk_progress", { name, count, goal })
						: t(feeding ? "reminder_feeding_body" : "reminder_walk_body", { name }),
				);
			}

			// Vaccinations, vet visits and treatments: a week before and on the day they are due.
			const dueItems: CareDue[] = [
				...care.vet.map((r) => ({ kind: "vet" as const, label: r.name, date: r.date, nextDueAt: r.nextDueAt })),
				...care.vaccination.map((r) => ({
					kind: "vaccination" as const,
					label: r.name,
					date: r.date,
					nextDueAt: r.nextDueAt,
				})),
				...care.parasite.map((r) => ({
					kind: "parasite" as const,
					label: r.name,
					parasiteType: r.parasiteType,
					date: r.date,
					nextDueAt: r.nextDueAt,
				})),
			];
			for (const reminder of planCareReminders({ now, items: dueItems, timeZone: timezone })) {
				const what =
					reminder.kind === "parasite"
						? [t(`parasite_${reminder.parasiteType ?? "flea"}`), reminder.label].filter(Boolean).join(" ")
						: reminder.kind === "vet"
							? [t("care_section_vet"), reminder.label].filter(Boolean).join(": ")
							: reminder.label;
				await schedule(
					reminder.at,
					t(reminder.when === "soon" ? "reminder_care_soon_title" : "reminder_care_today_title"),
					t(reminder.when === "soon" ? "reminder_care_soon_body" : "reminder_care_today_body", { name, what }),
				);
			}

			// Medicine: 30 minutes after each slot, only for doses not ticked off yet.
			for (const r of planMedicineReminders({ now, medicines, doses, timeZone: timezone })) {
				await schedule(
					r.at,
					t("reminder_medicine_title"),
					t("reminder_medicine_body", {
						name,
						medicine: r.medicine.name,
						dose: r.medicine.dose ? ` (${r.medicine.dose})` : "",
						time: r.slot,
					}),
				);
			}

			// Dog food: a week before the bag runs out, and on the day.
			for (const reminder of planFoodReminders(food, now, timezone)) {
				await schedule(
					reminder.at,
					t(reminder.when === "soon" ? "reminder_food_soon_title" : "reminder_food_today_title"),
					t(reminder.when === "soon" ? "reminder_food_soon_body" : "reminder_food_today_body", { name }),
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
		};
		schedulingQueue = schedulingQueue
			.then(run)
			.catch((e) => console.warn("Failed to schedule reminders", e));
		return () => {
			cancelled = true;
		};
	}, [
		enabled,
		token,
		name,
		hasFedToday,
		hasWalkedToday,
		feedingsToday,
		walksToday,
		feedingsPerDay,
		walksPerDay,
		lastWeightAt,
		care,
		food,
		medicines,
		doses,
		timezone,
		feedingTime,
		walkTime,
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
