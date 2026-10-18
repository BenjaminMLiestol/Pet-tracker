import {
	CSV_HEADER,
	PDF_WEIGHT_ROWS,
	buildCsv,
	buildSummaryHtml,
	csvCell,
	escapeHtml,
	exportFileName,
	isoDay,
	type ExportData,
	type ExportLabels,
} from "../exportData";

const at = (iso: string) => Date.parse(iso);

const labels: ExportLabels = {
	title: "Vet summary",
	prepared: "Prepared 20 Oct 2026",
	breed: "Breed",
	born: "Born",
	currentWeight: "Current weight",
	lastBath: "Last bath",
	weights: "Weight",
	vaccinations: "Vaccinations",
	parasites: "Flea, tick & worming",
	vet: "Vet visits",
	date: "Date",
	name: "Name",
	type: "Type",
	product: "Product",
	reason: "Reason",
	nextDue: "Next due",
	notes: "Notes",
	none: "Nothing logged",
	parasiteTypes: { flea: "Flea", tick: "Tick", worm: "Worm" },
	moreWeights: (n) => `${n} older weigh-ins are in the app`,
};

const data = (over: Partial<ExportData> = {}): ExportData => ({
	dog: { name: "Toya", breed: "Finnish lapphund", birthday: "30 Oct 2021" },
	timeZone: "Europe/Oslo",
	generatedAt: at("2026-10-20T10:00:00Z"),
	weights: [
		{ timestamp: at("2026-10-01T10:00:00Z"), weightKg: 24.5 },
		{ timestamp: at("2026-10-15T10:00:00Z"), weightKg: 24.8 },
	],
	baths: [{ timestamp: at("2026-10-05T10:00:00Z") }],
	vaccinations: [
		{ name: "Rabies", date: at("2025-11-10T10:00:00Z"), nextDueAt: at("2026-11-10T10:00:00Z"), notes: null },
	],
	parasites: [
		{ name: "Frontline", parasiteType: "flea", date: at("2026-09-01T10:00:00Z"), nextDueAt: null, notes: "Spot-on" },
	],
	vet: [{ name: "Checkup", date: at("2026-08-20T10:00:00Z"), nextDueAt: null, notes: "All good" }],
	...over,
});

describe("escapeHtml", () => {
	it("escapes everything that could break out of the page", () => {
		expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
			"&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
		);
		expect(escapeHtml(null)).toBe("");
	});
});

describe("buildSummaryHtml", () => {
	const html = buildSummaryHtml(data(), labels, "en-GB");

	it("is a complete document with the dog, its facts and every section", () => {
		expect(html.startsWith("<!DOCTYPE html>")).toBe(true);
		expect(html).toContain("<h1>Toya</h1>");
		expect(html).toContain("Finnish lapphund");
		expect(html).toContain("30 Oct 2021");
		for (const heading of ["Weight", "Vaccinations", "Flea, tick &amp; worming", "Vet visits"]) {
			expect(html).toContain(`<h2>${heading}</h2>`);
		}
	});

	it("shows the newest weight as the current one, and lists weigh-ins newest first", () => {
		expect(html).toContain("24.8 kg (15 Oct 2026)");
		expect(html.indexOf("15 Oct 2026")).toBeLessThan(html.indexOf("1 Oct 2026</span>"));
	});

	it("lists vaccines, treatments with their type name, and vet visits with notes", () => {
		expect(html).toContain("Rabies");
		expect(html).toContain("10 Nov 2026");
		expect(html).toContain("Flea");
		expect(html).toContain("Frontline");
		expect(html).toContain("Spot-on");
		expect(html).toContain("Checkup");
		expect(html).toContain("All good");
	});

	it("escapes text the user wrote", () => {
		const evil = buildSummaryHtml(
			data({
				dog: { name: "<b>Toya</b>", breed: "", birthday: null },
				vet: [{ name: "<img src=x onerror=alert(1)>", date: at("2026-08-20T10:00:00Z"), nextDueAt: null, notes: "a & b" }],
			}),
			labels,
			"en-GB",
		);
		expect(evil).not.toContain("<img");
		expect(evil).not.toContain("<b>Toya</b>");
		expect(evil).toContain("&lt;img src=x onerror=alert(1)&gt;");
		expect(evil).toContain("a &amp; b");
	});

	it("puts the dog's photo in the header, and only if it is plain base64", () => {
		const withPhoto = buildSummaryHtml(
			data({ dog: { name: "Toya", breed: "", birthday: null, photo: "/9j/4AAQSkZJRg==" } }),
			labels,
			"en-GB",
		);
		expect(withPhoto).toContain('<img class="photo" alt="" src="data:image/jpeg;base64,/9j/4AAQSkZJRg==">');

		// Anything that could close the tag or add attributes is left out entirely.
		for (const bad of ['x" onerror="alert(1)', "x><script>", "<svg onload=1>"]) {
			const out = buildSummaryHtml(data({ dog: { name: "Toya", breed: "", birthday: null, photo: bad } }), labels, "en-GB");
			expect(out).not.toContain("<img");
			expect(out).not.toContain("onerror");
		}
		expect(buildSummaryHtml(data(), labels, "en-GB")).not.toContain("<img");
	});

	it("says so for an empty section instead of printing an empty table", () => {
		const empty = buildSummaryHtml(data({ vaccinations: [], parasites: [], vet: [], weights: [] }), labels, "en-GB");
		expect(empty.match(/Nothing logged/g)).toHaveLength(4);
		expect(empty).not.toContain("<table>");
		expect(empty).not.toContain("Current weight");
	});

	it("caps the weight table and says how many more there are", () => {
		const many = Array.from({ length: PDF_WEIGHT_ROWS + 5 }, (_, i) => ({
			timestamp: at("2026-01-01T10:00:00Z") + i * 86400000,
			weightKg: 20 + i / 10,
		}));
		const out = buildSummaryHtml(data({ weights: many }), labels, "en-GB");
		expect(out).toContain("5 older weigh-ins are in the app");
		// 15 weight rows + the header row, plus one row each in the other three tables' bodies.
		expect(out.split("<tr>").length - 1).toBe(PDF_WEIGHT_ROWS + 1 + 1 + 1 + 1 + 1 + 1 + 1);
	});

	it("reads dates in the dog's timezone", () => {
		const late = buildSummaryHtml(
			data({ weights: [{ timestamp: at("2026-10-14T23:30:00Z"), weightKg: 24 }] }),
			labels,
			"en-GB",
		);
		expect(late).toContain("15 Oct 2026"); // already the 15th in Oslo
	});
});

