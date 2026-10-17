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
};

export default function DateField({ label, value, onChange }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { i18n } = useTranslation();
	const locale = i18n.language === "nb" ? "nb-NO" : "en-US";

	const handle = (_: unknown, picked?: Date) => {
		if (picked) onChange(picked);
	};

	return (
		<View style={styles.row}>
			<Text style={styles.label}>{label}</Text>
			{Platform.OS === "android" ? (
				<Pressable
					style={styles.androidValue}
					accessibilityRole="button"
					accessibilityLabel={`${label}: ${new Intl.DateTimeFormat(locale).format(value)}`}
					onPress={() =>
						DateTimePickerAndroid.open({
							value,
							mode: "date",
							onChange: handle,
						})
					}
				>
					<Text>{new Intl.DateTimeFormat(locale).format(value)}</Text>
				</Pressable>
			) : (
				<DateTimePicker
					value={value}
					mode="date"
					display="compact"
					accessibilityLabel={label}
					locale={locale}
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
		marginBottom: 12,
	},
	label: { fontSize: 16, color: c.textSecondary, fontWeight: "600" },
	androidValue: {
		backgroundColor: c.surfaceAlt,
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
});
