import { Children, Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { css, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT_CSS } from "../motion";
import PendingNote from "./PendingNote";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { radius, smooth, space, useTheme, type Colors } from "../theme";
import { Text } from "./themed";

// A raised area of the screen. Separated from the canvas by tone, never by a border.
export function Surface({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
	const c = useTheme();
	return (
		<View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, ...smooth }, style]}>
			{children}
		</View>
	);
}

// Rows inside one Surface, divided by inset hairlines.
export function Group({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
	const c = useTheme();
	const items = Children.toArray(children);
	return (
		<Surface style={[{ overflow: "hidden" }, style]}>
			{items.map((child, i) => (
				<Fragment key={i}>
					{i > 0 && (
						<View
							style={{
								height: StyleSheet.hairlineWidth,
								backgroundColor: c.border,
								marginLeft: space[4],
							}}
						/>
					)}
					{child}
				</Fragment>
			))}
		</Surface>
	);
}

// A heading for a block of content. Sentence case; the weight does the work.
export function Section({
	label,
	children,
	right,
	style,
}: {
	label?: string;
	children: ReactNode;
	right?: ReactNode;
	style?: StyleProp<ViewStyle>;
}) {
	return (
		<View style={[{ marginBottom: space[6] }, style]}>
			{label ? (
				<View
					style={{
						flexDirection: "row",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: space[2],
						paddingHorizontal: space[1],
					}}
				>
					<Text variant="label" tone="muted">
						{label}
					</Text>
					{right}
				</View>
			) : null}
			{children}
		</View>
	);
}

// One line of a Group: a label on the left, a value or control on the right.
export function Row({
	title,
	detail,
	right,
	style,
	titleColor,
}: {
	title: string;
	detail?: string;
	right?: ReactNode;
	style?: StyleProp<ViewStyle>;
	titleColor?: string;
}) {
	return (
		<View
			style={[
				{
					flexDirection: "row",
					alignItems: "center",
					justifyContent: "space-between",
					minHeight: 52,
					paddingVertical: space[3],
					paddingHorizontal: space[4],
					gap: space[3],
				},
				style,
			]}
		>
			<View style={{ flexShrink: 1 }}>
				<Text variant="body" style={titleColor ? { color: titleColor } : undefined}>
					{title}
				</Text>
				{detail ? (
					<Text variant="caption" tone="muted">
						{detail}
					</Text>
				) : null}
			</View>
			{right}
		</View>
	);
}

type ScreenProps = {
	title: string;
	children: ReactNode;
	refreshing?: boolean;
	onRefresh?: () => void;
};

// Page scaffold: canvas, safe-area top, a large title (the tab bar names the page,
// so there is no header bar), pull-to-refresh and comfortable bottom padding.
export function Screen({ title, children, refreshing, onRefresh }: ScreenProps) {
	const c = useTheme();
	const insets = useSafeAreaInsets();
	const styles = useMemo(() => makeStyles(c), [c]);
	return (
		<ScrollView
			style={styles.fill}
			contentContainerStyle={[styles.content, { paddingTop: insets.top + space[4] }]}
			keyboardShouldPersistTaps="handled"
			alwaysBounceVertical
			refreshControl={
				onRefresh ? (
					<RefreshControl
						refreshing={!!refreshing}
						onRefresh={onRefresh}
						tintColor={c.textMuted}
					/>
				) : undefined
			}
		>
			<Text variant="largeTitle" style={styles.title}>
				{title}
			</Text>
			<PendingNote />
			{children}
		</ScrollView>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		fill: { flex: 1, backgroundColor: c.bg },
		content: { paddingHorizontal: space[5], paddingBottom: space[8] },
		title: { marginBottom: space[5] },
	});

const press = css.create({
	box: {
		transform: [{ scale: 1 }],
		transitionProperty: "transform",
		transitionDuration: "140ms",
		transitionTimingFunction: EASE_OUT_CSS,
	},
	boxReduced: {
		opacity: 1,
		transitionProperty: "opacity",
		transitionDuration: "140ms",
		transitionTimingFunction: EASE_OUT_CSS,
	},
	down: { transform: [{ scale: 0.98 }] },
	downReduced: { opacity: 0.7 },
});

// Anything tappable that isn't a button (stat tiles, rows): same press feel as buttons,
// slightly gentler on larger surfaces.
export function PressScale({
	children,
	onPress,
	style,
	accessibilityLabel,
}: {
	children: ReactNode;
	onPress: () => void;
	style?: StyleProp<ViewStyle>;
	accessibilityLabel?: string;
}) {
	const reduced = useReducedMotion();
	const [down, setDown] = useState(false);
	return (
		<Pressable
			onPress={onPress}
			onPressIn={() => setDown(true)}
			onPressOut={() => setDown(false)}
			pressRetentionOffset={16}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel}
			style={style}
		>
			<Animated.View
				style={[
					reduced ? press.boxReduced : press.box,
					down && (reduced ? press.downReduced : press.down),
				]}
			>
				{children}
			</Animated.View>
		</Pressable>
	);
}

