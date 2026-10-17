import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet, type BathRecord } from "../context/PetContext";
import AppButton from "../components/AppButton";
import EntryTimeModal from "../components/EntryTimeModal";
import { Text } from "../components/themed";
import { useToast } from "../components/Toast";
import { Group, Screen, Section, Surface } from "../components/ui";
import { useFreshIds, useMotion } from "../motion";
import { formatDay } from "../utils/dates";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";

const BAR_AREA = 120;

export default function BathsScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const {
		baths,
		nextBathDueAt,
		isBathDue,
		bathOverdueDays,
		bathIntervalDays,
		busy,
		setBathedToday,
		updateBath,
		removeBath,
		refresh,
		refreshing,
		timezone,
	} = usePet();
	const toast = useToast();
	// The time sheet logs an earlier bath (editing === null) or moves one.
	const [sheet, setSheet] = useState<{ editing: BathRecord | null } | null>(null);
	const isFocused = useIsFocused();
	const m = useMotion();

	const sorted = useMemo(
		() => [...baths].sort((a, b) => b.timestamp - a.timestamp),
		[baths],
	);

	// Days between each bath and the one before it, newest first, last 8.
	const intervalsDays = useMemo(() => {
		const days: number[] = [];
		for (let i = 0; i < sorted.length - 1; i += 1) {
			const diffDays = Math.max(
				1,
				Math.round((sorted[i].timestamp - sorted[i + 1].timestamp) / (1000 * 60 * 60 * 24)),
			);
			days.push(diffDays);
		}
		return days.slice(0, 8);
	}, [sorted]);

	const rowIds = useMemo(() => sorted.map((b) => b.id), [sorted]);
	const fresh = useFreshIds(rowIds);
	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";
	const labels = { today: t("today"), yesterday: t("yesterday") };

	// Deletes happen straight away; the toast offers Undo, which logs the bath again.
	const remove = async (bath: BathRecord) => {
		const ok = await removeBath(bath.id);
		if (!ok) return toast.show(t("delete_failed"), "error");
		toast.show(t("entry_deleted"), "success", {
			label: t("entry_undo"),
			onPress: () => {
				setBathedToday(new Date(bath.timestamp));
			},
		});
	};
	const editing = sheet?.editing ?? null;

	const maxInterval = Math.max(1, ...intervalsDays);
	const df = new Intl.DateTimeFormat(i18n.language === "nb" ? "nb-NO" : "en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
	});
	const nextBathText = nextBathDueAt ? df.format(nextBathDueAt) : t("not_recorded");

	return (
		<Screen title={t("baths_title")} refreshing={isFocused && refreshing} onRefresh={refresh}>
			{/* Marking a bath done swaps the button for a hint: cross-fade it instead of
			    snapping, and let the card settle. skipEntering keeps the first open still. */}
			<Animated.View layout={m.layout} style={styles.statusWrap}>
				<Surface style={styles.status}>
					<LayoutAnimationConfig skipEntering>
						<Text variant="sub" tone="muted">
							{t("next_schedule")}
						</Text>
						<Text variant="largeTitle" style={styles.date}>
							{nextBathText}
						</Text>
						{bathOverdueDays > 0 && (
							<Animated.Text
								style={styles.overdue}
								entering={m.fadeIn}
								exiting={m.exit}
							>
								{t("bath_overdue", { count: bathOverdueDays })}
							</Animated.Text>
						)}
						{isBathDue ? (
							<Animated.View
								key="mark"
								style={styles.action}
								entering={m.fadeIn}
								exiting={m.exit}
							>
								<AppButton
									title={t("mark_bathed_today")}
									onPress={() => setBathedToday()}
									disabled={busy}
									icon="water"
								/>
							</Animated.View>
						) : (
							<Animated.Text
								key="hint"
								style={styles.hint}
								entering={m.fadeIn}
								exiting={m.exit}
							>
								{t("bath_schedule_hint", { count: bathIntervalDays })}
							</Animated.Text>
						)}
					</LayoutAnimationConfig>
				</Surface>
			</Animated.View>

			<Section label={t("history_days_between_baths")}>
				<Surface style={styles.chart}>
					{intervalsDays.length === 0 ? (
						<Text variant="sub" tone="muted">
							{t("not_enough_data")}
						</Text>
					) : (
						<View style={styles.bars}>
							{intervalsDays.map((d, idx) => (
								<View key={`${d}-${idx}`} style={styles.barCol}>
									<View
										style={[
											styles.bar,
											{
												height: 16 + Math.round((d / maxInterval) * (BAR_AREA - 16)),
												// The latest interval is the one that matters; older ones recede.
												opacity: idx === 0 ? 1 : 0.45,
											},
										]}
									/>
									<Text variant="caption" tone="muted" style={type.numeric}>
										{d}
									</Text>
								</View>
							))}
						</View>
					)}
				</Surface>
			</Section>

			<Section
				label={t("history")}
				right={
					<Pressable
						onPress={() => setSheet({ editing: null })}
						disabled={busy}
						hitSlop={8}
						style={[styles.add, busy && styles.disabled]}
						accessibilityRole="button"
						accessibilityLabel={t("log_earlier")}
					>
						<Ionicons name="add" size={20} color={c.text} />
					</Pressable>
				}
			>
				{sorted.length === 0 ? (
					<Surface style={styles.empty}>
						<Text variant="sub" tone="muted">
							{t("no_data_yet")}
						</Text>
					</Surface>
				) : (
					<Group>
						{sorted.map((b) => (
							<Animated.View
								key={b.id}
								style={styles.historyRow}
								entering={fresh.has(b.id) ? m.rowEnter : undefined}
								exiting={m.exit}
								layout={m.layout}
							>
								<Pressable
									onPress={() => setSheet({ editing: b })}
									disabled={busy}
									style={styles.when}
									accessibilityRole="button"
									accessibilityLabel={t("entry_edit_title")}
								>
									<Text variant="body" style={type.numeric}>
										{formatDay(b.timestamp, timezone, locale, labels)}
									</Text>
								</Pressable>
								<Pressable
									onPress={() => remove(b)}
									disabled={busy}
									hitSlop={8}
									style={styles.trash}
									accessibilityRole="button"
									accessibilityLabel={t("delete")}
								>
									<Ionicons name="trash-outline" size={20} color={c.textMuted} />
								</Pressable>
							</Animated.View>
						))}
					</Group>
				)}
			</Section>

			<EntryTimeModal
				visible={sheet !== null}
				title={editing ? t("entry_edit_title") : t("log_earlier")}
				initial={editing ? new Date(editing.timestamp) : new Date()}
				onClose={() => setSheet(null)}
				onSave={(at) => (editing ? updateBath(editing.id, at) : setBathedToday(at))}
			/>
		</Screen>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		statusWrap: { marginBottom: space[6] },
		status: { padding: space[5], gap: space[1] },
		date: { marginTop: space[1] },
		overdue: { color: c.danger, fontSize: 15, lineHeight: 20, fontWeight: "600", marginTop: space[1] },
		hint: { color: c.textMuted, fontSize: 15, lineHeight: 20, marginTop: space[1] },
		action: { marginTop: space[4] },
		chart: { padding: space[5] },
		add: {
			width: 32,
			height: 32,
			borderRadius: 16,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: c.surface,
		},
		disabled: { opacity: 0.4 },
		empty: { padding: space[5], alignItems: "center" },
		historyRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 52,
			paddingLeft: space[4],
			paddingRight: space[1],
			backgroundColor: c.surface,
		},
		when: { flex: 1, minHeight: 52, justifyContent: "center" },
		trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
		bars: {
			flexDirection: "row",
			alignItems: "flex-end",
			justifyContent: "space-between",
			gap: space[2],
			height: BAR_AREA + 24,
		},
		barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end", gap: space[2] },
		bar: {
			width: "100%",
			maxWidth: 32,
			backgroundColor: c.accent,
			borderRadius: radius.sm - 4,
			...smooth,
		},
	});
