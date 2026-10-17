import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { daysBetween } from "../utils/dates";
import { usePet } from "../context/PetContext";
import { useAuth } from "../context/AuthContext";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";
import { Group, PressScale, Row, Screen, Section, Surface } from "../components/ui";

const DOG_IMG = require("../../assets/dog.png");

export default function HomeScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const isFocused = useIsFocused();
	const navigation = useNavigation<any>();
	const { user } = useAuth();
	const {
		name,
		breed,
		feedingsToday,
		walksToday,
		lastBathAt,
		currentWeightKg,
		timezone,
		refresh,
		refreshing,
	} = usePet();

	const displayName = user?.first_name?.trim() || user?.email || t("friend");

	const df = new Intl.DateTimeFormat(i18n.language === "nb" ? "nb-NO" : "en-US", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	const bathAgo = lastBathAt ? daysBetween(lastBathAt.getTime(), Date.now(), timezone) : null;
	const bathAgoText =
		bathAgo == null ? null : bathAgo <= 0 ? t("today") : t("days_ago", { count: bathAgo });

	return (
		<Screen
			title={t("greeting", { name: displayName })}
			refreshing={isFocused && refreshing}
			onRefresh={refresh}
		>
			{/* Toya gets the one warm moment on the page. */}
			<View style={styles.hero}>
				<View style={styles.heroText}>
					<Text variant="title" style={styles.heroName} numberOfLines={1}>
						{name}
					</Text>
					{breed ? (
						<Text variant="sub" style={styles.heroBreed} numberOfLines={1}>
							{breed}
						</Text>
					) : null}
				</View>
				<Image
					source={DOG_IMG}
					style={styles.heroImage}
					resizeMode="contain"
					accessible
					accessibilityLabel={t("dog_image_alt", { defaultValue: "Dog" })}
				/>
			</View>

			<Section label={t("today")}>
				<View style={styles.tiles}>
					<StatTile
						value={feedingsToday}
						label={t("fed")}
						onPress={() => navigation.navigate("Feeding")}
					/>
					<StatTile
						value={walksToday}
						label={t("walked")}
						onPress={() => navigation.navigate("Walk")}
					/>
				</View>
			</Section>

			<Section label={t("overview")}>
				<Group>
					<Row
						title={t("last_bath")}
						detail={lastBathAt ? df.format(lastBathAt) : undefined}
						right={
							<Text variant="body" tone={bathAgoText ? "default" : "muted"} style={styles.value}>
								{bathAgoText ?? t("not_recorded")}
							</Text>
						}
					/>
					<Row
						title={t("current_weight")}
						right={
							<Text
								variant="body"
								tone={currentWeightKg != null ? "default" : "muted"}
								style={styles.value}
							>
								{currentWeightKg != null ? `${currentWeightKg.toFixed(1)} kg` : t("not_recorded")}
							</Text>
						}
					/>
				</Group>
			</Section>
		</Screen>
	);
}

// A count is the whole point of this tile, so it is the biggest thing on the page.
function StatTile({ value, label, onPress }: { value: number; label: string; onPress: () => void }) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	return (
		<PressScale
			onPress={onPress}
			style={styles.tileWrap}
			accessibilityLabel={`${label}: ${value}`}
		>
			<Surface style={styles.tile}>
				<Text variant="stat" style={value === 0 ? styles.statZero : undefined}>
					{value}
				</Text>
				<Text variant="sub" tone="muted">
					{label}
				</Text>
			</Surface>
		</PressScale>
	);
}

const makeStyles = (c: Colors & { isDark: boolean }) =>
	StyleSheet.create({
		hero: {
			flexDirection: "row",
			alignItems: "flex-end",
			justifyContent: "space-between",
			backgroundColor: c.accentSoft,
			borderRadius: radius.lg,
			...smooth,
			paddingLeft: space[5],
			paddingTop: space[5],
			marginBottom: space[6],
			overflow: "hidden",
			minHeight: 168,
		},
		heroText: { flexShrink: 1, paddingBottom: space[5], alignSelf: "flex-start" },
		heroName: { color: c.isDark ? c.text : c.accentText },
		heroBreed: { color: c.textSecondary, marginTop: 2 },
		heroImage: { width: 176, height: 176 },
		tiles: { flexDirection: "row", gap: space[3] },
		tileWrap: { flex: 1 },
		tile: {
			paddingHorizontal: space[5],
			paddingTop: space[4],
			paddingBottom: space[5],
			gap: space[1],
		},
		statZero: { color: c.textMuted },
		value: { textAlign: "right", flexShrink: 1, fontVariant: ["tabular-nums"] },
	});
