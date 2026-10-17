import { useEffect, useState } from "react";
import {
	cubicBezier,
	Easing,
	FadeIn,
	FadeOut,
	Keyframe,
	LinearTransition,
	useReducedMotion,
} from "react-native-reanimated";

// Strong ease-out for UI. Nothing in the app uses ease-in.
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
// Same curve for CSS-style transitions and animations.
export const EASE_OUT_CSS = cubicBezier(0.23, 1, 0.32, 1);

// Layout animations are built once, outside components (the builders are mutable).
const enterFrom = (translateY: number, ms: number) =>
	new Keyframe({
		0: { opacity: 0, transform: [{ translateY }] },
		100: { opacity: 1, transform: [{ translateY: 0 }], easing: EASE_OUT },
	}).duration(ms);

const fade = (ms: number) => FadeIn.duration(ms).easing(EASE_OUT);
const fadeOut = (ms: number) => FadeOut.duration(ms).easing(EASE_OUT);

const FULL = {
	// New history row: drops in from just above its slot.
	rowEnter: enterFrom(-8, 200),
	// Care records are rarer, so they get a touch more time.
	careEnter: enterFrom(-8, 220),
	// New weight tile: settles up from slightly small.
	tileEnter: new Keyframe({
		0: { opacity: 0, transform: [{ scale: 0.96 }] },
		100: { opacity: 1, transform: [{ scale: 1 }], easing: EASE_OUT },
	}).duration(200),
	fadeIn: fade(200),
	exit: fadeOut(160),
	exitShort: fadeOut(150),
	// Toast: drops in from the top edge (250ms) and leaves the way it came (180ms).
	toastEnter: enterFrom(-12, 250),
	toastExit: new Keyframe({
		0: { opacity: 1, transform: [{ translateY: 0 }] },
		100: { opacity: 0, transform: [{ translateY: -8 }], easing: EASE_OUT },
	}).duration(180),
	// Neighbouring content glides into its new position.
	layout: LinearTransition.duration(200).easing(EASE_OUT),
};

// Reduced motion keeps the opacity changes that explain a state change, and drops
// translation, scale and sliding layout.
const REDUCED: typeof FULL = {
	rowEnter: fade(200) as never,
	careEnter: fade(220) as never,
	tileEnter: fade(200) as never,
	fadeIn: fade(200),
	exit: fadeOut(160),
	exitShort: fadeOut(150),
	toastEnter: fade(250) as never,
	toastExit: fadeOut(180) as never,
	layout: undefined as never,
};

export function useMotion() {
	return useReducedMotion() ? REDUCED : FULL;
}

const NONE = new Set<number>();
const MAX_FRESH = 3;

// Ids that were just added at the top of a list. Only these may play an entrance:
// rows that merely scroll back into view, bulk loads and load-more pages must not.
// `ids` has to keep the same identity until the data changes (memoize it).
export function useFreshIds(ids: number[]): Set<number> {
	const [prev, setPrev] = useState(ids);
	const [fresh, setFresh] = useState<Set<number>>(NONE);

	// Adjust state while rendering (React's documented pattern) so the new rows
	// mount in this very commit already knowing they are fresh.
	if (ids !== prev) {
		setPrev(ids);
		setFresh(freshPrefix(prev, ids));
	}

	// The flag only matters for the mount; clear it so a remount can't replay it.
	useEffect(() => {
		if (fresh === NONE) return;
		const timer = setTimeout(() => setFresh(NONE), 400);
		return () => clearTimeout(timer);
	}, [fresh]);

	return fresh;
}

function freshPrefix(prev: number[], next: number[]): Set<number> {
	if (prev.length === 0) return NONE; // first load, not an insertion
	const known = new Set(prev);
	const added: number[] = [];
	for (const id of next) {
		if (known.has(id)) break;
		added.push(id);
		if (added.length > MAX_FRESH) return NONE; // a bulk replace, don't animate
	}
	return added.length > 0 ? new Set(added) : NONE;
}
