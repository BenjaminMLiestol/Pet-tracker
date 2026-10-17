import React, { useState } from "react";
import { Alert, Button, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useCare, type CareKind, type CareRecord } from "../context/CareContext";
import CareFormModal from "../components/CareFormModal";
import { usePet } from "../context/PetContext";
import { daysBetween } from "../utils/dates";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";
import { useFreshIds, useMotion } from "../motion";

const KINDS: CareKind[] = ["vet", "vaccination", "parasite"];

export default function CareScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { records, busy, refreshing, refresh, addRecord, removeRecord } =
		useCare();
	const { timezone } = usePet();
	const isFocused = useIsFocused();
	const [formKind, setFormKind] = useState<CareKind | null>(null);

	// A record added at the top of its list may enter; the first load and refreshes may not.
	const m = useMotion();
	const fresh: Record<CareKind, Set<number>> = {
		vet: useFreshIds(useMemo(() => records.vet.map((r) => r.id), [records.vet])),
		vaccination: useFreshIds(
			useMemo(() => records.vaccination.map((r) => r.id), [records.vaccination]),
		),
		parasite: useFreshIds(
			useMemo(() => records.parasite.map((r) => r.id), [records.parasite]),
		),
	};

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
			return { text: t("care_overdue", { count: -diff }), color: c.danger };
		if (diff === 0) return { text: t("care_due_today"), color: c.warning };
		return {
			text: `${t("care_next_due")}: ${df.format(new Date(r.nextDueAt))}`,
			color: diff <= 14 ? c.warning : c.textMuted,
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
					<Animated.View key={kind} style={styles.card} layout={m.layout}>
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
									<Animated.View
										key={r.id}
										style={styles.record}
										entering={fresh[kind].has(r.id) ? m.careEnter : undefined}
										exiting={m.exit}
										layout={m.layout}
									>
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
											<Ionicons name="trash-outline" size={20} color={c.danger} />
										</Pressable>
									</Animated.View>
								);
							})
						)}
					</Animated.View>
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

const makeStyles = (c: Colors) => StyleSheet.create({
	screen: { flex: 1, backgroundColor: c.bg },
	content: { padding: 16, alignItems: "stretch", justifyContent: "flex-start" },
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
	helperText: { color: c.textMuted, paddingTop: 12 },
	record: {
		flexDirection: "row",
		alignItems: "flex-start",
		justifyContent: "space-between",
		paddingTop: 12,
		marginTop: 12,
		borderTopWidth: 1,
		borderTopColor: c.border,
	},
	recordText: { flex: 1, marginRight: 12 },
	recordTitle: { fontSize: 16, color: c.text, fontWeight: "600" },
	recordMeta: { color: c.textMuted, marginTop: 2 },
	recordNotes: { color: c.textSecondary, marginTop: 4 },
});
