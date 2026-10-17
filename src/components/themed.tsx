import React from "react";
import {
	Text as RNText,
	TextInput as RNTextInput,
	type TextInputProps,
	type TextProps,
} from "react-native";
import { useTheme } from "../theme";

// Drop-in replacements: React Native's own Text/TextInput default to black,
// which disappears on a dark background. Explicit `color` styles still win.
export function Text({ style, ...props }: TextProps) {
	const c = useTheme();
	return <RNText {...props} style={[{ color: c.text }, style]} />;
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
