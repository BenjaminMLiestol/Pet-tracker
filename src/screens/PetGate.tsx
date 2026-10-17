import React, { useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import AppButton from "../components/AppButton";
import { Text } from "../components/themed";
import { usePet } from "../context/PetContext";
import { space, useTheme, type Colors } from "../theme";
import OnboardingScreen from "./OnboardingScreen";

// Decides what to show before the app proper: still loading, couldn't load (which must never
// look like "you have no dogs"), no dog yet, or the app.
export default function PetGate({ children }: { children: ReactNode }) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { petsStatus, pets, reloadPets } = usePet();
	const [retrying, setRetrying] = useState(false);

	if (pets.length > 0) return <>{children}</>;

	if (petsStatus === "loading") {
		return (
			<View style={styles.center}>
				<ActivityIndicator color={c.textMuted} />
			</View>
		);
	}

	if (petsStatus === "error") {
		return (
			<View style={styles.center}>
				<Text variant="headline" style={styles.message}>
					{t("pets_load_failed")}
				</Text>
				<AppButton
					compact
					title={t("retry")}
					loading={retrying}
					onPress={async () => {
						setRetrying(true);
						await reloadPets().catch(() => {});
						setRetrying(false);
					}}
				/>
			</View>
		);
	}

	return <OnboardingScreen />;
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		center: {
			flex: 1,
			backgroundColor: c.bg,
			alignItems: "center",
			justifyContent: "center",
			padding: space[6],
			gap: space[4],
		},
		message: { textAlign: "center" },
	});
