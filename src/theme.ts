import { useColorScheme } from "react-native";

const light = {
	bg: "#ffffff",
	surface: "#f9fafb",
	surfaceAlt: "#f3f4f6",
	border: "#e5e7eb",
	borderStrong: "#d1d5db",
	text: "#111827",
	textSecondary: "#374151",
	textMuted: "#6b7280",
	primary: "#2563eb",
	onPrimary: "#ffffff",
	primarySoft: "#eef2ff",
	primarySoftBorder: "#c7d2fe",
	chart: "#60a5fa",
	danger: "#dc2626",
	warning: "#d97706",
	infoBg: "#ecfeff",
	infoBorder: "#bae6fd",
	infoText: "#0f766e",
};

export type Colors = typeof light;

const dark: Colors = {
	bg: "#0b1220",
	surface: "#162032",
	surfaceAlt: "#1f2b40",
	border: "#2a3750",
	borderStrong: "#3a4a68",
	text: "#f3f4f6",
	textSecondary: "#d1d5db",
	textMuted: "#9ca3af",
	primary: "#60a5fa",
	onPrimary: "#0b1220",
	primarySoft: "#1e2a4a",
	primarySoftBorder: "#3b4f85",
	chart: "#60a5fa",
	danger: "#f87171",
	warning: "#fbbf24",
	infoBg: "#0f2a30",
	infoBorder: "#155e75",
	infoText: "#5eead4",
};

export const palettes = { light, dark };

// Follows the phone's appearance setting.
export function useTheme(): Colors & { isDark: boolean } {
	const isDark = useColorScheme() === "dark";
	return { ...(isDark ? dark : light), isDark };
}
