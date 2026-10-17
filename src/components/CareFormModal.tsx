import React, { useEffect, useState } from "react";
import { Button, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import Animated from "react-native-reanimated";
import { useTranslation } from "react-i18next";
import DateField from "./DateField";
import type { CareInput, CareKind, ParasiteType } from "../context/CareContext";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text, TextInput } from "./themed";
import { useMotion } from "../motion";

type Props = {
	kind: CareKind | null; // null = closed
	busy: boolean;
	onClose: () => void;
	onSubmit: (kind: CareKind, input: CareInput) => Promise<boolean>;
};

const PARASITE_TYPES: ParasiteType[] = ["flea", "tick", "worm"];

export default function CareFormModal({ kind, busy, onClose, onSubmit }: Props) {
	const c = useTheme();
	const m = useMotion();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const [name, setName] = useState("");
	const [parasiteType, setParasiteType] = useState<ParasiteType>("flea");
	const [date, setDate] = useState(new Date());
	const [hasNext, setHasNext] = useState(false);
	const [nextDueAt, setNextDueAt] = useState(() => defaultNext());
	const [notes, setNotes] = useState("");

	// Reset whenever the form is opened.
	useEffect(() => {
		if (kind) {
			setName("");
			setParasiteType("flea");
			setDate(new Date());
			setHasNext(false);
			setNextDueAt(defaultNext());
			setNotes("");
		}
	}, [kind]);

	if (!kind) return null;

	const nameRequired = kind !== "parasite";
	const canSave = !busy && (!nameRequired || name.trim().length > 0);

	const save = async () => {
		const ok = await onSubmit(kind, {
			name: name.trim(),
			parasiteType: kind === "parasite" ? parasiteType : undefined,
			date,
			nextDueAt: hasNext ? nextDueAt : null,
			notes,
		});
		if (ok) onClose();
	};

	return (
		<Modal
			visible
			animationType="slide"
			presentationStyle="pageSheet"
			onRequestClose={onClose}
		>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
				>
					<Text style={styles.title}>{t(`care_add_${kind}`)}</Text>

					{kind === "parasite" && (
						<View style={styles.chips}>
							{PARASITE_TYPES.map((p) => (
								<Pressable
									key={p}
									onPress={() => setParasiteType(p)}
									accessibilityRole="radio"
									accessibilityLabel={t(`parasite_${p}`)}
									accessibilityState={{ selected: parasiteType === p }}
									style={[styles.chip, parasiteType === p && styles.chipActive]}
								>
									<Text
										style={[
											styles.chipText,
											parasiteType === p && styles.chipTextActive,
										]}
									>
										{t(`parasite_${p}`)}
									</Text>
								</Pressable>
							))}
						</View>
					)}

					<TextInput
						style={styles.input}
						value={name}
						onChangeText={setName}
						placeholder={t(`care_name_placeholder_${kind}`)}
						accessibilityLabel={t(`care_name_placeholder_${kind}`)}
						returnKeyType="done"
					/>

					<DateField label={t(`care_date_${kind}`)} value={date} onChange={setDate} />

					<View style={styles.switchRow}>
						<Text style={styles.switchLabel}>{t("care_set_next")}</Text>
						<Switch
							value={hasNext}
							onValueChange={setHasNext}
							accessibilityLabel={t("care_set_next")}
						/>
					</View>
					{/* The next-due row fades in and out; what sits below glides instead of jumping. */}
					{hasNext && (
						<Animated.View entering={m.fadeIn} exiting={m.exitShort}>
							<DateField
								label={t("care_next_due")}
								value={nextDueAt}
								onChange={setNextDueAt}
							/>
						</Animated.View>
					)}

					<Animated.View layout={m.layout}>
						<TextInput
							style={[styles.input, styles.notes]}
							value={notes}
							onChangeText={setNotes}
							placeholder={t("care_notes_placeholder")}
							accessibilityLabel={t("care_notes_placeholder")}
							multiline
						/>
					</Animated.View>

					<Animated.View style={styles.actions} layout={m.layout}>
						<Button title={t("cancel")} onPress={onClose} color={c.textMuted} />
						<Button title={t("save")} onPress={save} disabled={!canSave} />
					</Animated.View>
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
}

function defaultNext(): Date {
	const d = new Date();
	d.setFullYear(d.getFullYear() + 1);
	return d;
}

const makeStyles = (c: Colors) => StyleSheet.create({
	flex: { flex: 1, backgroundColor: c.bg },
	content: { padding: 20 },
	title: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
	input: {
		borderWidth: 1,
		borderColor: c.border,
		borderRadius: 12,
		padding: 12,
		fontSize: 16,
		marginBottom: 12,
		backgroundColor: c.bg,
	},
	notes: { minHeight: 80, textAlignVertical: "top" },
	chips: { flexDirection: "row", marginBottom: 12 },
	chip: {
		borderWidth: 1,
		borderColor: c.border,
		borderRadius: 999,
		paddingHorizontal: 14,
		paddingVertical: 8,
		marginRight: 8,
	},
	chipActive: { backgroundColor: c.primary, borderColor: c.primary },
	chipText: { color: c.textSecondary, fontWeight: "600" },
	chipTextActive: { color: c.onPrimary },
	switchRow: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	switchLabel: { fontSize: 16, color: c.textSecondary, fontWeight: "600" },
	actions: {
		flexDirection: "row",
		justifyContent: "space-between",
		marginTop: 8,
	},
});
