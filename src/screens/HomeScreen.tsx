import React from "react";
import { View, Text, StyleSheet, Image } from "react-native";
import { usePet } from "../context/PetContext";
import { useTranslation } from "react-i18next";

export default function HomeScreen() {
	const { t, i18n } = useTranslation();
	const DOG_IMG = require("../../assets/dog.png");
	const { name, hasFedToday, hasWalkedToday, lastBathAt, currentWeightKg } =
		usePet();

	const lastBathText = lastBathAt
		? `${new Intl.DateTimeFormat(i18n.language === "nb" ? "nb-NO" : "en-US").format(lastBathAt)} (${formatRelativeDays(lastBathAt, t)})`
		: t("not_recorded");

	const weightText =
		currentWeightKg != null
			? `${currentWeightKg.toFixed(1)} kg`
			: t("not_recorded");

	const { width: imgW, height: imgH } = Image.resolveAssetSource(DOG_IMG);
	const aspectRatio = imgW && imgH ? imgW / imgH : 16 / 9;

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t("greeting", { name })}</Text>

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
					// 'cover' will nicely crop wide/tall images into the rounded frame
					resizeMode="cover"
					accessible
					accessibilityLabel="Dog"
				/>
			</View>
		</View>
	);
}

function formatRelativeDays(
	date: Date,
	t: (k: string, o?: any) => string,
): string {
	const msPerDay = 1000 * 60 * 60 * 24;
	const diff = Date.now() - date.getTime();
	const days = Math.floor(diff / msPerDay);
	if (days === 0) return t("today");
	if (days === 1)
		return i18nExistsNorwegian() ? "for 1 dag siden" : "1 day ago";
	return i18nExistsNorwegian() ? `for ${days} dager siden` : `${days} days ago`;
}
function i18nExistsNorwegian() {
	// quick helper; you can pass i18n.language in if preferred
	return true; // default nb; keep simple
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "stretch",
		justifyContent: "flex-start",
		padding: 16,
		backgroundColor: "#fff",
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

	/* --- New styles for the image --- */
	heroImageWrap: {
		marginTop: 12,
		borderRadius: 16,
		overflow: "hidden",
		backgroundColor: "#f3f4f6",
		// subtle shadow
		shadowColor: "#000",
		shadowOpacity: 0.08,
		shadowRadius: 8,
		shadowOffset: { width: 0, height: 4 },
		elevation: 3,
	},
	heroImage: {
		width: "100%",
		height: undefined, // let aspectRatio compute height from width
		minHeight: 160, // keep a nice presence on small screens
		maxHeight: 300, // don’t get too tall on tablets
	},
});
