import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useMedicines } from "../context/MedicineContext";
import { usePet } from "../context/PetContext";
import { space, useTheme, type Colors } from "../theme";
import { calendarDay } from "../utils/dates";
import { slotsForDay, type DaySlot } from "../utils/medicine";
import { whoLabel } from "../utils/who";
import { Text } from "./themed";
import { useToast } from "./Toast";
import { Group, Row, Section } from "./ui";

// Home: today's doses, each a row to tick off (tap again to take it back). Shown only when
// something is due today. A dose ticked by anyone counts for every owner.
export default function MedicineToday() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { timezone, owners } = usePet();
	const { user } = useAuth();
	const { medicines, doses, setGiven } = useMedicines();
	const toast = useToast();

	const slots = useMemo(
		() => slotsForDay(medicines, doses, calendarDay(Date.now(), timezone), new Date()),
		[medicines, doses, timezone],
	);
	if (slots.length === 0) return null;

	const toggle = async (s: DaySlot) => {
		const ok = await setGiven(s.medicine.id, s.date, s.slot, s.status !== "given");
		if (!ok) toast.show(t("settings_save_failed"), "error");
	};

	const label = (s: DaySlot) => {
		const dose = s.medicine.dose ? ` (${s.medicine.dose})` : "";
		const state =
			s.status === "given" ? t("medicine_status_given") : s.status === "late" ? t("medicine_late") : t("medicine_status_open");
		return `${s.slot} ${s.medicine.name}${dose}: ${state}`;
	};

	return (
		<Section label={t("medicine_today")}>
			<Group>
				{slots.map((s) => {
					const by = s.dose ? whoLabel(s.dose.userId, owners, user?.id) : "";
					const detail = [s.medicine.dose, by ? t("medicine_given_by", { name: by }) : null].filter(Boolean).join(" · ");
					return (
						<Pressable
							key={`${s.medicine.id}|${s.slot}`}
							onPress={() => toggle(s)}
							accessibilityRole="checkbox"
							accessibilityState={{ checked: s.status === "given" }}
							accessibilityLabel={label(s)}
							style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
						>
							<Row
								title={`${s.slot} · ${s.medicine.name}`}
								detail={detail || undefined}
								titleColor={s.status === "given" ? c.textMuted : undefined}
								left={
									<Ionicons
										name={s.status === "given" ? "checkmark-circle" : "ellipse-outline"}
										size={26}
										color={s.status === "given" ? c.success : s.status === "late" ? c.danger : c.textMuted}
									/>
								}
								right={
									s.status === "late" ? (
										<View>
											<Text variant="sub" style={styles.late}>
												{t("medicine_late")}
											</Text>
										</View>
									) : undefined
								}
							/>
						</Pressable>
					);
				})}
			</Group>
		</Section>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		late: { color: c.danger, fontWeight: "600" },
	});
