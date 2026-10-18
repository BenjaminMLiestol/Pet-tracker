import React, { useEffect, useMemo, useState } from "react";
import {
	Keyboard,
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { space, useTheme, type Colors } from "../theme";
import { dayToDate, nextFreeTime, normalizeTimes, type Medicine } from "../utils/medicine";
import { timeToDate, formatTime } from "../utils/reminders";
import { calendarDay } from "../utils/dates";
import AppButton from "./AppButton";
import DateField from "./DateField";
import { Text, TextInput } from "./themed";
import { Group, Row, Stepper } from "./ui";
import type { MedicineInput } from "../context/MedicineContext";

const MAX_TIMES = 6;
const DEFAULT_TIME = "08:00";

type Props = {
	visible: boolean;
	// The medicine being edited, or null to add a new one.
	editing: Medicine | null;
	timeZone: string;
	onClose: () => void;
	// Resolves true when saved; the sheet stays open when it fails.
	onSave: (input: MedicineInput) => Promise<boolean>;
	failed: boolean;
};

// "08:00" as a Date on today, for the time picker; and back.
const asDate = (hhmm: string) => {
	const [h, m] = hhmm.split(":").map(Number);
	return timeToDate({ hour: h, minute: m });
};
const asTime = (d: Date) => formatTime({ hour: d.getHours(), minute: d.getMinutes() });

// A medicine's name and dose, its times of day (as many as needed, each its own time), how often
// (every N days) and an optional end date. It always starts today, so there is no start date.
export default function MedicineFormModal({ visible, editing, timeZone, onClose, onSave, failed }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const [name, setName] = useState("");
	const [dose, setDose] = useState("");
	const [times, setTimes] = useState<string[]>([DEFAULT_TIME]);
	const [interval, setIntervalDays] = useState(1);
	const [hasEnd, setHasEnd] = useState(false);
	const [endsOn, setEndsOn] = useState(() => new Date());
	const [saving, setSaving] = useState(false);

	// Today in the dog's timezone, as a Date the picker can show.
	const today = () => {
		const [y, mo, d] = dayToDate(calendarDay(Date.now(), timeZone)).split("-").map(Number);
		return new Date(y, mo - 1, d);
	};

	useEffect(() => {
		if (!visible) return;
		setSaving(false);
		setName(editing?.name ?? "");
		setDose(editing?.dose ?? "");
		setTimes(editing?.times.length ? editing.times : [DEFAULT_TIME]);
		setIntervalDays(editing?.intervalDays ?? 1);
		setHasEnd(!!editing?.endsOn);
		if (editing?.endsOn) {
			const [y, mo, d] = editing.endsOn.split("-").map(Number);
			setEndsOn(new Date(y, mo - 1, d));
		} else {
			const d = today();
			d.setDate(d.getDate() + 10);
			setEndsOn(d);
		}
		// Only when the sheet opens: later changes come from this sheet itself.
		// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	}, [visible, editing]);

	if (!visible) return null;

	const cleanTimes = normalizeTimes(times);
	// The same time twice would be one dose: ask for different ones.
	const duplicate = cleanTimes.length !== times.length;
	const canSave = name.trim().length > 0 && times.length > 0 && !duplicate && !saving;

	const close = () => {
		Keyboard.dismiss();
		onClose();
	};

	const setTimeAt = (index: number, date: Date) => setTimes((prev) => prev.map((v, i) => (i === index ? asTime(date) : v)));

	const save = async () => {
		Keyboard.dismiss();
		setSaving(true);
		const ymd = (d: Date) =>
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
		const ok = await onSave({
			name,
			dose,
			times: cleanTimes,
			intervalDays: interval,
			endsOn: hasEnd ? ymd(endsOn) : null,
		});
		if (ok) onClose();
		else setSaving(false);
	};

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
			<KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
				<ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
					<View style={styles.header}>
						<Text variant="title" style={styles.title}>
							{editing ? t("medicine_edit") : t("medicine_add")}
						</Text>
						<Pressable onPress={close} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("cancel")}>
							<Ionicons name="close" size={26} color={c.text} />
						</Pressable>
					</View>

					<Group>
						<TextInput
							style={styles.input}
							value={name}
							onChangeText={setName}
							placeholder={t("medicine_name")}
							accessibilityLabel={t("medicine_name")}
							testID="medicine-name"
							returnKeyType="next"
						/>
						<TextInput
							style={styles.input}
							value={dose}
							onChangeText={setDose}
							placeholder={t("medicine_dose")}
							accessibilityLabel={t("medicine_dose")}
							returnKeyType="done"
						/>
					</Group>

					<Text variant="sub" tone="muted" style={styles.label}>
						{t("medicine_times")}
					</Text>
					<Group>
						{times.map((time, i) => (
							<View key={i} style={styles.timeRow}>
								<View style={styles.flex}>
									<DateField
										mode="time"
										label={t("medicine_time_n", { n: i + 1 })}
										value={asDate(time)}
										onChange={(d) => setTimeAt(i, d)}
									/>
								</View>
								{times.length > 1 && (
									<Pressable
										onPress={() => setTimes((prev) => prev.filter((_, j) => j !== i))}
										hitSlop={8}
										style={styles.remove}
										accessibilityRole="button"
										accessibilityLabel={t("medicine_time_remove", { n: i + 1 })}
									>
										<Ionicons name="remove-circle-outline" size={24} color={c.danger} />
									</Pressable>
								)}
							</View>
						))}
						{times.length < MAX_TIMES && (
							<Pressable
								onPress={() => setTimes((prev) => [...prev, nextFreeTime(prev)])}
								accessibilityRole="button"
								accessibilityLabel={t("medicine_time_add")}
								style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
							>
								<Row title={t("medicine_time_add")} right={<Ionicons name="add" size={22} color={c.text} />} />
							</Pressable>
						)}
					</Group>
					{duplicate && (
						<Text variant="caption" style={styles.error}>
							{t("medicine_times_same")}
						</Text>
					)}

					<Text variant="sub" tone="muted" style={styles.label}>
						{t("medicine_repeat")}
					</Text>
					<Group>
						<Row
							title={t("medicine_every")}
							right={
								<Stepper
									value={interval}
									min={1}
									max={365}
									onChange={setIntervalDays}
									format={(n) => t("medicine_every_n", { count: n })}
									decrementLabel={t("medicine_every_less")}
									incrementLabel={t("medicine_every_more")}
									testID="medicine-every"
								/>
							}
						/>
						<Row
							title={t("medicine_end")}
							right={
								<View style={styles.switchBox}>
									<Switch value={hasEnd} onValueChange={setHasEnd} accessibilityLabel={t("medicine_end")} />
								</View>
							}
						/>
						{hasEnd && (
							<DateField label={t("medicine_ends_on")} value={endsOn} onChange={setEndsOn} minimumDate={today()} />
						)}
					</Group>
					<Text variant="caption" tone="muted" style={styles.hint}>
						{hasEnd ? t("medicine_hint_end") : t("medicine_hint_forever")}
					</Text>

					{failed && (
						<Text variant="sub" style={styles.error}>
							{t("medicine_save_failed")}
						</Text>
					)}
					<View style={styles.actions}>
						<AppButton title={t("save")} onPress={save} loading={saving} disabled={!canSave} />
					</View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		flex: { flex: 1, backgroundColor: c.bg },
		content: { padding: space[5], paddingTop: space[6], paddingBottom: space[8] },
		header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: space[5], gap: space[2] },
		title: { flexShrink: 1 },
		input: { minHeight: 52, paddingHorizontal: space[4], fontSize: 17 },
		label: { marginTop: space[5], marginBottom: space[2], paddingHorizontal: space[1] },
		timeRow: { flexDirection: "row", alignItems: "center", paddingRight: space[3] },
		remove: { paddingLeft: space[2] },
		switchBox: { width: 51, height: 31, alignItems: "center", justifyContent: "center" },
		hint: { marginTop: space[2], paddingHorizontal: space[1] },
		error: { color: c.danger, marginTop: space[2], paddingHorizontal: space[1] },
		actions: { marginTop: space[6] },
	});
