import React from "react";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import ActivityLogScreen from "../components/ActivityLogScreen";

export default function WalkScreen() {
	const { t } = useTranslation();
	const { walks, walksToday, addWalk, updateWalk, removeWalk, loadMore, loadingMore } =
		usePet();

	return (
		<ActivityLogScreen
			title={t("walk_title")}
			todayLabel={t("walked_today_label")}
			logButtonLabel={t("log_walk")}
			entries={walks.filter((w) => w.walked)}
			countToday={walksToday}
			onAdd={addWalk}
			onUpdate={updateWalk}
			onRemove={removeWalk}
			onLoadMore={() => loadMore("walks")}
			loadingMore={loadingMore.walks}
		/>
	);
}
