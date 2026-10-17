import { formatCode, looksLikeCode, normalizeCode } from "../inviteCode";

describe("invite codes", () => {
	it("normalises however it was typed", () => {
		expect(normalizeCode("abcd-efgh")).toBe("ABCDEFGH");
		expect(normalizeCode("  ab cd – ef gh ")).toBe("ABCDEFGH");
		expect(normalizeCode("")).toBe("");
	});

	it("formats with a dash after four characters, as you type", () => {
		expect(formatCode("ABCDEFGH")).toBe("ABCD-EFGH");
		expect(formatCode("abcd")).toBe("ABCD");
		expect(formatCode("abcde")).toBe("ABCD-E");
		expect(formatCode("ABCD-EFGH")).toBe("ABCD-EFGH");
	});

	it("only calls a full code valid when every character can appear in one", () => {
		expect(looksLikeCode("ABCD-EFGH")).toBe(true);
		expect(looksLikeCode("k7m2 q9rt")).toBe(true);
		expect(looksLikeCode("ABCDEFG")).toBe(false); // too short
		expect(looksLikeCode("ABCDEFGHJ")).toBe(false); // too long
		expect(looksLikeCode("ABCD-EF0H")).toBe(false); // 0 is never used
		expect(looksLikeCode("ABCD-EFIL")).toBe(false); // I and L are never used
	});
});
