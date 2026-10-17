import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable } from "react-native";
import Animated, { css, useReducedMotion } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { EASE_OUT_CSS } from "../motion";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "./themed";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
	title: string;
	onPress: () => void;
	disabled?: boolean;
	variant?: Variant;
	// Auto width instead of filling the row (inline actions).
	compact?: boolean;
	icon?: keyof typeof Ionicons.glyphMap;
	// Text/icon colour override, e.g. a destructive ghost button.
	color?: string;
	// Shows a spinner in place of the label and ignores presses.
	loading?: boolean;
};

// The one button. Primary is ink (the quiet default); secondary is a tonal fill;
// ghost is text only. Every variant shares the same press: 0.97 scale in 140ms
// (opacity only under reduced motion).
export default function AppButton({
	title,
	onPress,
	disabled,
	variant = "primary",
	compact,
	icon,
	color,
	loading,
}: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const reduced = useReducedMotion();
	const [pressed, setPressed] = useState(false);

	const fg =
		color ?? (variant === "primary" ? c.onPrimary : variant === "secondary" ? c.text : c.text);

	return (
		<Pressable
			onPress={onPress}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			disabled={disabled || loading}
			hitSlop={8}
			pressRetentionOffset={16}
			accessibilityRole="button"
			accessibilityLabel={title}
			accessibilityState={{ disabled: !!disabled, busy: !!loading }}
			style={compact ? undefined : { alignSelf: "stretch" }}
		>
			<Animated.View
				style={[
					reduced ? styles.boxReduced : styles.box,
					styles[variant],
					compact && styles.compact,
					pressed && (reduced ? styles.pressedReduced : styles.pressed),
					disabled && styles.disabled,
				]}
			>
				{loading ? (
					<ActivityIndicator color={fg} />
				) : (
					<>
						{icon ? <Ionicons name={icon} size={20} color={fg} /> : null}
						<Text variant="headline" style={{ color: fg }}>
							{title}
						</Text>
					</>
				)}
			</Animated.View>
		</Pressable>
	);
}

const makeStyles = (c: Colors) =>
	css.create({
		box: {
			minHeight: 52,
			flexDirection: "row",
			gap: space[2],
			justifyContent: "center",
			alignItems: "center",
			paddingHorizontal: space[5],
			borderRadius: radius.md,
			...smooth,
			transform: [{ scale: 1 }],
			transitionProperty: "transform",
			transitionDuration: "140ms",
			transitionTimingFunction: EASE_OUT_CSS,
		},
		boxReduced: {
			minHeight: 52,
			flexDirection: "row",
			gap: space[2],
			justifyContent: "center",
			alignItems: "center",
			paddingHorizontal: space[5],
			borderRadius: radius.md,
			...smooth,
			opacity: 1,
			transitionProperty: "opacity",
			transitionDuration: "140ms",
			transitionTimingFunction: EASE_OUT_CSS,
		},
		primary: { backgroundColor: c.primary },
		secondary: { backgroundColor: c.surfaceAlt },
		ghost: { backgroundColor: "transparent" },
		compact: { minHeight: 52, paddingHorizontal: space[5] },
		pressed: { transform: [{ scale: 0.97 }] },
		pressedReduced: { opacity: 0.6 },
		disabled: { opacity: 0.4 },
	});
