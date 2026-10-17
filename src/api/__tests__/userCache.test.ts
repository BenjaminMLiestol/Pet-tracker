import AsyncStorage from "@react-native-async-storage/async-storage";
import { clearUserCache } from "../userCache";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

it("removes per-user cache keys but keeps device preferences", async () => {
	await AsyncStorage.multiSet([
		["pet-tracker/active-pet-id", "1"],
		["pet-tracker/cache/v2/1", "{}"],
		["pet-tracker/care-cache/v1/1", "{}"],
		["app/reminders-enabled", "true"],
	]);

	await clearUserCache();

	expect(await AsyncStorage.getAllKeys()).toEqual(["app/reminders-enabled"]);
});
