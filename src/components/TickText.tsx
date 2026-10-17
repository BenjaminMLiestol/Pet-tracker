import { useState } from "react";
import type { StyleProp, TextStyle } from "react-native";
import Animated, { css, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT_CSS } from "../motion";
import { useTheme } from "../theme";

// A text value that, when it changes, enters with a short rise + fade (180ms ease-out).
// The first value renders still; only later changes play, so screens don't animate on open.
const rise = css.keyframes({
	from: { opacity: 0, transform: [{ translateY: 6 }] },
	to: { opacity: 1, transform: [{ translateY: 0 }] },
});
const fadeOnly = css.keyframes({ from: { opacity: 0 }, to: { opacity: 1 } });

const styles = css.create({
	tick: {
		animationName: rise,
		animationDuration: "180ms",
		animationTimingFunction: EASE_OUT_CSS,
		animationFillMode: "backwards",
	},
	tickReduced: {
		animationName: fadeOnly,
		animationDuration: "180ms",
		animationTimingFunction: EASE_OUT_CSS,
		animationFillMode: "backwards",
	},
});

export default function TickText({
	value,
	style,
}: {
	value: string;
	style?: StyleProp<TextStyle>;
}) {
	const c = useTheme();
	const reduced = useReducedMotion();
	const [prev, setPrev] = useState(value);
	const [tick, setTick] = useState(0);

	// Remount on change (new key) so the entrance replays for every new value.
	if (value !== prev) {
		setPrev(value);
		setTick(tick + 1);
	}

	return (
		<Animated.Text
			key={tick}
			style={[{ color: c.text }, style, tick > 0 && (reduced ? styles.tickReduced : styles.tick)]}
		>
			{value}
		</Animated.Text>
	);
}
