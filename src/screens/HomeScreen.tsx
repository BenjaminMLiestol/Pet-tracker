import React from "react";
import {
	View,
	Text,
	StyleSheet,
	Image,
	ScrollView,
	RefreshControl,
} from "react-native";
import { usePet } from "../context/PetContext";
import { useAuth } from "../context/AuthContext";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";

export default function HomeScreen() {
	const { t, i18n } = useTranslation();
	const isFocused = useIsFocused();
	const DOG_IMG = require("../../assets/dog.png");

	const {
		hasFedToday,
		hasWalkedToday,
		lastBathAt,
		currentWeightKg,
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
		? `${df.format(lastBathAt)} (${formatRelativeDays(lastBathAt, t, i18n.language)})`
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
					{hasFedToday ? t("yes") : t("no")}
				</Text>
				<Text style={styles.row}>
					<Text style={styles.label}>{t("walked")}: </Text>
					{hasWalkedToday ? t("yes") : t("no")}
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
	t: (k: string, o?: any) => string,
	lang: string,
): string {
	const msPerDay = 1000 * 60 * 60 * 24;
	const diff = Date.now() - date.getTime();
	const days = Math.floor(diff / msPerDay);
	if (days === 0) return t("today");
	if (days === 1)
		return lang.startsWith("nb") ? "for 1 dag siden" : "1 day ago";
	return lang.startsWith("nb") ? `for ${days} dager siden` : `${days} days ago`;
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

	title: {
		fontSize: 24,
		fontWeight: "600",
		marginBottom: 16,
	},
	card: {
		backgroundColor: "#f9fafb",
		borderColor: "#e5e7eb",
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
		color: "#374151",
		fontWeight: "600",
	},

	/* --- Image styles --- */
	heroImageWrap: {
		marginTop: 12,
		borderRadius: 16,
		overflow: "hidden",
		backgroundColor: "#f3f4f6",
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
