import React, { useMemo, useRef, useState } from "react";
import { Keyboard, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { TextInput as RNTextInput } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { usePet, type WeightRecord } from "../context/PetContext";
import WeightChart from "../components/WeightChart";
import AppButton from "../components/AppButton";
import EntryTimeModal from "../components/EntryTimeModal";
import { useToast } from "../components/Toast";
import { Text, TextInput } from "../components/themed";
import { Group, Screen, Section, Surface } from "../components/ui";
import { useFreshIds, useMotion } from "../motion";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";
import { formatDay } from "../utils/dates";

export default function WeightScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const {
		currentWeightKg,
		weights,
		setWeightToday,
		updateWeight,
		removeWeight,
		busy,
		refresh,
		refreshing,
		timezone,
	} = usePet();
	const toast = useToast();
	// The sheet logs a weigh-in for another day (editing === null) or edits one.
	const [sheet, setSheet] = useState<{ editing: WeightRecord | null } | null>(null);
	const [sheetKg, setSheetKg] = useState("");
	const [input, setInput] = useState("");
	const inputRef = useRef<RNTextInput>(null);
	const isFocused = useIsFocused();

	const sorted = useMemo(
		() => [...weights].sort((a, b) => b.timestamp - a.timestamp),
		[weights],
	);

	// The rows shown. A weigh-in added just now (and only that) plays an entrance.
	const rows = useMemo(() => sorted.slice(0, 12), [sorted]);
	const rowIds = useMemo(() => rows.map((w) => w.id), [rows]);
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

	const parseKg = (text: string) => Number(text.replace(",", "."));
	const sheetKgValid = Number.isFinite(parseKg(sheetKg)) && parseKg(sheetKg) > 0;
	const editing = sheet?.editing ?? null;
	const openSheet = (w: WeightRecord | null) => {
		setSheetKg(w ? String(w.weightKg) : "");
		setSheet({ editing: w });
	};

	// Deletes happen straight away; the toast offers Undo, which logs the weigh-in again.
	const remove = async (w: WeightRecord) => {
		const ok = await removeWeight(w.id);
		if (!ok) return toast.show(t("delete_failed"), "error");
		toast.show(t("entry_deleted"), "success", {
			label: t("entry_undo"),
			onPress: () => {
				setWeightToday(w.weightKg, new Date(w.timestamp));
			},
		});
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

			<Section
				label={t("history")}
				right={
					<Pressable
						onPress={() => openSheet(null)}
						disabled={busy}
						hitSlop={8}
						style={[styles.add, busy && styles.disabled]}
						accessibilityRole="button"
						accessibilityLabel={t("weight_log_title")}
					>
						<Ionicons name="add" size={20} color={c.text} />
					</Pressable>
				}
			>
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
								key={w.id}
								style={styles.historyRow}
								entering={fresh.has(w.id) ? m.rowEnter : undefined}
								exiting={m.exit}
								layout={m.layout}
							>
								<Pressable
									onPress={() => openSheet(w)}
									disabled={busy}
									style={styles.rowMain}
									accessibilityRole="button"
									accessibilityLabel={t("weight_edit_title")}
								>
									<Text variant="body" style={type.numeric}>
										{w.weightKg.toFixed(1)} kg
										{w.pending ? "  " : ""}
									</Text>
									{w.pending && (
										<Ionicons
											name="cloud-offline-outline"
											size={16}
											color={c.accentText}
											accessibilityLabel={t("pending_row")}
										/>
									)}
									<Text variant="sub" tone="muted">
										{formatDay(w.timestamp, timezone, locale, labels)}
									</Text>
								</Pressable>
								<Pressable
									onPress={() => remove(w)}
									disabled={busy}
									hitSlop={8}
									style={styles.trash}
									accessibilityRole="button"
									accessibilityLabel={t("delete")}
								>
									<Ionicons name="trash-outline" size={20} color={c.textMuted} />
								</Pressable>
							</Animated.View>
						))}
					</Group>
				)}
			</Section>

			<EntryTimeModal
				visible={sheet !== null}
				title={editing ? t("weight_edit_title") : t("weight_log_title")}
				initial={editing ? new Date(editing.timestamp) : new Date()}
				canSave={sheetKgValid}
				onClose={() => setSheet(null)}
				onSave={(at) =>
					editing
						? updateWeight(editing.id, parseKg(sheetKg), at)
						: setWeightToday(parseKg(sheetKg), at)
				}
			>
				<TextInput
					style={styles.sheetInput}
					value={sheetKg}
					onChangeText={setSheetKg}
					placeholder={t("weight_kg_label")}
					accessibilityLabel={t("weight_kg_label")}
					keyboardType="decimal-pad"
					returnKeyType="done"
				/>
			</EntryTimeModal>
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
			minHeight: 52,
			paddingLeft: space[4],
			paddingRight: space[1],
			backgroundColor: c.surface,
		},
		rowMain: {
			flex: 1,
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 52,
			paddingRight: space[3],
		},
		trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
		add: {
			width: 32,
			height: 32,
			borderRadius: 16,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: c.surface,
		},
		disabled: { opacity: 0.4 },
		sheetInput: { minHeight: 52, paddingHorizontal: space[4], fontSize: 17 },
		empty: { padding: space[5], alignItems: "center" },
	});
