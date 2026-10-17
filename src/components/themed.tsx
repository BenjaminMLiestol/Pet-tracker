import React from "react";
import {
	Text as RNText,
	TextInput as RNTextInput,
	type TextInputProps,
	type TextProps,
} from "react-native";
import { type, useTheme } from "../theme";

type Tone = "default" | "secondary" | "muted" | "accent";
type TextExtra = { variant?: keyof typeof type; tone?: Tone };

// Drop-in replacements: React Native's own Text/TextInput default to black,
// which disappears on a dark background. Explicit `color` styles still win.
// `variant` applies a step of the type scale; `tone` picks the text colour.
export function Text({ style, variant, tone = "default", ...props }: TextProps & TextExtra) {
	const c = useTheme();
	const color =
		tone === "muted"
			? c.textMuted
			: tone === "secondary"
				? c.textSecondary
				: tone === "accent"
					? c.accentText
					: c.text;
	return <RNText {...props} style={[{ color }, variant && type[variant], style]} />;
}

export const TextInput = React.forwardRef<RNTextInput, TextInputProps>(
	({ style, placeholderTextColor, ...props }, ref) => {
		const c = useTheme();
		return (
			<RNTextInput
				ref={ref}
				{...props}
				placeholderTextColor={placeholderTextColor ?? c.textMuted}
				style={[{ color: c.text }, style]}
			/>
		);
	},
);
