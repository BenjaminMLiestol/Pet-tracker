import i18n from "../i18n";
import { ApiError } from "./client";

// User-facing text for a failed request.
export function describeError(e: unknown): string {
	if (e instanceof ApiError) {
		if (e.kind === "network" || e.kind === "timeout")
			return i18n.t("error_offline");
		// Validation errors carry a readable message from the server.
		if (e.status === 422) return e.message;
	}
	return i18n.t("error_save_failed");
}
