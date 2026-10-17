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
type ToastApi = { show: (message: string, kind?: Kind) => void };

const ToastContext = createContext<ToastApi | undefined>(undefined);

const SHOW_MS = { success: 2200, error: 3500 };

// One toast at a time: a new one replaces the current one.
export function ToastProvider({ children }: { children: ReactNode }) {
	const [toast, setToast] = useState<{ id: number; message: string; kind: Kind } | null>(
		null,
	);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const nextId = useRef(0);

	const dismiss = useCallback(() => {
		clearTimeout(timer.current);
		setToast(null);
	}, []);

	const show = useCallback((message: string, kind: Kind = "success") => {
		clearTimeout(timer.current);
		nextId.current += 1;
		setToast({ id: nextId.current, message, kind });
		AccessibilityInfo.announceForAccessibility(message);
		timer.current = setTimeout(() => setToast(null), SHOW_MS[kind]);
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

function ToastHost({
	toast,
	onPress,
}: {
	toast: { id: number; message: string; kind: Kind } | null;
	onPress: () => void;
}) {
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
					style={[
						styles.toast,
						{ backgroundColor: c.surface, borderColor: c.border },
					]}
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
							color={toast.kind === "success" ? c.success : c.danger}
						/>
						<Text style={styles.message}>{toast.message}</Text>
					</Pressable>
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
		borderWidth: 1,
		borderRadius: 14,
		maxWidth: 480,
		shadowColor: "#000",
		shadowOpacity: 0.12,
		shadowRadius: 12,
		shadowOffset: { width: 0, height: 4 },
		elevation: 4,
	},
	row: {
		flexDirection: "row",
		alignItems: "center",
		gap: 10,
		paddingVertical: 12,
		paddingHorizontal: 14,
	},
	message: { fontSize: 15, flexShrink: 1 },
});
