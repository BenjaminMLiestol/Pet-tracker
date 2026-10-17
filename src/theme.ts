import { useColorScheme, type TextStyle } from "react-native";

// Quiet and precise. Surfaces separate by tone, not borders; primary actions are ink;
// the one warm colour (honey, from Toya's coat) marks data and state, never decoration.
const light = {
	bg: "#F3F4F6", // canvas
	surface: "#FFFFFF",
	surfaceAlt: "#ECEEF1", // inputs, pressed rows, tracks
	border: "#E3E5E9", // hairlines
	borderStrong: "#CBD0D8",
	text: "#0F1115", // ink
	textSecondary: "#3A404A",
	textMuted: "#7A818C",
	primary: "#0F1115", // primary action = ink
	onPrimary: "#FFFFFF",
	primarySoft: "#E4E7EB",
	primarySoftBorder: "#E4E7EB",
	accent: "#E3A04D", // honey: fills and marks
	accentSoft: "#FBF0DD",
	accentText: "#8F5410", // honey that passes contrast as text on white
	chart: "#E3A04D",
	danger: "#D92D20",
	success: "#12A150",
	// Status colours that read on the inverse (toast) surface, which is the opposite theme.
	successOnInverse: "#32D583",
	dangerOnInverse: "#F97066",
	warning: "#8F5410",
	infoBg: "#FBF0DD",
	infoBorder: "#FBF0DD",
	infoText: "#8F5410",
};

export type Colors = typeof light;

const dark: Colors = {
	bg: "#08090B",
	surface: "#131519", // raised surfaces get lighter, not outlined
	surfaceAlt: "#1D2026",
	border: "#23262D",
	borderStrong: "#363A44",
	text: "#F3F4F6",
	textSecondary: "#C3C8D0",
	textMuted: "#8A919C",
	primary: "#F3F4F6",
	onPrimary: "#0F1115",
	primarySoft: "#23262D",
	primarySoftBorder: "#23262D",
	accent: "#F0B15C",
	accentSoft: "#2A2013",
	accentText: "#F0B15C",
	chart: "#F0B15C",
	danger: "#F97066",
	success: "#32D583",
	successOnInverse: "#12A150",
	dangerOnInverse: "#D92D20",
	warning: "#F0B15C",
	infoBg: "#2A2013",
	infoBorder: "#2A2013",
	infoText: "#F0B15C",
};

export const palettes = { light, dark };

// Corner radii. Large surfaces are generous; controls are tighter. Use with
// borderCurve: "continuous" (see `smooth`) so corners match iOS.
export const radius = { sm: 12, md: 16, lg: 24, pill: 999 } as const;
export const smooth = { borderCurve: "continuous" } as const;

// 4pt grid.
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 } as const;

// One type scale. Sentence case throughout; numerals are tabular so counts don't jitter.
export const type = {
	largeTitle: { fontSize: 34, lineHeight: 40, fontWeight: "700", letterSpacing: -0.8 },
	title: { fontSize: 22, lineHeight: 28, fontWeight: "600", letterSpacing: -0.3 },
	headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
	body: { fontSize: 17, lineHeight: 24, fontWeight: "400" },
	sub: { fontSize: 15, lineHeight: 20, fontWeight: "400" },
	label: { fontSize: 13, lineHeight: 18, fontWeight: "600", letterSpacing: 0.1 },
	caption: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
	stat: {
		fontSize: 56,
		lineHeight: 60,
		fontWeight: "700",
		letterSpacing: -2,
		fontVariant: ["tabular-nums"],
	},
	numeric: { fontVariant: ["tabular-nums"] },
} satisfies Record<string, TextStyle>;

// Follows the phone's appearance setting.
export function useTheme(): Colors & { isDark: boolean } {
	const isDark = useColorScheme() === "dark";
	return { ...(isDark ? dark : light), isDark };
}
