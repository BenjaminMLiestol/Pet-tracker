import * as LocalAuthentication from "expo-local-authentication";

export type BiometricKind = "face" | "touch" | "other";

export type BiometricInfo = { available: boolean; kind: BiometricKind };

/** Whether this phone can check a face or fingerprint, and which one it is. */
export async function getBiometricInfo(): Promise<BiometricInfo> {
	try {
		const [hardware, enrolled] = await Promise.all([
			LocalAuthentication.hasHardwareAsync(),
			LocalAuthentication.isEnrolledAsync(),
		]);
		if (!hardware || !enrolled) return { available: false, kind: "other" };

		const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
		const T = LocalAuthentication.AuthenticationType;
		const kind: BiometricKind = types.includes(T.FACIAL_RECOGNITION)
			? "face"
			: types.includes(T.FINGERPRINT)
				? "touch"
				: "other";
		return { available: true, kind };
	} catch {
		return { available: false, kind: "other" };
	}
}
