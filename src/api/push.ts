import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { apiFetch } from "./client";

// Remote push is best effort. It needs a build with the push entitlement (a paid Apple
// Developer account) and an EAS project id; without them every call here is a quiet no-op.

const REGISTERED_KEY = "push/registered";
const TOKEN_KEY = "push/token";

function projectId(): string | undefined {
	return Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
}

/**
 * Sends this phone's push token to the server so co-owners' activity can reach it. Never
 * asks for permission (the reminders switch does that); it just follows it. Safe to call
 * often: the server is only told when the token or the signed-in person changed.
 */
export async function registerForPush(userId: number): Promise<void> {
	try {
		const id = projectId();
		if (!id) return;
		if (!(await Notifications.getPermissionsAsync()).granted) return;

		const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId: id });
		const key = `${userId}:${token}`;
		if ((await AsyncStorage.getItem(REGISTERED_KEY)) === key) return;

		await apiFetch("/devices", {
			method: "POST",
			body: { token, platform: Platform.OS === "ios" ? "ios" : "android" },
		});
		await AsyncStorage.multiSet([
			[REGISTERED_KEY, key],
			[TOKEN_KEY, token],
		]);
	} catch {
		// No entitlement, simulator, offline: reminders still work locally.
	}
}

/** Stops pushes to this phone for the person signing out. Call before the session ends. */
export async function unregisterFromPush(): Promise<void> {
	try {
		const token = await AsyncStorage.getItem(TOKEN_KEY);
		await AsyncStorage.multiRemove([REGISTERED_KEY, TOKEN_KEY]);
		if (token) await apiFetch("/devices", { method: "DELETE", body: { token } });
	} catch {
		// The server also forgets a token when its owner signs in on another account.
	}
}
