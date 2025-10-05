import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import * as Localization from "expo-localization";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_LANG = "app/lang";
const DEFAULT_LANG = "nb"; // Norwegian Bokmål

// Inline resources (you can split into JSON files later)
const resources = {
	nb: {
		common: {
			greeting: "Hei, {{name}}!",
			today: "I dag",
			fed: "Matet",
			walked: "Gått tur",
			yes: "Ja",
			no: "Nei",
			grooming: "Stell",
			last_bath: "Sist bad",
			health: "Helse",
			current_weight: "Nåværende vekt",
			not_recorded: "Ingen registrering",
			language: "Språk",
			baths_title: "Bad",
			next_schedule: "Neste plan",
			due: "Forfallsdato",
			mark_bathed_today: "Marker badet i dag",
			monthly_schedule_hint: "Månedlig plan (hver ~30. dag)",
			history_days_between_baths: "Historikk (dager mellom bad)",
			not_enough_data: "Ikke nok data ennå",

			weight_title: "Vekt",
			current: "Nåværende",
			log_today_optional: "Logg i dag (valgfritt)",
			placeholder_weight: "f.eks. 19,3",
			save: "Lagre",
			history: "Historikk",
			no_data_yet: "Ingen data ennå",

			walk_title: "Tur",
			walked_today_label: "Gått tur i dag",
			walked_label: "Gått",
			skipped_label: "Hoppet over",

			feeding_title: "Mating",
			fed_today_label: "Matet i dag",
			not_fed_label: "Ikke matet",

			// Tabs
			tabs_home: "Hjem",
			tabs_feeding: "Mat",
			tabs_walk: "Tur",
			tabs_weight: "Vekt",
			tabs_bath: "Bad",
			tabs_profile: "Profil",

			// Profile
			profile_title: "Profil",
			account: "Konto",
			name: "Navn",
			email: "E-post",
			pet: "Hund",
			breed: "Rase",
			last_bath_short: "Sist bad",
			current_weight_short: "Vekt",
		},
	},
	en: {
		common: {
			greeting: "Hi, {{name}}!",
			today: "Today",
			fed: "Fed",
			walked: "Walked",
			yes: "Yes",
			no: "No",
			grooming: "Grooming",
			last_bath: "Last bath",
			health: "Health",
			current_weight: "Current weight",
			not_recorded: "No record",
			language: "Language",
			baths_title: "Baths",
			next_schedule: "Next schedule",
			due: "Due date",
			mark_bathed_today: "Mark bathed today",
			monthly_schedule_hint: "Monthly schedule (every ~30 days)",
			history_days_between_baths: "History (days between baths)",
			not_enough_data: "Not enough data yet",

			weight_title: "Weight",
			current: "Current",
			log_today_optional: "Log today (optional)",
			placeholder_weight: "e.g. 19.3",
			save: "Save",
			history: "History",
			no_data_yet: "No data yet",

			walk_title: "Walk",
			walked_today_label: "Walked today",
			walked_label: "Walked",
			skipped_label: "Skipped",

			feeding_title: "Feeding",
			fed_today_label: "Fed today",
			not_fed_label: "Not fed",

			tabs_home: "Home",
			tabs_feeding: "Feeding",
			tabs_walk: "Walk",
			tabs_weight: "Weight",
			tabs_bath: "Bath",
			tabs_profile: "Profile",

			profile_title: "Profile",
			account: "Account",
			name: "Name",
			email: "Email",
			pet: "Pet",
			breed: "Breed",
			last_bath_short: "Last bath",
			current_weight_short: "Weight",
		},
	},
};

i18n.use(initReactI18next).init({
	resources,
	ns: ["common"],
	defaultNS: "common",
	lng: DEFAULT_LANG, // start in nb
	fallbackLng: "nb",
	supportedLngs: ["nb", "en"],
	interpolation: { escapeValue: false },
});

// detect device/saved lang and switch (persist selection)
export async function initI18n() {
	try {
		const saved = await AsyncStorage.getItem(STORAGE_LANG);
		const device = Localization.getLocales?.()[0];
		const deviceCode = (device?.languageCode || "").toLowerCase(); // 'nb', 'no', 'en'...
		const detected =
			saved || (deviceCode === "no" ? "nb" : deviceCode === "nb" ? "nb" : "en");

		await i18n.changeLanguage(detected);
	} catch {
		// ignore; stay at default
	}
}

export async function setAppLanguage(lang: "nb" | "en") {
	await i18n.changeLanguage(lang);
	await AsyncStorage.setItem(STORAGE_LANG, lang);
}

export default i18n;
