import React, { useEffect, useMemo, useState } from "react";
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { describeError } from "../api/errors";
import { space, useTheme, type Colors } from "../theme";
import AppButton from "./AppButton";
import { Text, TextInput } from "./themed";
import { Group } from "./ui";

type Props = {
	visible: boolean;
	title: string;
	body: string;
	submitLabel: string;
	onClose: () => void;
	// Throws an error whose message is safe to show (a wrong password, offline, ...).
	onSubmit: (password: string) => Promise<void>;
};

// Asks for the account password once, for things that save it (Face ID login).
export default function PasswordConfirmModal({
	visible,
	title,
	body,
	submitLabel,
	onClose,
	onSubmit,
}: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const [password, setPassword] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!visible) return;
		setPassword("");
		setBusy(false);
		setError(null);
	}, [visible]);

	if (!visible) return null;

	const close = () => {
		Keyboard.dismiss();
		onClose();
	};

	const submit = async () => {
		if (!password || busy) return;
		setBusy(true);
		setError(null);
		try {
			await onSubmit(password);
			close();
		} catch (e) {
			setError(describeError(e, "face_setup_failed"));
			setBusy(false);
		}
	};

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
			<KeyboardAvoidingView
				style={styles.screen}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<View style={styles.header}>
					<Text variant="title" style={styles.title}>
						{title}
					</Text>
					<Pressable
						onPress={close}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel={t("cancel")}
					>
						<Ionicons name="close" size={26} color={c.text} />
					</Pressable>
				</View>
				<Text variant="sub" tone="muted" style={styles.body}>
					{body}
				</Text>
				<Group>
					<TextInput
						style={styles.input}
						secureTextEntry
						autoFocus
						autoComplete="current-password"
						textContentType="password"
						placeholder={t("login_password")}
						accessibilityLabel={t("login_password")}
						value={password}
						onChangeText={setPassword}
						returnKeyType="go"
						onSubmitEditing={submit}
					/>
				</Group>
				{error && <Text style={styles.error}>{error}</Text>}
				<View style={styles.actions}>
					<AppButton title={submitLabel} onPress={submit} loading={busy} disabled={!password || busy} />
				</View>
			</KeyboardAvoidingView>
		</Modal>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: c.bg, padding: space[5], paddingTop: space[6] },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: space[3],
			gap: space[2],
		},
		title: { flexShrink: 1 },
		body: { marginBottom: space[4] },
		input: { minHeight: 56, paddingHorizontal: space[4], fontSize: 17 },
		error: { color: c.danger, fontSize: 15, marginTop: space[3], paddingHorizontal: space[1] },
		actions: { marginTop: space[5] },
	});
