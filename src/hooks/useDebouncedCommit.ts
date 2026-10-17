import { useCallback, useEffect, useRef } from "react";

/**
 * Calls `commit` with the latest value once `delay` ms have passed without a newer one, so a
 * stepper tapped five times saves once. Anything still pending is saved when the component
 * unmounts (leaving the screen shouldn't throw a change away).
 */
export function useDebouncedCommit<T>(commit: (value: T) => void | Promise<void>, delay = 700) {
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
	const pending = useRef<{ value: T } | null>(null);
	const latest = useRef(commit);
	latest.current = commit;

	const flush = useCallback(() => {
		clearTimeout(timer.current);
		const next = pending.current;
		pending.current = null;
		if (next) void latest.current(next.value);
	}, []);

	const schedule = useCallback(
		(value: T) => {
			pending.current = { value };
			clearTimeout(timer.current);
			timer.current = setTimeout(flush, delay);
		},
		[flush, delay],
	);

	useEffect(() => flush, [flush]);

	return schedule;
}
