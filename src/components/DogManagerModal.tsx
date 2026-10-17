import React, { useEffect, useMemo, useState } from "react";
import {
	KeyboardAvoidingView,
	Modal,
	Platform,
	Pressable,
	ScrollView,
	StyleSheet,
	Switch,
	View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { describeError } from "../api/errors";
import { usePet } from "../context/PetContext";
import { deviceTimeZone } from "../utils/dates";
import { CODE_LENGTH, formatCode, looksLikeCode, normalizeCode } from "../utils/inviteCode";
import { radius, smooth, space, type, useTheme, type Colors } from "../theme";
import AppButton from "./AppButton";
import DateField from "./DateField";
import { Text, TextInput } from "./themed";
import { Group, Row } from "./ui";

export type DogManagerMode = "list" | "create" | "join";

type Props = {
	visible: boolean;
	// Where to start. "create" and "join" are used when there are no dogs yet.
	initialMode?: DogManagerMode;
	onClose: () => void;
};

// Switch between dogs, add a new one, or join one with an invitation code.
export default function DogManagerModal({ visible, initialMode = "list", onClose }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t } = useTranslation();
	const { pets, petId, selectPet, createPet, joinWithCode } = usePet();

	const [mode, setMode] = useState<DogManagerMode>(initialMode);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Create form
	const [name, setName] = useState("");
	const [breed, setBreed] = useState("");
	const [hasBirthday, setHasBirthday] = useState(false);
	const [birthday, setBirthday] = useState(() => new Date());

	// Join form
	const [code, setCode] = useState("");

	// Start fresh every time the sheet is opened.
	useEffect(() => {
		if (!visible) return;
		setMode(initialMode);
		setBusy(false);
		setError(null);
		setName("");
		setBreed("");
		setHasBirthday(false);
		setBirthday(new Date());
		setCode("");
	}, [visible, initialMode]);

	if (!visible) return null;

	const go = (next: DogManagerMode) => {
		setError(null);
		setMode(next);
	};
	// Back goes to the list, unless the sheet opened straight onto a form.
	const back = () => (initialMode === "list" ? go("list") : onClose());

	const choose = async (id: number) => {
		onClose();
		await selectPet(id);
	};

	const submitCreate = async () => {
		setBusy(true);
		setError(null);
		try {
			await createPet({
				name: name.trim(),
				breed: breed.trim() || undefined,
				date_of_birth: hasBirthday ? localDate(birthday) : undefined,
				timezone: deviceTimeZone(),
			});
			onClose();
		} catch (e) {
			setError(describeError(e, "dog_create_failed"));
			setBusy(false);
		}
	};

	const submitJoin = async () => {
		setBusy(true);
		setError(null);
		try {
			await joinWithCode(code);
			onClose();
		} catch (e) {
			setError(describeError(e, "join_failed"));
			setBusy(false);
		}
	};

	const title =
		mode === "list" ? t("dogs_title") : mode === "create" ? t("dog_create_title") : t("join_title");

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<KeyboardAvoidingView
				style={styles.flex}
				behavior={Platform.OS === "ios" ? "padding" : undefined}
			>
				<ScrollView
					contentContainerStyle={styles.content}
					keyboardShouldPersistTaps="handled"
					keyboardDismissMode="interactive"
				>
					<View style={styles.header}>
						{mode !== "list" && (
							<Pressable
								onPress={back}
								hitSlop={12}
								style={styles.back}
								accessibilityRole="button"
								accessibilityLabel={t("back")}
							>
								<Ionicons name="chevron-back" size={22} color={c.text} />
							</Pressable>
						)}
						<Text variant="title" style={styles.title}>
							{title}
						</Text>
					</View>

					{mode === "list" && (
						<>
							<Group>
								{pets.map((dog) => (
									<Pressable
										key={dog.id}
										onPress={() => choose(dog.id)}
										accessibilityRole="radio"
										accessibilityState={{ selected: dog.id === petId }}
										style={({ pressed }) => pressed && styles.pressed}
									>
										<Row
											title={dog.name}
											detail={dog.breed ?? undefined}
											right={
												dog.id === petId ? (
													<Ionicons name="checkmark" size={22} color={c.text} />
												) : undefined
											}
										/>
									</Pressable>
								))}
							</Group>
							<Group style={styles.actions}>
								<Pressable
									onPress={() => go("create")}
									accessibilityRole="button"
									style={({ pressed }) => pressed && styles.pressed}
								>
									<Row
										title={t("dog_new")}
										right={<Ionicons name="add" size={22} color={c.text} />}
									/>
								</Pressable>
								<Pressable
									onPress={() => go("join")}
									accessibilityRole="button"
									style={({ pressed }) => pressed && styles.pressed}
								>
									<Row
										title={t("dog_join")}
										right={<Ionicons name="key-outline" size={20} color={c.text} />}
									/>
								</Pressable>
							</Group>
						</>
					)}

					{mode === "create" && (
						<>
							<Group>
								<TextInput
									style={styles.input}
									value={name}
									onChangeText={setName}
									placeholder={t("dog_name_placeholder")}
									accessibilityLabel={t("dog_name_placeholder")}
									autoCapitalize="words"
									returnKeyType="next"
								/>
								<TextInput
									style={styles.input}
									value={breed}
									onChangeText={setBreed}
									placeholder={t("dog_breed_placeholder")}
									accessibilityLabel={t("dog_breed_placeholder")}
									autoCapitalize="sentences"
									returnKeyType="done"
								/>
								<View style={styles.switchRow}>
									<Text variant="body">{t("dog_birthday_set")}</Text>
									<View style={styles.switchBox}>
										<Switch
											value={hasBirthday}
											onValueChange={setHasBirthday}
											accessibilityLabel={t("dog_birthday_set")}
										/>
									</View>
								</View>
								{hasBirthday && (
									<DateField
										label={t("dog_birthday")}
										value={birthday}
										onChange={setBirthday}
										maximumDate={new Date()}
									/>
								)}
							</Group>
							{error && <Text style={styles.error}>{error}</Text>}
							<View style={styles.submit}>
								<AppButton
									title={t("dog_create")}
									onPress={submitCreate}
									loading={busy}
									disabled={name.trim().length === 0}
								/>
							</View>
						</>
					)}

					{mode === "join" && (
						<>
							<Text variant="sub" tone="muted" style={styles.hint}>
								{t("join_hint")}
							</Text>
							<Group>
								<TextInput
									style={[styles.input, styles.code]}
									value={formatCode(code)}
									onChangeText={(text) => setCode(normalizeCode(text).slice(0, CODE_LENGTH))}
									placeholder={t("join_placeholder")}
									accessibilityLabel={t("join_title")}
									autoCapitalize="characters"
									autoCorrect={false}
									autoComplete="off"
									spellCheck={false}
									returnKeyType="go"
									onSubmitEditing={() => looksLikeCode(code) && submitJoin()}
								/>
							</Group>
							{error && <Text style={styles.error}>{error}</Text>}
							<View style={styles.submit}>
								<AppButton
									title={t("join_action")}
									onPress={submitJoin}
									loading={busy}
									disabled={!looksLikeCode(code)}
								/>
							</View>
						</>
					)}
				</ScrollView>
			</KeyboardAvoidingView>
		</Modal>
	);
}

// The calendar date the person picked, as YYYY-MM-DD (not shifted to UTC).
function localDate(d: Date): string {
	const mm = String(d.getMonth() + 1).padStart(2, "0");
	const dd = String(d.getDate()).padStart(2, "0");
	return `${d.getFullYear()}-${mm}-${dd}`;
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		flex: { flex: 1, backgroundColor: c.bg },
		content: { padding: space[5], paddingTop: space[6] },
		header: { flexDirection: "row", alignItems: "center", marginBottom: space[5], gap: space[2] },
		back: { marginLeft: -space[1] },
		title: { flexShrink: 1 },
		actions: { marginTop: space[4] },
		pressed: { opacity: 0.6 },
		input: { minHeight: 52, paddingHorizontal: space[4], fontSize: 17 },
		code: { ...type.numeric, fontSize: 24, letterSpacing: 2, textAlign: "center", minHeight: 64 },
		hint: { marginBottom: space[4] },
		switchRow: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			minHeight: 52,
			paddingHorizontal: space[4],
		},
		switchBox: { width: 51, height: 31, alignItems: "center", justifyContent: "center" },
		error: { color: c.danger, fontSize: 15, marginTop: space[3], paddingHorizontal: space[1] },
		submit: { marginTop: space[5] },
	});
