import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { setAppLanguage } from "../i18n";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "./themed";

const LANGUAGES = [
	{ code: "nb", label: "Norsk (Bokmål)", a11y: "language_nb" },
	{ code: "en", label: "English", a11y: "language_en" },
] as const;

// A two-way switch: the chosen language is the ink-filled segment.
export default function LanguageSwitcher() {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();

	return (
		<View style={styles.track}>
			{LANGUAGES.map(({ code, label, a11y }) => {
				const selected = i18n.language === code;
				return (
					<Pressable
						key={code}
						style={[styles.segment, selected && styles.selected]}
						onPress={() => setAppLanguage(code)}
						accessibilityRole="radio"
						accessibilityLabel={t(a11y)}
						accessibilityState={{ selected }}
					>
						<Text
							variant="sub"
							style={[styles.text, selected && styles.textSelected]}
						>
							{label}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		track: {
			flexDirection: "row",
			backgroundColor: c.surfaceAlt,
			borderRadius: radius.md,
			...smooth,
			padding: space[1],
			gap: space[1],
		},
		segment: {
			flex: 1,
			height: 40,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: radius.md - space[1],
			...smooth,
		},
		selected: { backgroundColor: c.primary },
		text: { color: c.textSecondary, fontWeight: "600" },
		textSelected: { color: c.onPrimary },
	});
