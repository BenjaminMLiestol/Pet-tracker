import React, { useMemo } from "react";
import { View, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet } from "../context/PetContext";
import { useTheme, type Colors } from "../theme";
import { Text } from "./themed";
import AppButton from "./AppButton";
import TickText from "./TickText";
import { useToast } from "./Toast";
import { useFreshIds, useMotion } from "../motion";

type Entry = { id: number; timestamp: number };

type Props = {
	title: string;
	todayLabel: string;
	logButtonLabel: string;
	entries: Entry[];
	countToday: number;
	onAdd: () => void;
	onRemove: (id: number) => Promise<boolean>;
	// Infinite scroll: called near the end of the list
	onLoadMore: () => void;
	loadingMore: boolean;
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
	onLoadMore,
	loadingMore,
}: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { name, busy, refresh, refreshing } = usePet();
	const isFocused = useIsFocused();
	const toast = useToast();

	const sorted = useMemo(
		() => [...entries].sort((a, b) => b.timestamp - a.timestamp),
		[entries],
	);

	// Only rows just added at the top may play an entrance (not scroll-ins or page loads).
	const ids = useMemo(() => sorted.map((e) => e.id), [sorted]);
	const fresh = useFreshIds(ids);
	const m = useMotion();

	const countLabel =
		countToday > 0 ? t("times", { count: countToday }) : t("not_yet_today");

	const dtf = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
		{ dateStyle: "short", timeStyle: "short" },
	);

	// Deletes happen straight away; the toast reports how it went.
	const remove = async (id: number) => {
		const ok = await onRemove(id);
		toast.show(ok ? t("entry_deleted") : t("delete_failed"), ok ? "success" : "error");
	};

	return (
		<Animated.FlatList
			style={styles.screen}
			itemLayoutAnimation={m.layout}
			contentContainerStyle={styles.content}
			data={sorted}
			refreshing={isFocused && refreshing}
			onRefresh={refresh}
			onEndReached={onLoadMore}
			onEndReachedThreshold={0.5}
			ListFooterComponent={
				loadingMore ? <ActivityIndicator style={styles.footer} /> : null
			}
			keyExtractor={(item) => String(item.id)}
			ListHeaderComponent={
				<>
					<Text style={styles.title}>{title}</Text>

					<View style={styles.card}>
						<Text style={styles.row}>
							<Text style={styles.label}>{todayLabel}</Text>
						</Text>
						<View style={styles.summaryRow}>
							<View style={styles.countRow}>
								<Text style={styles.nameText}>{name}: </Text>
								<TickText style={styles.nameText} value={countLabel} />
							</View>
						</View>
						<AppButton title={logButtonLabel} onPress={onAdd} disabled={busy} />
					</View>

					<View style={styles.card}>
						<Text style={styles.cardTitle}>{t("history")}</Text>
					</View>
				</>
			}
			renderItem={({ item }) => (
				<Animated.View
					style={styles.listRow}
					entering={fresh.has(item.id) ? m.rowEnter : undefined}
					exiting={m.exit}
				>
					<Text style={styles.listRowTitle}>
						{dtf.format(new Date(item.timestamp))}
					</Text>
					<Pressable
						onPress={() => remove(item.id)}
						disabled={busy}
						hitSlop={8}
						accessibilityRole="button"
						accessibilityLabel={t("delete")}
					>
						<Ionicons name="trash-outline" size={20} color={c.danger} />
					</Pressable>
				</Animated.View>
			)}
			ItemSeparatorComponent={() => <View style={styles.separator} />}
			ListEmptyComponent={
				<Text style={styles.helperText}>{t("no_data_yet")}</Text>
			}
		/>
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
	row: { fontSize: 16, marginBottom: 8 },
	label: { color: c.textSecondary, fontWeight: "600" },

	summaryRow: { marginBottom: 8 },
	countRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline" },
	nameText: { fontSize: 16, color: c.text },

	listRow: {
		backgroundColor: c.bg,
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		paddingVertical: 12,
		paddingHorizontal: 4,
	},
	listRowTitle: { color: c.text },
	separator: { height: 1, backgroundColor: c.border },

	footer: { paddingVertical: 16 },
	helperText: { color: c.textMuted, paddingVertical: 8 },
});
