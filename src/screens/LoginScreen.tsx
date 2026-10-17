import { useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import AppButton from "../components/AppButton";
import { Text, TextInput } from "../components/themed";
import { Group } from "../components/ui";

const LoginScreen: React.FC = () => {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { login } = useAuth();
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
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
			Alert.alert(t("login_failed_title"), e?.message ?? t("login_failed_unknown"));
		} finally {
			setLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			{/* The one warm mark on the page. */}
			<View style={styles.mark}>
				<Ionicons name="paw" size={28} color={c.accentText} />
			</View>
			<Text variant="largeTitle" style={styles.title}>
				{t("login_welcome")}
			</Text>

			<Group style={styles.fields}>
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
					returnKeyType="next"
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
					returnKeyType="go"
					onSubmitEditing={onSubmit}
					testID="password"
				/>
			</Group>

			<AppButton title={t("login_submit")} onPress={onSubmit} loading={loading} />
		</KeyboardAvoidingView>
	);
};

export default LoginScreen;

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
		title: { marginBottom: space[6] },
		fields: { marginBottom: space[4] },
		input: { minHeight: 56, paddingHorizontal: space[4], fontSize: 17 },
	});
