import React, { useMemo, useRef, useState } from "react";
import {
	View,
	Text,
	StyleSheet,
	TextInput,
	Button,
	Keyboard,
	TouchableWithoutFeedback,
} from "react-native";
import { usePet } from "../context/PetContext";
import { useTranslation } from "react-i18next";

export default function WeightScreen() {
	const { t, i18n } = useTranslation();
	const { currentWeightKg, weights, setWeightToday } = usePet();
	const [input, setInput] = useState("");
	const inputRef = useRef<TextInput>(null);

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
			<View style={styles.container}>
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
						<Button title={t("save")} onPress={onSave} />
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
			</View>
		</TouchableWithoutFeedback>
	);
}

const styles = StyleSheet.create({
	container: {
		flex: 1,
		alignItems: "stretch",
		justifyContent: "flex-start",
		padding: 16,
		backgroundColor: "#fff",
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
	formRow: { flexDirection: "row", alignItems: "center", gap: 8 },
	input: {
		flex: 1,
		borderWidth: 1,
		borderColor: "#d1d5db",
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
		backgroundColor: "#ecfeff",
		borderColor: "#bae6fd",
		borderWidth: 1,
		borderRadius: 10,
		padding: 12,
		marginBottom: 8,
	},
	tileValue: {
		fontSize: 18,
		fontWeight: "700",
		color: "#0f766e",
		marginBottom: 4,
	},
	tileDate: { fontSize: 12, color: "#374151" },
	helperText: { color: "#6b7280" },
});
