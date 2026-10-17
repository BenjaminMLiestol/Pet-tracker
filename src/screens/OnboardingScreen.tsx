import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import AppButton from "../components/AppButton";
import DogManagerModal, { type DogManagerMode } from "../components/DogManagerModal";
import { Text } from "../components/themed";
import { radius, smooth, space, useTheme, type Colors } from "../theme";

// Shown when someone has no dog yet: a new account, or someone who was just invited.
export default function OnboardingScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { logout } = useAuth();
	const [mode, setMode] = useState<DogManagerMode | null>(null);

	return (
		<View style={styles.container}>
			<View style={styles.mark}>
				<Ionicons name="paw" size={28} color={c.accentText} />
			</View>
			<Text variant="largeTitle" style={styles.title}>
				{t("onboarding_title")}
			</Text>
			<Text variant="body" tone="muted" style={styles.body}>
				{t("onboarding_body")}
			</Text>

			<View style={styles.actions}>
				<AppButton title={t("dog_create_title")} icon="add" onPress={() => setMode("create")} />
				<AppButton
					variant="secondary"
					title={t("dog_join")}
					icon="key-outline"
					onPress={() => setMode("join")}
				/>
			</View>
			<View style={styles.logout}>
				<AppButton variant="ghost" title={t("logout")} onPress={logout} />
			</View>

			<DogManagerModal
				visible={mode !== null}
				initialMode={mode ?? "create"}
				onClose={() => setMode(null)}
			/>
		</View>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: c.bg,
			paddingHorizontal: space[6],
			justifyContent: "center",
		},
		mark: {
			width: 56,
			height: 56,
			borderRadius: radius.md,
			...smooth,
			backgroundColor: c.accentSoft,
			alignItems: "center",
			justifyContent: "center",
			marginBottom: space[5],
		},
		title: { marginBottom: space[2] },
		body: { marginBottom: space[8] },
		actions: { gap: space[3] },
		logout: { marginTop: space[6], alignItems: "center" },
	});
