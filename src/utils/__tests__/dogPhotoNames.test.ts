import { newestPhotoName, photoFileName, photoNamesFor } from "../dogPhotoNames";

describe("dog photo file names", () => {
	it("names a photo after the dog and the time", () => {
		expect(photoFileName(3, 1790000000000)).toBe("3-1790000000000.jpg");
	});

	it("finds the newest photo of one dog and ignores the others", () => {
		const names = ["1-100.jpg", "1-300.jpg", "1-200.jpg", "12-999.jpg", "2-500.jpg"];
		expect(newestPhotoName(names, 1)).toBe("1-300.jpg");
		expect(newestPhotoName(names, 12)).toBe("12-999.jpg");
		expect(newestPhotoName(names, 2)).toBe("2-500.jpg");
	});

	it("does not mix up dog 1 with dog 11 or 21", () => {
		expect(newestPhotoName(["11-5.jpg", "21-9.jpg"], 1)).toBeNull();
		expect(photoNamesFor(["11-5.jpg", "1-2.jpg", "21-9.jpg"], 1)).toEqual(["1-2.jpg"]);
	});

	it("is null for no photo, and skips files that are not photos", () => {
		expect(newestPhotoName([], 1)).toBeNull();
		expect(newestPhotoName([".DS_Store", "1-abc.jpg", "1-5.png", "x-5.jpg"], 1)).toBeNull();
		expect(photoNamesFor([".DS_Store", "1-5.png"], 1)).toEqual([]);
	});
});
