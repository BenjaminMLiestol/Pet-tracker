import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, {
	DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import { useTheme, type Colors } from "../theme";
import { Text } from "./themed";

type Props = {
	label: string;
	value: Date;
	onChange: (date: Date) => void;
	// "time" shows a clock picker and a HH:MM value; default is a calendar date.
	mode?: "date" | "time";
};

export default function DateField({ label, value, onChange, mode = "date" }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { i18n } = useTranslation();
	const locale = i18n.language === "nb" ? "nb-NO" : "en-US";
	const text =
		mode === "time"
			? new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false }).format(value)
			: new Intl.DateTimeFormat(locale).format(value);

	const handle = (_: unknown, picked?: Date) => {
		if (picked) onChange(picked);
	};

	return (
		<View style={styles.row}>
			<Text variant="body" style={styles.label}>{label}</Text>
			{Platform.OS === "android" ? (
				<Pressable
					style={styles.androidValue}
					accessibilityRole="button"
					accessibilityLabel={`${label}: ${text}`}
					onPress={() =>
						DateTimePickerAndroid.open({
							value,
							mode,
							is24Hour: true,
							onChange: handle,
						})
					}
				>
					<Text>{text}</Text>
				</Pressable>
			) : (
				<DateTimePicker
					value={value}
					mode={mode}
					display="compact"
					accessibilityLabel={label}
					// iOS follows the locale for 12/24h; en-GB is the 24-hour English.
					locale={mode === "time" && locale === "en-US" ? "en-GB" : locale}
					themeVariant={c.isDark ? "dark" : "light"}
					onChange={handle}
				/>
			)}
		</View>
	);
}

const makeStyles = (c: Colors) => StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		minHeight: 52,
		paddingHorizontal: 16,
	},
	label: { fontSize: 17 },
	androidValue: {
		backgroundColor: c.surfaceAlt,
		borderRadius: 10,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
});
