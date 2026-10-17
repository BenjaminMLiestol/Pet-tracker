import React, { useMemo, useRef, useState } from "react";
import { Keyboard, StyleSheet, View } from "react-native";
import type { TextInput as RNTextInput } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet } from "../context/PetContext";
import WeightChart from "../components/WeightChart";
import AppButton from "../components/AppButton";
import { Text, TextInput } from "../components/themed";
import { Group, Screen, Section, Surface } from "../components/ui";
import { useFreshIds, useMotion } from "../motion";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";
import { formatDay } from "../utils/dates";

export default function WeightScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { currentWeightKg, weights, setWeightToday, busy, refresh, refreshing, timezone } =
		usePet();
	const [input, setInput] = useState("");
	const inputRef = useRef<RNTextInput>(null);
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...weights].sort((a, b) => b.timestamp - a.timestamp),
		[weights],
	);

	// The rows shown. A weigh-in added just now (and only that) plays an entrance.
	const rows = useMemo(() => sorted.slice(0, 12), [sorted]);
	const rowIds = useMemo(() => rows.map((w) => w.timestamp), [rows]);
	const fresh = useFreshIds(rowIds);
	const m = useMotion();

	const onSave = () => {
		const normalized = input.replace(",", ".");
		const val = Number(normalized);
		if (!Number.isFinite(val) || val <= 0) return;
		setWeightToday(val);
		setInput("");
		inputRef.current?.blur();
		Keyboard.dismiss();
	};

	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";
	const labels = { today: t("today"), yesterday: t("yesterday") };
	const canSave = Number.isFinite(Number(input.replace(",", "."))) && Number(input.replace(",", ".")) > 0;

	return (
		<Screen title={t("weight_title")} refreshing={isFocused && refreshing} onRefresh={refresh}>
			<Surface style={styles.current}>
				{currentWeightKg != null ? (
					<View style={styles.valueRow}>
						<Text variant="stat">{currentWeightKg.toFixed(1)}</Text>
						<Text variant="title" tone="muted" style={styles.unit}>
							kg
						</Text>
					</View>
				) : (
					<Text variant="title" tone="muted" style={styles.none}>
						{t("not_recorded")}
					</Text>
				)}
				<Text variant="sub" tone="muted">
					{t("current_weight")}
				</Text>
			</Surface>

			<Section label={t("weight_trend")}>
				<Surface style={styles.chart}>
					<WeightChart weights={weights} />
				</Surface>
			</Section>

			<Section label={t("log_today_optional")}>
				<View style={styles.form}>
					<TextInput
						ref={inputRef}
						style={styles.input}
						placeholder={t("placeholder_weight")}
						accessibilityLabel={t("weight_input_label")}
						value={input}
						onChangeText={setInput}
						keyboardType="decimal-pad"
						returnKeyType="done"
						blurOnSubmit
						onSubmitEditing={onSave}
					/>
					<AppButton compact title={t("save")} onPress={onSave} disabled={busy || !canSave} />
				</View>
			</Section>

			<Section label={t("history")}>
				{rows.length === 0 ? (
					<Surface style={styles.empty}>
						<Text variant="sub" tone="muted">
							{t("no_data_yet")}
						</Text>
					</Surface>
				) : (
					<Group>
						{rows.map((w) => (
							<Animated.View
								key={w.timestamp}
								style={styles.historyRow}
								entering={fresh.has(w.timestamp) ? m.rowEnter : undefined}
							>
								<Text variant="body" style={type.numeric}>
									{w.weightKg.toFixed(1)} kg
								</Text>
								<Text variant="sub" tone="muted">
									{formatDay(w.timestamp, timezone, locale, labels)}
								</Text>
							</Animated.View>
						))}
					</Group>
				)}
			</Section>
		</Screen>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		current: { padding: space[5], gap: space[1], marginBottom: space[6] },
		valueRow: { flexDirection: "row", alignItems: "baseline", gap: space[2] },
		unit: { fontVariant: ["tabular-nums"] },
		none: { marginVertical: space[2] },
		chart: { paddingVertical: space[4], paddingHorizontal: space[4] },
		form: { flexDirection: "row", gap: space[3], alignItems: "center" },
		input: {
			flex: 1,
			height: 52,
			backgroundColor: c.surface,
			borderRadius: radius.md,
			...smooth,
			paddingHorizontal: space[4],
			fontSize: 17,
			fontVariant: ["tabular-nums"],
		},
		historyRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 52,
			paddingHorizontal: space[4],
			backgroundColor: c.surface,
		},
		empty: { padding: space[5], alignItems: "center" },
	});
