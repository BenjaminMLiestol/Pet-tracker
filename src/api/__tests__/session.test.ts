import { REFRESH_MIN_INTERVAL_MS, refreshSession, resetSessionRefresh } from "../session";

const mockApiFetch = jest.fn();
const mockSetToken = jest.fn();
jest.mock("../client", () => ({ apiFetch: (...a: unknown[]) => mockApiFetch(...a) }));
jest.mock("../tokenStorage", () => ({ setToken: (...a: unknown[]) => mockSetToken(...a) }));

beforeEach(() => {
	mockApiFetch.mockReset();
	mockSetToken.mockReset();
	jest.useFakeTimers();
	jest.setSystemTime(new Date("2026-10-20T12:00:00Z"));
});
afterEach(() => jest.useRealTimers());

describe("refreshSession", () => {
	it("stores the new token and returns the user", async () => {
		mockApiFetch.mockResolvedValue({ user: { id: 1 }, token: "new" });

		await expect(refreshSession({ force: true })).resolves.toEqual({ id: 1 });
		expect(mockApiFetch).toHaveBeenCalledWith("/auth/refresh", { method: "POST" });
		expect(mockSetToken).toHaveBeenCalledWith("new");
	});

	it("runs one request at a time, so the old token is never used twice", async () => {
		mockApiFetch.mockResolvedValue({ user: { id: 1 }, token: "new" });
		jest.setSystemTime(Date.now() + REFRESH_MIN_INTERVAL_MS);

		await Promise.all([refreshSession({ force: true }), refreshSession({ force: true })]);

		expect(mockApiFetch).toHaveBeenCalledTimes(1);
	});

	it("skips a foreground refresh that comes too soon, and runs one after the interval", async () => {
		mockApiFetch.mockResolvedValue({ user: { id: 1 }, token: "new" });
		await refreshSession({ force: true });

		expect(await refreshSession()).toBeNull();
		expect(mockApiFetch).toHaveBeenCalledTimes(1);

		jest.setSystemTime(Date.now() + REFRESH_MIN_INTERVAL_MS + 1);
		expect(await refreshSession()).toEqual({ id: 1 });
		expect(mockApiFetch).toHaveBeenCalledTimes(2);
	});

	it("keeps the current token when the request fails", async () => {
		mockApiFetch.mockRejectedValue(new Error("Network request failed"));

		await expect(refreshSession({ force: true })).resolves.toBeNull();
		expect(mockSetToken).not.toHaveBeenCalled();
	});

	it("does not refresh right after a fresh sign-in", async () => {
		jest.setSystemTime(Date.now() + REFRESH_MIN_INTERVAL_MS * 2);
		resetSessionRefresh();

		expect(await refreshSession()).toBeNull();
		expect(mockApiFetch).not.toHaveBeenCalled();
	});
});
