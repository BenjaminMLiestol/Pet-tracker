import { Children, Fragment, useMemo, useState, type ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Animated, { css, useReducedMotion } from "react-native-reanimated";
import { EASE_OUT_CSS } from "../motion";
import { useSafeAreaInsets } from "react-native-safe-area-context";
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
}: {
	title: string;
	detail?: string;
	right?: ReactNode;
	style?: StyleProp<ViewStyle>;
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
				<Text variant="body">{title}</Text>
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
