import React, { useMemo } from "react";
import { Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "./themed";

// Shown while entries logged without a connection are still waiting to be sent. Tap to try now.
export default function PendingNote() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { pendingCount, flushPending } = usePet();
	if (pendingCount === 0) return null;

	return (
		<Pressable
			onPress={flushPending}
			style={styles.note}
			accessibilityRole="button"
			accessibilityLabel={`${t("pending_note", { count: pendingCount })}. ${t("pending_retry")}`}
		>
			<Ionicons name="cloud-offline-outline" size={18} color={c.accentText} />
			<Text variant="sub" style={styles.text}>
				{t("pending_note", { count: pendingCount })}
			</Text>
			<Text variant="sub" style={styles.retry}>
				{t("pending_retry")}
			</Text>
		</Pressable>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		note: {
			flexDirection: "row",
			alignItems: "center",
			gap: space[2],
			backgroundColor: c.accentSoft,
			borderRadius: radius.md,
			...smooth,
			paddingVertical: space[3],
			paddingHorizontal: space[4],
			marginBottom: space[4],
		},
		text: { flex: 1, color: c.accentText },
		retry: { color: c.accentText, fontWeight: "700", textDecorationLine: "underline" },
	});
