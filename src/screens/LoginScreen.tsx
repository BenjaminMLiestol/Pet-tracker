import { useState } from "react";
import { View, Pressable, StyleSheet, ActivityIndicator, Alert } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text, TextInput } from "../components/themed";

const LoginScreen: React.FC = () => {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { login } = useAuth();
	const [email, setEmail] = useState(""); // prefill for dev if you want
	const [password, setPassword] = useState(""); // prefill for dev if you want
	const [loading, setLoading] = useState(false);

	const onSubmit = async () => {
		if (!email || !password) {
			Alert.alert(t("login_missing_title"), t("login_missing_message"));
			return;
		}
		setLoading(true);
		try {
			await login(email.trim(), password);
		} catch (e: any) {
			Alert.alert(
				t("login_failed_title"),
				e?.message ?? t("login_failed_unknown"),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>{t("login_welcome")}</Text>
			<TextInput
				style={styles.input}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				placeholder={t("login_email")}
				accessibilityLabel={t("login_email")}
				textContentType="emailAddress"
				value={email}
				onChangeText={setEmail}
				testID="email"
			/>
			<TextInput
				style={styles.input}
				secureTextEntry
				placeholder={t("login_password")}
				accessibilityLabel={t("login_password")}
				autoComplete="current-password"
				textContentType="password"
				value={password}
				onChangeText={setPassword}
				testID="password"
			/>
			<Pressable
				style={styles.button}
				onPress={onSubmit}
				disabled={loading}
				accessibilityRole="button"
				accessibilityLabel={t("login_submit")}
				accessibilityState={{ disabled: loading, busy: loading }}
			>
				{loading ? (
					<ActivityIndicator />
				) : (
					<Text style={styles.buttonText}>{t("login_submit")}</Text>
				)}
			</Pressable>
		</View>
	);
};

export default LoginScreen;

const makeStyles = (c: Colors) => StyleSheet.create({
	container: { flex: 1, padding: 24, justifyContent: "center" },
	title: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 24,
		textAlign: "center",
	},
	input: {
		borderWidth: 1,
		borderColor: c.border,
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
		fontSize: 16,
		backgroundColor: c.bg,
	},
	button: {
		backgroundColor: c.primary,
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: "center",
	},
	buttonText: { color: c.onPrimary, fontWeight: "700", fontSize: 16 },
});
