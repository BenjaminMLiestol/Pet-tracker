// What the vet summary (PDF) and the health-data backup (CSV) are built from. Pure functions:
// the screens and the share sheet live elsewhere (src/api/exportFiles.ts).

export type CareExport = {
	// Vet: reason. Vaccination: vaccine name. Parasite: product (may be empty).
	name: string;
	parasiteType?: string | null;
	date: number;
	nextDueAt: number | null;
	notes: string | null;
};

export type ExportData = {
	dog: { name: string; breed: string; birthday: string | null };
	timeZone: string;
	generatedAt: number;
	weights: { timestamp: number; weightKg: number }[];
	baths: { timestamp: number }[];
	vaccinations: CareExport[];
	parasites: CareExport[];
	vet: CareExport[];
};

export type ExportLabels = {
	title: string;
	// "Prepared {{date}}"
	prepared: string;
	breed: string;
	born: string;
	currentWeight: string;
	lastBath: string;
	weights: string;
	vaccinations: string;
	parasites: string;
	vet: string;
	date: string;
	name: string;
	type: string;
	product: string;
	reason: string;
	nextDue: string;
	notes: string;
	none: string;
	// Parasite type names by key: flea, tick, worm.
	parasiteTypes: Record<string, string>;
	moreWeights: (count: number) => string;
};


/** Weigh-ins shown in the PDF; the CSV has them all. */
export const PDF_WEIGHT_ROWS = 15;

export function escapeHtml(value: unknown): string {
	return String(value ?? "")
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function safeZone(timeZone: string): string | undefined {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone });
		return timeZone;
	} catch {
		return undefined;
	}
}

/** "20 Oct 2026" in the dog's timezone and the reader's language. */
export function formatDate(ts: number, locale: string, timeZone: string): string {
	return new Intl.DateTimeFormat(locale, {
		day: "numeric",
		month: "short",
		year: "numeric",
		timeZone: safeZone(timeZone),
	}).format(ts);
}

/** "2026-10-20": the day in the dog's timezone, in a form spreadsheets sort and parse. */
export function isoDay(ts: number, timeZone: string): string {
	return new Intl.DateTimeFormat("en-CA", {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		timeZone: safeZone(timeZone),
	}).format(ts);
}

const newestFirst = <T extends { date?: number; timestamp?: number }>(rows: T[]) =>
	[...rows].sort((a, b) => (b.date ?? b.timestamp ?? 0) - (a.date ?? a.timestamp ?? 0));

// ===================== PDF (HTML) =====================

const STYLE = `
@page { margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #15171c; font-size: 11pt; line-height: 1.4; }
h1 { font-size: 22pt; margin: 0 0 2pt; }
h2 { font-size: 13pt; margin: 20pt 0 6pt; padding-bottom: 3pt; border-bottom: 1.5pt solid #e1a04a; }
.sub { color: #5d6370; margin: 0; }
.facts { margin: 12pt 0 0; }
.facts div { margin: 2pt 0; }
.facts b { display: inline-block; min-width: 90pt; font-weight: 600; }
table { width: 100%; border-collapse: collapse; margin-top: 2pt; }
th { text-align: left; font-size: 9pt; color: #5d6370; font-weight: 600; padding: 3pt 6pt 3pt 0; border-bottom: 0.5pt solid #c9ccd3; }
td { padding: 4pt 6pt 4pt 0; vertical-align: top; border-bottom: 0.5pt solid #eceef2; }
td.num { white-space: nowrap; font-variant-numeric: tabular-nums; }
table.narrow { width: 55%; }
.empty { color: #5d6370; margin: 4pt 0; }
.more { color: #5d6370; font-size: 9pt; margin-top: 4pt; }
`;

