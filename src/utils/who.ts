export type Person = { id: number; first_name: string; last_name: string };

/**
 * Who logged an entry, for a list row. Only a co-owner is named: most rows are your own, so
 * labelling those would just be noise and bury the exception. Empty for your own entries, on
 * a dog with one owner, and when the person is unknown (they left the dog, or the entry
 * predates this feature).
 */
export function whoLabel(userId: number | undefined, owners: Person[], meId: number | undefined): string {
	if (userId === undefined || userId === meId || owners.length < 2) return "";
	return owners.find((o) => o.id === userId)?.first_name.trim() ?? "";
}
