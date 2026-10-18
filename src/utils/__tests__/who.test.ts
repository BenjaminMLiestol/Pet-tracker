import { whoLabel } from "../who";

const ben = { id: 1, first_name: "Benjamin", last_name: "B" };
const kari = { id: 2, first_name: " Kari ", last_name: "K" };

describe("whoLabel", () => {
	it("names a co-owner by first name", () => {
		expect(whoLabel(2, [ben, kari], 1)).toBe("Kari");
	});

	it("says nothing about your own entries", () => {
		expect(whoLabel(1, [ben, kari], 1)).toBe("");
	});

	it("stays empty on a dog with one owner", () => {
		expect(whoLabel(1, [ben], 1)).toBe("");
		expect(whoLabel(2, [], 1)).toBe("");
	});

	it("stays empty when the person is unknown", () => {
		expect(whoLabel(undefined, [ben, kari], 1)).toBe("");
		expect(whoLabel(99, [ben, kari], 1)).toBe("");
	});
});
