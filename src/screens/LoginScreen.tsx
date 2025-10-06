import { useState } from "react";
import {
	View,
	Text,
	TextInput,
	Pressable,
	StyleSheet,
	ActivityIndicator,
	Alert,
} from "react-native";
import { useAuth } from "../context/AuthContext";

const LoginScreen: React.FC = () => {
	const { login } = useAuth();
	const [email, setEmail] = useState(""); // prefill for dev if you want
	const [password, setPassword] = useState(""); // prefill for dev if you want
	const [loading, setLoading] = useState(false);

	const onSubmit = async () => {
		if (!email || !password) {
			Alert.alert("Missing info", "Please enter email and password.");
			return;
		}
		setLoading(true);
		try {
			await login(email.trim(), password);
		} catch (e: any) {
			Alert.alert("Login failed", e?.message ?? "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Welcome back 👋</Text>
			<TextInput
				style={styles.input}
				autoCapitalize="none"
				autoComplete="email"
				keyboardType="email-address"
				placeholder="Email"
				value={email}
				onChangeText={setEmail}
				testID="email"
			/>
			<TextInput
				style={styles.input}
				secureTextEntry
				placeholder="Password"
				value={password}
				onChangeText={setPassword}
				testID="password"
			/>
			<Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
				{loading ? (
					<ActivityIndicator />
				) : (
					<Text style={styles.buttonText}>Log in</Text>
				)}
			</Pressable>
		</View>
	);
};

export default LoginScreen;

const styles = StyleSheet.create({
	container: { flex: 1, padding: 24, justifyContent: "center" },
	title: {
		fontSize: 24,
		fontWeight: "700",
		marginBottom: 24,
		textAlign: "center",
	},
	input: {
		borderWidth: 1,
		borderColor: "#e5e7eb",
		borderRadius: 12,
		padding: 12,
		marginBottom: 12,
		fontSize: 16,
		backgroundColor: "#fff",
	},
	button: {
		backgroundColor: "#2563eb",
		paddingVertical: 14,
		borderRadius: 12,
		alignItems: "center",
	},
	buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
});
