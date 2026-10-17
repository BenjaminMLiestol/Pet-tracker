import React, { useMemo } from "react";
import { Alert, StyleSheet, Switch, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useAuth } from "../context/AuthContext";
import { usePet } from "../context/PetContext";
import { useReminders } from "../context/RemindersContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import AppButton from "../components/AppButton";
import { Text } from "../components/themed";
import { Group, Row, Screen, Section, Surface } from "../components/ui";
import { space, type, useTheme, type Colors } from "../theme";

export default function ProfileScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { user, logout } = useAuth();
	const { name: petName, breed, currentWeightKg, lastBathAt, refresh, refreshing } = usePet();
	const isFocused = useIsFocused();
	const { enabled: remindersOn, setEnabled: setRemindersOn } = useReminders();

	const onToggleReminders = async (next: boolean) => {
		const ok = await setRemindersOn(next);
		if (!ok) Alert.alert(t("reminders"), t("reminders_permission_denied"));
	};

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
