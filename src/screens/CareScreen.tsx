import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useIsFocused } from "@react-navigation/native";
import { useCare, type CareKind, type CareRecord } from "../context/CareContext";
import CareFormModal from "../components/CareFormModal";
import { usePet } from "../context/PetContext";
import { daysBetween } from "../utils/dates";
import { space, useTheme, type Colors } from "../theme";
import { Text } from "../components/themed";
import { Group, Screen, Section, Surface } from "../components/ui";
import { useFreshIds, useMotion } from "../motion";
import { useToast } from "../components/Toast";

const KINDS: CareKind[] = ["vet", "vaccination", "parasite"];

export default function CareScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { records, busy, refreshing, refresh, addRecord, removeRecord } = useCare();
	const { timezone } = usePet();
	const toast = useToast();
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

	const df = new Intl.DateTimeFormat(i18n.language === "nb" ? "nb-NO" : "en-GB", {
		day: "numeric",
		month: "short",
		year: "numeric",
	});

	const title = (r: CareRecord) => {
		if (r.kind === "parasite") {
			const kindName = r.parasiteType ? t(`parasite_${r.parasiteType}`) : "";
			return [kindName, r.name].filter(Boolean).join(" · ");
		}
		return r.name;
	};

	// Overdue is the only thing that's red; "due soon" is honey; the rest stays quiet.
	const dueStatus = (r: CareRecord) => {
		if (!r.nextDueAt) return null;
		const diff = daysBetween(Date.now(), r.nextDueAt, timezone);
		if (diff < 0) return { text: t("care_overdue", { count: -diff }), color: c.danger };
		if (diff === 0) return { text: t("care_due_today"), color: c.accentText };
		return {
			text: `${t("care_next_due")}: ${df.format(new Date(r.nextDueAt))}`,
			color: diff <= 14 ? c.accentText : c.textMuted,
		};
	};

	// Deletes happen straight away; the toast reports how it went.
	const remove = async (kind: CareKind, id: number) => {
		const ok = await removeRecord(kind, id);
		toast.show(ok ? t("entry_deleted") : t("delete_failed"), ok ? "success" : "error");
	};

	return (
		<>
			<Screen title={t("care_title")} refreshing={isFocused && refreshing} onRefresh={refresh}>
				{KINDS.map((kind) => (
					<Animated.View key={kind} layout={m.layout}>
						<Section
							label={t(`care_section_${kind}`)}
							right={
								<Pressable
									onPress={() => setFormKind(kind)}
									disabled={busy}
									hitSlop={8}
									style={[styles.add, busy && styles.disabled]}
									accessibilityRole="button"
									accessibilityLabel={t(`care_add_${kind}`)}
								>
									<Ionicons name="add" size={20} color={c.text} />
								</Pressable>
							}
						>
							{records[kind].length === 0 ? (
								<Surface style={styles.empty}>
									<Text variant="sub" tone="muted">
										{t("no_data_yet")}
									</Text>
								</Surface>
							) : (
								<Group>
									{records[kind].map((r) => {
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
													<Text variant="headline">{title(r) || t("care_untitled")}</Text>
													<Text variant="sub" tone="muted">
														{df.format(new Date(r.date))}
													</Text>
													{due && (
														<Text variant="sub" style={[styles.due, { color: due.color }]}>
															{due.text}
														</Text>
													)}
													{r.notes ? (
														<Text variant="caption" tone="muted" style={styles.notes}>
															{r.notes}
														</Text>
													) : null}
												</View>
												<Pressable
													onPress={() => remove(kind, r.id)}
													disabled={busy}
													hitSlop={8}
													style={styles.trash}
													accessibilityRole="button"
													accessibilityLabel={t("delete")}
												>
													<Ionicons name="trash-outline" size={20} color={c.textMuted} />
												</Pressable>
											</Animated.View>
										);
									})}
								</Group>
							)}
						</Section>
					</Animated.View>
				))}
			</Screen>

			<CareFormModal
				kind={formKind}
				busy={busy}
				onClose={() => setFormKind(null)}
				onSubmit={addRecord}
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
		disabled: { opacity: 0.4 },
		empty: { padding: space[5], alignItems: "center" },
		record: {
			flexDirection: "row",
			alignItems: "flex-start",
			justifyContent: "space-between",
			paddingVertical: space[3],
			paddingLeft: space[4],
			paddingRight: space[1],
			gap: space[2],
			backgroundColor: c.surface,
		},
		recordText: { flex: 1, gap: 2, paddingVertical: 2 },
		due: { fontWeight: "600" },
		notes: { marginTop: 2 },
		trash: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
	});
