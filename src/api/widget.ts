import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import { parsePendingLogs, type PendingWidgetLog, type WidgetSnapshot } from "../utils/widgetSnapshot";

// The home-screen widget lives in its own process and can't see the app's memory. They share
// one App Group storage: the app writes a snapshot there (and the login, so the widget's
// buttons can log without opening the app); the widget writes back anything it couldn't send.
// Everything here is best effort: without the widget (Android, a build without the target) it
// quietly does nothing.

const GROUP = "group.com.benjaminliestol.pettracker";
const SNAPSHOT_KEY = "petSnapshot";
const PENDING_KEY = "pendingLogs";

let storage: ExtensionStorage | null | undefined;
function shared(): ExtensionStorage | null {
	if (Platform.OS !== "ios") return null;
	if (storage === undefined) {
		try {
			storage = new ExtensionStorage(GROUP);
		} catch {
			storage = null;
		}
	}
	return storage;
}

// The last thing published, without its timestamp: an unchanged snapshot isn't written (or
// reloaded) again, which keeps the widget's reload budget for real changes.
let lastPublished: string | null = null;

export function publishSnapshot(snapshot: WidgetSnapshot): void {
	try {
		const { updatedAt: _ignored, ...content } = snapshot;
		const key = JSON.stringify(content);
		if (key === lastPublished) return;
		lastPublished = key;
		shared()?.set(SNAPSHOT_KEY, JSON.stringify(snapshot));
		ExtensionStorage.reloadWidget();
	} catch {
		// no widget, nothing to update
	}
}

/** On sign-out: the widget must not keep a login or a dog's data. */
export function clearWidgetData(): void {
	lastPublished = null;
	try {
		const s = shared();
		s?.remove(SNAPSHOT_KEY);
		s?.remove(PENDING_KEY);
		ExtensionStorage.reloadWidget();
	} catch {
		// nothing to clear
	}
}

/** Logs the widget couldn't send, handed over once: they are removed from the shared storage. */
export function takePendingLogs(): PendingWidgetLog[] {
	try {
		const s = shared();
		if (!s) return [];
		const logs = parsePendingLogs(s.get(PENDING_KEY));
		if (logs.length > 0) s.remove(PENDING_KEY);
		return logs;
	} catch {
		return [];
	}
}
