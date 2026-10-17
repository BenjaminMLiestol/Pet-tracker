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
import { AccessibilityInfo, Pressable, StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useMotion } from "../motion";
import { useTheme } from "../theme";
import { Text } from "./themed";

type Kind = "success" | "error";
// An optional button on the toast (e.g. Undo). Pressing it also dismisses the toast.
type ToastAction = { label: string; onPress: () => void };
type ToastData = { id: number; message: string; kind: Kind; action?: ToastAction };
type ToastApi = { show: (message: string, kind?: Kind, action?: ToastAction) => void };

const ToastContext = createContext<ToastApi | undefined>(undefined);

const SHOW_MS = { success: 2200, error: 3500 };
// Long enough to notice the button and reach for it.
const ACTION_MS = 5000;

// One toast at a time: a new one replaces the current one.
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<ToastData | null>(null);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const nextId = useRef(0);

	const dismiss = useCallback(() => {
		clearTimeout(timer.current);
		setToast(null);
	}, []);

	const show = useCallback((message: string, kind: Kind = "success", action?: ToastAction) => {
		clearTimeout(timer.current);
		nextId.current += 1;
		setToast({ id: nextId.current, message, kind, action });
		AccessibilityInfo.announceForAccessibility(message);
		timer.current = setTimeout(() => setToast(null), action ? ACTION_MS : SHOW_MS[kind]);
	}, []);

	useEffect(() => () => clearTimeout(timer.current), []);

	const api = useMemo(() => ({ show }), [show]);

	return (
		<ToastContext.Provider value={api}>
			{children}
			<ToastHost toast={toast} onPress={dismiss} />
		</ToastContext.Provider>
	);
}

function ToastHost({ toast, onPress }: { toast: ToastData | null; onPress: () => void }) {
	const c = useTheme();
	const m = useMotion();
	const insets = useSafeAreaInsets();

	return (
		// box-none: the empty host never blocks touches on the screen underneath.
		<View
			pointerEvents="box-none"
			style={[styles.host, { top: insets.top + 8 }]}
		>
			{toast && (
				<Animated.View
					key={toast.id}
					entering={m.toastEnter}
					exiting={m.toastExit}
					// Inverse of the page (ink on light, light on dark) so it never blends in.
					style={[styles.toast, { backgroundColor: c.text }]}
				>
					<Pressable
						onPress={onPress}
						style={styles.row}
						accessibilityRole="alert"
						accessibilityLiveRegion="polite"
					>
						<Ionicons
							name={toast.kind === "success" ? "checkmark-circle" : "alert-circle"}
							size={20}
							color={toast.kind === "success" ? c.successOnInverse : c.dangerOnInverse}
						/>
						<Text variant="sub" style={[styles.message, { color: c.bg }]}>
							{toast.message}
						</Text>
					</Pressable>
					{toast.action && (
						<Pressable
							onPress={() => {
								onPress();
								toast.action?.onPress();
							}}
							hitSlop={8}
							style={styles.action}
							accessibilityRole="button"
						>
							<Text variant="sub" style={[styles.actionLabel, { color: c.bg }]}>
								{toast.action.label}
							</Text>
						</Pressable>
					)}
				</Animated.View>
			)}
		</View>
	);
}

export function useToast(): ToastApi {
	const ctx = useContext(ToastContext);
	if (!ctx) throw new Error("useToast must be used within a ToastProvider");
	return ctx;
}

const styles = StyleSheet.create({
	host: { position: "absolute", left: 16, right: 16, alignItems: "center" },
	toast: {
		flexDirection: "row",
		alignItems: "center",
		borderRadius: 999,
		borderCurve: "continuous",
		maxWidth: 480,
		shadowColor: "#000",
		shadowOpacity: 0.18,
		shadowRadius: 16,
		shadowOffset: { width: 0, height: 6 },
		elevation: 6,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 12,
		paddingHorizontal: 18,
		flexShrink: 1,
	},
	action: { paddingVertical: 12, paddingRight: 18, paddingLeft: 4 },
	actionLabel: { fontWeight: "700", textDecorationLine: "underline" },
	message: { fontWeight: "500", flexShrink: 1 },
});
