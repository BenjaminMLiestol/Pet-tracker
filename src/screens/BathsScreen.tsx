import React, { useMemo } from "react";
import {
	View,
	Text,
	StyleSheet,
	Button,
	ScrollView,
	RefreshControl,
} from "react-native";
import { usePet } from "../context/PetContext";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";

export default function BathsScreen() {
	const { t, i18n } = useTranslation();
	const {
		baths,
		nextBathDueAt,
		isBathDueToday,
		setBathedToday,
		refresh,
		refreshing,
	} = usePet();
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...baths].sort((a, b) => b.timestamp - a.timestamp),
		[baths],
	);

	const intervalsDays = useMemo(() => {
		const days: number[] = [];
		for (let i = 0; i < sorted.length - 1; i += 1) {
			const a = sorted[i].timestamp;
			const b = sorted[i + 1].timestamp;
			const diffDays = Math.max(1, Math.round((a - b) / (1000 * 60 * 60 * 24)));
			days.push(diffDays);
		}
		return days.slice(0, 8);
	}, [sorted]);

	const maxInterval = Math.max(1, ...intervalsDays);
	const df = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
	);
	const nextBathText = nextBathDueAt
		? df.format(nextBathDueAt)
		: t("not_recorded");

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
			<Text style={styles.title}>{t("baths_title")}</Text>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("next_schedule")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("due")}: </Text>
					{nextBathText}
				</Text>
				{isBathDueToday ? (
					<Button title={t("mark_bathed_today")} onPress={setBathedToday} />
				) : (
					<Text style={styles.helperText}>{t("monthly_schedule_hint")}</Text>
				)}
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("history_days_between_baths")}</Text>
				<View style={styles.chartContainer}>
					<View style={styles.chartBars}>
						{intervalsDays.length === 0 ? (
							<Text style={styles.helperText}>{t("not_enough_data")}</Text>
						) : (
							intervalsDays.map((d, idx) => {
								const height = 16 + Math.round((d / maxInterval) * 84);
								return (
									<View key={`${d}-${idx}`} style={styles.barWrapper}>
										<View style={[styles.bar, { height }]} />
										<Text style={styles.barLabel}>{d}</Text>
									</View>
								);
							})
						)}
					</View>
				</View>
			</View>
		</ScrollView>
	);
}

const styles = StyleSheet.create({
	// ScrollView container
	screen: {
		flex: 1,
		backgroundColor: "#fff",
	},
	// Inner layout for ScrollView
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
	helperText: { color: "#6b7280", marginTop: 8 },
	chartContainer: { height: 120 },
	chartBars: { flex: 1, flexDirection: "row", alignItems: "flex-end" },
	barWrapper: { width: 28, alignItems: "center", marginRight: 8 },
	bar: { width: 20, backgroundColor: "#60a5fa", borderRadius: 6 },
	barLabel: { marginTop: 6, fontSize: 12, color: "#111827" },
});
