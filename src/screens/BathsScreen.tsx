import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { LayoutAnimationConfig } from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet } from "../context/PetContext";
import AppButton from "../components/AppButton";
import { Text } from "../components/themed";
import { Screen, Section, Surface } from "../components/ui";
import { useMotion } from "../motion";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";

const BAR_AREA = 120;

export default function BathsScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { baths, nextBathDueAt, isBathDue, bathOverdueDays, busy, setBathedToday, refresh, refreshing } =
		usePet();
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
									onPress={setBathedToday}
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
								{t("monthly_schedule_hint")}
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
