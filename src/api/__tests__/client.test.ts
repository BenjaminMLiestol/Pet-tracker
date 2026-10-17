import { ApiError, apiFetch, registerUnauthorizedHandler } from "../client";

jest.mock("../tokenStorage", () => ({ getToken: jest.fn(async () => "tok-123") }));

const json = (status: number, body: unknown): Response =>
	({
		ok: status >= 200 && status < 300,
		status,
		headers: { get: () => "application/json" },
		json: async () => body,
		text: async () => JSON.stringify(body),
	}) as unknown as Response;

const fetchMock = jest.fn();
beforeEach(() => {
	fetchMock.mockReset();
	(global as any).fetch = fetchMock;
	registerUnauthorizedHandler(() => {});
});

describe("apiFetch", () => {
	it("calls the versioned URL with the bearer token and JSON body", async () => {
		fetchMock.mockResolvedValue(json(201, { id: 1 }));
		await apiFetch("/feedings", { method: "POST", body: { pet_id: 1 } });

		const [url, init] = fetchMock.mock.calls[0];
		expect(url).toBe("http://localhost:8000/api/v1/feedings");
		expect(init.headers.Authorization).toBe("Bearer tok-123");
		expect(init.body).toBe(JSON.stringify({ pet_id: 1 }));
	});

	it("uses the server's message for failed requests", async () => {
		fetchMock.mockResolvedValue(json(422, { message: "x", errors: { value: ["Too heavy"] } }));
		await expect(apiFetch("/weights", { method: "POST", body: {} })).rejects.toMatchObject({
			message: "Too heavy",
			status: 422,
		});
	});

	it("logs out on 401, except for login/register where 401 means a wrong password", async () => {
		const onUnauthorized = jest.fn();
		registerUnauthorizedHandler(onUnauthorized);

		fetchMock.mockResolvedValue(json(401, { message: "Unauthenticated" }));
		await expect(apiFetch("/pets")).rejects.toThrow("Unauthorized");
		expect(onUnauthorized).toHaveBeenCalledTimes(1);

		fetchMock.mockResolvedValue(json(401, { message: "Invalid credentials" }));
		await expect(apiFetch("/auth/login", { method: "POST", body: {} })).rejects.toThrow(
			"Invalid credentials",
		);
		expect(onUnauthorized).toHaveBeenCalledTimes(1);
	});

	it("retries a GET once after a network failure", async () => {
		fetchMock.mockRejectedValueOnce(new TypeError("Network request failed"));
		fetchMock.mockResolvedValueOnce(json(200, { data: [] }));

		await expect(apiFetch("/pets")).resolves.toEqual({ data: [] });
		expect(fetchMock).toHaveBeenCalledTimes(2);
	});

	it("retries a GET after a 5xx but not after a 4xx", async () => {
		fetchMock.mockResolvedValueOnce(json(503, {}));
		fetchMock.mockResolvedValueOnce(json(200, []));
		await apiFetch("/pets");
		expect(fetchMock).toHaveBeenCalledTimes(2);

		fetchMock.mockReset();
		fetchMock.mockResolvedValue(json(404, { message: "Not found" }));
		await expect(apiFetch("/pets/9")).rejects.toMatchObject({ status: 404 });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("never retries writes", async () => {
		fetchMock.mockRejectedValue(new TypeError("Network request failed"));
		await expect(apiFetch("/feedings", { method: "POST", body: {} })).rejects.toMatchObject({
			kind: "network",
		});
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("reports a timeout when the request is aborted", async () => {
		const abort = Object.assign(new Error("aborted"), { name: "AbortError" });
		fetchMock.mockRejectedValue(abort);
		const err = (await apiFetch("/feedings", { method: "POST", body: {} }).catch((e) => e)) as ApiError;
		expect(err).toBeInstanceOf(ApiError);
		expect(err.kind).toBe("timeout");
	});
});
