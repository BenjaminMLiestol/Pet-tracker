import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";
import { averagePerDay, lastDaysCounts, totalOf, weekdayLabel, type DayCount } from "../utils/insights";
import { Text } from "./themed";
import { Surface } from "./ui";

const BAR_AREA = 56;
const MIN_BAR = 6;

// The last seven days at a glance: feedings and walks per day. Today is the full-strength
// bar; the days before it recede, and quiet days are a thin stub rather than nothing.
export default function WeekInsights() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { feedings, walks, timezone } = usePet();
	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";

	const rows = useMemo(() => {
		const now = Date.now();
		return [
			{
				key: "feedings",
				label: t("week_feedings"),
				counts: lastDaysCounts(
					feedings.filter((f) => f.fed).map((f) => f.timestamp),
					now,
					timezone,
				),
			},
			{
				key: "walks",
				label: t("week_walks"),
				counts: lastDaysCounts(
					walks.filter((w) => w.walked).map((w) => w.timestamp),
					now,
					timezone,
				),
			},
		];
	}, [feedings, walks, timezone, t]);

	return (
		<Surface style={styles.card}>
			{rows.map((row, i) => (
				<View key={row.key} style={[styles.block, i > 0 && styles.blockSpaced]}>
					<View style={styles.head}>
						<Text variant="headline">{row.label}</Text>
						<Text variant="sub" tone="muted" style={type.numeric}>
							{t("week_summary", {
								total: totalOf(row.counts),
								avg: new Intl.NumberFormat(locale).format(averagePerDay(row.counts)),
							})}
						</Text>
					</View>
					<Bars counts={row.counts} locale={locale} />
				</View>
			))}
		</Surface>
	);
}

function Bars({ counts, locale }: { counts: DayCount[]; locale: string }) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const max = Math.max(1, ...counts.map((d) => d.count));
	const last = counts.length - 1;

	return (
		<View style={styles.bars} accessibilityRole="image">
			{counts.map((d, i) => (
				<View key={d.day} style={styles.col}>
					<View style={styles.barArea}>
						<View
							style={[
								styles.bar,
								{
									height:
										d.count === 0
											? MIN_BAR
											: MIN_BAR + Math.round((d.count / max) * (BAR_AREA - MIN_BAR)),
								},
								d.count === 0 ? styles.barEmpty : i === last ? styles.barToday : styles.barPast,
							]}
						/>
					</View>
					<Text
						variant="caption"
						tone={i === last ? "default" : "muted"}
						style={i === last ? styles.dayToday : undefined}
					>
						{weekdayLabel(d.day, locale)}
					</Text>
				</View>
			))}
		</View>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		card: { padding: space[5] },
		block: {},
		blockSpaced: { marginTop: space[5] },
		head: {
			flexDirection: "row",
			alignItems: "baseline",
			justifyContent: "space-between",
			marginBottom: space[3],
		},
		bars: { flexDirection: "row", gap: space[2] },
		col: { flex: 1, alignItems: "center", gap: space[1] },
		barArea: { height: BAR_AREA, width: "100%", justifyContent: "flex-end", alignItems: "center" },
		bar: { width: "100%", maxWidth: 28, borderRadius: radius.sm - 4, ...smooth },
		barToday: { backgroundColor: c.accent },
		barPast: { backgroundColor: c.accent, opacity: 0.45 },
		barEmpty: { backgroundColor: c.border },
		dayToday: { fontWeight: "700" },
	});
