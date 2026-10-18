import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { getBiometricInfo, type BiometricInfo } from "./biometrics";

// Face ID login: after signing in once with the password, the password is kept in the phone's
// keychain behind Face ID / Touch ID (or the passcode). When the 7-day login has expired,
// reading it back is the "login": the phone asks for the face, we sign in with what it returns.
//
// Only the email lives outside the keychain (to show who it is and to notice a different
// account signing in); reading the password always requires the biometric check.

const CREDENTIALS_KEY = "faceLogin.credentials";
const EMAIL_KEY = "faceLogin/email";
const DECLINED_KEY = "faceLogin/declined";

export type FaceCredentials = { email: string; password: string };

export async function getFaceLoginEmail(): Promise<string | null> {
	return AsyncStorage.getItem(EMAIL_KEY).catch(() => null);
}

export async function saveFaceLogin(creds: FaceCredentials, prompt: string): Promise<void> {
	await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(creds), {
		requireAuthentication: true,
		authenticationPrompt: prompt,
	});
	await AsyncStorage.multiSet([
		[EMAIL_KEY, creds.email],
		[DECLINED_KEY, "0"],
	]);
}

/** Asks for Face ID and returns the saved login, or null if it was cancelled or is gone. */
export async function readFaceLogin(prompt: string): Promise<FaceCredentials | null> {
	try {
		const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY, {
			requireAuthentication: true,
			authenticationPrompt: prompt,
		});
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<FaceCredentials>;
		return parsed.email && parsed.password ? { email: parsed.email, password: parsed.password } : null;
	} catch {
		return null;
	}
}

export async function clearFaceLogin(): Promise<void> {
	await SecureStore.deleteItemAsync(CREDENTIALS_KEY).catch(() => {});
	await AsyncStorage.removeItem(EMAIL_KEY).catch(() => {});
}

/** Whether the "use Face ID next time?" offer was answered with "not now". */
export async function wasOfferDeclined(): Promise<boolean> {
	return (await AsyncStorage.getItem(DECLINED_KEY).catch(() => null)) === "1";
}

export async function setOfferDeclined(): Promise<void> {
	await AsyncStorage.setItem(DECLINED_KEY, "1").catch(() => {});
}

export function useBiometricInfo(): BiometricInfo {
	const [info, setInfo] = useState<BiometricInfo>({ available: false, kind: "other" });
	useEffect(() => {
		getBiometricInfo().then(setInfo);
	}, []);
	return info;
}
