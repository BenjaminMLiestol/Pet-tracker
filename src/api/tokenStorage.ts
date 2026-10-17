import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const TOKEN_KEY = "authToken";

// SecureStore has no web implementation, so fall back to AsyncStorage there.
const useSecure = Platform.OS !== "web";

export async function getToken(): Promise<string | null> {
	if (!useSecure) return AsyncStorage.getItem(TOKEN_KEY);

	const secure = await SecureStore.getItemAsync(TOKEN_KEY);
	if (secure) return secure;

	// One-time migration of tokens saved by older versions in plain AsyncStorage.
	const legacy = await AsyncStorage.getItem(TOKEN_KEY);
	if (legacy) {
		await SecureStore.setItemAsync(TOKEN_KEY, legacy);
		await AsyncStorage.removeItem(TOKEN_KEY);
	}
	return legacy;
}

export async function setToken(token: string): Promise<void> {
	if (useSecure) await SecureStore.setItemAsync(TOKEN_KEY, token);
	else await AsyncStorage.setItem(TOKEN_KEY, token);
}

export async function clearToken(): Promise<void> {
	if (useSecure) await SecureStore.deleteItemAsync(TOKEN_KEY);
	await AsyncStorage.removeItem(TOKEN_KEY);
}
