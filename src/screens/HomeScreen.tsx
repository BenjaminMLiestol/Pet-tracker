import React from "react";
import { View, StyleSheet, Image, ScrollView, RefreshControl } from "react-native";
import { daysBetween } from "../utils/dates";
import { usePet } from "../context/PetContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";

export default function HomeScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const isFocused = useIsFocused();
	const DOG_IMG = require("../../assets/dog.png");

	const {
		feedingsToday,
		walksToday,
		lastBathAt,
		currentWeightKg,
		timezone,
		refresh,
		refreshing,
	} = usePet();
	const { user } = useAuth();

	// Use user's name (fallback to email or a friendly label)
	const displayName =
		user?.first_name || user?.last_name
			? `${user?.first_name ?? ""}`.trim()
			: (user?.email ?? t("friend"));

	const df = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
	);
	const lastBathText = lastBathAt
		? `${df.format(lastBathAt)} (${formatRelativeDays(lastBathAt, timezone, t)})`
		: t("not_recorded");

	const weightText =
		currentWeightKg != null
			? `${currentWeightKg.toFixed(1)} kg`
			: t("not_recorded");

	const { width: imgW, height: imgH } = Image.resolveAssetSource(DOG_IMG);
	const aspectRatio = imgW && imgH ? imgW / imgH : 16 / 9;

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
			<Text style={styles.title}>{t("greeting", { name: displayName })}</Text>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("today")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("fed")}: </Text>
					{feedingsToday > 0 ? t("times", { count: feedingsToday }) : t("no")}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("walked")}: </Text>
					{walksToday > 0 ? t("times", { count: walksToday }) : t("no")}
				</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("grooming")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("last_bath")}: </Text>
					{lastBathText}
				</Text>
			</View>

			<View style={styles.card}>
				<Text style={styles.cardTitle}>{t("health")}</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("current_weight")}: </Text>
					{weightText}
				</Text>
			</View>

			<View style={styles.heroImageWrap}>
				<Image
					source={DOG_IMG}
					style={[styles.heroImage, { aspectRatio }]}
					resizeMode="cover"
					accessible
					accessibilityLabel={t("dog_image_alt", { defaultValue: "Dog" })}
				/>
			</View>
		</ScrollView>
	);
}

function formatRelativeDays(
	date: Date,
	timezone: string,
	t: (k: string, o?: any) => string,
): string {
	const days = daysBetween(date.getTime(), Date.now(), timezone);
	if (days <= 0) return t("today");
	return t("days_ago", { count: days });
}

const makeStyles = (c: Colors) => StyleSheet.create({
	// ScrollView container
	screen: {
		flex: 1,
		backgroundColor: c.bg,
	},
	// Inner layout for ScrollView
	content: {
		padding: 16,
		alignItems: "stretch",
		justifyContent: "flex-start",
	},

	title: {
		fontSize: 24,
		fontWeight: "600",
		marginBottom: 16,
	},
	card: {
		backgroundColor: c.surface,
		borderColor: c.border,
		borderWidth: 1,
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	cardTitle: {
		fontSize: 16,
		fontWeight: "700",
		marginBottom: 8,
	},
	row: {
		fontSize: 16,
		marginBottom: 4,
	},
	label: {
		color: c.textSecondary,
		fontWeight: "600",
	},

	/* --- Image styles --- */
	heroImageWrap: {
		marginTop: 12,
		borderRadius: 16,
		overflow: "hidden",
		backgroundColor: c.surfaceAlt,
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 3,
	},
	heroImage: {
		width: "100%",
		height: undefined, // height derived from aspectRatio
		minHeight: 160,
		maxHeight: 300,
	},
});
