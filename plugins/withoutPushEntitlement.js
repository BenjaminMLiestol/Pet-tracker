const { withEntitlementsPlist } = require("expo/config-plugins");

// expo-notifications adds the aps-environment (remote push) entitlement, which free
// (personal team) Apple accounts can't sign, so it is removed by default and local
// reminders still work. With a paid Apple Developer account, prebuild with ENABLE_PUSH=1
// to keep it and receive co-owner pushes:
//   ENABLE_PUSH=1 npx expo prebuild --platform ios
// (also add your EAS project id under expo.extra.eas.projectId in app.json).
module.exports = function withoutPushEntitlement(config) {
	if (process.env.ENABLE_PUSH === "1") return config;
	return withEntitlementsPlist(config, (c) => {
		delete c.modResults["aps-environment"];
		return c;
	});
};
