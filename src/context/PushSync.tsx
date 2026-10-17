import { useEffect } from "react";
import { AppState } from "react-native";
import { useTranslation } from "react-i18next";
import { registerForPush } from "../api/push";
import { useAuth } from "./AuthContext";

// Keeps the server's idea of this person in step with the phone: where to send pushes, and
// in which language. Renders nothing.
export default function PushSync() {
	const { token, user, updateSettings } = useAuth();
	const { i18n } = useTranslation();
	const userId = user?.id;
	const savedLocale = user?.locale;

	// Register at sign-in and whenever the app comes forward (the reminders switch may have
	// just been granted permission).
	useEffect(() => {
		if (!token || userId === undefined) return;
		registerForPush(userId);
		const sub = AppState.addEventListener("change", (s) => {
			if (s === "active") registerForPush(userId);
		});
		return () => sub.remove();
	}, [token, userId]);

	// Pushes are written by the server, so it has to know the language.
	useEffect(() => {
		if (!token || userId === undefined) return;
		if (i18n.language !== savedLocale && (i18n.language === "nb" || i18n.language === "en")) {
			updateSettings({ locale: i18n.language });
		}
	}, [token, userId, savedLocale, i18n.language, updateSettings]);

	return null;
}
