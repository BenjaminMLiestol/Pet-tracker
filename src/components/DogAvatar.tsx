import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useDogPhoto } from "../api/dogPhotos";
import { smooth, useTheme, type Colors } from "../theme";

// The dog's photo from this phone, or a paw on the honey tint when there is none.
export default function DogAvatar({ petId, size = 40 }: { petId: number | null; size?: number }) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const uri = useDogPhoto(petId);
	const box = { width: size, height: size, borderRadius: size / 2 };

	return uri ? (
		<Image source={{ uri }} style={[styles.image, box]} accessibilityIgnoresInvertColors />
	) : (
		<View style={[styles.fallback, box]}>
			<Ionicons name="paw" size={size * 0.5} color={c.accentText} />
		</View>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		image: { backgroundColor: c.surfaceAlt, ...smooth },
		fallback: { backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" },
	});
