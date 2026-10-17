import React from "react";
import { View, StyleSheet, ScrollView, Switch, Alert, RefreshControl } from "react-native";
import { useAuth } from "../context/AuthContext";
import { usePet } from "../context/PetContext";
import { useReminders } from "../context/RemindersContext";
import LanguageSwitcher from "../components/LanguageSwitcher";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";

export default function ProfileScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { user } = useAuth();
	const {
		name: petName,
		breed,
		currentWeightKg,
		lastBathAt,
		refresh,
		refreshing,
	} = usePet();
	const isFocused = useIsFocused();
	const { enabled: remindersOn, setEnabled: setRemindersOn } = useReminders();

	const onToggleReminders = async (next: boolean) => {
		const ok = await setRemindersOn(next);
		if (!ok) Alert.alert(t("reminders"), t("reminders_permission_denied"));
	};

	const fullName = user
		? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
		: "";
	const weightText =
		currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : "—";

	const formatter = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
	);
	const lastBathText = lastBathAt ? formatter.format(lastBathAt) : "—";

	return (
		<ScrollView
			style={styles.screen}
			contentContainerStyle={styles.content}
			refreshControl={
				<RefreshControl
					refreshing={isFocused && refreshing}
					onRefresh={refresh}
				/>
			}
			alwaysBounceVertical
		>
			<Text style={styles.title}>{t("profile_title")}</Text>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("account")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("name")}: </Text>
					{fullName || "—"}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("email")}: </Text>
					{user?.email ?? "—"}
				</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("pet")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("name")}: </Text>
					{petName || "—"}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("breed")}: </Text>
					{breed || "—"}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("current_weight_short")}: </Text>
					{weightText}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("last_bath_short")}: </Text>
					{lastBathText}
				</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("reminders")}</Text>
				<View style={styles.switchRow}>
					<Text style={styles.switchLabel}>{t("reminders_enable")}</Text>
					<Switch value={remindersOn} onValueChange={onToggleReminders} />
				</View>
				<Text style={styles.hint}>{t("reminders_hint")}</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("language")}</Text>
				<LanguageSwitcher />
			</View>
		</ScrollView>
	);
}

const makeStyles = (c: Colors) => StyleSheet.create({
	screen: { flex: 1, backgroundColor: c.bg },
	content: { padding: 16, alignItems: "stretch", justifyContent: "flex-start" },

	title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
	card: {
		backgroundColor: c.surface,
		borderColor: c.border,
		borderWidth: 1,
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
	row: { fontSize: 16, marginBottom: 6 },
	label: { color: c.textSecondary, fontWeight: "600" },
	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
	switchLabel: { fontSize: 16, flex: 1, marginRight: 12 },
	hint: { color: c.textMuted, marginTop: 8 },
});
