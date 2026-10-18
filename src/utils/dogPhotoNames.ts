// Dog photos are kept on the phone as files named "<dogId>-<time>.jpg". A new name for every
// photo means the picture can be cached for good and a change always shows (an image shown
// from a file path never refreshes if the same path is overwritten).

const PATTERN = /^(\d+)-(\d+)\.jpg$/;

export function photoFileName(petId: number, now: number): string {
	return `${petId}-${now}.jpg`;
}

/** The newest photo among `names` that belongs to the dog, or null. */
export function newestPhotoName(names: string[], petId: number): string | null {
	let best: { name: string; at: number } | null = null;
	for (const name of names) {
		const m = PATTERN.exec(name);
		if (!m || Number(m[1]) !== petId) continue;
		const at = Number(m[2]);
		if (!best || at > best.at) best = { name, at };
	}
	return best?.name ?? null;
}

/** Every photo file that belongs to the dog (older ones are removed when a new one is saved). */
export function photoNamesFor(names: string[], petId: number): string[] {
	return names.filter((n) => {
		const m = PATTERN.exec(n);
		return !!m && Number(m[1]) === petId;
	});
}
