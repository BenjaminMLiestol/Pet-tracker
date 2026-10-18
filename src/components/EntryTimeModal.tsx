import React, { useEffect, useMemo, useState, type ReactNode } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { space, useTheme, type Colors } from "../theme";
import AppButton from "./AppButton";
import DateField from "./DateField";
import { Text } from "./themed";
import { Group } from "./ui";

type Props = {
	visible: boolean;
	title: string;
	// The time the picker starts on (now for a new entry, the entry's time for an edit).
	initial: Date;
	onClose: () => void;
	// Resolves true when saved; the sheet closes then and stays open on failure.
	onSave: (at: Date) => Promise<boolean>;
	// Extra rows above the date and time (for example a weight), and whether they allow saving.
	children?: ReactNode;
	canSave?: boolean;
};

// Pick when something happened: used to log an entry after the fact or to move one.
export default function EntryTimeModal({
	visible,
	title,
	initial,
	onClose,
	onSave,
	children,
	canSave = true,
}: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const [value, setValue] = useState(initial);
	const [saving, setSaving] = useState(false);
	// Entries can't be in the future; fixed per open so the picker limit doesn't drift.
	const [now, setNow] = useState(() => new Date());

	useEffect(() => {
		if (!visible) return;
		setValue(initial);
		setNow(new Date());
		setSaving(false);
	}, [visible, initial]);

	if (!visible) return null;

	const close = () => {
		Keyboard.dismiss();
		onClose();
	};

	const save = async () => {
		Keyboard.dismiss();
		setSaving(true);
		// The picker's limit is by minute; never send a moment ahead of the server's clock.
		const at = value.getTime() > Date.now() ? new Date() : value;
		const ok = await onSave(at);
		if (ok) close();
		else setSaving(false);
	};

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
			<View style={styles.screen}>
				<View style={styles.header}>
					<Text variant="title" style={styles.title}>
						{title}
					</Text>
					<Pressable
						onPress={close}
						hitSlop={12}
						accessibilityRole="button"
						accessibilityLabel={t("cancel")}
					>
						<Ionicons name="close" size={26} color={c.text} />
					</Pressable>
				</View>
				<Group>
					{children}
					<DateField
						label={t("entry_date")}
						value={value}
						onChange={setValue}
						maximumDate={now}
					/>
					<DateField
						label={t("entry_time")}
						value={value}
						onChange={setValue}
						mode="time"
						maximumDate={now}
					/>
				</Group>
				<View style={styles.actions}>
					<AppButton
						title={t("save")}
						onPress={save}
						loading={saving}
						disabled={saving || !canSave}
					/>
				</View>
			</View>
		</Modal>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		screen: { flex: 1, backgroundColor: c.bg, padding: space[5], paddingTop: space[6] },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: space[5],
			gap: space[2],
		},
		title: { flexShrink: 1 },
		actions: { marginTop: space[5] },
	});
