import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { File, Paths } from "expo-file-system";

// Turns the export into a file and opens the share sheet (Save to Files, AirDrop, Mail, ...).
// Files are made in the cache folder under a readable name; the system may clear them later.

export type ExportKind = "pdf" | "csv";

const MIME: Record<ExportKind, string> = { pdf: "application/pdf", csv: "text/csv" };
const UTI: Record<ExportKind, string> = { pdf: "com.adobe.pdf", csv: "public.comma-separated-values-text" };

// A4 in points: what the print engine expects.
const A4 = { width: 595, height: 842 };

async function share(file: File, kind: ExportKind, dialogTitle: string): Promise<void> {
	if (!(await Sharing.isAvailableAsync())) throw new Error("Sharing is not available on this device");
	await Sharing.shareAsync(file.uri, { mimeType: MIME[kind], UTI: UTI[kind], dialogTitle });
}

/** Replaces any earlier export with the same name, then returns the file ready to share. */
function target(fileName: string): File {
	const file = new File(Paths.cache, fileName);
	if (file.exists) file.delete();
	return file;
}

export async function sharePdf(html: string, fileName: string, dialogTitle: string): Promise<void> {
	const printed = await Print.printToFileAsync({ html, ...A4 });
	const named = target(fileName);
	new File(printed.uri).move(named);
	await share(named, "pdf", dialogTitle);
}

export async function shareCsv(csv: string, fileName: string, dialogTitle: string): Promise<void> {
	const file = target(fileName);
	file.create();
	// Written as bytes: the text writer drops the leading byte-order mark that makes Excel
	// read æøå correctly.
	file.write(new TextEncoder().encode(csv));
	await share(file, "csv", dialogTitle);
}