function table(headers: string[], rows: string[][], className = ""): string {
	const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
	const body = rows
		.map((r) => `<tr>${r.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
		.join("");
	return `<table${className ? ` class="${className}"` : ""}><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/** The vet summary as a complete HTML document (printed to PDF). Every user-written text is escaped. */
export function buildSummaryHtml(data: ExportData, labels: ExportLabels, locale: string): string {
	const d = (ts: number) => escapeHtml(formatDate(ts, locale, data.timeZone));
	const nextDue = (ts: number | null) => (ts === null ? "" : d(ts));
	const empty = `<p class="empty">${escapeHtml(labels.none)}</p>`;

	const weights = newestFirst(data.weights.map((w) => ({ ...w, date: w.timestamp })));
	const shownWeights = weights.slice(0, PDF_WEIGHT_ROWS);
	const lastBath = newestFirst(data.baths.map((b) => ({ ...b, date: b.timestamp })))[0];

	const facts: string[] = [];
	if (data.dog.breed) facts.push(`<div><b>${escapeHtml(labels.breed)}</b>${escapeHtml(data.dog.breed)}</div>`);
	if (data.dog.birthday) facts.push(`<div><b>${escapeHtml(labels.born)}</b>${escapeHtml(data.dog.birthday)}</div>`);
	if (weights[0])
		facts.push(
			`<div><b>${escapeHtml(labels.currentWeight)}</b>${escapeHtml(weights[0].weightKg.toFixed(1))} kg (${d(weights[0].timestamp)})</div>`,
		);
	if (lastBath) facts.push(`<div><b>${escapeHtml(labels.lastBath)}</b>${d(lastBath.timestamp)}</div>`);

	const weightSection = weights.length
		? table(
				[labels.date, "kg"],
				shownWeights.map((w) => [`<span class="num">${d(w.timestamp)}</span>`, `${escapeHtml(w.weightKg.toFixed(1))}`]),
				"narrow",
			) +
			(weights.length > shownWeights.length
				? `<p class="more">${escapeHtml(labels.moreWeights(weights.length - shownWeights.length))}</p>`
				: "")
		: empty;

	const vaccinations = newestFirst(data.vaccinations);
	const vaccinationSection = vaccinations.length
		? table(
				[labels.name, labels.date, labels.nextDue, labels.notes],
				vaccinations.map((v) => [escapeHtml(v.name), d(v.date), nextDue(v.nextDueAt), escapeHtml(v.notes ?? "")]),
			)
		: empty;

	const parasites = newestFirst(data.parasites);
	const parasiteSection = parasites.length
		? table(
				[labels.type, labels.product, labels.date, labels.nextDue, labels.notes],
				parasites.map((p) => [
					escapeHtml(labels.parasiteTypes[p.parasiteType ?? ""] ?? p.parasiteType ?? ""),
					escapeHtml(p.name),
					d(p.date),
					nextDue(p.nextDueAt),
					escapeHtml(p.notes ?? ""),
				]),
			)
		: empty;

	const vet = newestFirst(data.vet);
	const vetSection = vet.length
		? table(
				[labels.reason, labels.date, labels.nextDue, labels.notes],
				vet.map((v) => [escapeHtml(v.name), d(v.date), nextDue(v.nextDueAt), escapeHtml(v.notes ?? "")]),
			)
		: empty;

	return `<!DOCTYPE html><html lang="${escapeHtml(locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><style>${STYLE}</style></head><body>
<h1>${escapeHtml(data.dog.name)}</h1>
<p class="sub">${escapeHtml(labels.title)} · ${escapeHtml(labels.prepared)}</p>
<div class="facts">${facts.join("")}</div>
<h2>${escapeHtml(labels.weights)}</h2>${weightSection}
<h2>${escapeHtml(labels.vaccinations)}</h2>${vaccinationSection}
<h2>${escapeHtml(labels.parasites)}</h2>${parasiteSection}
<h2>${escapeHtml(labels.vet)}</h2>${vetSection}
</body></html>`;
}

// ===================== CSV =====================

export const CSV_HEADER = ["type", "date", "value", "detail", "next_due", "notes"];

/**
 * One CSV cell. Quoted when it holds a comma, quote or line break. A cell that starts with
 * = + - or @ would run as a formula when opened in Excel or Sheets, so it gets a leading '.
 */
export function csvCell(value: unknown): string {
	let text = String(value ?? "");
	if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
	return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** All the health data in one spreadsheet-friendly file, oldest first. UTF-8 with a BOM so Excel reads æøå. */
export function buildCsv(data: ExportData): string {
	const day = (ts: number) => isoDay(ts, data.timeZone);
	const rows: { sort: number; cells: unknown[] }[] = [];

	for (const w of data.weights)
		rows.push({ sort: w.timestamp, cells: ["weight", day(w.timestamp), w.weightKg, "", "", ""] });
	for (const b of data.baths) rows.push({ sort: b.timestamp, cells: ["bath", day(b.timestamp), "", "", "", ""] });
	for (const v of data.vaccinations)
		rows.push({
			sort: v.date,
			cells: ["vaccination", day(v.date), "", v.name, v.nextDueAt === null ? "" : day(v.nextDueAt), v.notes ?? ""],
		});
	for (const p of data.parasites)
		rows.push({
			sort: p.date,
			cells: [
				"treatment",
				day(p.date),
				"",
				[p.parasiteType, p.name].filter(Boolean).join(" "),
				p.nextDueAt === null ? "" : day(p.nextDueAt),
				p.notes ?? "",
			],
		});
	for (const v of data.vet)
		rows.push({
			sort: v.date,
			cells: ["vet_visit", day(v.date), "", v.name, v.nextDueAt === null ? "" : day(v.nextDueAt), v.notes ?? ""],
		});

	rows.sort((a, b) => a.sort - b.sort);
	const lines = [CSV_HEADER, ...rows.map((r) => r.cells)].map((cells) => cells.map(csvCell).join(","));
	return `﻿${lines.join("\r\n")}\r\n`;
}

/** A file name that is safe on every system: "toya-vet-summary-2026-10-20.pdf". */
export function exportFileName(dogName: string, kind: "vet-summary" | "health-data", ext: "pdf" | "csv", ts: number, timeZone: string): string {
	const slug =
		dogName
			// Letters that don't split into a base letter plus an accent.
			.replace(/ø/gi, "o")
			.replace(/æ/gi, "ae")
			.replace(/ß/g, "ss")
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.replace(/[^a-zA-Z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.toLowerCase() || "dog";
	return `${slug}-${kind}-${isoDay(ts, timeZone)}.${ext}`;
}

