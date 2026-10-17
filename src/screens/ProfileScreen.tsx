import React, { useEffect, useMemo, useState } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { reminderTimes, useAuth } from "../context/AuthContext";
import { usePet } from "../context/PetContext";
import { useReminders } from "../context/RemindersContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import AppButton from "../components/AppButton";
import { Text } from "../components/themed";
import DateField from "../components/DateField";
import { useToast } from "../components/Toast";
import { Group, Row, Screen, Section, Stepper, Surface } from "../components/ui";
import { useMotion } from "../motion";
import { useDebouncedCommit } from "../hooks/useDebouncedCommit";
import { formatTime, parseTime, timeToDate } from "../utils/reminders";
import { space, type, useTheme, type Colors } from "../theme";

export default function ProfileScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { user, logout, updateReminderTimes } = useAuth();
	const {
		name: petName,
		breed,
		currentWeightKg,
		lastBathAt,
		bathIntervalDays,
		setBathInterval,
		refresh,
		refreshing,
	} = usePet();
	const toast = useToast();
	const m = useMotion();
	const isFocused = useIsFocused();
	const { enabled: remindersOn, setEnabled: setRemindersOn } = useReminders();

	const onToggleReminders = async (next: boolean) => {
		const ok = await setRemindersOn(next);
		if (!ok) Alert.alert(t("reminders"), t("reminders_permission_denied"));
	};

	// Settings save shortly after you stop adjusting them; the toast says how it went.
	const report = (ok: boolean) =>
		toast.show(ok ? t("saved") : t("settings_save_failed"), ok ? "success" : "error");

	// Days between baths (shared by everyone who owns the dog).
	const [days, setDays] = useState(bathIntervalDays);
	useEffect(() => setDays(bathIntervalDays), [bathIntervalDays]);
	const saveDays = useDebouncedCommit(async (next: number) => {
		if (next !== bathIntervalDays) report(await setBathInterval(next));
	});
	const onDays = (next: number) => {
		setDays(next);
		saveDays(next);
	};

	// Reminder times (personal). Held as "HH:MM" while editing.
	const saved = reminderTimes(user);
	const [feedingTime, setFeedingTime] = useState(saved.feeding);
	const [walkTime, setWalkTime] = useState(saved.walk);
	useEffect(() => setFeedingTime(saved.feeding), [saved.feeding]);
	useEffect(() => setWalkTime(saved.walk), [saved.walk]);
	const saveFeeding = useDebouncedCommit(async (next: string) => {
		if (next !== saved.feeding) report(await updateReminderTimes({ feeding_reminder_time: next }));
	});
	const saveWalk = useDebouncedCommit(async (next: string) => {
		if (next !== saved.walk) report(await updateReminderTimes({ walk_reminder_time: next }));
	});
	const pickTime = (kind: "feeding" | "walk") => (date: Date) => {
		const next = formatTime({ hour: date.getHours(), minute: date.getMinutes() });
		if (kind === "feeding") {
			setFeedingTime(next);
			saveFeeding(next);
		} else {
			setWalkTime(next);
			saveWalk(next);
		}
	};
	const asDate = (value: string, fallback: string) =>
		timeToDate(parseTime(value, parseTime(fallback, { hour: 18, minute: 0 })));

	const fullName = user ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim() : "";
	const weightText = currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : "—";
	const lastBathText = lastBathAt
		? new Intl.DateTimeFormat(i18n.language === "nb" ? "nb-NO" : "en-GB", {
				day: "numeric",
				month: "short",
				year: "numeric",
			}).format(lastBathAt)
		: "—";

	const value = (text: string) => (
		<Text variant="body" tone="muted" style={styles.value} numberOfLines={1}>
			{text}
		</Text>
	);

	return (
		<Screen title={t("profile_title")} refreshing={isFocused && refreshing} onRefresh={refresh}>
			<Section label={t("account")}>
				<Group>
					<Row title={t("name")} right={value(fullName || "—")} />
					<Row title={t("email")} right={value(user?.email ?? "—")} />
				</Group>
			</Section>

			<Section label={t("pet")}>
				<Group>
					<Row title={t("name")} right={value(petName || "—")} />
					<Row title={t("breed")} right={value(breed || "—")} />
					<Row title={t("current_weight_short")} right={value(weightText)} />
					<Row title={t("last_bath_short")} right={value(lastBathText)} />
				</Group>
			</Section>

			<Section label={t("grooming")}>
				<Group>
					<Row
						title={t("bath_every")}
						right={
							<Stepper
								value={days}
								min={1}
								max={365}
								onChange={onDays}
								format={(n) => t("days_count", { count: n })}
								decrementLabel={t("bath_interval_less")}
								incrementLabel={t("bath_interval_more")}
							/>
						}
					/>
				</Group>
				<Text variant="caption" tone="muted" style={styles.hint}>
					{t("bath_interval_hint")}
				</Text>
			</Section>

			<Section label={t("reminders")}>
				<Group>
					<Row
						title={t("reminders_enable")}
						right={
							<Switch
								value={remindersOn}
								onValueChange={onToggleReminders}
								accessibilityLabel={t("reminders_enable")}
							/>
						}
					/>
					{remindersOn && (
						<Animated.View entering={m.fadeIn} exiting={m.exitShort}>
							<DateField
								mode="time"
								label={t("reminder_feeding_time")}
								value={asDate(feedingTime, "18:00")}
								onChange={pickTime("feeding")}
							/>
						</Animated.View>
					)}
					{remindersOn && (
						<Animated.View entering={m.fadeIn} exiting={m.exitShort}>
							<DateField
								mode="time"
								label={t("reminder_walk_time")}
								value={asDate(walkTime, "19:00")}
								onChange={pickTime("walk")}
							/>
						</Animated.View>
					)}
				</Group>
				<Text variant="caption" tone="muted" style={styles.hint}>
					{t("reminders_hint")}
				</Text>
			</Section>

			<Section label={t("language")}>
				<Surface style={styles.language}>
					<LanguageSwitcher />
				</Surface>
			</Section>

			<View style={styles.logout}>
				<AppButton
					variant="secondary"
					title={t("logout")}
					icon="log-out-outline"
					color={c.danger}
					onPress={logout}
				/>
			</View>
		</Screen>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		value: { textAlign: "right", flexShrink: 1, ...type.numeric },
		hint: { marginTop: space[2], paddingHorizontal: space[1] },
		language: { padding: space[2] },
		logout: { marginTop: space[2] },
	});
