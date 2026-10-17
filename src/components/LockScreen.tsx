import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAppLock } from "../context/AppLockContext";
import { useAuth } from "../context/AuthContext";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import AppButton from "./AppButton";
import { Text } from "./themed";

const ASK_COOLDOWN_MS = 5000;

// Sits over the whole app while it is locked, and as a plain cover whenever the app is in
// the background (so the app switcher shows no dog data).
export default function LockScreen() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { locked, needsAuth, covered, kind, unlock } = useAppLock();
	const { logout } = useAuth();
	const asking = useRef(false);
	const lastAskedAt = useRef(0);

	// Ask for Face ID as soon as the lock appears, so opening the app is one glance. Not
	// again right after a cancel (the sheet closing flips the app back to active), so a
	// cancelled prompt leaves the Unlock button instead of nagging.
	useEffect(() => {
		if (!needsAuth || covered || asking.current) return;
		if (Date.now() - lastAskedAt.current < ASK_COOLDOWN_MS) return;
		asking.current = true;
		lastAskedAt.current = Date.now();
		unlock().finally(() => {
			asking.current = false;
			lastAskedAt.current = Date.now();
		});
	}, [needsAuth, covered, unlock]);

	if (!locked && !covered) return null;

	const label = kind === "touch" ? "Touch ID" : kind === "face" ? "Face ID" : t("lock_unlock");

	return (
		<View style={styles.container} accessibilityViewIsModal>
			<View style={styles.mark}>
				<Ionicons name="paw" size={28} color={c.accentText} />
			</View>
			{needsAuth && (
				<>
					<Text variant="largeTitle" style={styles.title}>
						{t("lock_title")}
					</Text>
					<View style={styles.actions}>
						<AppButton
							title={kind === "other" ? t("lock_unlock") : t("lock_unlock_with", { method: label })}
							icon="lock-open-outline"
							onPress={() => {
								if (!asking.current) unlock();
							}}
						/>
						<AppButton variant="ghost" title={t("logout")} onPress={logout} />
					</View>
				</>
			)}
		</View>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		container: {
			...StyleSheet.absoluteFillObject,
			backgroundColor: c.bg,
			justifyContent: "center",
			padding: space[6],
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
		title: { marginBottom: space[6] },
		actions: { gap: space[2] },
	});
