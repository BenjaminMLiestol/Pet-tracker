import React, { useState } from "react";
import {
	Alert,
	Button,
	Pressable,
	RefreshControl,
	ScrollView,
	StyleSheet,
	Text,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useCare, type CareKind, type CareRecord } from "../context/CareContext";
import CareFormModal from "../components/CareFormModal";
import { usePet } from "../context/PetContext";
import { daysBetween } from "../utils/dates";

const KINDS: CareKind[] = ["vet", "vaccination", "parasite"];

export default function CareScreen() {
	const { t, i18n } = useTranslation();
	const { records, busy, refreshing, refresh, addRecord, removeRecord } =
		useCare();
	const { timezone } = usePet();
	const isFocused = useIsFocused();
	const [formKind, setFormKind] = useState<CareKind | null>(null);

	const df = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
	);

	const title = (r: CareRecord) => {
		if (r.kind === "parasite") {
			const type = r.parasiteType ? t(`parasite_${r.parasiteType}`) : "";
			return [type, r.name].filter(Boolean).join(" · ");
		}
		return r.name;
	};

	const dueStatus = (r: CareRecord) => {
		if (!r.nextDueAt) return null;
		const diff = daysBetween(Date.now(), r.nextDueAt, timezone);
		if (diff < 0)
			return { text: t("care_overdue", { count: -diff }), color: "#dc2626" };
		if (diff === 0) return { text: t("care_due_today"), color: "#d97706" };
		return {
			text: `${t("care_next_due")}: ${df.format(new Date(r.nextDueAt))}`,
			color: diff <= 14 ? "#d97706" : "#6b7280",
		};
	};

	const confirmRemove = (kind: CareKind, id: number) =>
		Alert.alert(t("delete_entry_title"), t("delete_entry_message"), [
			{ text: t("cancel"), style: "cancel" },
			{
				text: t("delete"),
				style: "destructive",
				onPress: () => removeRecord(kind, id),
			},
		]);

	return (
		<>
			<ScrollView
				style={styles.screen}
				contentContainerStyle={styles.content}
				refreshControl={
					<RefreshControl refreshing={isFocused && refreshing} onRefresh={refresh} />
				}
				alwaysBounceVertical
			>
				<Text style={styles.title}>{t("care_title")}</Text>

				{KINDS.map((kind) => (
					<View key={kind} style={styles.card}>
						<Text style={styles.cardTitle}>{t(`care_section_${kind}`)}</Text>
						<Button
							title={t(`care_add_${kind}`)}
							onPress={() => setFormKind(kind)}
							disabled={busy}
						/>

						{records[kind].length === 0 ? (
							<Text style={styles.helperText}>{t("no_data_yet")}</Text>
						) : (
							records[kind].map((r) => {
								const due = dueStatus(r);
								return (
									<View key={r.id} style={styles.record}>
										<View style={styles.recordText}>
											<Text style={styles.recordTitle}>
												{title(r) || t("care_untitled")}
											</Text>
											<Text style={styles.recordMeta}>{df.format(new Date(r.date))}</Text>
											{due && (
												<Text style={[styles.recordMeta, { color: due.color }]}>
													{due.text}
												</Text>
											)}
											{r.notes ? <Text style={styles.recordNotes}>{r.notes}</Text> : null}
										</View>
										<Pressable
											onPress={() => confirmRemove(kind, r.id)}
											disabled={busy}
											hitSlop={8}
											accessibilityRole="button"
											accessibilityLabel={t("delete")}
										>
											<Ionicons name="trash-outline" size={20} color="#ef4444" />
										</Pressable>
									</View>
								);
							})
						)}
					</View>
				))}
			</ScrollView>

			<CareFormModal
				kind={formKind}
				busy={busy}
				onClose={() => setFormKind(null)}
				onSubmit={addRecord}
			/>
		</>
	);
}

const styles = StyleSheet.create({
	screen: { flex: 1, backgroundColor: "#fff" },
	content: { padding: 16, alignItems: "stretch", justifyContent: "flex-start" },
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
	helperText: { color: "#6b7280", paddingTop: 12 },
	record: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		paddingTop: 12,
		marginTop: 12,
		borderTopWidth: 1,
		borderTopColor: "#e5e7eb",
	},
	recordText: { flex: 1, marginRight: 12 },
	recordTitle: { fontSize: 16, color: "#111827", fontWeight: "600" },
	recordMeta: { color: "#6b7280", marginTop: 2 },
	recordNotes: { color: "#374151", marginTop: 4 },
});
