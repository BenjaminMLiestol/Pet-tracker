import React, { useMemo } from "react";
import { View, Text, StyleSheet, Switch, FlatList } from "react-native";
import { usePet } from "../context/PetContext";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";

export default function WalkScreen() {
	const { t, i18n } = useTranslation();
	const { name, walks, hasWalkedToday, setWalkedToday, refresh, refreshing } =
		usePet();
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...walks].sort((a, b) => b.timestamp - a.timestamp),
		[walks],
	);

	const dtf = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
		{ dateStyle: "short", timeStyle: "short" },
	);

	return (
		<FlatList
			style={styles.screen}
			contentContainerStyle={styles.content}
			data={sorted}
			refreshing={isFocused && refreshing}
			onRefresh={refresh}
			keyExtractor={(item, index) =>
				String(item.id ?? `${item.timestamp}-${index}`)
			}
			ListHeaderComponent={
				<>
					<Text style={styles.title}>{t("walk_title")}</Text>

					<View style={styles.card}>
						<Text style={styles.row}>
							<Text style={styles.label}>{t("walked_today_label")}</Text>
						</Text>
						<View style={styles.switchRow}>
							<Text style={styles.nameText}>{name}</Text>
							<Switch value={hasWalkedToday} onValueChange={setWalkedToday} />
						</View>
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
					<Text
						style={[
							styles.badge,
							item.walked ? styles.badgeGood : styles.badgeBad,
						]}
					>
						{item.walked ? t("walked_label") : t("skipped_label")}
					</Text>
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
	// FlatList container
	screen: {
		flex: 1,
		backgroundColor: "#fff",
	},
	// Inner layout
	content: {
		padding: 16,
		alignItems: "stretch",
		justifyContent: "flex-start",
	},

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

	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
	},
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
	badge: {
		paddingHorizontal: 10,
		paddingVertical: 4,
		borderRadius: 999,
		overflow: "hidden",
		color: "white",
		fontWeight: "700",
		minWidth: 70,
		textAlign: "center",
	},
	badgeGood: { backgroundColor: "#10b981" },
	badgeBad: { backgroundColor: "#ef4444" },
	separator: { height: 1, backgroundColor: "#e5e7eb" },

	helperText: { color: "#6b7280", paddingVertical: 8 },
});
