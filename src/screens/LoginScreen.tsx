import { useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuth } from "../context/AuthContext";
import { clearFaceLogin, setOfferDeclined, useBiometricInfo, wasOfferDeclined } from "../api/faceLogin";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import AppButton from "../components/AppButton";
import { Text, TextInput } from "../components/themed";
import { Group } from "../components/ui";

const LoginScreen: React.FC = () => {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { login, register, faceLoginEmail, endedBy, loginWithFaceId, rememberFaceLogin } = useAuth();
	const bio = useBiometricInfo();
	const [creating, setCreating] = useState(false);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [loading, setLoading] = useState(false);

	const missing = creating
		? !firstName.trim() || !lastName.trim() || !email || !password
		: !email || !password;

	const methodName = bio.kind === "touch" ? "Touch ID" : bio.kind === "face" ? "Face ID" : t("face_setting_other");

	// After the first password login, offer Face ID for the next time the login expires.
	const offerFaceLogin = async (loginEmail: string, loginPassword: string) => {
		if (!bio.available) return;
		// Someone else signing in: the saved password belongs to a different account.
		if (faceLoginEmail && faceLoginEmail.toLowerCase() !== loginEmail.toLowerCase()) {
			await clearFaceLogin();
		} else if (faceLoginEmail) {
			return; // already set up for this account
		}
		if (await wasOfferDeclined()) return;
		Alert.alert(t("face_offer_title", { method: methodName }), t("face_offer_body", { method: methodName }), [
			{ text: t("face_offer_no"), style: "cancel", onPress: () => setOfferDeclined() },
			{
				text: t("face_offer_yes", { method: methodName }),
				onPress: () => {
					rememberFaceLogin(loginEmail, loginPassword).catch(() => {});
				},
			},
		]);
	};

	const faceLogin = async () => {
		setLoading(true);
		try {
			await loginWithFaceId();
		} catch (e: any) {
			Alert.alert(t("login_failed_title"), e?.message ?? t("login_failed_unknown"));
		} finally {
			setLoading(false);
		}
	};

	// An expired login signs in with Face ID by itself; after choosing to log out, or on a
	// cold start with nobody signed in, it waits for a tap.
	useEffect(() => {
		if (faceLoginEmail && endedBy === "expired") faceLogin();
		// biome-ignore lint/correctness/useExhaustiveDependencies: once, when the screen appears
	}, []);

	const onSubmit = async () => {
		if (missing) {
			Alert.alert(t("login_missing_title"), t("login_missing_message"));
			return;
		}
		setLoading(true);
		try {
			if (creating) {
				await register({
					first_name: firstName.trim(),
					last_name: lastName.trim(),
					email: email.trim(),
					password,
				});
				offerFaceLogin(email.trim(), password);
			} else {
				await login(email.trim(), password);
				offerFaceLogin(email.trim(), password);
			}
		} catch (e: any) {
			Alert.alert(
				creating ? t("register_title") : t("login_failed_title"),
				e?.message ?? t("login_failed_unknown"),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<KeyboardAvoidingView
			style={styles.container}
			behavior={Platform.OS === "ios" ? "padding" : undefined}
		>
			<ScrollView
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				keyboardDismissMode="interactive"
			>
				{/* The one warm mark on the page. */}
				<View style={styles.mark}>
					<Ionicons name="paw" size={28} color={c.accentText} />
				</View>
				<Text variant="largeTitle" style={styles.title}>
					{creating ? t("register_title") : t("login_welcome")}
				</Text>

				{faceLoginEmail && !creating && (
					<View style={styles.face}>
						<AppButton
							title={t("face_login_button", { method: methodName })}
							icon="scan-outline"
							onPress={faceLogin}
							loading={loading}
						/>
						<Text variant="caption" tone="muted" style={styles.faceHint}>
							{faceLoginEmail}
						</Text>
					</View>
				)}

				<Group style={styles.fields}>
					{creating && (
						<TextInput
							style={styles.input}
							autoCapitalize="words"
							autoComplete="given-name"
							textContentType="givenName"
							placeholder={t("register_first_name")}
							accessibilityLabel={t("register_first_name")}
							value={firstName}
							onChangeText={setFirstName}
							returnKeyType="next"
						/>
					)}
					{creating && (
						<TextInput
							style={styles.input}
							autoCapitalize="words"
							autoComplete="family-name"
							textContentType="familyName"
							placeholder={t("register_last_name")}
							accessibilityLabel={t("register_last_name")}
							value={lastName}
							onChangeText={setLastName}
							returnKeyType="next"
						/>
					)}
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
						autoComplete={creating ? "new-password" : "current-password"}
						textContentType={creating ? "newPassword" : "password"}
						value={password}
						onChangeText={setPassword}
						returnKeyType="go"
						onSubmitEditing={onSubmit}
						testID="password"
					/>
				</Group>

				<AppButton
					title={creating ? t("register_submit") : t("login_submit")}
					onPress={onSubmit}
					loading={loading}
				/>
				<View style={styles.switch}>
					<AppButton
						variant="ghost"
						title={creating ? t("register_to_login") : t("login_to_register")}
						onPress={() => setCreating((v) => !v)}
					/>
				</View>
			</ScrollView>
		</KeyboardAvoidingView>
	);
};

export default LoginScreen;

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		container: { flex: 1, backgroundColor: c.bg },
		content: {
			flexGrow: 1,
			paddingHorizontal: space[6],
			paddingVertical: space[8],
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
		face: { marginBottom: space[5] },
		faceHint: { textAlign: "center", marginTop: space[2] },
		fields: { marginBottom: space[4] },
		input: { minHeight: 56, paddingHorizontal: space[4], fontSize: 17 },
		switch: { marginTop: space[2], alignItems: "center" },
	});