describe("csvCell", () => {
	it("leaves plain text alone and quotes what needs it", () => {
		expect(csvCell("Rabies")).toBe("Rabies");
		expect(csvCell("a, b")).toBe('"a, b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell("two\nlines")).toBe('"two\nlines"');
		expect(csvCell(null)).toBe("");
		expect(csvCell(24.8)).toBe("24.8");
	});

	it("defuses spreadsheet formulas", () => {
		expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
		expect(csvCell("+1")).toBe("'+1");
		expect(csvCell("-2")).toBe("'-2");
		expect(csvCell("@cmd")).toBe("'@cmd");
	});
});

describe("buildCsv", () => {
	const csv = buildCsv(data());
	const lines = csv.replace(/^﻿/, "").trimEnd().split("\r\n");

	it("starts with a BOM and the header, and uses CRLF", () => {
		expect(csv.startsWith("﻿")).toBe(true);
		expect(lines[0]).toBe(CSV_HEADER.join(","));
		expect(csv.endsWith("\r\n")).toBe(true);
	});

	it("has one line per entry, oldest first, with ISO dates", () => {
		expect(lines).toHaveLength(1 + 2 + 1 + 1 + 1 + 1);
		expect(lines[1]).toBe("vaccination,2025-11-10,,Rabies,2026-11-10,");
		expect(lines.map((l) => l.split(",")[1]).slice(1)).toEqual(
			[...lines.map((l) => l.split(",")[1]).slice(1)].sort(),
		);
	});

	it("writes weights as numbers and treatments with their type", () => {
		expect(lines).toContain("weight,2026-10-15,24.8,,,");
		expect(lines).toContain("treatment,2026-09-01,,flea Frontline,,Spot-on");
		expect(lines).toContain("bath,2026-10-05,,,,");
		expect(lines).toContain("vet_visit,2026-08-20,,Checkup,,All good");
	});

	it("keeps notes with commas and quotes intact", () => {
		const tricky = buildCsv(
			data({
				vet: [{ name: "Check, up", date: at("2026-08-20T10:00:00Z"), nextDueAt: null, notes: 'said "ok"' }],
			}),
		);
		expect(tricky).toContain('vet_visit,2026-08-20,,"Check, up",,"said ""ok"""');
	});
});

describe("isoDay and exportFileName", () => {
	it("uses the dog's calendar day", () => {
		expect(isoDay(at("2026-10-14T23:30:00Z"), "Europe/Oslo")).toBe("2026-10-15");
		expect(isoDay(at("2026-10-14T23:30:00Z"), "America/New_York")).toBe("2026-10-14");
	});

	it("makes a safe file name", () => {
		const ts = at("2026-10-20T10:00:00Z");
		expect(exportFileName("Toya", "vet-summary", "pdf", ts, "Europe/Oslo")).toBe("toya-vet-summary-2026-10-20.pdf");
		expect(exportFileName("Sølvi & Åse / 2", "health-data", "csv", ts, "Europe/Oslo")).toBe("solvi-ase-2-health-data-2026-10-20.csv");
		expect(exportFileName("🐶", "health-data", "csv", ts, "Europe/Oslo")).toBe("dog-health-data-2026-10-20.csv");
	});
});
