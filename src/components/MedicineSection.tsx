import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useMedicines, type MedicineInput } from "../context/MedicineContext";
import { usePet } from "../context/PetContext";
import { space, useTheme, type Colors } from "../theme";
import type { Medicine } from "../utils/medicine";
import MedicineFormModal from "./MedicineFormModal";
import { Text } from "./themed";
import { useToast } from "./Toast";
import { Group, Section, Surface } from "./ui";

/** "08:00, 20:00 · every 3 days · until 24 Oct": a medicine's schedule in one line. */
export function scheduleSummary(m: Medicine, t: (k: string, o?: Record<string, unknown>) => string, locale: string): string {
	const parts = [m.times.join(", "), t("medicine_every_n", { count: m.intervalDays })];
	if (m.endsOn) {
		const [y, mo, d] = m.endsOn.split("-").map(Number);
		const date = new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(y, mo - 1, d));
		parts.push(t("medicine_until", { date }));
	}
	return parts.join(" · ");
}

const toInput = (m: Medicine): MedicineInput => ({
	name: m.name,
	dose: m.dose ?? "",
	times: m.times,
	intervalDays: m.intervalDays,
	endsOn: m.endsOn,
});

// The Care tab's list of the dog's medicines: add, edit (tap), remove (with Undo).
export default function MedicineSection() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { timezone } = usePet();
	const { medicines, addMedicine, updateMedicine, removeMedicine } = useMedicines();
	const toast = useToast();
	const [form, setForm] = useState<{ editing: Medicine | null } | null>(null);
	const [failed, setFailed] = useState(false);
	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";

	const save = async (input: MedicineInput) => {
		const editing = form?.editing ?? null;
		const ok = editing ? await updateMedicine(editing.id, input) : await addMedicine(input);
		setFailed(!ok);
		return ok;
	};

	const remove = async (m: Medicine) => {
		const ok = await removeMedicine(m.id);
		if (!ok) return toast.show(t("delete_failed"), "error");
		// Undo adds it again (from today: the doses already ticked off belong to the removed one).
		toast.show(t("entry_deleted"), "success", {
			label: t("entry_undo"),
			onPress: () => {
				addMedicine(toInput(m));
			},
		});
	};

	return (
		<>
			<Section
				label={t("medicine_title")}
				right={
					<Pressable
						onPress={() => {
							setFailed(false);
							setForm({ editing: null });
						}}
						hitSlop={8}
						style={styles.add}
						accessibilityRole="button"
						accessibilityLabel={t("medicine_add")}
						testID="medicine-add"
					>
						<Ionicons name="add" size={20} color={c.text} />
					</Pressable>
				}
			>
				{medicines.length === 0 ? (
					<Surface style={styles.empty}>
						<Text variant="sub" tone="muted">
							{t("medicine_none")}
						</Text>
					</Surface>
				) : (
					<Group>
						{medicines.map((m) => (
							<View key={m.id} style={styles.row}>
								<Pressable
									onPress={() => {
										setFailed(false);
										setForm({ editing: m });
									}}
									style={styles.rowText}
									accessibilityRole="button"
									accessibilityLabel={`${m.name}${m.dose ? `, ${m.dose}` : ""}. ${scheduleSummary(m, t, locale)}`}
								>
									<Text variant="headline">{m.name}</Text>
									{m.dose ? (
										<Text variant="sub" tone="muted">
											{m.dose}
										</Text>
									) : null}
									<Text variant="sub" tone="muted">
										{scheduleSummary(m, t, locale)}
									</Text>
								</Pressable>
								<Pressable
									onPress={() => remove(m)}
									hitSlop={8}
									style={styles.trash}
									accessibilityRole="button"
									accessibilityLabel={`${t("delete")} ${m.name}`}
								>
									<Ionicons name="trash-outline" size={20} color={c.textMuted} />
								</Pressable>
							</View>
						))}
					</Group>
				)}
			</Section>
			<MedicineFormModal
				visible={form !== null}
				editing={form?.editing ?? null}
				timeZone={timezone}
				onClose={() => setForm(null)}
				onSave={save}
				failed={failed}
			/>
		</>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		add: {
			width: 32,
			height: 32,
			borderRadius: 16,
			backgroundColor: c.surface,
			alignItems: "center",
			justifyContent: "center",
		},
		empty: { padding: space[5], alignItems: "center" },
		row: { flexDirection: "row", alignItems: "center", backgroundColor: c.surface, paddingLeft: space[4], paddingRight: space[1] },
		rowText: { flex: 1, paddingVertical: space[3], gap: 2 },
		trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	});
