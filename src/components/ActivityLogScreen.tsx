import React, { useMemo } from "react";
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	Pressable,
	Alert,
	Button,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet } from "../context/PetContext";

type Entry = { id: number; timestamp: number };

type Props = {
	title: string;
	todayLabel: string;
	logButtonLabel: string;
	entries: Entry[];
	countToday: number;
	onAdd: () => void;
	onRemove: (id: number) => void;
};

// Shared log screen for repeatable per-day activities (feedings, walks).
export default function ActivityLogScreen({
	title,
	todayLabel,
	logButtonLabel,
	entries,
	countToday,
	onAdd,
	onRemove,
}: Props) {
	const { t, i18n } = useTranslation();
	const { name, busy, refresh, refreshing } = usePet();
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...entries].sort((a, b) => b.timestamp - a.timestamp),
		[entries],
	);

	const dtf = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
		{ dateStyle: "short", timeStyle: "short" },
	);

	const confirmRemove = (id: number) =>
		Alert.alert(t("delete_entry_title"), t("delete_entry_message"), [
			{ text: t("cancel"), style: "cancel" },
			{ text: t("delete"), style: "destructive", onPress: () => onRemove(id) },
		]);

	return (
		<FlatList
			style={styles.screen}
			contentContainerStyle={styles.content}
			data={sorted}
			refreshing={isFocused && refreshing}
			onRefresh={refresh}
			keyExtractor={(item) => String(item.id)}
			ListHeaderComponent={
				<>
					<Text style={styles.title}>{title}</Text>

					<View style={styles.card}>
						<Text style={styles.row}>
							<Text style={styles.label}>{todayLabel}</Text>
						</Text>
						<View style={styles.summaryRow}>
							<Text style={styles.nameText}>
								{name}:{" "}
								{countToday > 0
									? t("times", { count: countToday })
									: t("not_yet_today")}
							</Text>
						</View>
						<Button title={logButtonLabel} onPress={onAdd} disabled={busy} />
					</View>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>{t("history")}</Text>
					</View>
				</>
			}
			renderItem={({ item }) => (
				<View style={styles.listRow}>
					<Text style={styles.listRowTitle}>
						{dtf.format(new Date(item.timestamp))}
					</Text>
					<Pressable
						onPress={() => confirmRemove(item.id)}
						disabled={busy}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel={t("delete")}
					>
						<Ionicons name="trash-outline" size={20} color="#ef4444" />
					</Pressable>
				</View>
			)}
			ItemSeparatorComponent={() => <View style={styles.separator} />}
			ListEmptyComponent={
				<Text style={styles.helperText}>{t("no_data_yet")}</Text>
			}
		/>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#fff" },
	content: { padding: 16, alignItems: "stretch", justifyContent: "flex-start" },

	title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },

	card: {
		backgroundColor: "#f9fafb",
		borderColor: "#e5e7eb",
		borderWidth: 1,
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
	row: { fontSize: 16, marginBottom: 8 },
	label: { color: "#374151", fontWeight: "600" },

	summaryRow: { marginBottom: 8 },
	nameText: { fontSize: 16, color: "#111827" },

	listRow: {
		backgroundColor: "#fff",
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 12,
		paddingHorizontal: 4,
	},
	listRowTitle: { color: "#111827" },
	separator: { height: 1, backgroundColor: "#e5e7eb" },

	helperText: { color: "#6b7280", paddingVertical: 8 },
});
