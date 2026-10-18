import React, { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import { useToast } from "./Toast";
import { useDebouncedCommit } from "../hooks/useDebouncedCommit";
import { foodSupply, todayIso } from "../utils/food";
import { formatDate } from "../utils/exportData";
import { space, type, useTheme, type Colors } from "../theme";
import AppButton from "./AppButton";
import { Text } from "./themed";
import { Group, Row, Stepper } from "./ui";

// The bag is set in half kilos and the portion in tens of grams: a stepper moves by one unit.
const BAG_STEP_G = 500;
const DAILY_STEP_G = 10;
const DEFAULT_BAG_G = 12000;
const DEFAULT_DAILY_G = 300;

type Props = { visible: boolean; onClose: () => void };

// Sets up the current bag of food and shows how long it lasts. Shared by the dog's owners.
export default function FoodModal({ visible, onClose }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { name, timezone, food, saveFood } = usePet();
	const toast = useToast();
	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";

	const [bag, setBag] = useState(Math.round((food?.bagGrams ?? DEFAULT_BAG_G) / BAG_STEP_G));
	const [daily, setDaily] = useState(Math.round((food?.dailyGrams ?? DEFAULT_DAILY_G) / DAILY_STEP_G));
	const [saving, setSaving] = useState(false);

	useEffect(() => {
		if (!visible) return;
		setBag(Math.round((food?.bagGrams ?? DEFAULT_BAG_G) / BAG_STEP_G));
		setDaily(Math.round((food?.dailyGrams ?? DEFAULT_DAILY_G) / DAILY_STEP_G));
		// Only when the sheet opens: later changes come from this sheet itself.
		// biome-ignore lint/correctness/useExhaustiveDependencies: see above
	}, [visible]);

	const report = (ok: boolean) =>
		toast.show(ok ? t("saved") : t("settings_save_failed"), ok ? "success" : "error");

	// Once a bag exists, changing the sizes saves by itself (the opened-on day stays).
	const commit = useDebouncedCommit(async (next: { bag: number; daily: number }) => {
		if (!food) return;
		if (next.bag * BAG_STEP_G === food.bagGrams && next.daily * DAILY_STEP_G === food.dailyGrams) return;
		report(await saveFood({ bagGrams: next.bag * BAG_STEP_G, dailyGrams: next.daily * DAILY_STEP_G }));
	});

	if (!visible) return null;

	const supply = foodSupply(food, Date.now(), timezone);
	const kg = (grams: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(grams / 1000);

	const startBag = async () => {
		setSaving(true);
		const ok = await saveFood({
			bagGrams: bag * BAG_STEP_G,
			dailyGrams: daily * DAILY_STEP_G,
			startedOn: todayIso(Date.now(), timezone),
		});
		setSaving(false);
		if (ok) toast.show(t("saved"), "success");
		else toast.show(t("settings_save_failed"), "error");
	};

	const remove = async () => {
		const ok = await saveFood(null);
		if (ok) onClose();
		else toast.show(t("settings_save_failed"), "error");
	};

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<View style={styles.screen}>
				<ScrollView contentContainerStyle={styles.content}>
					<View style={styles.header}>
						<Text variant="title" style={styles.title}>
							{t("food_title")}
						</Text>
						<Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t("close")}>
							<Ionicons name="close" size={26} color={c.text} />
						</Pressable>
					</View>

					{supply && (
						<View style={styles.estimate}>
							<Text
								variant="stat"
								style={supply.status === "out" ? styles.danger : supply.status === "low" ? styles.low : undefined}
							>
								{supply.status === "out" ? t("food_out") : t("food_days_left", { count: supply.daysLeft })}
							</Text>
							<Text variant="sub" tone="muted">
								{supply.status === "out"
									? t("food_out_hint", { name })
									: t("food_remaining", {
											kg: kg(supply.remainingGrams),
											date: formatDate(supply.runsOutDay * 86400000, locale, "UTC"),
										})}
							</Text>
						</View>
					)}

					<Group>
						<Row
							title={t("food_bag")}
							right={
								<Stepper
									value={bag}
									min={1}
									max={200}
									onChange={(n) => {
										setBag(n);
										commit({ bag: n, daily });
									}}
									format={(n) => `${kg(n * BAG_STEP_G)} kg`}
									decrementLabel={t("food_bag_less")}
									incrementLabel={t("food_bag_more")}
								/>
							}
						/>
						<Row
							title={t("food_daily")}
							right={
								<Stepper
									value={daily}
									min={1}
									max={500}
									onChange={(n) => {
										setDaily(n);
										commit({ bag, daily: n });
									}}
									format={(n) => `${n * DAILY_STEP_G} g`}
									decrementLabel={t("food_daily_less")}
									incrementLabel={t("food_daily_more")}
								/>
							}
						/>
					</Group>
					<Text variant="caption" tone="muted" style={styles.hint}>
						{t("food_hint", { name })}
					</Text>

					<View style={styles.actions}>
						<AppButton
							title={food ? t("food_new_bag") : t("food_start")}
							icon={food ? "refresh" : "add"}
							onPress={startBag}
							loading={saving}
							disabled={saving}
						/>
						{food && <AppButton variant="ghost" title={t("food_remove")} color={c.danger} onPress={remove} />}
					</View>
				</ScrollView>
			</View>
		</Modal>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: c.bg },
		content: { padding: space[5], paddingTop: space[6] },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: space[5],
			gap: space[2],
		},
		title: { flexShrink: 1 },
		estimate: { marginBottom: space[5], gap: space[1] },
		low: { color: c.accentText },
		danger: { color: c.danger },
		hint: { marginTop: space[2], paddingHorizontal: space[1] },
		actions: { marginTop: space[6], gap: space[2] },
	});
