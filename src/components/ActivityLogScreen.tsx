import React, { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePet } from "../context/PetContext";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";
import { formatWhen } from "../utils/dates";
import { useFreshIds, useMotion } from "../motion";
import { Text } from "./themed";
import AppButton from "./AppButton";
import TickText from "./TickText";
import { useToast } from "./Toast";
import { Section, Surface } from "./ui";

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
	const { name, busy, refresh, refreshing, timezone } = usePet();
	const isFocused = useIsFocused();
	const toast = useToast();
	const insets = useSafeAreaInsets();

	const sorted = useMemo(
		() => [...entries].sort((a, b) => b.timestamp - a.timestamp),
		[entries],
	);

	// Only rows just added at the top may play an entrance (not scroll-ins or page loads).
	const ids = useMemo(() => sorted.map((e) => e.id), [sorted]);
	const fresh = useFreshIds(ids);
	const m = useMotion();

	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";
	const labels = { today: t("today"), yesterday: t("yesterday") };

	// Deletes happen straight away; the toast reports how it went.
	const remove = async (id: number) => {
		const ok = await onRemove(id);
		toast.show(ok ? t("entry_deleted") : t("delete_failed"), ok ? "success" : "error");
	};

	const last = sorted.length - 1;

	return (
		<Animated.FlatList
			style={styles.screen}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + space[4] }]}
			itemLayoutAnimation={m.layout}
			data={sorted}
			refreshing={isFocused && refreshing}
			onRefresh={refresh}
			onEndReached={onLoadMore}
			onEndReachedThreshold={0.5}
			ListFooterComponent={
				loadingMore ? <ActivityIndicator color={c.textMuted} style={styles.footer} /> : null
			}
			keyExtractor={(item) => String(item.id)}
			ListHeaderComponent={
				<>
					<Text variant="largeTitle" style={styles.title}>
						{title}
					</Text>

					{/* The count is the point of this page, so it is the biggest thing on it. */}
					<Surface style={styles.summary}>
						<TickText
							value={String(countToday)}
							style={[type.stat, countToday === 0 && { color: c.textMuted }]}
						/>
						<Text variant="sub" tone="muted" style={styles.summaryLabel}>
							{name ? `${name} · ${todayLabel}` : todayLabel}
						</Text>
						<AppButton title={logButtonLabel} onPress={onAdd} disabled={busy} icon="add" />
					</Surface>

					<Section label={t("history")} style={styles.sectionLabel}>
						{null}
					</Section>
				</>
			}
			renderItem={({ item, index }) => (
				<Animated.View
					style={[
						styles.row,
						index === 0 && styles.rowFirst,
						index === last && styles.rowLast,
					]}
					entering={fresh.has(item.id) ? m.rowEnter : undefined}
					exiting={m.exit}
				>
					<Text variant="body" style={type.numeric}>
						{formatWhen(item.timestamp, timezone, locale, labels)}
					</Text>
					<Pressable
						onPress={() => remove(item.id)}
						disabled={busy}
						hitSlop={12}
						style={styles.trash}
						accessibilityRole="button"
						accessibilityLabel={t("delete")}
					>
						<Ionicons name="trash-outline" size={20} color={c.textMuted} />
					</Pressable>
				</Animated.View>
			)}
			ItemSeparatorComponent={() => (
				<View style={styles.separatorWrap}>
					<View style={styles.separator} />
				</View>
			)}
			ListEmptyComponent={
				<Surface style={styles.empty}>
					<Text variant="sub" tone="muted">
						{t("no_data_yet")}
					</Text>
				</Surface>
			}
		/>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: c.bg },
		content: { paddingHorizontal: space[5], paddingBottom: space[8] },
		title: { marginBottom: space[5] },

		summary: { padding: space[5], gap: space[1], marginBottom: space[6] },
		summaryLabel: { marginBottom: space[4] },
		sectionLabel: { marginBottom: 0 },

		row: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 56,
			paddingLeft: space[4],
			paddingRight: space[1],
			backgroundColor: c.surface,
		},
		rowFirst: {
			borderTopLeftRadius: radius.lg,
			borderTopRightRadius: radius.lg,
			...smooth,
		},
		rowLast: {
			borderBottomLeftRadius: radius.lg,
			borderBottomRightRadius: radius.lg,
			...smooth,
		},
		trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
		separatorWrap: { backgroundColor: c.surface },
		separator: {
			height: StyleSheet.hairlineWidth,
			backgroundColor: c.border,
			marginLeft: space[4],
		},
		empty: { padding: space[5], alignItems: "center" },
		footer: { paddingVertical: space[4] },
	});
