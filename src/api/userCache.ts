import AsyncStorage from "@react-native-async-storage/async-storage";

// Every per-user cache key (active pet, pet bundles, care records) lives under this prefix,
// so signing out can wipe one user's data before the next user signs in.
export const USER_CACHE_PREFIX = "pet-tracker/";

export async function clearUserCache(): Promise<void> {
	const keys = await AsyncStorage.getAllKeys();
	const mine = keys.filter((k) => k.startsWith(USER_CACHE_PREFIX));
	if (mine.length > 0) await AsyncStorage.multiRemove(mine);
}
