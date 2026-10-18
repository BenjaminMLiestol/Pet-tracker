import { useEffect } from "react";
import { API_BASE_URL } from "../api/client";
import { getToken } from "../api/tokenStorage";
import { clearWidgetData, publishSnapshot } from "../api/widget";
import { buildSnapshot } from "../utils/widgetSnapshot";
import { useAuth } from "./AuthContext";
import { usePet } from "./PetContext";

// Keeps the home-screen widget's copy of the day in step with the app, and removes it (with the
// login it holds) when someone signs out. Renders nothing.
export default function WidgetSync() {
	const { token, user } = useAuth();
	const { petId, name, timezone, feedings, walks, feedingsPerDay, walksPerDay } = usePet();

	useEffect(() => {
		if (!token) {
			clearWidgetData();
			return;
		}
		if (petId == null) return;
		let cancelled = false;
		// The login is read from storage, not from state: it is swapped for a fresh one when the
		// app opens, and the widget's buttons need the current one. (`user` changes then too.)
		getToken().then((current) => {
			if (cancelled || !current) return;
			publishSnapshot(
				buildSnapshot({
					petId,
					name,
					timezone,
					feedGoal: feedingsPerDay,
					walkGoal: walksPerDay,
					feedings: feedings.filter((f) => f.fed).map((f) => f.timestamp),
					walks: walks.filter((w) => w.walked).map((w) => w.timestamp),
					api: API_BASE_URL,
					token: current,
					now: Date.now(),
				}),
			);
		});
		return () => {
			cancelled = true;
		};
	}, [token, user, petId, name, timezone, feedings, walks, feedingsPerDay, walksPerDay]);

	return null;
}
