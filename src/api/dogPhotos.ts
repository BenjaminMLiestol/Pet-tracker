import { useEffect, useState } from "react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { Directory, File, Paths } from "expo-file-system";
import { newestPhotoName, photoFileName, photoNamesFor } from "../utils/dogPhotoNames";

// A dog's photo lives on this phone only: nothing is uploaded, so a co-owner chooses their own
// (or none) and it is gone if the app is deleted. Square, 800 px, in the app's own folder.

const SIZE = 800;
const folder = () => new Directory(Paths.document, "dog-photos");

function ensureFolder(): Directory {
	const dir = folder();
	if (!dir.exists) dir.create({ idempotent: true });
	return dir;
}

function fileNames(): string[] {
	const dir = folder();
	return dir.exists ? dir.list().map((f) => f.name) : [];
}

/** file:// address of the dog's photo, or null. */
export function getDogPhotoUri(petId: number): string | null {
	try {
		const name = newestPhotoName(fileNames(), petId);
		return name ? new File(folder(), name).uri : null;
	} catch {
		return null;
	}
}

// Screens showing a photo hear about changes here, so Home, Profile and the dog list agree.
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export type PickResult = "saved" | "cancelled" | "failed";

/** Lets the person choose a picture (cropped to a centred square), then keeps it as the dog's photo. */
export async function pickDogPhoto(petId: number, onPicked?: () => void): Promise<PickResult> {
	try {
		// No in-picker crop: with allowsEditing iOS opens the old full-screen picker, which is
		// slow to appear; without it the fast system photo picker is used. The picture is cropped
		// to a centred square below instead.
		const picked = await ImagePicker.launchImageLibraryAsync({
			mediaTypes: ["images"],
			quality: 1,
			exif: false,
			preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
		});
		if (picked.canceled || !picked.assets?.[0]) return "cancelled";
		onPicked?.();

		const { uri, width, height } = picked.assets[0];
		const side = Math.min(width, height);
		const small = await ImageManipulator.manipulateAsync(
			uri,
			[
				{ crop: { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side } },
				{ resize: { width: SIZE } },
			],
			{ compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
		);
		const dir = ensureFolder();
		const target = new File(dir, photoFileName(petId, Date.now()));
		new File(small.uri).copy(target);
		removeOlder(petId, target.name);
		notify();
		return "saved";
	} catch (e) {
		console.warn("Could not save the dog photo", e);
		return "failed";
	}
}

function removeOlder(petId: number, keep: string | null): void {
	for (const name of photoNamesFor(fileNames(), petId)) {
		if (name === keep) continue;
		try {
			new File(folder(), name).delete();
		} catch {
			// already gone
		}
	}
}

export function removeDogPhoto(petId: number): void {
	try {
		removeOlder(petId, null);
	} finally {
		notify();
	}
}

/** On sign-out: the next person on this phone must not see the previous one's dogs. */
export function clearAllDogPhotos(): void {
	try {
		const dir = folder();
		if (dir.exists) dir.delete();
	} catch {
		// nothing to clear
	}
	notify();
}

/** The photo as base64, for the vet summary. */
export function readDogPhotoBase64(petId: number): string | null {
	try {
		const uri = getDogPhotoUri(petId);
		return uri ? new File(uri).base64Sync() : null;
	} catch {
		return null;
	}
}

/** The dog's photo address (null without one), kept up to date. */
export function useDogPhoto(petId: number | null | undefined): string | null {
	const [uri, setUri] = useState<string | null>(() => (petId == null ? null : getDogPhotoUri(petId)));
	useEffect(() => {
		const refresh = () => setUri(petId == null ? null : getDogPhotoUri(petId));
		refresh();
		listeners.add(refresh);
		return () => {
			listeners.delete(refresh);
		};
	}, [petId]);
	return uri;
}
