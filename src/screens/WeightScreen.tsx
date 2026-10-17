import React, { useMemo, useRef, useState } from "react";
import { View, StyleSheet, Button, Keyboard, TouchableWithoutFeedback, ScrollView, RefreshControl } from "react-native";
import { usePet } from "../context/PetContext";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import WeightChart from "../components/WeightChart";
import { useTheme, type Colors } from "../theme";
import type { TextInput as RNTextInput } from "react-native";
import { Text, TextInput } from "../components/themed";

export default function WeightScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const {
		currentWeightKg,
		weights,
		setWeightToday,
		busy,
		refresh,
		refreshing,
	} = usePet();
	const [input, setInput] = useState("");
	const inputRef = useRef<RNTextInput>(null);
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...weights].sort((a, b) => b.timestamp - a.timestamp),
		[weights],
	);

	const onSave = () => {
		const normalized = input.replace(",", ".");
		const val = Number(normalized);
		if (!Number.isFinite(val) || val <= 0) return;
		setWeightToday(val);
		setInput("");
		inputRef.current?.blur();
		Keyboard.dismiss();
	};

	const df = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
	);

	return (
		<TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
			<ScrollView
				style={styles.screen} // <-- only container bg/flex here
				contentContainerStyle={styles.content} // <-- layout/padding belong here
				refreshControl={
					<RefreshControl
						refreshing={isFocused && refreshing}
						onRefresh={refresh}
					/>
				}
				keyboardShouldPersistTaps="handled"
				alwaysBounceVertical
			>
				<Text style={styles.title}>{t("weight_title")}</Text>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>{t("current")}</Text>
					<Text style={styles.row}>
						<Text style={styles.label}>{t("current_weight")}: </Text>
						{currentWeightKg != null
							? `${currentWeightKg.toFixed(1)} kg`
							: t("not_recorded")}
					</Text>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>{t("weight_trend")}</Text>
					<WeightChart weights={weights} />
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>{t("log_today_optional")}</Text>
					<View style={styles.formRow}>
						<TextInput
							placeholder={t("placeholder_weight")}
							value={input}
							onChangeText={setInput}
							keyboardType="numeric"
							style={styles.input}
							ref={inputRef}
							blurOnSubmit
							returnKeyType="done"
							onSubmitEditing={onSave}
						/>
						<Button title={t("save")} onPress={onSave} disabled={busy} />
					</View>
				</View>

				<View style={styles.card}>
					<Text style={styles.cardTitle}>{t("history")}</Text>
					<View style={styles.grid}>
						{sorted.length === 0 ? (
							<Text style={styles.helperText}>{t("no_data_yet")}</Text>
						) : (
							sorted.slice(0, 12).map((w, idx) => (
								<View key={`${w.timestamp}-${idx}`} style={styles.tile}>
									<Text style={styles.tileValue}>
										{w.weightKg.toFixed(1)} kg
									</Text>
									<Text style={styles.tileDate}>
										{df.format(new Date(w.timestamp))}
									</Text>
								</View>
							))
						)}
					</View>
				</View>
			</ScrollView>
		</TouchableWithoutFeedback>
	);
}

const makeStyles = (c: Colors) => StyleSheet.create({
	// Use this for the ScrollView itself (container)
	screen: {
		flex: 1,
		backgroundColor: c.bg,
	},
	// Use this for layout & padding inside the ScrollView
	content: {
		padding: 16,
		alignItems: "stretch",
		justifyContent: "flex-start",
	},

	title: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
	card: {
		backgroundColor: c.surface,
		borderColor: c.border,
		borderWidth: 1,
		borderRadius: 12,
		padding: 16,
		marginBottom: 12,
	},
	cardTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
	row: { fontSize: 16, marginBottom: 8 },
	label: { color: c.textSecondary, fontWeight: "600" },
	formRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderColor: c.borderStrong,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
		marginRight: 8,
		backgroundColor: "white",
	},
	grid: {
		flexDirection: "row",
		flexWrap: "wrap",
		justifyContent: "space-between",
	},
	tile: {
		width: "48%",
		backgroundColor: c.infoBg,
		borderColor: c.infoBorder,
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		marginBottom: 8,
	},
	tileValue: {
		fontSize: 18,
		fontWeight: "700",
		color: c.infoText,
		marginBottom: 4,
	},
	tileDate: { fontSize: 12, color: c.textSecondary },
	helperText: { color: c.textMuted },
});
