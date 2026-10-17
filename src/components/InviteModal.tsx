import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { describeError } from "../api/errors";
import {
	createInvitation,
	listInvitations,
	revokeInvitation,
	type Invitation,
} from "../api/sharing";
import { usePet } from "../context/PetContext";
import { space, type, useTheme, type Colors } from "../theme";
import { formatCode } from "../utils/inviteCode";
import AppButton from "./AppButton";
import { Text } from "./themed";
import { Surface } from "./ui";

type Props = { visible: boolean; onClose: () => void };

// Make and share one-time codes that let someone else look after the same dog.
export default function InviteModal({ visible, onClose }: Props) {
	const c = useTheme();
	const styles = useMemo(() => makeStyles(c), [c]);
	const { t, i18n } = useTranslation();
	const { petId, name } = usePet();
	const [codes, setCodes] = useState<Invitation[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const make = useCallback(async () => {
		if (petId == null) return;
		setBusy(true);
		setError(null);
		try {
			const created = await createInvitation(petId);
			setCodes((prev) => [created, ...(prev ?? [])]);
		} catch (e) {
			setError(describeError(e, "invite_failed"));
		} finally {
			setBusy(false);
		}
	}, [petId]);

	// Opening the sheet shows the open codes. If there are none, the person came here for
	// one, so make it for them.
	useEffect(() => {
		if (!visible || petId == null) return;
		let cancelled = false;
		setCodes(null);
		setError(null);
		(async () => {
			try {
				const open = await listInvitations(petId);
				if (cancelled) return;
				setCodes(open);
				if (open.length === 0) await make();
			} catch (e) {
				if (!cancelled) {
					setCodes([]);
					setError(describeError(e, "invite_failed"));
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [visible, petId, make]);

	const cancel = async (invitation: Invitation) => {
		if (petId == null) return;
		setCodes((prev) => (prev ?? []).filter((i) => i.id !== invitation.id));
		try {
			await revokeInvitation(petId, invitation.id);
		} catch (e) {
			setCodes((prev) => [invitation, ...(prev ?? [])]);
			setError(describeError(e, "invite_failed"));
		}
	};

	const share = (invitation: Invitation) =>
		Share.share({
			message: t("invite_message", { name, code: formatCode(invitation.code) }),
		}).catch(() => {});

	if (!visible) return null;

	const locale = i18n.language === "nb" ? "nb-NO" : "en-GB";
	const expires = (iso: string) =>
		t("invite_expires", {
			date: new Intl.DateTimeFormat(locale, { day: "numeric", month: "short" }).format(new Date(iso)),
		});

	return (
		<Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
			<View style={styles.flex}>
				<ScrollView contentContainerStyle={styles.content}>
					<View style={styles.header}>
						<Text variant="title" style={styles.title}>
							{t("invite_title")}
						</Text>
						<Pressable
							onPress={onClose}
							hitSlop={12}
							accessibilityRole="button"
							accessibilityLabel={t("cancel")}
						>
							<Ionicons name="close" size={24} color={c.text} />
						</Pressable>
					</View>
					<Text variant="sub" tone="muted" style={styles.hint}>
						{t("invite_hint", { name })}
					</Text>

					{codes === null ? (
						<ActivityIndicator color={c.textMuted} style={styles.loading} />
					) : codes.length === 0 ? (
						<Text variant="sub" tone="muted" style={styles.none}>
							{t("invite_none")}
						</Text>
					) : (
						codes.map((invitation) => (
							<Surface key={invitation.id} style={styles.card}>
								<Text style={styles.code} selectable>
									{formatCode(invitation.code)}
								</Text>
								<Text variant="caption" tone="muted" style={styles.expires}>
									{expires(invitation.expires_at)}
								</Text>
								<AppButton
									title={t("invite_share")}
									icon="share-outline"
									onPress={() => share(invitation)}
								/>
								<AppButton
									variant="ghost"
									title={t("invite_cancel")}
									color={c.danger}
									onPress={() => cancel(invitation)}
								/>
							</Surface>
						))
					)}

					{error && <Text style={styles.error}>{error}</Text>}

					{codes !== null && codes.length > 0 && (
						<View style={styles.more}>
							<AppButton variant="secondary" title={t("invite_new")} onPress={make} loading={busy} />
						</View>
					)}
				</ScrollView>
			</View>
		</Modal>
	);
}

const makeStyles = (c: Colors) =>
	StyleSheet.create({
		flex: { flex: 1, backgroundColor: c.bg },
		content: { padding: space[5], paddingTop: space[6] },
		header: {
			flexDirection: "row",
			alignItems: "center",
			justifyContent: "space-between",
			marginBottom: space[2],
		},
		title: { flexShrink: 1 },
		hint: { marginBottom: space[5] },
		loading: { marginVertical: space[8] },
		none: { textAlign: "center", marginVertical: space[6] },
		card: { padding: space[5], marginBottom: space[4], gap: space[2] },
		code: {
			...type.numeric,
			fontSize: 34,
			lineHeight: 40,
			fontWeight: "700",
			letterSpacing: 3,
			color: c.text,
			textAlign: "center",
		},
		expires: { textAlign: "center", marginBottom: space[3] },
		error: { color: c.danger, fontSize: 15, marginBottom: space[3], paddingHorizontal: space[1] },
		more: { marginTop: space[2] },
	});
