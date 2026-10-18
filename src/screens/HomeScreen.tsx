import React, { useMemo, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { daysBetween } from "../utils/dates";
import { usePet } from "../context/PetContext";
import { useAuth } from "../context/AuthContext";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";
import DogManagerModal from "../components/DogManagerModal";
import WeekInsights from "../components/WeekInsights";
import { useDogPhoto } from "../api/dogPhotos";
import FoodModal from "../components/FoodModal";
import MedicineToday from "../components/MedicineToday";
import { foodSupply } from "../utils/food";
import { Group, PressRow, PressScale, Row, Screen, Section, Surface } from "../components/ui";

const DOG_IMG = require("../../assets/dog.png");

export default function HomeScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const isFocused = useIsFocused();
	const navigation = useNavigation<any>();
	const { user } = useAuth();
	const [dogsOpen, setDogsOpen] = useState(false);
	const [foodOpen, setFoodOpen] = useState(false);
	const {
		petId,
		name,
		breed,
		feedingsToday,
		walksToday,
		feedingsPerDay,
		walksPerDay,
		food,
		lastBathAt,
		currentWeightKg,
		timezone,
		refresh,
		refreshing,
	} = usePet();

	const displayName = user?.first_name?.trim() || user?.email || t("friend");
	const supply = foodSupply(food, Date.now(), timezone);
	const photo = useDogPhoto(petId);

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
			{/* Tapping the dog's card switches dogs, or adds one. */}
			<PressScale
				onPress={() => setDogsOpen(true)}
				accessibilityLabel={`${t("dogs_switch")}: ${name}`}
				style={styles.heroWrap}
			>
				<View style={styles.hero}>
					<View style={styles.heroText}>
						<View style={styles.heroNameRow}>
							<Text variant="title" style={styles.heroName} numberOfLines={1}>
								{name}
							</Text>
							<Ionicons
								name="chevron-down"
								size={18}
								color={c.isDark ? c.textSecondary : c.accentText}
							/>
						</View>
						{breed ? (
							<Text variant="sub" style={styles.heroBreed} numberOfLines={1}>
								{breed}
							</Text>
						) : null}
					</View>
					{photo ? (
						<Image
							source={{ uri: photo }}
							style={styles.heroPhoto}
							accessible
							accessibilityLabel={name}
							accessibilityIgnoresInvertColors
						/>
					) : (
						<Image
							source={DOG_IMG}
							style={styles.heroImage}
							resizeMode="contain"
							accessible
							accessibilityLabel={t("dog_image_alt", { defaultValue: "Dog" })}
						/>
					)}
				</View>
			</PressScale>
			<DogManagerModal visible={dogsOpen} onClose={() => setDogsOpen(false)} />

			<Section label={t("today")}>
				<View style={styles.tiles}>
					<StatTile
						value={feedingsToday}
						goal={feedingsPerDay}
						label={t("fed")}
						onPress={() => navigation.navigate("Feeding")}
					/>
					<StatTile
						value={walksToday}
						goal={walksPerDay}
						label={t("walked")}
						onPress={() => navigation.navigate("Walk")}
					/>
				</View>
			</Section>

			<MedicineToday />

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
					<PressRow
						title={t("food_title")}
						accessibilityLabel={`${t("food_title")}: ${
							supply
								? supply.status === "out"
									? t("food_out")
									: t("food_days_left", { count: supply.daysLeft })
								: t("food_setup")
						}`}
						right={
							<View style={styles.foodRight}>
								<Text
									variant="body"
									tone={supply ? "default" : "muted"}
									style={[
										styles.value,
										supply?.status === "low" && { color: c.accentText },
										supply?.status === "out" && { color: c.danger },
									]}
								>
									{supply
										? supply.status === "out"
											? t("food_out")
											: t("food_days_left", { count: supply.daysLeft })
										: t("food_setup")}
								</Text>
								<Ionicons name="chevron-forward" size={18} color={c.textMuted} />
							</View>
						}
						onPress={() => setFoodOpen(true)}
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

			<FoodModal visible={foodOpen} onClose={() => setFoodOpen(false)} />

			<Section label={t("week_title")}>
				<WeekInsights />
			</Section>
		</Screen>
	);
}

// A count is the whole point of this tile, so it is the biggest thing on the page.
function StatTile({
	value,
	goal,
	label,
	onPress,
}: {
	value: number;
	goal: number;
	label: string;
	onPress: () => void;
}) {
	const c = useTheme();
	const { t } = useTranslation();
	const styles = useMemo(() => makeStyles(c), [c]);
	return (
		<PressScale
			onPress={onPress}
			style={styles.tileWrap}
			accessibilityLabel={`${label}: ${value} / ${goal}${value >= goal ? `, ${t("goal_reached")}` : ""}`}
		>
			<Surface style={styles.tile}>
				<View style={styles.statRow}>
					<Text variant="stat" style={value === 0 ? styles.statZero : undefined}>
						{value}
					</Text>
					<Text variant="title" tone="muted" style={styles.goal}>
						/{goal}
					</Text>
					{value >= goal && (
						<Ionicons
							name="checkmark-circle"
							size={22}
							color={c.success}
							style={styles.goalDone}
							accessibilityLabel={t("goal_reached")}
						/>
					)}
				</View>
				<Text variant="sub" tone="muted">
					{label}
				</Text>
			</Surface>
		</PressScale>
	);
}

const makeStyles = (c: Colors & { isDark: boolean }) =>
	StyleSheet.create({
		heroWrap: { marginBottom: space[6] },
		heroNameRow: { flexDirection: "row", alignItems: "center", gap: space[1] },
		hero: {
			flexDirection: "row",
			alignItems: "flex-end",
			justifyContent: "space-between",
			backgroundColor: c.accentSoft,
			borderRadius: radius.lg,
			...smooth,
			paddingLeft: space[5],
			paddingTop: space[5],
			overflow: "hidden",
			minHeight: 168,
		},
		heroText: { flexShrink: 1, paddingBottom: space[5], alignSelf: "flex-start" },
		heroName: { color: c.isDark ? c.text : c.accentText, flexShrink: 1 },
		heroBreed: { color: c.textSecondary, marginTop: 2 },
		heroImage: { width: 176, height: 176 },
		heroPhoto: { width: 150, height: 150, borderRadius: radius.lg, marginBottom: space[4], marginRight: space[1], ...smooth },
		tiles: { flexDirection: "row", gap: space[3] },
		tileWrap: { flex: 1 },
		tile: {
			paddingHorizontal: space[5],
			paddingTop: space[4],
			paddingBottom: space[5],
			gap: space[1],
		},
		foodRight: { flexDirection: "row", alignItems: "center", gap: space[1] },
		statZero: { color: c.textMuted },
		statRow: { flexDirection: "row", alignItems: "baseline" },
		goal: { marginLeft: space[1], fontVariant: ["tabular-nums"] },
		goalDone: { marginLeft: space[2], alignSelf: "center" },
		value: { textAlign: "right", flexShrink: 1, fontVariant: ["tabular-nums"] },
	});
