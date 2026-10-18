import AsyncStorage from "@react-native-async-storage/async-storage";
import {
	clearFaceLogin,
	getFaceLoginEmail,
	readFaceLogin,
	saveFaceLogin,
	setOfferDeclined,
	wasOfferDeclined,
} from "../faceLogin";

jest.mock("@react-native-async-storage/async-storage", () =>
	require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
jest.mock("../biometrics", () => ({ getBiometricInfo: async () => ({ available: true, kind: "face" }) }));

const store = new Map<string, string>();
const mockSet = jest.fn(async (k: string, v: string) => void store.set(k, v));
const mockGet = jest.fn(async (k: string) => store.get(k) ?? null);
const mockDelete = jest.fn(async (k: string) => void store.delete(k));
jest.mock("expo-secure-store", () => ({
	setItemAsync: (...a: [string, string, object]) => mockSet(a[0], a[1], ...(a.slice(2) as [])),
	getItemAsync: (...a: [string, object]) => mockGet(a[0]),
	deleteItemAsync: (...a: [string]) => mockDelete(a[0]),
}));

beforeEach(async () => {
	store.clear();
	mockSet.mockClear();
	await AsyncStorage.clear();
});

describe("face login storage", () => {
	it("keeps the password in the keychain and only the email outside it", async () => {
		await saveFaceLogin({ email: "a@b.test", password: "secret123" }, "Log in");

		expect(await getFaceLoginEmail()).toBe("a@b.test");
		expect(await AsyncStorage.getAllKeys()).not.toContain("faceLogin.credentials");
		expect(JSON.stringify(await AsyncStorage.multiGet(await AsyncStorage.getAllKeys()))).not.toContain(
			"secret123",
		);
		expect(await readFaceLogin("Log in")).toEqual({ email: "a@b.test", password: "secret123" });
	});

	it("reads back nothing once cleared", async () => {
		await saveFaceLogin({ email: "a@b.test", password: "secret123" }, "Log in");
		await clearFaceLogin();

		expect(await getFaceLoginEmail()).toBeNull();
		expect(await readFaceLogin("Log in")).toBeNull();
	});

	it("treats a cancelled or failing keychain read as no login", async () => {
		mockGet.mockRejectedValueOnce(new Error("User canceled"));
		expect(await readFaceLogin("Log in")).toBeNull();

		store.set("faceLogin.credentials", "not json");
		expect(await readFaceLogin("Log in")).toBeNull();

		store.set("faceLogin.credentials", JSON.stringify({ email: "a@b.test" }));
		expect(await readFaceLogin("Log in")).toBeNull();
	});

	it("remembers a declined offer until Face ID is turned on", async () => {
		expect(await wasOfferDeclined()).toBe(false);
		await setOfferDeclined();
		expect(await wasOfferDeclined()).toBe(true);

		await saveFaceLogin({ email: "a@b.test", password: "secret123" }, "Log in");
		expect(await wasOfferDeclined()).toBe(false);
	});
});
