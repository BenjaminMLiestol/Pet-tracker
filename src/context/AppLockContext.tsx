import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "../i18n";
import { authenticate, getBiometricInfo, type BiometricKind } from "../api/biometrics";
import { shouldLock } from "../utils/appLock";
import { useAuth } from "./AuthContext";

// A device setting, not a per-account one, so it lives outside the "pet-tracker/" prefix that
// is wiped on logout.
const STORAGE_KEY = "app/biometric-lock";

type AppLockValue = {
	// This phone can check a face or fingerprint (and it is set up).
	available: boolean;
	kind: BiometricKind;
	enabled: boolean;
	// Turning it on asks for Face ID once to prove it works. Resolves true when saved.
	setEnabled: (enabled: boolean) => Promise<boolean>;
	// Content must be hidden behind the lock screen.
	locked: boolean;
	// Locked because someone has to authenticate (as opposed to just waiting for the setting
	// to load). Only then may Face ID be asked for.
	needsAuth: boolean;
	// The app is not in the foreground: hide content from the app switcher.
	covered: boolean;
	unlock: () => Promise<boolean>;
};

const AppLockContext = createContext<AppLockValue | undefined>(undefined);

export function AppLockProvider({ children }: { children: ReactNode }) {
	const { token } = useAuth();
	const [available, setAvailable] = useState(false);
	const [kind, setKind] = useState<BiometricKind>("other");
	const [enabled, setEnabledState] = useState(false);
	const [loaded, setLoaded] = useState(false);
	// Starts locked so a cold start never flashes content before the setting has loaded.
	const [lockedFlag, setLockedFlag] = useState(true);
	const [covered, setCovered] = useState(false);
	const backgroundedAt = useRef<number | null>(null);
	const enabledRef = useRef(false);
	enabledRef.current = enabled;

	useEffect(() => {
		(async () => {
			const [info, stored] = await Promise.all([
				getBiometricInfo(),
				AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
			]);
			setAvailable(info.available);
			setKind(info.kind);
			const on = stored === "1";
			setEnabledState(on);
			setLockedFlag(on);
			setLoaded(true);
		})();
	}, []);

	useEffect(() => {
		const sub = AppState.addEventListener("change", (state) => {
			if (state === "active") {
				setCovered(false);
				if (shouldLock({ enabled: enabledRef.current, backgroundedAt: backgroundedAt.current, now: Date.now() })) {
					setLockedFlag(true);
				}
				backgroundedAt.current = null;
				return;
			}
			// "inactive" also covers the Face ID sheet and the app switcher snapshot.
			setCovered(true);
			if (backgroundedAt.current === null) backgroundedAt.current = Date.now();
		});
		return () => sub.remove();
	}, []);

	const prompt = () => ({
		prompt: i18n.t("lock_prompt"),
		cancel: i18n.t("cancel"),
	});

	const unlock = useCallback(async () => {
		const ok = await authenticate(prompt());
		if (ok) setLockedFlag(false);
		return ok;
	}, []);

	const setEnabled = useCallback(
		async (next: boolean) => {
			if (next) {
				if (!available || !(await authenticate(prompt()))) return false;
			}
			setEnabledState(next);
			await AsyncStorage.setItem(STORAGE_KEY, next ? "1" : "0").catch(() => {});
			if (!next) setLockedFlag(false);
			return true;
		},
		[available],
	);

	// Only an app with someone signed in has anything to protect.
	const locked = !!token && (!loaded || (enabled && lockedFlag));
	const needsAuth = !!token && loaded && enabled && lockedFlag;

	const value = useMemo(
		() => ({ available, kind, enabled, setEnabled, locked, needsAuth, covered: covered && !!token && enabled, unlock }),
		[available, kind, enabled, setEnabled, locked, needsAuth, covered, token, unlock],
	);

	return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): AppLockValue {
	const ctx = useContext(AppLockContext);
	if (!ctx) throw new Error("useAppLock must be used within an AppLockProvider");
	return ctx;
}
