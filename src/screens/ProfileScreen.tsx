import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { reminderTimes, useAuth } from "../context/AuthContext";
import { useBiometricInfo } from "../api/faceLogin";
import PasswordConfirmModal from "../components/PasswordConfirmModal";
import { usePet } from "../context/PetContext";
import { useReminders } from "../context/RemindersContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import AppButton from "../components/AppButton";
import { Text } from "../components/themed";
import DateField from "../components/DateField";
import DogManagerModal from "../components/DogManagerModal";
import InviteModal from "../components/InviteModal";
import { removeOwner } from "../api/sharing";
import { useToast } from "../components/Toast";
import { Group, PressRow, Row, Screen, Section, Stepper, Surface } from "../components/ui";
import { useMotion } from "../motion";
import { useDebouncedCommit } from "../hooks/useDebouncedCommit";
import { useExport } from "../hooks/useExport";
import { formatTime, parseTime, timeToDate } from "../utils/reminders";
import { space, type, useTheme, type Colors } from "../theme";

export default function ProfileScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const {
		user,
		logout,
		logoutEverywhere,
		updateSettings,
		faceLoginEmail,
		enableFaceLogin,
		disableFaceLogin,
	} = useAuth();
	const {
		name: petName,
		breed,
		currentWeightKg,
		lastBathAt,
		bathIntervalDays,
		setBathInterval,
		petId,
		pets,
		owners,
		leavePet,
		reloadPets,
		refresh,
		refreshing,
	} = usePet();
	const [dogsOpen, setDogsOpen] = useState(false);
	const [inviteOpen, setInviteOpen] = useState(false);
	const toast = useToast();
	const m = useMotion();
	const isFocused = useIsFocused();
	const { enabled: remindersOn, setEnabled: setRemindersOn } = useReminders();
	const { busy: exporting, exportPdf, exportCsv } = useExport();
	const exportAs = async (run: () => Promise<boolean>) => {
		if (!(await run())) toast.show(t("export_failed"), "error");
	};
	const bio = useBiometricInfo();
	const [faceSetupOpen, setFaceSetupOpen] = useState(false);
	const methodName = bio.kind === "touch" ? "Touch ID" : bio.kind === "face" ? "Face ID" : t("face_setting_other");

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
		if (next !== saved.feeding) report(await updateSettings({ feeding_reminder_time: next }));
	});
	const saveWalk = useDebouncedCommit(async (next: string) => {
		if (next !== saved.walk) report(await updateSettings({ walk_reminder_time: next }));
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

	// Removing a co-owner or leaving is a big step: ask first (unlike deleting a log entry).
	const ownerName = (o: { first_name: string; last_name: string }) =>
		`${o.first_name} ${o.last_name}`.trim();
	const confirmRemove = (o: { id: number; first_name: string; last_name: string }) =>
		Alert.alert(
			t("owner_remove_title", { name: ownerName(o) }),
			t("owner_remove_message", { name: ownerName(o), dog: petName }),
			[
				{ text: t("cancel"), style: "cancel" },
				{
					text: t("owner_remove"),
					style: "destructive",
					onPress: async () => {
						try {
							if (petId != null) await removeOwner(petId, o.id);
							await reloadPets();
							toast.show(t("saved"));
						} catch {
							toast.show(t("owner_action_failed"), "error");
						}
					},
				},
			],
		);
	const confirmLeave = () =>
		Alert.alert(t("owner_leave_title", { dog: petName }), t("owner_leave_message"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("owner_leave"),
				style: "destructive",
				onPress: async () => {
					try {
						if (petId != null) await leavePet(petId);
					} catch {
						toast.show(t("owner_action_failed"), "error");
					}
				},
			},
		]);

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

			<Section label={t("dogs_title")}>
				<Group>
					<PressRow
						title={t("dogs_switch")}
						right={
							<View style={styles.dogsRight}>
								<Text variant="body" tone="muted" numberOfLines={1} style={styles.dogsCurrent}>
									{pets.length > 1 ? `${petName} · ${pets.length}` : petName}
								</Text>
								<Ionicons name="chevron-forward" size={18} color={c.textMuted} />
							</View>
						}
						onPress={() => setDogsOpen(true)}
					/>
				</Group>
			</Section>

			<Section label={t("owners_title")}>
				<Group>
					{owners.map((o) => (
						<Row
							key={o.id}
							title={ownerName(o)}
							detail={o.id === user?.id ? t("owner_you") : undefined}
							right={
								o.id !== user?.id ? (
									<Pressable
										onPress={() => confirmRemove(o)}
										hitSlop={10}
										accessibilityRole="button"
										accessibilityLabel={`${t("owner_remove")} ${ownerName(o)}`}
									>
										<Text variant="sub" tone="muted">
											{t("owner_remove")}
										</Text>
									</Pressable>
								) : undefined
							}
						/>
					))}
					<PressRow
						title={t("invite_title")}
						right={<Ionicons name="person-add-outline" size={20} color={c.text} />}
						onPress={() => setInviteOpen(true)}
					/>
					{owners.length > 1 && (
						<PressRow title={t("owner_leave")} titleColor={c.danger} onPress={confirmLeave} />
					)}
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
					{owners.length > 1 && (
						<Row
							title={t("notify_co_owners")}
							right={
								<Switch
									value={user?.notify_co_owners ?? true}
									onValueChange={async (next) =>
										report(await updateSettings({ notify_co_owners: next }))
									}
									accessibilityLabel={t("notify_co_owners")}
								/>
							}
						/>
					)}
				</Group>
				<Text variant="caption" tone="muted" style={styles.hint}>
					{t("reminders_hint")}
				</Text>
			</Section>

			<Section label={t("export_section")}>
				<Group>
					<PressRow
						title={t("export_pdf")}
						right={
							exporting === "pdf" ? (
								<ActivityIndicator color={c.textMuted} />
							) : (
								<Ionicons name="document-text-outline" size={20} color={c.text} />
							)
						}
						onPress={() => !exporting && exportAs(exportPdf)}
					/>
					<PressRow
						title={t("export_csv")}
						right={
							exporting === "csv" ? (
								<ActivityIndicator color={c.textMuted} />
							) : (
								<Ionicons name="grid-outline" size={20} color={c.text} />
							)
						}
						onPress={() => !exporting && exportAs(exportCsv)}
					/>
				</Group>
				<Text variant="caption" tone="muted" style={styles.hint}>
					{t("export_hint")}
				</Text>
			</Section>

			{bio.available && (
				<Section label={t("face_section")}>
					<Group>
						<Row
							title={t(`face_setting_${bio.kind}`)}
							right={
								<Switch
									value={faceLoginEmail !== null}
									onValueChange={(next) => {
										if (next) setFaceSetupOpen(true);
										else disableFaceLogin();
									}}
									accessibilityLabel={t(`face_setting_${bio.kind}`)}
								/>
							}
						/>
					</Group>
					<Text variant="caption" tone="muted" style={styles.hint}>
						{t("face_hint")}
					</Text>
				</Section>
			)}

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
				<AppButton
					variant="ghost"
					title={t("logout_all")}
					color={c.danger}
					onPress={() =>
						Alert.alert(t("logout_all_title"), t("logout_all_body"), [
							{ text: t("cancel"), style: "cancel" },
							{
								text: t("logout_all"),
								style: "destructive",
								onPress: async () => {
									if (!(await logoutEverywhere())) toast.show(t("logout_all_failed"), "error");
								},
							},
						])
					}
				/>
			</View>
			<PasswordConfirmModal
				visible={faceSetupOpen}
				title={t("face_setup_title")}
				body={t("face_setup_body", { method: methodName })}
				submitLabel={t("face_setup_submit")}
				onClose={() => setFaceSetupOpen(false)}
				onSubmit={enableFaceLogin}
			/>
			<DogManagerModal visible={dogsOpen} onClose={() => setDogsOpen(false)} />
			<InviteModal visible={inviteOpen} onClose={() => setInviteOpen(false)} />
		</Screen>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		value: { textAlign: "right", flexShrink: 1, ...type.numeric },
		dogsRight: { flexDirection: "row", alignItems: "center", gap: space[2], flexShrink: 1 },
		dogsCurrent: { flexShrink: 1 },
		hint: { marginTop: space[2], paddingHorizontal: space[1] },
		language: { padding: space[2] },
		logout: { marginTop: space[2] },
	});