type StepperProps = {
	value: number;
	min: number;
	max: number;
	onChange: (next: number) => void;
	// Text shown between the buttons, e.g. "30 days".
	format: (value: number) => string;
	decrementLabel: string;
	incrementLabel: string;
};

const HOLD_DELAY_MS = 400; // before a held button starts repeating
const REPEAT_MS = 70;
const FAST_AFTER = 14; // repeats before stepping by 5

// A number with minus and plus. Tap for one step; hold to repeat (and speed up after a
// moment), so 30 -> 90 isn't sixty taps. VoiceOver users swipe up/down on the whole control.
export function Stepper({
	value,
	min,
	max,
	onChange,
	format,
	decrementLabel,
	incrementLabel,
}: StepperProps) {
	const c = useTheme();
	const current = useRef(value);
	current.current = value;
	const timers = useRef<{ delay?: ReturnType<typeof setTimeout>; repeat?: ReturnType<typeof setInterval> }>({});

	const step = useCallback(
		(delta: number) => {
			const next = Math.min(max, Math.max(min, current.current + delta));
			if (next === current.current) return false;
			current.current = next;
			onChange(next);
			return true;
		},
		[min, max, onChange],
	);

	const stop = useCallback(() => {
		clearTimeout(timers.current.delay);
		clearInterval(timers.current.repeat);
	}, []);

	const start = useCallback(
		(direction: 1 | -1) => {
			stop();
			step(direction);
			timers.current.delay = setTimeout(() => {
				let repeats = 0;
				timers.current.repeat = setInterval(() => {
					repeats += 1;
					if (!step(direction * (repeats > FAST_AFTER ? 5 : 1))) stop();
				}, REPEAT_MS);
			}, HOLD_DELAY_MS);
		},
		[step, stop],
	);

	useEffect(() => stop, [stop]);

	const button = (direction: 1 | -1, disabled: boolean) => (
		<Pressable
			onPressIn={() => start(direction)}
			onPressOut={stop}
			disabled={disabled}
			hitSlop={6}
			style={({ pressed }) => [
				{
					width: 36,
					height: 36,
					borderRadius: 18,
					backgroundColor: c.surfaceAlt,
					alignItems: "center",
					justifyContent: "center",
					opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
				},
			]}
			accessible={false}
			importantForAccessibility="no"
		>
			<Ionicons name={direction === 1 ? "add" : "remove"} size={20} color={c.text} />
		</Pressable>
	);

	return (
		<View
			style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}
			accessible
			accessibilityRole="adjustable"
			accessibilityLabel={`${decrementLabel} / ${incrementLabel}`}
			accessibilityValue={{ min, max, now: value, text: format(value) }}
			accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
			onAccessibilityAction={(e) => step(e.nativeEvent.actionName === "increment" ? 1 : -1)}
		>
			{button(-1, value <= min)}
			<Text variant="headline" style={{ minWidth: 76, textAlign: "center", fontVariant: ["tabular-nums"] }}>
				{format(value)}
			</Text>
			{button(1, value >= max)}
		</View>
	);
}

// A Row you can tap (opens a sheet, runs an action). It dims while pressed.
export function PressRow({
	title,
	detail,
	right,
	onPress,
	titleColor,
	accessibilityLabel,
}: {
	title: string;
	detail?: string;
	right?: ReactNode;
	onPress: () => void;
	titleColor?: string;
	accessibilityLabel?: string;
}) {
	return (
		<Pressable
			onPress={onPress}
			accessibilityRole="button"
			accessibilityLabel={accessibilityLabel ?? title}
			style={({ pressed }) => (pressed ? { opacity: 0.6 } : undefined)}
		>
			<Row title={title} detail={detail} right={right} titleColor={titleColor} />
		</Pressable>
	);
}

