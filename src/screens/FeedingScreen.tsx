import React from "react";
import { useTranslation } from "react-i18next";
import { usePet } from "../context/PetContext";
import ActivityLogScreen from "../components/ActivityLogScreen";

export default function FeedingScreen() {
	const { t } = useTranslation();
	const { feedings, feedingsToday, feedingsPerDay, addFeeding, updateFeeding, removeFeeding, loadMore, loadingMore } =
		usePet();

	return (
		<ActivityLogScreen
			title={t("feeding_title")}
			todayLabel={t("fed_today_label")}
			logButtonLabel={t("log_feeding")}
			entries={feedings.filter((f) => f.fed)}
			countToday={feedingsToday}
			goal={feedingsPerDay}
			onAdd={addFeeding}
			onUpdate={updateFeeding}
			onRemove={removeFeeding}
			onLoadMore={() => loadMore("feedings")}
			loadingMore={loadingMore.feedings}
		/>
	);
}
