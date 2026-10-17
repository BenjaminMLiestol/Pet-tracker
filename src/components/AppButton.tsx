import { useMemo, useState } from "react";
import { Pressable } from "react-native";
import Animated, { css, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT_CSS } from "../motion";
import { useTheme, type Colors } from "../theme";
import { Text } from "./themed";

type Props = {
	title: string;
	onPress: () => void;
	disabled?: boolean;
	color?: string;
};

// Text button with the platform look of RN's <Button>, plus press feedback:
// 0.97 scale in 140ms on press-in (opacity only under reduced motion).
export default function AppButton({ title, onPress, disabled, color }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const reduced = useReducedMotion();
	const [pressed, setPressed] = useState(false);

	return (
		<Pressable
			onPress={onPress}
			onPressIn={() => setPressed(true)}
			onPressOut={() => setPressed(false)}
			disabled={disabled}
			hitSlop={8}
			pressRetentionOffset={16}
			accessibilityRole="button"
			accessibilityLabel={title}
			accessibilityState={{ disabled: !!disabled }}
		>
			<Animated.View
				style={[
					reduced ? styles.boxReduced : styles.box,
					pressed && (reduced ? styles.pressedReduced : styles.pressed),
					disabled && styles.disabled,
				]}
			>
				<Text style={[styles.title, { color: color ?? c.primary }]}>{title}</Text>
			</Animated.View>
		</Pressable>
	);
}

const makeStyles = (c: Colors) =>
	css.create({
		box: {
			minHeight: 44,
			justifyContent: "center",
			alignItems: "center",
			transform: [{ scale: 1 }],
			transitionProperty: "transform",
			transitionDuration: "140ms",
			transitionTimingFunction: EASE_OUT_CSS,
		},
		boxReduced: {
			minHeight: 44,
			justifyContent: "center",
			alignItems: "center",
			opacity: 1,
			transitionProperty: "opacity",
			transitionDuration: "140ms",
			transitionTimingFunction: EASE_OUT_CSS,
		},
		pressed: { transform: [{ scale: 0.97 }] },
		pressedReduced: { opacity: 0.6 },
		disabled: { opacity: 0.4 },
		title: { fontSize: 17 },
	});
