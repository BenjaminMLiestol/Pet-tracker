import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, {
	DateTimePickerAndroid,
} from "@react-native-community/datetimepicker";
import { useTranslation } from "react-i18next";

type Props = {
	label: string;
	value: Date;
	onChange: (date: Date) => void;
};

export default function DateField({ label, value, onChange }: Props) {
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
					locale={locale}
					onChange={handle}
				/>
			)}
		</View>
	);
}

const styles = StyleSheet.create({
	row: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		marginBottom: 12,
	},
	label: { fontSize: 16, color: "#374151", fontWeight: "600" },
	androidValue: {
		backgroundColor: "#f3f4f6",
		borderRadius: 8,
		paddingHorizontal: 12,
		paddingVertical: 8,
	},
});
