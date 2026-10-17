import React, { useState } from "react";
import { View, Text, StyleSheet, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";
import { useTranslation } from "react-i18next";
import type { WeightRecord } from "../context/PetContext";

const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 24, left: 40 };
const MAX_POINTS = 30;

export default function WeightChart({ weights }: { weights: WeightRecord[] }) {
	const { t, i18n } = useTranslation();
	const [width, setWidth] = useState(0);

	const onLayout = (e: LayoutChangeEvent) =>
		setWidth(e.nativeEvent.layout.width);

	// Oldest → newest, most recent MAX_POINTS entries.
	const points = [...weights]
		.sort((a, b) => a.timestamp - b.timestamp)
		.slice(-MAX_POINTS);

	if (points.length < 2) {
		return <Text style={styles.helperText}>{t("chart_need_two")}</Text>;
	}

	const values = points.map((p) => p.weightKg);
	const rawMin = Math.min(...values);
	const rawMax = Math.max(...values);
	// Pad the range so a flat series still draws a visible line.
	const span = Math.max(rawMax - rawMin, 0.5);
	const yMin = rawMin - span * 0.15;
	const yMax = rawMax + span * 0.15;

	const tMin = points[0].timestamp;
	const tMax = points[points.length - 1].timestamp;
	const tSpan = Math.max(tMax - tMin, 1);

	const innerW = Math.max(width - PAD.left - PAD.right, 1);
	const innerH = HEIGHT - PAD.top - PAD.bottom;
	const x = (ts: number) => PAD.left + ((ts - tMin) / tSpan) * innerW;
	const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * innerH;

	const df = new Intl.DateTimeFormat(
		i18n.language === "nb" ? "nb-NO" : "en-US",
		{ day: "numeric", month: "short" },
	);
	const polyline = points.map((p) => `${x(p.timestamp)},${y(p.weightKg)}`).join(" ");
	const first = points[0];
	const last = points[points.length - 1];

	return (
		<View onLayout={onLayout} style={styles.wrap}>
			{width > 0 && (
				<Svg width={width} height={HEIGHT}>
					{(rawMax === rawMin ? [rawMax] : [rawMax, rawMin]).map((v) => (
						<React.Fragment key={v}>
							<Line
								x1={PAD.left}
								x2={width - PAD.right}
								y1={y(v)}
								y2={y(v)}
								stroke="#e5e7eb"
								strokeWidth={1}
							/>
							<SvgText
								x={PAD.left - 6}
								y={y(v) + 4}
								fontSize={11}
								fill="#6b7280"
								textAnchor="end"
							>
								{v.toFixed(1)}
							</SvgText>
						</React.Fragment>
					))}
					<Polyline
						points={polyline}
						fill="none"
						stroke="#2563eb"
						strokeWidth={2}
						strokeLinejoin="round"
					/>
					{points.map((p) => (
						<Circle
							key={p.timestamp}
							cx={x(p.timestamp)}
							cy={y(p.weightKg)}
							r={3}
							fill="#2563eb"
						/>
					))}
					<SvgText
						x={x(first.timestamp)}
						y={HEIGHT - 6}
						fontSize={11}
						fill="#6b7280"
						textAnchor="start"
					>
						{df.format(new Date(first.timestamp))}
					</SvgText>
					<SvgText
						x={x(last.timestamp)}
						y={HEIGHT - 6}
						fontSize={11}
						fill="#6b7280"
						textAnchor="end"
					>
						{df.format(new Date(last.timestamp))}
					</SvgText>
				</Svg>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	wrap: { height: HEIGHT },
	helperText: { color: "#6b7280", paddingVertical: 8 },
});
