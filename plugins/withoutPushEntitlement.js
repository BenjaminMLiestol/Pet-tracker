const { withEntitlementsPlist } = require("expo/config-plugins");

// The app only schedules local reminders, so it doesn't need remote push.
// expo-notifications adds the aps-environment entitlement anyway, which free
// (personal team) Apple accounts can't sign. Remove it.
module.exports = function withoutPushEntitlement(config) {
	return withEntitlementsPlist(config, (c) => {
		delete c.modResults["aps-environment"];
		return c;
	});
};
