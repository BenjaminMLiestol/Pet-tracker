// Invitation codes are 8 characters from an alphabet without look-alikes (no 0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 8;

/** What the person typed ("abcd - efgh ") to the bare code ("ABCDEFGH"). */
export function normalizeCode(input: string): string {
	return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "ABCDEFGH" -> "ABCD-EFGH": easier to read aloud and to type. */
export function formatCode(code: string): string {
	const bare = normalizeCode(code);
	return bare.length > 4 ? `${bare.slice(0, 4)}-${bare.slice(4)}` : bare;
}

/** True when it could be a real code, so the Join button can wait until it might work. */
export function looksLikeCode(input: string): boolean {
	const bare = normalizeCode(input);
	return bare.length === CODE_LENGTH && [...bare].every((ch) => ALPHABET.includes(ch));
}
