import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import { useCare } from "../context/CareContext";
import { sharePdf, shareCsv } from "../api/exportFiles";
import {
	buildCsv,
	buildSummaryHtml,
	exportFileName,
	formatDate,
	type ExportData,
	type ExportLabels,
} from "../utils/exportData";

// Builds the vet summary (PDF) and the health-data backup (CSV) from what is loaded and opens
// the share sheet. `busy` is the one running; `error` is true when the last attempt failed.
export function useExport() {
	const { t, i18n } = useTranslation();
	const { name, breed, birthday, timezone, weights, baths } = usePet();
	const { records } = useCare();
	const [busy, setBusy] = useState<"pdf" | "csv" | null>(null);
	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";

	const run = useCallback(
		async (kind: "pdf" | "csv"): Promise<boolean> => {
			if (busy) return false;
			setBusy(kind);
			try {
				const now = Date.now();
				const data: ExportData = {
					dog: {
						name,
						breed,
						// A plain date, shown as written, so read it as UTC to keep the day.
						birthday: birthday ? formatDate(Date.parse(birthday), locale, "UTC") : null,
					},
					timeZone: timezone,
					generatedAt: now,
					weights: weights.filter((w) => !w.pending).map((w) => ({ timestamp: w.timestamp, weightKg: w.weightKg })),
					baths: baths.filter((b) => !b.pending).map((b) => ({ timestamp: b.timestamp })),
					vaccinations: records.vaccination.map((r) => ({ name: r.name, date: r.date, nextDueAt: r.nextDueAt, notes: r.notes })),
					parasites: records.parasite.map((r) => ({
						name: r.name,
						parasiteType: r.parasiteType,
						date: r.date,
						nextDueAt: r.nextDueAt,
						notes: r.notes,
					})),
					vet: records.vet.map((r) => ({ name: r.name, date: r.date, nextDueAt: r.nextDueAt, notes: r.notes })),
				};
				if (kind === "pdf") {
					const labels: ExportLabels = {
						title: t("summary_title"),
						prepared: t("summary_prepared", { date: formatDate(now, locale, timezone) }),
						breed: t("summary_breed"),
						born: t("summary_born"),
						currentWeight: t("summary_current_weight"),
						lastBath: t("summary_last_bath"),
						weights: t("summary_weights"),
						vaccinations: t("care_section_vaccination"),
						parasites: t("care_section_parasite"),
						vet: t("care_section_vet"),
						date: t("col_date"),
						name: t("col_name"),
						type: t("col_type"),
						product: t("col_product"),
						reason: t("col_reason"),
						nextDue: t("col_next_due"),
						notes: t("col_notes"),
						none: t("summary_none"),
						parasiteTypes: { flea: t("parasite_flea"), tick: t("parasite_tick"), worm: t("parasite_worm") },
						moreWeights: (count) => t("summary_more_weights", { count }),
					};
					await sharePdf(
						buildSummaryHtml(data, labels, locale),
						exportFileName(name, "vet-summary", "pdf", now, timezone),
						t("export_pdf"),
					);
				} else {
					await shareCsv(buildCsv(data), exportFileName(name, "health-data", "csv", now, timezone), t("export_csv"));
				}
				return true;
			} catch (e) {
				console.warn("Export failed", e);
				return false;
			} finally {
				setBusy(null);
			}
		},
		[busy, name, breed, birthday, timezone, weights, baths, records, t, locale],
	);

	return { busy, exportPdf: () => run("pdf"), exportCsv: () => run("csv") };
}
